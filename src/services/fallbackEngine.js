'use strict';

/**
 * src/services/fallbackEngine.js
 * RCS/SMS orchestration. Reads fallback_order from MoEngage payload.
 *
 * Decision tree:
 *   fallback_order includes "rcs" → call SPARC sendRCS()
 *     ├── SUCCESS → fire RCS_SENT callback, wait for DLR
 *     └── FAILURE → fire RCS_DELIVERY_FAILED callback
 *           └── fallback_order includes "sms" AND sms{} present?
 *                 ├── YES → sendSMS() → fire SMS_SENT or SMS_DELIVERY_FAILED
 *                 └── NO → stop
 *   does NOT include "rcs" but includes "sms" → SMS only path
 */

const sparcClient = require('./sparcClient');
const callbackDispatcher = require('./callbackDispatcher');
const { mapMessageToSparc } = require('../mappers/inboundMapper');
// mapDlrEvent is for SPARC-sourced DLR callbacks only.
// For immediate confirmations (sent/failed) we build the MoEngage payload directly.
const { FAILED_STATUSES } = require('../mappers/dlrMapper');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Process a single message through the fallback engine.
 *
 * @param {object} message - Single message from MoEngage payload
 * @param {object} client - Client row from DB
 */
async function processMessage(message, client) {
  const callback_data = message.callback_data;
  const destination = message.destination;
  const rcs = message.rcs;
  const sms = message.sms;

  const rawOrder = message.fallback_order || [CHANNELS.RCS];
  const fallbackOrder = rawOrder.map(channel => String(channel).toLowerCase());

  // Temp override: always use .env MOENGAGE_DLR_URL for mock testing
  // so we skip the webhook.site URL configured in the local database.
  const dlrUrl = env.MOENGAGE_DLR_URL; // env.MOENGAGE_DLR_URL;

  const includesRcs = fallbackOrder.includes(CHANNELS.RCS);
  const includesSms = fallbackOrder.includes(CHANNELS.SMS);

  if (includesRcs) {
    // --- Try RCS first ---
    try {
      const sparcPayload = mapMessageToSparc(message, env.SPARC_WEBHOOK_URL);
      const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);

      // Log raw SPARC response so we can see exactly what came back
      logger.info('Raw SPARC RCS response', {
        callbackData: callback_data,
        sparcResponse: JSON.stringify(sparcResponse),
      });

      // SPARC returns EITHER:
      //   Object: { status_code, submission_id, success:[], failed:[{ seq_id, error }] }
      //   Array:  [{ status: "SUCCESS"|"FAILED", callback_data }]
      let submissionId = null;

      if (Array.isArray(sparcResponse)) {
        // Array format — check if any item is a failure
        const failedItem = sparcResponse.find(item =>
          item.status && item.status.toUpperCase() !== 'SUCCESS'
        );
        if (failedItem) {
          throw new Error(`SPARC rejected message: ${failedItem.status} — ${failedItem.error || failedItem.description || 'unknown reason'}`);
        }
        // Success — use callback_data as submission reference
        submissionId = sparcResponse[0]?.callback_data || null;
      } else if (sparcResponse && typeof sparcResponse === 'object') {
        // Object format — check failed array
        if (Array.isArray(sparcResponse.failed) && sparcResponse.failed.length > 0) {
          const nativeError = sparcResponse.failed[0].error || 'Native SPARC validation error';
          throw new Error(`SPARC API rejected message instantly: ${nativeError}`);
        }
        submissionId = sparcResponse.submission_id || null;
      }

      // Update message status to RCS_SENT
      const messageId = sparcPayload.messages[0].message_id;

      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, submissionId || messageId);

      // Fire RCS_SENT callback to MoEngage after 5 seconds
      const sentPayload = buildMoeStatusPayload(MESSAGE_STATUSES.RCS_SENT, callback_data);

      setTimeout(async () => {
        try {
          await callbackDispatcher.dispatchStatus(dlrUrl, sentPayload, callback_data);
          const timestamp = Math.floor(Date.now() / 1000);
          console.log(`rcs sent | callback_data: ${callback_data} | timestamp: ${timestamp}`);
          logger.info(`rcs sent | callback_data: ${callback_data} | timestamp: ${timestamp}`);
        } catch (err) {
          logger.error('Delayed RCS_SENT callback failed', { callbackData: callback_data, error: err.message });
        }
      }, 5000);

      logger.info('RCS message submission successful, SENT callback queued (5s delay)', {
        callbackData: callback_data,
        messageId,
        submissionId
      });

      return; // Success — DLR events will arrive later via /sparc/dlr
    } catch (rcsError) {
      logger.warn('RCS send failed, checking fallback', {
        callbackData: callback_data,
        error: rcsError.message,
        hasSmsInFallback: includesSms,
      });

      // Update status to RCS_SENT_FAILED
      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED);

      // Fire RCS_DELIVERY_FAILED callback  
      const failedPayload = buildMoeStatusPayload(
        MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
        callback_data,
        rcsError.message
      );
      await callbackDispatcher.dispatchStatus(dlrUrl, failedPayload, callback_data);

      // --- Attempt SMS fallback if configured ---
      if (includesSms && sms) {
        logger.info('Attempting SMS fallback after RCS failure', { callbackData: callback_data });
        // assistantId: prefer rcs.bot_id from the message, fall back to client's stored assistant id
        const assistantId = message.rcs?.bot_id || client.rcs_assistant_id || null;
        await attemptSms(message, client, dlrUrl, assistantId);
      }
      return; // RCS path handled (success or failure) — stop here
    }
  }

  // --- SMS only path (no RCS in fallback_order: ["SMS"]) ---
  if (includesSms && sms) {
    logger.info('SMS-only path triggered', { callbackData: callback_data });
    const assistantId = message.rcs?.bot_id || client.rcs_assistant_id || null;
    await attemptSms(message, client, dlrUrl, assistantId);
    return;
  }

  logger.warn('No valid channel in fallback_order (or SMS is disabled)', {
    callbackData: callback_data,
    fallbackOrder,
  });
}

/**
 * Attempt to send an SMS message via SPARC.
 * @param {object} message - MoEngage message
 * @param {object} client - Client row
 * @param {string} dlrUrl - MoEngage DLR callback URL
 * @param {string|null} [assistantId] - SPARC assistant/bot ID (required by SPARC SMS API)
 */
async function attemptSms(message, client, dlrUrl, assistantId = null) {
  const { callback_data, destination, sms } = message;

  // Resolve assistantId: caller may pass it, else fall back to client record
  const resolvedAssistantId = assistantId || client.rcs_assistant_id || null;

  if (!resolvedAssistantId) {
    logger.warn('SMS fallback attempted with no assistantId — SPARC may reject', { callback_data });
  }

  try {
    // --- URL Tracking Upgradation ---
    const mappings = await trackLinkRepo.getMappingsByClient(client.id);
    const { modifiedText, trackLinkIds, hasUrl } = processMessageLinks(sms.message || sms.text, mappings);

    let smsResponse;
    if (hasUrl) {
      smsResponse = await sparcClient.sendLinkSMS(
        client,
        { ...sms, message: modifiedText },
        destination,
        trackLinkIds
      );
    } else {
      smsResponse = await sparcClient.sendSMS(
        client,
        sms,
        destination,
        resolvedAssistantId
      );
    }

    logger.info('SMS fallback sent successfully', {
      callbackData: callback_data,
      transactionId: smsResponse?.transactionId,
      state: smsResponse?.state,
    });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT);

    // Persist the SPARC SMS transactionId so the SMS DLR webhook can correlate back
    if (smsResponse?.transactionId) {
      await messageRepo.updateSparcTransactionId(callback_data, smsResponse.transactionId).catch(err => {
        logger.warn('Failed to store SMS transactionId — SMS_DELIVERED DLR may not dispatch', {
          callbackData: callback_data,
          transactionId: smsResponse.transactionId,
          error: err.message,
        });
      });
    }

    const smsPayload = buildMoeStatusPayload(MESSAGE_STATUSES.SMS_SENT, callback_data);

    setTimeout(async () => {
      try {
        await callbackDispatcher.dispatchStatus(dlrUrl, smsPayload, callback_data);
        const timestamp = Math.floor(Date.now() / 1000);
        console.log(`sms sent | callback_data: ${callback_data} | timestamp: ${timestamp}`);
        logger.info(`sms sent | callback_data: ${callback_data} | timestamp: ${timestamp}`);
      } catch (err) {
        logger.error('Delayed SMS_SENT callback failed', { callbackData: callback_data, error: err.message });
      }
    }, 5000);

  } catch (smsError) {
    logger.error('SMS fallback also failed', {
      callbackData: callback_data,
      error: smsError.message,
    });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT_FAILED);

    const smsFailPayload = buildMoeStatusPayload(
      MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
      callback_data,
      'Mobile number is incorrect'
    );
    await callbackDispatcher.dispatchStatus(dlrUrl, smsFailPayload, callback_data);
  }
}

/**
 * Build a MoEngage-format status callback payload directly.
 * Used for immediate "sent" / "failed" confirmations — NOT for SPARC DLR events.
 *
 * @param {string} moeStatus  - One of MESSAGE_STATUSES
 * @param {string} callbackData
 * @param {string} [errorMessage]  - Required for failed statuses
 * @returns {{ statuses: Array }}
 */
function buildMoeStatusPayload(moeStatus, callbackData, errorMessage) {
  const item = {
    status: moeStatus,
    callback_data: callbackData,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  if (errorMessage && FAILED_STATUSES.has(moeStatus)) {
    item.error_message = errorMessage;
  }
  return { statuses: [item] };
}

module.exports = { processMessage, attemptSms, buildMoeStatusPayload };

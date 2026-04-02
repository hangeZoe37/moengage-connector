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

      // Check if SPARC API returned native failure inside 200 OK
      if (sparcResponse && Array.isArray(sparcResponse.failed) && sparcResponse.failed.length > 0) {
        const nativeError = sparcResponse.failed[0].error || 'Native SPARC validation error';
        throw new Error(`SPARC API rejected message instantly: ${nativeError}`);
      }

      // Update message status to RCS_SENT
      const messageId = sparcPayload.messages[0].message_id;
      const submissionId = sparcResponse.submission_id; // Capture API batch tracker

      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, submissionId || messageId);

      // Fire RCS_SENT callback to MoEngage immediately
      // DEACTIVATED for manual testing per user request to avoid "hardcoded" confusion
      // const sentPayload = buildMoeStatusPayload(MESSAGE_STATUSES.RCS_SENT, callback_data);
      // await callbackDispatcher.dispatchStatus(dlrUrl, sentPayload, callback_data);

      logger.info('RCS message sent successfully, waiting for DLR', {
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

      // --- Attempt SMS fallback ---
      // if (includesSms && sms) {
      //   await attemptSms(message, client, dlrUrl);
      // }
      return;
    }
  }

  // --- SMS only path (no RCS in fallback_order) ---
  // if (includesSms && sms) {
  //   await attemptSms(message, client, dlrUrl);
  //   return;
  // }

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
 */
async function attemptSms(message, client, dlrUrl) {
  // SMS Logic disabled temporarily as per requirement
  /*
  const { callback_data, destination, rcs, sms } = message;

  try {
    await sparcClient.sendSMS(client, sms, destination, rcs.bot_id);

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT);

    const smsPayload = buildMoeStatusPayload(MESSAGE_STATUSES.SMS_SENT, callback_data);
    await callbackDispatcher.dispatchStatus(dlrUrl, smsPayload, callback_data);

    logger.info('SMS fallback sent successfully', { callbackData: callback_data });
  } catch (smsError) {
    logger.error('SMS fallback failed', {
      callbackData: callback_data,
      error: smsError.message,
    });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT_FAILED);

    const smsFailPayload = buildMoeStatusPayload(
      MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
      callback_data,
      smsError.message
    );
    await callbackDispatcher.dispatchStatus(dlrUrl, smsFailPayload, callback_data);
  }
  */
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

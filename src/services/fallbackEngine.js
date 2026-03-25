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
const { mapDlrEvent } = require('../mappers/dlrMapper');
const messageRepo = require('../repositories/messageRepo');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Process a single message through the fallback engine.
 *
 * @param {object} message - Single message from MoEngage payload
 * @param {object} workspace - Workspace row from DB
 */
async function processMessage(message, workspace) {
  const { callback_data, destination, rcs, sms } = message;
  const fallbackOrder = message.fallback_order || [CHANNELS.RCS];
  const dlrUrl = workspace.moe_dlr_url || env.MOENGAGE_DLR_URL;

  const includesRcs = fallbackOrder.includes(CHANNELS.RCS);
  const includesSms = fallbackOrder.includes(CHANNELS.SMS);

  if (includesRcs) {
    // --- Try RCS first ---
    try {
      const sparcPayload = mapMessageToSparc(message, env.SPARC_DLR_WEBHOOK_URL);
      const sparcResponse = await sparcClient.sendRCS(workspace, sparcPayload);

      // Update message status to RCS_SENT
      const messageId = sparcPayload.messages[0].message_id;
      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, messageId);

      // Fire RCS_SENT callback to MoEngage
      const sentPayload = mapDlrEvent({
        status: 'rcs_sent',
        seq_id: callback_data,
        timestamp: Math.floor(Date.now() / 1000),
      });
      await callbackDispatcher.dispatchStatus(dlrUrl, sentPayload, callback_data);

      logger.info('RCS message sent successfully, waiting for DLR', {
        callbackData: callback_data,
        messageId,
      });

      return; // Success — DLR events will arrive later via /sparc/dlr
    } catch (rcsError) {
      logger.warn('RCS send failed, checking fallback', {
        callbackData: callback_data,
        error: rcsError.message,
        hasSmsInFallback: includesSms,
      });

      // Update status to RCS_FAILED
      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_FAILED);

      // Fire RCS_DELIVERY_FAILED callback
      const failedPayload = mapDlrEvent({
        status: 'rcs_failed',
        seq_id: callback_data,
        timestamp: Math.floor(Date.now() / 1000),
        error_message: rcsError.message,
      });
      await callbackDispatcher.dispatchStatus(dlrUrl, failedPayload, callback_data);

      // --- Attempt SMS fallback ---
      if (includesSms && sms) {
        await attemptSms(message, workspace, dlrUrl);
      }
      return;
    }
  }

  // --- SMS only path (no RCS in fallback_order) ---
  if (includesSms && sms) {
    await attemptSms(message, workspace, dlrUrl);
    return;
  }

  logger.warn('No valid channel in fallback_order', {
    callbackData: callback_data,
    fallbackOrder,
  });
}

/**
 * Attempt to send an SMS message via SPARC.
 * @param {object} message - MoEngage message
 * @param {object} workspace - Workspace row
 * @param {string} dlrUrl - MoEngage DLR callback URL
 */
async function attemptSms(message, workspace, dlrUrl) {
  const { callback_data, destination, rcs, sms } = message;

  try {
    await sparcClient.sendSMS(workspace, sms, destination, rcs.bot_id);

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT);

    const smsPayload = mapDlrEvent({
      status: 'sms_sent',
      seq_id: callback_data,
      timestamp: Math.floor(Date.now() / 1000),
    });
    await callbackDispatcher.dispatchStatus(dlrUrl, smsPayload, callback_data);

    logger.info('SMS fallback sent successfully', { callbackData: callback_data });
  } catch (smsError) {
    logger.error('SMS fallback failed', {
      callbackData: callback_data,
      error: smsError.message,
    });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_FAILED);

    const smsFailPayload = mapDlrEvent({
      status: 'sms_failed',
      seq_id: callback_data,
      timestamp: Math.floor(Date.now() / 1000),
      error_message: smsError.message,
    });
    await callbackDispatcher.dispatchStatus(dlrUrl, smsFailPayload, callback_data);
  }
}

module.exports = { processMessage, attemptSms };

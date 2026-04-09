'use strict';

/**
 * src/controllers/dlrController.js
 * Maps DLR event, saves to DB, dispatches callback.
 * ORCHESTRATION ONLY. No SQL. No HTTP.
 */

const { mapDlrEvent, translateStatus } = require('../mappers/dlrMapper');
const dlrRepo             = require('../repositories/dlrRepo');
const messageRepo         = require('../repositories/messageRepo');
const clientRepo          = require('../repositories/clientRepo');
const callbackDispatcher  = require('../services/callbackDispatcher');
const { attemptSms }      = require('../services/fallbackEngine');
const { notifyUpdate }    = require('../services/dashboardService');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env }             = require('../config/env');
const logger              = require('../config/logger');

/** RCS statuses that should trigger SMS fallback */
const RCS_FAILED_STATUSES = new Set([
  MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  MESSAGE_STATUSES.RCS_SENT_FAILED,
]);

/**
 * Handle a DLR event received from SPARC.
 * @param {object} sparcEvent - Raw DLR event payload from SPARC
 */
async function handleDlrEvent(sparcEvent) {
  const eventRoot  = sparcEvent.eventData || sparcEvent;
  const entity     = eventRoot.entity || {};

  const callbackData = sparcEvent.seqId || sparcEvent.seq_id || eventRoot.seqId;
  const sparcStatus  = (entity.eventType || '').toUpperCase();
  const moeStatus    = translateStatus(sparcStatus);

  logger.info('Processing DLR event', { callbackData, sparcStatus, moeStatus });

  // Save DLR event to DB
  let eventTimestamp = null;
  if (entity.sendTime) {
    const parsed = Math.floor(new Date(entity.sendTime).getTime() / 1000);
    if (!isNaN(parsed)) eventTimestamp = parsed;
  }

  const dlrResult = await dlrRepo.create({
    callback_data:   callbackData,
    sparc_status:    sparcStatus,
    moe_status:      moeStatus,
    error_message:   entity.error?.message || null,
    event_timestamp: eventTimestamp,
  });

  // Look up the original message to find the client_id
  const message = await messageRepo.findByCallbackData(callbackData);

  if (!message) {
    logger.warn('DLR event received for unknown callback_data', { callbackData });
    return;
  }

  // Update message status
  await messageRepo.updateStatus(callbackData, moeStatus);

  // Map to MoEngage format and dispatch
  const dlrUrl    = env.MOENGAGE_DLR_URL;
  const moePayload = mapDlrEvent(sparcEvent);
  const dispatched = await callbackDispatcher.dispatchStatus(dlrUrl, moePayload, callbackData);

  if (dispatched) {
    await dlrRepo.markDispatched(dlrResult.insertId);
  }

  // ── SMS Fallback on RCS failure ───────────────────────────────────────────
  if (RCS_FAILED_STATUSES.has(moeStatus)) {
    try {
      const rawPayload = typeof message.raw_payload === 'string'
        ? JSON.parse(message.raw_payload)
        : message.raw_payload;

      const fallbackOrder = (rawPayload?.fallback_order || [])
        .map(c => String(c).toLowerCase());
      const smsBlock = rawPayload?.sms;

      if (fallbackOrder.includes(CHANNELS.SMS) && smsBlock) {
        logger.info('RCS DLR failure — triggering SMS fallback', { callbackData, moeStatus });

        const client = await clientRepo.findById(message.client_id);
        if (client) {
          const fullMessage  = { ...rawPayload, callback_data: callbackData };
          const assistantId  = rawPayload?.rcs?.bot_id || client.rcs_assistant_id || null;
          await attemptSms(fullMessage, client, dlrUrl, assistantId);
        } else {
          logger.warn('Could not find client for SMS fallback', {
            callbackData,
            clientId: message.client_id,
          });
        }
      } else {
        logger.info('No SMS fallback configured for this message', {
          callbackData,
          fallbackOrder,
          hasSmsBlock: !!smsBlock,
        });
      }
    } catch (fallbackError) {
      logger.error('Error during DLR-triggered SMS fallback', {
        callbackData,
        error: fallbackError.message,
      });
    }
  }

  // Notify dashboard of status update
  notifyUpdate('message', {
    ...message,
    status:     moeStatus,
    updated_at: new Date().toISOString(),
  });
}

module.exports = { handleDlrEvent };

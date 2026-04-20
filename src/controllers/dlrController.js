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
const clevertapService    = require('../services/clevertapService');
const { mapDlrToCleverTap } = require('../mappers/clevertapMapper');
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

  let callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;
  const sparcStatus  = (entity.eventType || eventRoot.status || sparcEvent.status || '').toUpperCase();
  const internalStatus = translateStatus(sparcStatus);

  logger.info('Processing DLR event', { callbackData, sparcStatus, internalStatus });

  // Save DLR event to DB
  let eventTimestamp = null;
  if (entity.sendTime) {
    const parsed = Math.floor(new Date(entity.sendTime).getTime() / 1000);
    if (!isNaN(parsed)) eventTimestamp = parsed;
  }

  // Look up the original message FIRST so we can pass connector_type to the DLR repo
  let message = await messageRepo.findByCallbackData(callbackData);

  // Multi-Prefix Resilience: Try finding with 'moe_' or 'cl_' if direct match fails (handles manual simulations)
  if (!message && callbackData) {
    if (!callbackData.startsWith('moe_') && !callbackData.startsWith('cl_')) {
      const moeId = `moe_${callbackData}`;
      const clId = `cl_${callbackData}`;
      
      const moeMsg = await messageRepo.findByCallbackData(moeId);
      if (moeMsg) {
        message = moeMsg;
        callbackData = moeId; // Update local variable for consistent downstream logging
      } else {
        const clMsg = await messageRepo.findByCallbackData(clId);
        if (clMsg) {
          message = clMsg;
          callbackData = clId;
        }
      }
    }
  }

  if (!message) {
    logger.warn('DLR event received for unknown callback_data', { callbackData });

    
    // Attempt bifurcation based on prefix if message not found
    let fallbackConnector = 'MOENGAGE';
    if (callbackData && String(callbackData).startsWith('cl_')) {
      fallbackConnector = 'CLEVERTAP';
    }

    // Still record the DLR in the shared table even if parent message not found
    await dlrRepo.create({
      callback_data:   callbackData,
      sparc_status:    sparcStatus,
      moe_status:      internalStatus,
      error_message:   entity.error?.message || null,
      event_timestamp: eventTimestamp,
    }, fallbackConnector);
    return;
  }


  const connectorType = message.connector_type || 'MOENGAGE';

  // Insert DLR into shared table AND the appropriate connector-specific table
  const dlrResult = await dlrRepo.create({
    callback_data:   callbackData,
    sparc_status:    sparcStatus,
    moe_status:      internalStatus,
    error_message:   entity.error?.message || null,
    event_timestamp: eventTimestamp,
  }, connectorType);

  // Update message status in shared table AND connector-specific table
  await messageRepo.updateStatusInBoth(callbackData, internalStatus, connectorType);

  // 1. Determine DLR URL and payload format
  const callbackUrl = env.DEFAULT_CONNECTOR_URL;
  let dispatched = false;

  if (connectorType === 'CLEVERTAP' && message.callback_url) {
    logger.info('Forwarding DLR to CleverTap', { callbackData, url: message.callback_url });
    const ctPayload = mapDlrToCleverTap(callbackData, internalStatus, entity.error);
    if (ctPayload) {
      dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callbackData, 'CLEVERTAP_STATUS');
    } else {
      // If null, it's a non-final status we don't send to CT
      dispatched = true;
    }
  } else {
    // Default MoEngage logic
    const moePayload = mapDlrEvent(sparcEvent);
    dispatched = await callbackDispatcher.dispatchStatus(callbackUrl, moePayload, callbackData);
  }

  if (dispatched) {
    // markDispatched now updates both shared and connector-specific tables
    await dlrRepo.markDispatched(dlrResult.insertId, connectorType);
  }

  // ── SMS Fallback on RCS failure ───────────────────────────────────────────
  if (RCS_FAILED_STATUSES.has(internalStatus)) {
    try {
      const rawPayload = typeof message.raw_payload === 'string'
        ? JSON.parse(message.raw_payload)
        : message.raw_payload;

      const fallbackOrder = (rawPayload?.fallback_order || [])
        .map(c => String(c).toLowerCase());
      const smsBlock = rawPayload?.sms;

      if (fallbackOrder.includes(CHANNELS.SMS) && smsBlock) {
        logger.info('RCS DLR failure — triggering SMS fallback', { callbackData, internalStatus });

        const client = await clientRepo.findById(message.client_id);
        if (client) {
          if (connectorType === 'CLEVERTAP') {
             // Use cleverTapService for fallback
             await clevertapService.processMessage(rawPayload, client);
          } else {
             const fullMessage  = { ...rawPayload, callback_data: callbackData };
             const assistantId  = rawPayload?.rcs?.bot_id || client.rcs_assistant_id || null;
             await attemptSms(fullMessage, client, callbackUrl, assistantId);
          }
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
    status:     internalStatus,
    updated_at: new Date().toISOString(),
  });
}

module.exports = { handleDlrEvent };

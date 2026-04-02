'use strict';

/**
 * src/controllers/dlrController.js
 * Maps DLR event, saves to DB, dispatches callback.
 * ORCHESTRATION ONLY. No SQL. No HTTP.
 */

const { mapDlrEvent, translateStatus } = require('../mappers/dlrMapper');
const dlrRepo = require('../repositories/dlrRepo');
const messageRepo = require('../repositories/messageRepo');
// ;
const callbackDispatcher = require('../services/callbackDispatcher');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Handle a DLR event received from SPARC.
 *
 * @param {object} sparcEvent - Raw DLR event payload from SPARC
 */
async function handleDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  const callbackData = sparcEvent.seqId || sparcEvent.seq_id || eventRoot.seqId;
  const sparcStatus = (entity.eventType || '').toUpperCase();
  const moeStatus = translateStatus(sparcStatus);

  logger.info('Processing DLR event', {
    callbackData,
    sparcStatus,
    moeStatus,
  });

  // Save DLR event to DB
  let eventTimestamp = null;
  if (entity.sendTime) {
    const parsed = Math.floor(new Date(entity.sendTime).getTime() / 1000);
    if (!isNaN(parsed)) eventTimestamp = parsed;
  }

  const dlrResult = await dlrRepo.create({
    callback_data: callbackData,
    sparc_status: sparcStatus,
    moe_status: moeStatus,
    error_message: entity.error?.message || null,
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

  // Get client info if needed (DLR URL is now global)
  
  
  // Temp override: always use .env MOENGAGE_DLR_URL for mock testing
  const dlrUrl = env.MOENGAGE_DLR_URL;

  // Map to MoEngage format and dispatch
  const moePayload = mapDlrEvent(sparcEvent);
  const dispatched = await callbackDispatcher.dispatchStatus(dlrUrl, moePayload, callbackData);

  if (dispatched) {
    await dlrRepo.markDispatched(dlrResult.insertId);
  }

  // Notify dashboard of status update
  const { notifyUpdate } = require('../services/dashboardService');
  notifyUpdate('message', {
    ...message,
    status: moeStatus,
    updated_at: new Date().toISOString()
  });
}

module.exports = { handleDlrEvent };

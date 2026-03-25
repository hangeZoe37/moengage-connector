'use strict';

/**
 * src/controllers/dlrController.js
 * Maps DLR event, saves to DB, dispatches callback.
 * ORCHESTRATION ONLY. No SQL. No HTTP.
 */

const { mapDlrEvent, translateStatus } = require('../mappers/dlrMapper');
const dlrRepo = require('../repositories/dlrRepo');
const messageRepo = require('../repositories/messageRepo');
const workspaceRepo = require('../repositories/workspaceRepo');
const callbackDispatcher = require('../services/callbackDispatcher');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Handle a DLR event received from SPARC.
 *
 * @param {object} sparcEvent - Raw DLR event payload from SPARC
 */
async function handleDlrEvent(sparcEvent) {
  // TODO: Confirm exact field name with SPARC team (seq_id vs message_id vs ref_id)
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;
  const sparcStatus = sparcEvent.status;
  const moeStatus = translateStatus(sparcStatus);

  logger.info('Processing DLR event', {
    callbackData,
    sparcStatus,
    moeStatus,
  });

  // Save DLR event to DB
  const dlrResult = await dlrRepo.create({
    callback_data: callbackData,
    sparc_status: sparcStatus,
    moe_status: moeStatus,
    error_message: sparcEvent.error_message || null,
    event_timestamp: sparcEvent.timestamp || null,
  });

  // Look up the original message to find the workspace
  const message = await messageRepo.findByCallbackData(callbackData);

  if (!message) {
    logger.warn('DLR event received for unknown callback_data', { callbackData });
    return;
  }

  // Update message status
  await messageRepo.updateStatus(callbackData, moeStatus);

  // Get workspace to find the DLR URL
  const workspace = await workspaceRepo.findById(message.workspace_id);
  const dlrUrl = workspace?.moe_dlr_url || env.MOENGAGE_DLR_URL;

  // Map to MoEngage format and dispatch
  const moePayload = mapDlrEvent(sparcEvent);
  const dispatched = await callbackDispatcher.dispatchStatus(dlrUrl, moePayload, callbackData);

  if (dispatched) {
    await dlrRepo.markDispatched(dlrResult.insertId);
  }
}

module.exports = { handleDlrEvent };

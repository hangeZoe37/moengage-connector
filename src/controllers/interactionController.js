'use strict';

/**
 * src/controllers/interactionController.js
 * Saves click event, dispatches SUGGESTION_CLICKED.
 * ORCHESTRATION ONLY. No SQL. No HTTP.
 */

const { mapInteractionEvent } = require('../mappers/interactionMapper');
const suggestionRepo = require('../repositories/suggestionRepo');
const messageRepo = require('../repositories/messageRepo');
// ;
const callbackDispatcher = require('../services/callbackDispatcher');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Handle a suggestion/postback interaction from SPARC.
 *
 * @param {object} sparcEvent - Raw interaction event from SPARC
 */
async function handleInteraction(sparcEvent) {
  // TODO: Confirm exact field names with SPARC team
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;

  logger.info('Processing interaction event', {
    callbackData,
    text: sparcEvent.suggestion_text || sparcEvent.text,
  });

  // Normalize ISO 8601 string to Unix timestamp (integer)
  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (sparcEvent.timestamp) {
    const parsed = Math.floor(new Date(sparcEvent.timestamp).getTime() / 1000);
    if (!isNaN(parsed)) timestampSeconds = parsed;
  }

  // Save suggestion event to DB
  const result = await suggestionRepo.create({
    callback_data: callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    postback_data: sparcEvent.postback_data || sparcEvent.postback,
    event_timestamp: timestampSeconds,
  });

  // Look up original message for client info
  const message = await messageRepo.findByCallbackData(callbackData);

  if (!message) {
    logger.warn('Interaction event received for unknown callback_data', { callbackData });
    return;
  }

  // Get workspace DLR URL
  
  const dlrUrl = env.MOENGAGE_DLR_URL;

  // Map to MoEngage format and dispatch
  const moePayload = mapInteractionEvent(sparcEvent);
  const dispatched = await callbackDispatcher.dispatchSuggestion(dlrUrl, moePayload, callbackData);

  if (dispatched) {
    await suggestionRepo.markDispatched(result.insertId);
  }

  // Notify dashboard of interaction
  const { notifyUpdate } = require('../services/dashboardService');
  notifyUpdate('suggestion', {
    callback_data: callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    client_name: message.client_name || 'Unknown',
    timestamp: new Date().toISOString()
  });
}

module.exports = { handleInteraction };

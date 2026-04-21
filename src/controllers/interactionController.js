'use strict';

/**
 * src/controllers/interactionController.js
 * Saves click event, dispatches SUGGESTION_CLICKED.
 * ORCHESTRATION ONLY. No SQL. No HTTP.
 */

const { mapInteractionEvent } = require('../mappers/interactionMapper');
const suggestionRepo          = require('../repositories/suggestionRepo');
const messageRepo             = require('../repositories/messageRepo');
const callbackDispatcher      = require('../services/callbackDispatcher');
const { notifyUpdate }        = require('../services/dashboardService');
const { env }                 = require('../config/env');
const logger                  = require('../config/logger');

/**
 * Handle a suggestion/postback interaction from SPARC.
 * @param {object} sparcEvent - Raw interaction event from SPARC
 */
async function handleInteraction(sparcEvent) {
  // Field names confirmed with SPARC API docs — seq_id is primary, others are fallbacks
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

  // 1. Direct Match
  let message = await messageRepo.findByCallbackData(callbackData);

  // 2. Multi-Prefix Resilience: Handle mismatches (stripping or swaping prefixes)
  if (!message && callbackData) {
    const prefixes = ['moe_', 'cl_', 'web_'];
    let unprefixedId = callbackData;
    let foundPrefix = prefixes.find(p => callbackData.startsWith(p));
    
    if (foundPrefix) {
      unprefixedId = callbackData.replace(foundPrefix, '');
      message = await messageRepo.findByCallbackData(unprefixedId);
    }
    
    if (!message) {
      for (const p of prefixes) {
        if (foundPrefix && p === foundPrefix) continue;
        const morphedId = `${p}${unprefixedId}`;
        const morphedMsg = await messageRepo.findByCallbackData(morphedId);
        if (morphedMsg) {
          message = morphedMsg;
          callbackData = morphedId;
          break;
        }
      }
    } else if (foundPrefix) {
      callbackData = unprefixedId;
    }
  }

  if (!message) {
    logger.warn('Interaction event received for unknown callback_data', { callbackData });
    // Keep it in the shared DB just in case, default to MoEngage
    await suggestionRepo.create({
      callback_data:   callbackData,
      suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
      postback_data:   sparcEvent.postback_data   || sparcEvent.postback,
      event_timestamp: timestampSeconds,
    }, 'MOENGAGE');
    return;
  }

  const connectorType = message.connector_type || 'MOENGAGE';

  // Save suggestion event to DB (dual-write to shared and connector-specific)
  const result = await suggestionRepo.create({
    callback_data:   callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    postback_data:   sparcEvent.postback_data   || sparcEvent.postback,
    event_timestamp: timestampSeconds,
  }, connectorType);

  // 1. Determine DLR URL and payload format
  let dispatched = false;
  if (connectorType === 'CLEVERTAP' && message.callback_url) {
    const { mapInteractionToCleverTap } = require('../mappers/clevertapMapper');
    logger.info('Forwarding Interaction to CleverTap', { callbackData, url: message.callback_url });
    const ctPayload = mapInteractionToCleverTap(callbackData, sparcEvent, message);
    dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callbackData, 'CLEVERTAP_INTERACTION');
  } else if (connectorType === 'WEBENGAGE') {
    const { mapInteractionToWebEngage } = require('../mappers/webengageMapper');
    const weUrl = env.WEBENGAGE_DLR_URL || 'https://rt.in.webengage.com/tracking/events';
    logger.info('Forwarding Interaction to WebEngage', { callbackData, url: weUrl });
    const wePayload = mapInteractionToWebEngage(callbackData, sparcEvent, message);
    dispatched = await callbackDispatcher.dispatch(weUrl, wePayload, callbackData, 'WEBENGAGE_INTERACTION');
  } else {
    // Default MoEngage logic
    const callbackUrl = env.DEFAULT_CONNECTOR_URL;
    const callbackPayload = mapInteractionEvent(sparcEvent);
    dispatched = await callbackDispatcher.dispatchSuggestion(callbackUrl, callbackPayload, callbackData);
  }

  if (dispatched) {
    await suggestionRepo.markDispatched(result.insertId, connectorType);
  }

  // Notify dashboard of interaction
  notifyUpdate('suggestion', {
    callback_data:   callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    client_name:     message.client_name || 'Unknown',
    timestamp:       new Date().toISOString(),
  });
}

module.exports = { handleInteraction };

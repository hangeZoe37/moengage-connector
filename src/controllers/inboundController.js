'use strict';

/**
 * src/controllers/inboundController.js
 * ORCHESTRATION ONLY. Call services + repos. No SQL. No HTTP.
 * Loops messages, calls mapper + fallbackEngine per message.
 */

const fallbackEngine  = require('../services/fallbackEngine');
const messageRepo     = require('../repositories/messageRepo');
const trackLinkRepo   = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { notifyUpdate } = require('../services/dashboardService');
const logger          = require('../config/logger');

// Parallel processing concurrency limit
let pLimit = require('p-limit');
if (pLimit && pLimit.default) {
  pLimit = pLimit.default;
}
const limit = pLimit(50); // Process 50 messages at a time

/**
 * Process all messages from an inbound connector request.
 * Optimized with caching, single-lookup mappings, and parallel processing.
 *
 * @param {Array<object>} messages - Array of message items from the connector payload
 * @param {object} client  - Client row from DB
 */
async function processMessages(messages, client) {
  // 1. Pre-fetch mappings once per batch (optimization)
  let mappings = [];
  try {
    mappings = await trackLinkRepo.getMappingsByClient(client.id, 'MOENGAGE');
  } catch (err) {
    logger.error('Failed to pre-fetch URL mappings', { clientId: client.id, error: err.message });
  }

  // 2. Define the processing task for a single message
  const processTask = async (message) => {
    try {
      // Automatic Prefixing for Bifurcation
      if (message.callback_data && !message.callback_data.startsWith('moe_')) {
        message.callback_data = `moe_${message.callback_data}`;
      }

      // Safe-read message_type
      const messageType =
        message.rcs?.message_content?.type ||
        message.content?.type             ||
        'UNKNOWN';

      const botId = message.rcs?.bot_id || null;

      // --- URL Tracking Optimization ---
      let hasUrlFlag = 0;
      if (message.sms?.text) {
        const { hasUrl } = processMessageLinks(message.sms.text, mappings);
        hasUrlFlag = hasUrl ? 1 : 0;
      }

      // Create log entry in DB
      await messageRepo.create({
        callback_data:   message.callback_data,
        client_id:       client.id,
        destination:     message.destination,
        bot_id:          botId,
        template_name:   message.rcs?.template_id || message.rcs?.template_name || null,
        message_type:    messageType,
        fallback_order:  message.fallback_order || ['rcs'],
        raw_payload:     message,
        has_url:         hasUrlFlag,
        connector_type:  'MOENGAGE'
      });

      // No fallback content provided, notify of failure
      logger.info('No fallback content provided for message', { callbackData: message.callback_data });
      // We don't dispatch failure here, usually we wait for DLR or handle it in callbackDispatcher

      // Process through fallback engine
      await fallbackEngine.processMessage(message, client);

      // Notify dashboard
      notifyUpdate('message', {
        callback_data: message.callback_data,
        destination:   message.destination,
        message_type:  messageType,
        status:        'QUEUED',
        client_name:   client.name || client.client_name,
        created_at:    new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to process message', {
        callbackData: message.callback_data,
        client_id:    client.id,
        error:        error.message,
      });
    }
  };

  // 3. Execute tasks in parallel with concurrency limit
  await Promise.all(messages.map(msg => limit(() => processTask(msg))));
}

module.exports = { processMessages };

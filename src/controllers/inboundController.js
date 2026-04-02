'use strict';

/**
 * src/controllers/inboundController.js
 * ORCHESTRATION ONLY. Call services + repos. No SQL. No HTTP.
 * Loops messages, calls mapper + fallbackEngine per message.
 */

const fallbackEngine = require('../services/fallbackEngine');
const messageRepo = require('../repositories/messageRepo');
const logger = require('../config/logger');

/**
 * Process all messages from an inbound MoEngage request.
 * Called AFTER res.json() has been sent (via setImmediate).
 *
 * @param {Array<object>} messages - Array of message items from MoEngage payload
 * @param {object} client - Client row from DB
 */
async function processMessages(messages, client) {
  for (const message of messages) {
    try {
      // Log message to DB
      await messageRepo.create({
        callback_data: message.callback_data,
        client_id: client.id,
        destination: message.destination,
        bot_id: message.rcs.bot_id,
        template_name: message.rcs.template_id || message.rcs.template_name || null,
        message_type: message.content.type,
        fallback_order: message.fallback_order || ['rcs'],
        raw_payload: message,
      });

      // Process through fallback engine (RCS → SMS)
      await fallbackEngine.processMessage(message, client);

      // Notify dashboard of new message
      const { notifyUpdate } = require('../services/dashboardService');
      notifyUpdate('message', {
        callback_data: message.callback_data,
        destination: message.destination,
        message_type: message.content.type,
        status: 'QUEUED',
        client_name: client.name,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to process message', {
        callbackData: message.callback_data,
        client_id: client.id,
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

module.exports = { processMessages };

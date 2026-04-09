'use strict';

/**
 * src/controllers/inboundController.js
 * ORCHESTRATION ONLY. Call services + repos. No SQL. No HTTP.
 * Loops messages, calls mapper + fallbackEngine per message.
 */

const fallbackEngine  = require('../services/fallbackEngine');
const messageRepo     = require('../repositories/messageRepo');
const { notifyUpdate } = require('../services/dashboardService');
const logger          = require('../config/logger');

/**
 * Process all messages from an inbound MoEngage request.
 * Called AFTER res.json() has been sent (via setImmediate).
 *
 * @param {Array<object>} messages - Array of message items from MoEngage payload
 * @param {object} client  - Client row from DB
 */
async function processMessages(messages, client) {
  for (const message of messages) {
    try {
      // Safe-read message_type: MoEngage can send it as message.content.type
      // OR nested under message.rcs.message_content.type
      const messageType =
        message.rcs?.message_content?.type ||
        message.content?.type             ||
        'UNKNOWN';

      // Safe-read bot_id — may come from rcs.bot_id
      const botId = message.rcs?.bot_id || null;

      await messageRepo.create({
        callback_data:   message.callback_data,
        client_id:       client.id,
        destination:     message.destination,
        bot_id:          botId,
        template_name:   message.rcs?.template_id || message.rcs?.template_name || null,
        message_type:    messageType,
        fallback_order:  message.fallback_order || ['rcs'],
        raw_payload:     message,
      });

      // Process through fallback engine (RCS → SMS)
      await fallbackEngine.processMessage(message, client);

      // Notify dashboard of new message
      notifyUpdate('message', {
        callback_data: message.callback_data,
        destination:   message.destination,
        // Use same safe read as above — avoids TypeError if content is undefined
        message_type:  message.content?.type || message.rcs?.message_content?.type || 'UNKNOWN',
        status:        'QUEUED',
        client_name:   client.name || client.client_name,
        created_at:    new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to process message', {
        callbackData: message.callback_data,
        client_id:    client.id,
        error:        error.message,
        stack:        error.stack,
      });
    }
  }
}

module.exports = { processMessages };

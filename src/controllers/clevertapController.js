'use strict';

/**
 * src/controllers/clevertapController.js
 * Handles incoming RCS messaging requests from CleverTap.
 */

const cleverTapService = require('../services/clevertapService');
const messageRepo = require('../repositories/messageRepo');
const logger = require('../config/logger');

async function handleInbound(req, res) {
  const { body, client } = req;
  const { msgId, to, rcsContent, callbackURL } = body;

  logger.info('Received CleverTap RCS request', {
    msgId,
    to,
    clientId: client.id,
    type: rcsContent?.content?.type
  });

  try {
    // 1. Initial validation
    if (!msgId || !to || !rcsContent) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields: msgId, to, or rcsContent' });
    }

    // 2. Persist to DB
    const logData = {
      callback_data: msgId, // CleverTap msgId maps to our reconcile key
      client_id: client.id,
      destination: to,
      bot_id: rcsContent.senderId,
      message_type: rcsContent.content?.type?.toUpperCase(),
      raw_payload: body,
      connector_type: 'CLEVERTAP',
      callback_url: callbackURL
    };

    await messageRepo.create(logData);

    // 3. Process asynchronously
    // We respond 200 OK immediately to CleverTap to avoid timeouts
    cleverTapService.processMessage(body, client).catch(err => {
      logger.error('Background CleverTap processing failed', { msgId, error: err.message });
    });

    return res.status(200).json({ status: 'success', message: 'Message queued' });

  } catch (error) {
    logger.error('CleverTap inbound handler error', { msgId, error: error.message });
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = {
  handleInbound,
};

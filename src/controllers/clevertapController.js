'use strict';

/**
 * src/controllers/clevertapController.js
 * Handles incoming RCS messaging requests from CleverTap.
 */

const cleverTapService = require('../services/clevertapService');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const logger = require('../config/logger');

async function handleInbound(req, res) {
  const { body, client } = req;
  let { msgId, to, rcsContent, smsContent, callbackURL } = body;

  // Automatic Prefixing for Bifurcation
  if (msgId && !msgId.startsWith('cl_')) {
    msgId = `cl_${msgId}`;
    body.msgId = msgId; 
  }

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

    // --- URL Tracking Selection ---
    let hasUrlFlag = 0;
    if (smsContent?.body) {
      const mappings = await trackLinkRepo.getMappingsByClient(client.id, 'CLEVERTAP');
      const { hasUrl } = processMessageLinks(smsContent.body, mappings);
      hasUrlFlag = hasUrl ? 1 : 0;
    }

    // --- Automatic Fallback Determination ---
    const hasSmsFallback = !!(body.smsContent || body.sms);
    const fallbackOrder = body.fallback_order || (hasSmsFallback ? ['rcs', 'sms'] : ['rcs']);
    const templateName = rcsContent.content?.type?.toUpperCase() === 'TEMPLATE' 
      ? rcsContent.content?.templateId : null;

    // 2. Persist to DB
    const logData = {
      callback_data: msgId, 
      client_id: client.id,
      destination: to,
      bot_id: rcsContent.senderId,
      template_name: templateName,
      message_type: rcsContent.content?.type?.toUpperCase(),
      fallback_order: fallbackOrder,
      raw_payload: body,
      connector_type: 'CLEVERTAP',
      callback_url: callbackURL,
      has_url: hasUrlFlag
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

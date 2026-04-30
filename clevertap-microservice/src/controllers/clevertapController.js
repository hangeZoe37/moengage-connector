'use strict';

/**
 * src/controllers/clevertapController.js
 * Handles incoming RCS messaging requests from CleverTap.
 */

const clevertapService = require('../services/clevertapService');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { env } = require('../config/env');
const logger = require('../config/logger');

async function handleInbound(req, res) {
  const { body, client } = req;
  let { msgId, to, rcsContent, smsContent, sms } = body;
  const callbackURL = body.dlr_url || body.callback_url || body.callbackURL || env.CLEVERTAP_DLR_URL;
  const smsBlock = smsContent || sms;

  // Automatic Prefixing for Bifurcation
  if (msgId && !String(msgId).startsWith('cl_')) {
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
    if (smsBlock?.body || smsBlock?.message) {
      const mappings = await trackLinkRepo.getMappingsByClient(client.id);
      const { hasUrl } = processMessageLinks(smsBlock.body || smsBlock.message, mappings);
      hasUrlFlag = hasUrl ? 1 : 0;
    }

    // --- Automatic Fallback Determination ---
    const hasSmsFallback = !!smsBlock;
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
      callback_url: callbackURL || null,
      has_url: hasUrlFlag
    };

    await messageRepo.create(logData);

    // 3. Process asynchronously
    clevertapService.processMessage(body, client).catch(err => {
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

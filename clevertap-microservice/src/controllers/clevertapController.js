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

const { mapCleverTapApiError } = require('../utils/clevertapErrorMapper');

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
    const cleanId = msgId ? String(msgId).replace(/^cl_/, '') : msgId;

    if (!msgId || !to || !rcsContent) {
      return res.status(200).json([
        {
          event: "failed",
          data: [{
            ts: Math.floor(Date.now() / 1000),
            code: "2014",
            meta: cleanId || "unknown"
          }]
        }
      ]);
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

    // 3. Process synchronously to catch immediate provider errors
    try {
      await clevertapService.processMessage(body, client);
      return res.status(200).json({ success: true });
    } catch (serviceError) {
      const errorCode = mapCleverTapApiError(serviceError.message);
      return res.status(200).json([
        {
          event: "failed",
          data: [{
            ts: Math.floor(Date.now() / 1000),
            code: errorCode,
            meta: cleanId
          }]
        }
      ]);
    }

  } catch (error) {
    logger.error('CleverTap inbound handler error', { msgId, error: error.message });
    const cleanId = msgId ? String(msgId).replace(/^cl_/, '') : msgId;
    return res.status(200).json([
      {
        event: "failed",
        data: [{
          ts: Math.floor(Date.now() / 1000),
          code: "2014",
          meta: cleanId
        }]
      }
    ]);
  }
}

module.exports = {
  handleInbound,
};

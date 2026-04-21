'use strict';

/**
 * src/controllers/webengageController.js
 * Handles incoming RCS messaging requests from WebEngage (RSP format).
 */

const webengageService = require('../services/webengageService');
const messageRepo = require('../repositories/messageRepo');
const logger = require('../config/logger');

async function handleInbound(req, res) {
  const { body, client } = req;
  const { rcsData, metadata, version } = body;

  // 1. Initial Validation
  if (!rcsData || !metadata || !metadata.messageId) {
    logger.warn('Received malformed WebEngage request', { body });
    return res.status(200).json({ 
      status: 'rcs_rejected', 
      statusCode: 2010, 
      message: 'Missing required fields: rcsData, metadata, or messageId' 
    });
  }

  // Automatic Prefixing for Internal Bifurcation
  let messageId = metadata.messageId;
  if (messageId && !messageId.startsWith('web_')) {
    messageId = `web_${messageId}`;
  }
  
  const to = rcsData.toNumber;
  const rawType = rcsData.templateData?.type || 'TEXT';
  const type = rawType.replace('RICH_', ''); // RICH_CARD -> CARD, RICH_CAROUSEL -> CAROUSEL

  logger.info('Received WebEngage RCS request', {
    messageId,
    to,
    clientId: client.id,
    type: type
  });

  try {
    // 2. Persist to DB
    const logData = {
      callback_data: messageId, // WebEngage messageId maps to our reconcile key
      client_id: client.id,
      destination: to,
      bot_id: rcsData.sender,
      message_type: type.toUpperCase(),
      raw_payload: body,
      connector_type: 'WEBENGAGE',
      callback_url: null // WebEngage uses static endpoints configured in dashboard
    };

    await messageRepo.create(logData);

    // 3. Process asynchronously
    // We respond "rcs_accepted" immediately to WebEngage
    webengageService.processMessage(body, client).catch(err => {
      logger.error('Background WebEngage processing failed', { messageId, error: err.message });
    });

    return res.status(200).json({ 
      status: 'rcs_accepted', 
      statusCode: 0 
    });

  } catch (error) {
    logger.error('WebEngage inbound handler error', { messageId, error: error.message });
    return res.status(200).json({ 
      status: 'rcs_rejected', 
      statusCode: 1000, 
      message: 'Internal server error' 
    });
  }
}

module.exports = {
  handleInbound,
};

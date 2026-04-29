'use strict';

const logger = require('../config/logger');
const messageRepo = require('../repositories/messageRepo');
const fallbackEngine = require('../services/fallbackEngine');
const { FAILED_STATUSES } = require('../mappers/dlrMapper');

async function handleInbound(req, res) {
  const { campaign_id, campaign_name, messages } = req.body;
  const client = req.client; // From bearerAuth middleware

  logger.info('Received MoEngage RCS batch', {
    clientId: client.id,
    campaignId: campaign_id,
    messageCount: messages?.length,
  });

  // Acknowledge immediately with the format expected by MoEngage (Array of statuses)
  const responseArray = messages.map((msg) => ({
    status: 'SUCCESS',
    callback_data: msg.callback_data,
  }));
  res.status(200).json(responseArray);

  // Process asynchronously
  setTimeout(async () => {
    for (const msg of messages) {
      try {
        const originalCallbackData = String(msg.callback_data || '');
        const prefixedCallbackData = originalCallbackData.startsWith('moe_') 
          ? originalCallbackData 
          : `moe_${originalCallbackData}`;

        msg.callback_data = prefixedCallbackData;

        // Persist queue state
        await messageRepo.create({
          callback_data: prefixedCallbackData,
          client_id: client.id,
          destination: msg.destination,
          bot_id: msg.rcs?.bot_id || null,
          template_name: msg.rcs?.template_id || null,
          message_type: msg.rcs?.message_content?.type || 'TEXT',
          fallback_order: msg.fallback_order || ['rcs'],
          raw_payload: msg,
          has_url: 0
        });

        // Trigger orchestration
        await fallbackEngine.processMessage(msg, client);
      } catch (err) {
        logger.error('Error processing MoEngage message', { error: err.message, payload: msg });
      }
    }
  }, 0);
}

module.exports = {
  handleInbound
};

'use strict';

const logger = require('../config/logger');
const messageRepo = require('../repositories/messageRepo');
const fallbackEngine = require('../services/fallbackEngine');

async function handleInbound(req, res) {
  const { campaign_id, campaign_name, messages } = req.body;
  const client = req.client;

  // ── 4XX: Client Error — missing or invalid body ─────────────────────────
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json([{
      status: 'FAILURE',
      message: 'Request body must contain a non-empty "messages" array',
      callback_data: null
    }]);
  }

  logger.info('Received MoEngage RCS batch', {
    clientId: client.id,
    campaignId: campaign_id,
    messageCount: messages.length,
  });

  try {
    // ── 200: Immediate acknowledgement per MoEngage spec ──────────────────
    // Each item: { status, callback_data } on SUCCESS
    //            { status, message, callback_data } on FAILURE
    const responseArray = messages.map((msg) => {
      if (!msg.destination || !msg.callback_data) {
        return {
          status: 'FAILURE',
          message: 'Missing required fields: destination or callback_data',
          callback_data: msg.callback_data || null
        };
      }
      return {
        status: 'SUCCESS',
        callback_data: msg.callback_data
      };
    });

    res.status(200).json(responseArray);

    // ── Async background processing (after response is sent) ───────────────
    setTimeout(async () => {
      for (const msg of messages) {
        // Skip messages that failed validation
        if (!msg.destination || !msg.callback_data) continue;

        try {
          const originalCallbackData = String(msg.callback_data || '');
          const prefixedCallbackData = originalCallbackData.startsWith('moe_')
            ? originalCallbackData
            : `moe_${originalCallbackData}`;

          msg.callback_data = prefixedCallbackData;

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

          await fallbackEngine.processMessage(msg, client);
        } catch (err) {
          logger.error('Error processing MoEngage message', { error: err.message, callback_data: msg.callback_data });
        }
      }
    }, 0);

  } catch (error) {
    // ── 5XX: Unexpected server error ───────────────────────────────────────
    logger.error('MoEngage inbound handler crashed', { error: error.message });
    return res.status(500).json([{
      status: 'FAILURE',
      message: 'Internal server error',
      callback_data: null
    }]);
  }
}

module.exports = { handleInbound };

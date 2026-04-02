'use strict';

/**
 * src/routes/inbound.js
 * POST /integrations/moengage/rcs/send
 * HTTP ONLY. Parse request → call controller → send response.
 *
 * CRITICAL: res.json() MUST happen within 5 seconds (MoEngage timeout).
 * All SPARC API calls happen AFTER response via setImmediate().
 */

const { Router } = require('express');
const bearerAuth = require('../middleware/bearerAuth');
const validatePayload = require('../middleware/validatePayload');
const inboundController = require('../controllers/inboundController');
const logger = require('../config/logger');

const router = Router();

router.post('/send', bearerAuth, validatePayload, async (req, res) => {
  const { messages } = req.body;
  const client = req.client;

  logger.info('Inbound request received', {
    clientId: client.id,
    messageCount: messages.length,
  });

  // Step 1: Build response items synchronously (fast)
  const responseArray = messages.map((msg) => ({
    status: 'SUCCESS',
    callback_data: msg.callback_data,
  }));

  // Step 2: Send response FIRST — must happen within 5 seconds
  res.json(responseArray);

  // Step 3: Process AFTER response is sent
  setImmediate(async () => {
    try {
      await inboundController.processMessages(messages, client);
    } catch (error) {
      logger.error('Background message processing failed', {
        clientId: client.id,
        error: error.message,
        stack: error.stack,
      });
    }
  });
});

module.exports = router;

'use strict';

/**
 * src/routes/sparcWebhook.js
 * POST /sparc/webhook
 * Unified endpoint to receive BOTH DLR (delivery status) and Interaction events from SPARC.
 * NO Bearer auth — protected by Nginx IP allowlist.
 */

const { Router } = require('express');
const dlrController = require('../controllers/dlrController');
const interactionController = require('../controllers/interactionController');
const logger = require('../config/logger');

const router = Router();

router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    logger.info('SPARC webhook event received', { body: payload });

    // Acknowledge receipt immediately
    res.json({ success: true });

    // Process asynchronously
    setImmediate(async () => {
      try {
        // Determine whether this is an Interaction or a DLR
        if (payload.interactionType) {
          await interactionController.handleInteraction(payload);
        } else {
          await dlrController.handleDlrEvent(payload);
        }
      } catch (error) {
        logger.error('Webhook event processing failed', {
          error: error.message,
          stack: error.stack,
          body: payload,
        });
      }
    });
  } catch (error) {
    logger.error('Webhook route error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

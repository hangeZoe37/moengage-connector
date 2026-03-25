'use strict';

/**
 * src/routes/sparcInteraction.js
 * POST /sparc/interaction
 * Receives suggestion/postback interaction events from SPARC.
 * NO Bearer auth — protected by Nginx IP allowlist.
 */

const { Router } = require('express');
const interactionController = require('../controllers/interactionController');
const logger = require('../config/logger');

const router = Router();

router.post('/interaction', async (req, res) => {
  try {
    logger.info('SPARC interaction event received', {
      body: req.body,
    });

    // Acknowledge receipt immediately
    res.json({ success: true });

    // Process the interaction event asynchronously
    setImmediate(async () => {
      try {
        await interactionController.handleInteraction(req.body);
      } catch (error) {
        logger.error('Interaction event processing failed', {
          error: error.message,
          stack: error.stack,
          body: req.body,
        });
      }
    });
  } catch (error) {
    logger.error('Interaction route error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

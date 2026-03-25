'use strict';

/**
 * src/routes/sparcDlr.js
 * POST /sparc/dlr
 * Receives DLR (delivery status) events from SPARC.
 * NO Bearer auth — protected by Nginx IP allowlist.
 */

const { Router } = require('express');
const dlrController = require('../controllers/dlrController');
const logger = require('../config/logger');

const router = Router();

router.post('/dlr', async (req, res) => {
  try {
    logger.info('SPARC DLR event received', {
      body: req.body,
    });

    // Acknowledge receipt immediately
    res.json({ success: true });

    // Process the DLR event asynchronously
    setImmediate(async () => {
      try {
        await dlrController.handleDlrEvent(req.body);
      } catch (error) {
        logger.error('DLR event processing failed', {
          error: error.message,
          stack: error.stack,
          body: req.body,
        });
      }
    });
  } catch (error) {
    logger.error('DLR route error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const logger = require('../config/logger');

router.post('/webhook', async (req, res) => {
  res.status(200).json({ status: 'Success', message: 'Accepted' });

  try {
    let events = Array.isArray(req.body) ? req.body : [req.body];
    
    // Sometimes SPARC wraps an array inside a 'data' key
    if (req.body && Array.isArray(req.body.data)) {
      events = req.body.data;
    }

    for (const sparcEvent of events) {
      if (sparcEvent.interactionType) {
        await webhookController.handleInteraction(sparcEvent);
      } else {
        await webhookController.handleDlrEvent(sparcEvent);
      }
    }
  } catch (err) {
    logger.error('Error processing SPARC webhook asynchronously', { error: err.message, body: req.body });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const logger = require('../config/logger');

// RCS DLR + Interaction events
router.post('/webhook', async (req, res) => {
  // ACK immediately
  res.status(200).json({ status: 'Success', message: 'Accepted' });

  logger.info('Incoming SPARC Webhook request', { body: req.body });

  try {
    let events = Array.isArray(req.body) ? req.body : [req.body];
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
    logger.error('Error processing SPARC webhook asynchronously', { error: err.message });
  }
});

// SMS DLR webhook
router.get('/sms-dlr', async (req, res) => {
  res.status(200).send('OK');
  
  try {
    await webhookController.handleSmsDlr(req.query);
  } catch (err) {
    logger.error('Error processing SPARC SMS DLR', { error: err.message });
  }
});

module.exports = router;

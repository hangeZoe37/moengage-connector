'use strict';

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const logger = require('../config/logger');

console.log('🚀 CleverTap Simulation Routes Loaded: /api/test/*');

// Simulate RCS Delivered
router.post('/rcs-delivered', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const event = {
    seq_id: seqId,
    status: 'RCS_DELIVERED',
    eventData: { entity: { eventType: 'DELIVERED', sendTime: new Date().toISOString() } }
  };
  
  webhookController.handleDlrEvent(event);
  res.json({ message: 'Simulated RCS Delivered', seqId });
});

// Simulate RCS Failed
router.post('/rcs-failed', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const event = {
    seq_id: seqId,
    status: 'RCS_DELIVERY_FAILED',
    eventData: { entity: { eventType: 'FAILED', error: { message: 'User Offline' } } }
  };
  
  webhookController.handleDlrEvent(event);
  res.json({ message: 'Simulated RCS Failed', seqId });
});

// Simulate RCS Read
router.post('/rcs-read', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const event = {
    seq_id: seqId,
    status: 'RCS_READ',
    eventData: { entity: { eventType: 'READ' } }
  };
  
  webhookController.handleDlrEvent(event);
  res.json({ message: 'Simulated RCS Read', seqId });
});

// Simulate SMS Delivered
router.post('/sms-delivered', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const query = {
    transactionId: seqId,
    deliverystatus: 'SMS_DELIVERED',
    deliverytime: new Date().toISOString()
  };
  
  console.log('📡 [DEBUG] SMS Simulation Route Hit:', seqId);
  webhookController.handleSmsDlr(query);
  res.json({ message: 'Simulated SMS Delivered', seqId });
});

// Simulate SMS Failed
router.post('/sms-failed', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const query = {
    transactionId: seqId,
    deliverystatus: 'SMS_FAILED',
    description: 'Absent Subscriber'
  };
  
  webhookController.handleSmsDlr(query);
  res.json({ message: 'Simulated SMS Failed', seqId });
});

// Simulate Interaction: Clicked (URL)
router.post('/interaction-clicked', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const event = {
    callback_data: seqId,
    interactionType: 'SUGGESTION',
    suggestion_text: 'Clicked (URL)',
    postback_data: 'URL_CLICKED',
    timestamp: new Date().toISOString()
  };
  
  webhookController.handleInteraction(event);
  res.json({ message: 'Simulated Interaction Clicked', seqId });
});

// Simulate Interaction: Replied (Text)
router.post('/interaction-replied', async (req, res) => {
  const seqId = req.body.seqId || req.query.seqId;
  if (!seqId) return res.status(400).json({ error: 'seqId is required in body' });
  
  const event = {
    callback_data: seqId,
    interactionType: 'REPLY',
    suggestion_text: 'Replied (Text)',
    text: 'Hello from User',
    timestamp: new Date().toISOString()
  };
  
  webhookController.handleInteraction(event);
  res.json({ message: 'Simulated Interaction Replied', seqId });
});

module.exports = router;

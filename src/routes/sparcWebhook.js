'use strict';

/**
 * src/routes/sparcWebhook.js
 * POST /sparc/webhook  — unified RCS DLR + interaction events from SPARC
 * GET  /sparc/sms-dlr  — SMS delivery receipt (DLR) webhook from SPARC SMS gateway
 *
 * NO Bearer auth — protected by Nginx IP allowlist.
 */

const { Router } = require('express');
const dlrController = require('../controllers/dlrController');
const interactionController = require('../controllers/interactionController');
const messageRepo = require('../repositories/messageRepo');
const callbackDispatcher = require('../services/callbackDispatcher');
const { buildMoeStatusPayload } = require('../services/fallbackEngine');
const { MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

const router = Router();

/**
 * SPARC SMS DLR status → MoEngage status mapping.
 * SPARC SMS gateway sends these values as the `deliverystatus` query param.
 */
const SMS_DLR_STATUS_MAP = {
  'DELIVERY_SUCCESS': MESSAGE_STATUSES.SMS_DELIVERED,
  'DELIVERY_FAILURE': MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
  'UNDELIVERED':      MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
  'REJECTED':         MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
  'EXPIRED':          MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
};

// ─── RCS DLR + Interaction events (POST) ──────────────────────────────────────

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

// ─── SMS DLR webhook (GET with query params) ──────────────────────────────────
//
// SPARC SMS gateway calls:
//   GET /sparc/sms-dlr?transactionId=890445775&recipient=919990927990
//     &deliverystatus=DELIVERY_SUCCESS&deliverytime=2026-04-07+15:57:11
//     &from=SMPALT&description=Message+delivered+successfully&pdu=4&fynomsgId=NA

router.get('/sms-dlr', async (req, res) => {
  // Always ack immediately — SPARC expects 200
  res.status(200).send('OK');

  setImmediate(async () => {
    const { transactionId, deliverystatus, deliverytime, recipient, description } = req.query;

    logger.info('SPARC SMS DLR received', { transactionId, deliverystatus, recipient, deliverytime, description });

    if (!transactionId || !deliverystatus) {
      logger.warn('SPARC SMS DLR missing required params', { query: req.query });
      return;
    }

    try {
      // Map SPARC delivery status → MoEngage status
      const moeStatus = SMS_DLR_STATUS_MAP[deliverystatus.toUpperCase()];
      if (!moeStatus) {
        logger.warn('SPARC SMS DLR: unknown deliverystatus — ignoring', { deliverystatus, transactionId });
        return;
      }

      // Look up the original message by the stored transactionId
      const message = await messageRepo.findBySparcTransactionId(transactionId);
      if (!message) {
        logger.warn('SPARC SMS DLR: no message found for transactionId', { transactionId });
        return;
      }

      const { callback_data } = message;

      // Convert deliverytime (e.g. "2026-04-07 15:57:11") to epoch seconds
      let timestampSeconds = Math.floor(Date.now() / 1000);
      if (deliverytime) {
        const parsed = Math.floor(new Date(deliverytime.replace(' ', 'T') + 'Z').getTime() / 1000);
        if (!isNaN(parsed)) timestampSeconds = parsed;
      }

      // Update DB status
      await messageRepo.updateStatus(callback_data, moeStatus);
      logger.info('SPARC SMS DLR: message status updated', { callback_data, moeStatus, transactionId });

      // Dispatch callback based on connector type
      let dispatched = false;
      if (message.connector_type === 'CLEVERTAP' && message.callback_url) {
        logger.info('SPARC SMS DLR: Forwarding to CleverTap', { callback_data, url: message.callback_url });
        const { mapDlrToCleverTap } = require('../mappers/clevertapMapper');
        const cleanCallbackData = callback_data ? String(callback_data).replace(/^cl_/, '') : callback_data;
        const ctPayload = mapDlrToCleverTap(cleanCallbackData, moeStatus, description ? { code: "SMS", message: description } : null);

        if (ctPayload) {
          dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callback_data, 'CLEVERTAP_SMS_DLR');
        } else {
          dispatched = true;
        }
      } else {
        // Default MoEngage logic
        const isFailed = moeStatus.includes('FAILED');
        const moePayload = {
          statuses: [{
            status: moeStatus,
            callback_data: callback_data ? String(callback_data).replace(/^moe_/, '') : callback_data,
            timestamp: String(timestampSeconds),

            ...(isFailed && { error_message: description || 'Delivery failed' }),
          }],
        };
        const dlrUrl = env.MOENGAGE_DLR_URL;
        dispatched = await callbackDispatcher.dispatchStatus(dlrUrl, moePayload, callback_data);
      }

      if (dispatched) {
        logger.info('SPARC SMS DLR: Callback dispatched successfully', { callback_data, moeStatus, connector: message.connector_type });
      }

    } catch (err) {
      logger.error('SPARC SMS DLR processing error', { transactionId, error: err.message, stack: err.stack });
    }
  });
});

module.exports = router;


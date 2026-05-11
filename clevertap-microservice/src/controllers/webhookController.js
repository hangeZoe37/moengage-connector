'use strict';

/**
 * src/controllers/webhookController.js
 * Handles SPARC webhooks (DLRs and Interactions).
 */

const { translateStatus, isSmsStatus } = require('../mappers/dlrMapper');
const { mapDlrToCleverTap, mapInteractionToCleverTap } = require('../mappers/clevertapMapper');
const messageRepo = require('../repositories/messageRepo');
const dlrRepo = require('../repositories/dlrRepo');
const suggestionRepo = require('../repositories/suggestionRepo');
const clientRepo = require('../repositories/clientRepo');
const clevertapService = require('../services/clevertapService');
const callbackDispatcher = require('../services/callbackDispatcher');
const { pools } = require('../config/db');
const logger = require('../config/logger');

async function handleDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  let callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;
  
  console.log('-------------------------------------------');
  console.log('📡 [DEBUG] RCS DLR RECEIVED IN CONTROLLER');
  console.log('ID:', callbackData);
  console.log('Sparc Status:', (entity.eventType || eventRoot.status || sparcEvent.status));
  console.log('-------------------------------------------');

  if (callbackData && !String(callbackData).startsWith('cl_')) {
    callbackData = `cl_${callbackData}`;
  }

  const sparcStatus = (entity.eventType || eventRoot.status || sparcEvent.status || '').toUpperCase();
  const internalStatus = translateStatus(sparcStatus);

  logger.info('Processing CleverTap DLR event', { callbackData, sparcStatus, internalStatus });

  const message = await messageRepo.findByCallbackData(callbackData);
  if (!message) {
    logger.warn('DLR received for unknown callback_data', { callbackData });
    return;
  }

  // 1. Update DB
  let eventTimestamp = null;
  if (entity.sendTime) {
    eventTimestamp = Math.floor(new Date(entity.sendTime).getTime() / 1000);
  }

  const dlrResult = await dlrRepo.create({
    callback_data: callbackData,
    sparc_status: sparcStatus,
    moe_status: internalStatus,
    error_message: entity.error?.message || null,
    event_timestamp: eventTimestamp,
  });

  await messageRepo.updateStatus(callbackData, internalStatus);

  // 2. Dispatch to CleverTap
  if (message.callback_url) {
    const ctPayload = mapDlrToCleverTap(callbackData, internalStatus, entity.error);
    if (ctPayload) {
      logger.info('Forwarding DLR to CleverTap', { callbackData, url: message.callback_url });
      const dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callbackData, 'CLEVERTAP_STATUS');
      if (dispatched) {
        await dlrRepo.markDispatched(dlrResult.insertId);
      }
    }
  }

  // 3. SMS Fallback if RCS fails
  if (['RCS_DELIVERY_FAILED', 'RCS_SENT_FAILED'].includes(internalStatus)) {
    const rawPayload = typeof message.raw_payload === 'string' ? JSON.parse(message.raw_payload) : message.raw_payload;
    const fallbackOrder = (message.fallback_order || []).map(c => String(c).toLowerCase());
    const smsBlock = rawPayload?.sms || rawPayload?.smsContent;

    if (fallbackOrder.includes('sms') && smsBlock) {
      logger.info('RCS DLR failure — triggering SMS fallback', { callbackData });
      const client = await clientRepo.findById(message.client_id);
      if (client) {
        await clevertapService.attemptSms(rawPayload, client);
      }
    }
  }
}

async function handleInteraction(sparcEvent) {
  let callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;
  
  if (callbackData && !String(callbackData).startsWith('cl_')) {
    callbackData = `cl_${callbackData}`;
  }

  logger.info('Processing CleverTap interaction event', { callbackData });

  const message = await messageRepo.findByCallbackData(callbackData);
  if (!message) {
    logger.warn('Interaction received for unknown callback_data', { callbackData });
    return;
  }

  // 1. Update DB
  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (sparcEvent.timestamp) {
    timestampSeconds = Math.floor(new Date(sparcEvent.timestamp).getTime() / 1000);
  }

  const result = await suggestionRepo.create({
    callback_data: callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    postback_data: sparcEvent.postback_data || sparcEvent.postback,
    event_timestamp: timestampSeconds,
  });

  // 2. Dispatch to CleverTap
  if (message.callback_url) {
    const ctPayload = mapInteractionToCleverTap(callbackData, sparcEvent, message);
    if (ctPayload) {
      logger.info('Forwarding Interaction to CleverTap', { callbackData, url: message.callback_url });
      const dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callbackData, 'CLEVERTAP_INTERACTION');
      if (dispatched) {
        await suggestionRepo.markDispatched(result.insertId);
      }
    }
  }
}

async function handleSmsDlr(reqQuery) {
  const { transactionId, deliverystatus, deliverytime, description } = reqQuery;

  console.log('-------------------------------------------');
  console.log('📩 [DEBUG] SMS DLR RECEIVED IN CONTROLLER');
  console.log('ID:', transactionId);
  console.log('Status:', deliverystatus);
  console.log('-------------------------------------------');

  logger.info('📩 SMS DLR received', { transactionId, deliverystatus });

  if (!transactionId || !deliverystatus) {
    logger.warn('SMS DLR missing transactionId or deliverystatus — check your Postman seqId variable!', { transactionId, deliverystatus });
    return;
  }

  // Try finding by Sparc Transaction ID first, then fall back to Callback Data (for simulations)
  let message = await messageRepo.findBySparcTransactionId(transactionId);
  if (!message) {
    logger.debug('SMS DLR: Sparc ID not found, trying Callback Data lookup', { transactionId });
    message = await messageRepo.findByCallbackData(transactionId);
  }

  if (!message) {
    logger.warn('❌ SMS DLR received for unknown message — did you send an outbound request first?', { transactionId });
    return;
  }

  logger.info('✅ SMS DLR matched to message', { transactionId, messageId: message.id });

  const { callback_data } = message;
  const internalStatus = translateStatus(deliverystatus);

  // 1. Update DB — mark status AND channel as SMS
  const dlrResult = await dlrRepo.create({
    callback_data: callback_data,
    sparc_status: deliverystatus,
    moe_status: internalStatus,
    error_message: description || null,
    event_timestamp: deliverytime ? Math.floor(new Date(deliverytime).getTime() / 1000) : Math.floor(Date.now() / 1000),
  });

  await messageRepo.updateStatus(callback_data, internalStatus);

  // Mark the message channel as SMS so the UI "SMS" filter works
  await pools.CLEVERTAP.query(
    `UPDATE message_logs SET message_type = 'SMS', updated_at = NOW() WHERE callback_data = ?`,
    [callback_data]
  );

  // 2. Dispatch to CleverTap
  if (message.callback_url) {
    const ctPayload = mapDlrToCleverTap(callback_data, internalStatus, description ? { code: "SMS", message: description } : null);
    if (ctPayload) {
      const dispatched = await callbackDispatcher.dispatch(message.callback_url, ctPayload, callback_data, 'CLEVERTAP_SMS_DLR');
      if (dispatched) {
        await dlrRepo.markDispatched(dlrResult.insertId);
      }
    }
  }
}

module.exports = {
  handleDlrEvent,
  handleInteraction,
  handleSmsDlr
};

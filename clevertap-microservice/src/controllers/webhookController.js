'use strict';

/**
 * src/controllers/webhookController.js
 * Handles SPARC webhooks (DLRs and Interactions).
 */

const { translateStatus } = require('../mappers/dlrMapper');
const { mapDlrToCleverTap, mapInteractionToCleverTap } = require('../mappers/clevertapMapper');
const messageRepo = require('../repositories/messageRepo');
const dlrRepo = require('../repositories/dlrRepo');
const suggestionRepo = require('../repositories/suggestionRepo');
const clientRepo = require('../repositories/clientRepo');
const clevertapService = require('../services/clevertapService');
const callbackDispatcher = require('../services/callbackDispatcher');
const logger = require('../config/logger');

async function handleDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  let callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;
  
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

  if (!transactionId || !deliverystatus) return;

  const message = await messageRepo.findBySparcTransactionId(transactionId);
  if (!message) return;

  const { callback_data } = message;
  const internalStatus = translateStatus(deliverystatus);

  await messageRepo.updateStatus(callback_data, internalStatus);

  if (message.callback_url) {
    const ctPayload = mapDlrToCleverTap(callback_data, internalStatus, description ? { code: "SMS", message: description } : null);
    if (ctPayload) {
      await callbackDispatcher.dispatch(message.callback_url, ctPayload, callback_data, 'CLEVERTAP_SMS_DLR');
    }
  }
}

module.exports = {
  handleDlrEvent,
  handleInteraction,
  handleSmsDlr
};

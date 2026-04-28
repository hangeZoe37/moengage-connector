'use strict';

const { mapDlrEvent, translateStatus } = require('../mappers/dlrMapper');
const dlrRepo = require('../repositories/dlrRepo');
const suggestionRepo = require('../repositories/suggestionRepo');
const messageRepo = require('../repositories/messageRepo');
const clientRepo = require('../repositories/clientRepo');
const callbackDispatcher = require('../services/callbackDispatcher');
const { attemptSms } = require('../services/fallbackEngine');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

const RCS_FAILED_STATUSES = new Set([
  MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  MESSAGE_STATUSES.RCS_SENT_FAILED,
]);

async function handleDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  let callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;
  const sparcStatus = (
    entity.eventType || 
    eventRoot.status || 
    sparcEvent.status || 
    sparcEvent.interactionType || 
    ''
  ).toUpperCase();
  const internalStatus = translateStatus(sparcStatus);

  logger.info('Processing MoEngage DLR event', { callbackData, sparcStatus, internalStatus });

  let eventTimestamp = null;
  if (entity.sendTime) {
    const parsed = Math.floor(new Date(entity.sendTime).getTime() / 1000);
    if (!isNaN(parsed)) eventTimestamp = parsed;
  }

  let message = await messageRepo.findByCallbackData(callbackData);

  // If missing, check if SPARC dropped the prefix
  if (!message && callbackData && !String(callbackData).startsWith('moe_')) {
    const prefixedId = `moe_${callbackData}`;
    const prefixedMsg = await messageRepo.findByCallbackData(prefixedId);
    if (prefixedMsg) {
      message = prefixedMsg;
      callbackData = prefixedId;
    }
  }

  if (!message) {
    logger.warn('DLR event received for unknown callback_data in MoEngage DB', { callbackData });
    await dlrRepo.create({
      callback_data: callbackData,
      sparc_status: sparcStatus,
      moe_status: internalStatus,
      error_message: entity.error?.message || null,
      event_timestamp: eventTimestamp,
    });
    return;
  }

  const dlrResult = await dlrRepo.create({
    callback_data: callbackData,
    sparc_status: sparcStatus,
    moe_status: internalStatus,
    error_message: entity.error?.message || null,
    event_timestamp: eventTimestamp,
  });

  await messageRepo.updateStatus(callbackData, internalStatus);

  const callbackUrl = env.MOENGAGE_DLR_URL || 'http://localhost:4000/test/moengage-dlr';
  const moePayload = mapDlrEvent(sparcEvent);
  
  const dispatched = await callbackDispatcher.dispatchStatus(callbackUrl, moePayload, callbackData);

  if (dispatched) {
    await dlrRepo.markDispatched(dlrResult.insertId);
  }

  if (RCS_FAILED_STATUSES.has(internalStatus)) {
    try {
      const rawPayload = typeof message.raw_payload === 'string'
        ? JSON.parse(message.raw_payload)
        : message.raw_payload;

      const fallbackOrder = (message.fallback_order || []).map(c => String(c).toLowerCase());
      const smsBlock = rawPayload?.sms || rawPayload?.smsContent || rawPayload?.smsData;

      if (fallbackOrder.includes(CHANNELS.SMS) && smsBlock) {
        logger.info('RCS DLR failure — triggering SMS fallback', { callbackData, internalStatus });

        const client = await clientRepo.findById(message.client_id);
        if (client) {
          const fullMessage = { ...rawPayload, callback_data: callbackData };
          const assistantId = rawPayload?.rcs?.bot_id || client.rcs_assistant_id || null;
          await attemptSms(fullMessage, client, callbackUrl, assistantId);
        } else {
          logger.warn('Could not find client for SMS fallback', { callbackData, clientId: message.client_id });
        }
      }
    } catch (fallbackError) {
      logger.error('Error during DLR-triggered SMS fallback', { callbackData, error: fallbackError.message });
    }
  }
}

async function handleInteraction(sparcEvent) {
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;

  logger.info('Processing MoEngage interaction event', {
    callbackData,
    text: sparcEvent.suggestion_text || sparcEvent.text,
  });

  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (sparcEvent.timestamp) {
    const parsed = Math.floor(new Date(sparcEvent.timestamp).getTime() / 1000);
    if (!isNaN(parsed)) timestampSeconds = parsed;
  }

  let message = await messageRepo.findByCallbackData(callbackData);

  // Prefix fallback
  if (!message && callbackData && !String(callbackData).startsWith('moe_')) {
    const prefixedId = `moe_${callbackData}`;
    const prefixedMsg = await messageRepo.findByCallbackData(prefixedId);
    if (prefixedMsg) {
      message = prefixedMsg;
    }
  }

  const result = await suggestionRepo.create({
    callback_data: callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    postback_data: sparcEvent.postback_data || sparcEvent.postback,
    event_timestamp: timestampSeconds,
  });

  const callbackUrl = env.MOENGAGE_DLR_URL || 'http://localhost:4000/test/moengage-dlr';
  const callbackDispatcher = require('../services/callbackDispatcher');
  const callbackPayload = require('../mappers/dlrMapper').mapDlrEvent(sparcEvent);
  
  const dispatched = await callbackDispatcher.dispatchSuggestion(callbackUrl, callbackPayload, callbackData);

  if (dispatched) {
    await suggestionRepo.markDispatched(result.insertId);
  }
}

module.exports = { handleDlrEvent, handleInteraction };

'use strict';

const { translateStatus } = require('../mappers/dlrMapper');
const { mapToWebEngage, mapInteractionToWebEngage } = require('../mappers/webengageMapper');
const dlrRepo = require('../repositories/dlrRepo');
const suggestionRepo = require('../repositories/suggestionRepo');
const messageRepo = require('../repositories/messageRepo');
const callbackDispatcher = require('../services/callbackDispatcher');
const { env } = require('../config/env');
const logger = require('../config/logger');

async function handleDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  let callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;
  
  // Prefix check
  if (callbackData && !String(callbackData).startsWith('web_')) {
    callbackData = `web_${callbackData}`;
  }

  const sparcStatus = (
    entity.eventType || 
    eventRoot.status || 
    sparcEvent.status || 
    ''
  ).toUpperCase();

  const internalStatus = translateStatus(sparcStatus);

  logger.info('Processing WebEngage DLR event', { callbackData, sparcStatus, internalStatus });

  let eventTimestamp = null;
  if (entity.sendTime) {
    eventTimestamp = Math.floor(new Date(entity.sendTime).getTime() / 1000);
  }

  const message = await messageRepo.findByCallbackData(callbackData);
  if (!message) {
    logger.warn('DLR received for unknown callback_data', { callbackData });
    return;
  }

  // 1. Update DB
  const dlrResult = await dlrRepo.create({
    callback_data: callbackData,
    sparc_status: sparcStatus,
    moe_status: internalStatus,
    error_message: entity.error?.message || null,
    event_timestamp: eventTimestamp,
  });

  await messageRepo.updateStatus(callbackData, internalStatus);

  // 2. Dispatch to WebEngage (Using Version 1.0 format)
  const callbackUrl = env.WEBENGAGE_DLR_URL;
  const wePayload = mapToWebEngage(callbackData, internalStatus, message, entity.error?.message);
  
  const dispatched = await callbackDispatcher.dispatch(callbackUrl, wePayload, callbackData, 'DSN');

  if (dispatched) {
    await dlrRepo.markDispatched(dlrResult.insertId);
  }
}

async function handleInteraction(sparcEvent) {
  let callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;
  
  if (callbackData && !String(callbackData).startsWith('web_')) {
    callbackData = `web_${callbackData}`;
  }

  logger.info('Processing WebEngage interaction event', { callbackData });

  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (sparcEvent.timestamp) {
    timestampSeconds = Math.floor(new Date(sparcEvent.timestamp).getTime() / 1000);
  }

  const message = await messageRepo.findByCallbackData(callbackData);
  if (!message) {
    logger.warn('Interaction received for unknown callback_data', { callbackData });
    return;
  }

  // 1. Update DB
  const result = await suggestionRepo.create({
    callback_data: callbackData,
    suggestion_text: sparcEvent.suggestion_text || sparcEvent.text,
    postback_data: sparcEvent.postback_data || sparcEvent.postback,
    event_timestamp: timestampSeconds,
  });

  // 2. Dispatch to WebEngage (Using Version 1.0 format)
  const callbackUrl = env.WEBENGAGE_DLR_URL;
  const wePayload = mapInteractionToWebEngage(callbackData, sparcEvent, message);
  
  const dispatched = await callbackDispatcher.dispatch(callbackUrl, wePayload, callbackData, 'Interaction');

  if (dispatched) {
    await suggestionRepo.markDispatched(result.insertId);
  }
}

module.exports = {
  handleDlrEvent,
  handleInteraction
};

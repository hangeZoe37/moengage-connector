'use strict';

const sparcClient = require('./sparcClient');
const callbackDispatcher = require('./callbackDispatcher');
const { mapMessageToSparc } = require('../mappers/inboundMapper');
const { FAILED_STATUSES } = require('../mappers/dlrMapper');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

async function processMessage(message, client) {
  const callback_data = message.callback_data;
  const destination = message.destination;
  const sms = message.sms;

  const rawOrder = message.fallback_order || [CHANNELS.RCS];
  const fallbackOrder = rawOrder.map(channel => String(channel).toLowerCase());

  const dlrUrl = env.MOENGAGE_DLR_URL || 'http://localhost:4000/test/moengage-dlr';

  const includesRcs = fallbackOrder.includes(CHANNELS.RCS);
  const includesSms = fallbackOrder.includes(CHANNELS.SMS);

  if (includesRcs) {
    try {
      const sparcPayload = mapMessageToSparc(message, env.SPARC_WEBHOOK_URL, client.rcs_assistant_id);
      const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);

      let submissionId = null;

      if (Array.isArray(sparcResponse)) {
        const failedItem = sparcResponse.find(item =>
          item.status && item.status.toUpperCase() !== 'SUCCESS'
        );
        if (failedItem) {
          throw new Error(`SPARC rejected message: ${failedItem.status} — ${failedItem.error || failedItem.description || 'unknown reason'}`);
        }
        submissionId = sparcResponse[0]?.callback_data || null;
      } else if (sparcResponse && typeof sparcResponse === 'object') {
        if (Array.isArray(sparcResponse.failed) && sparcResponse.failed.length > 0) {
          const nativeError = sparcResponse.failed[0].error || 'Native SPARC validation error';
          throw new Error(`SPARC API rejected message instantly: ${nativeError}`);
        }
        submissionId = sparcResponse.submission_id || null;
      }

      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT);

      const sentPayload = buildMoeStatusPayload(MESSAGE_STATUSES.RCS_SENT, callback_data);

      setTimeout(async () => {
        try {
          await callbackDispatcher.dispatchStatus(dlrUrl, sentPayload, callback_data);
        } catch (err) {
          logger.error('Delayed RCS_SENT callback failed', { callbackData: callback_data, error: err.message });
        }
      }, 5000);

      return;
    } catch (rcsError) {
      await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED);

      const failedPayload = buildMoeStatusPayload(
        MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
        callback_data,
        rcsError.message
      );
      await callbackDispatcher.dispatchStatus(dlrUrl, failedPayload, callback_data);

      if (includesSms && sms) {
        const assistantId = message.rcs?.bot_id || client.rcs_assistant_id || null;
        await attemptSms(message, client, dlrUrl, assistantId);
      }
      return;
    }
  }

  if (includesSms && sms) {
    const assistantId = message.rcs?.bot_id || client.rcs_assistant_id || null;
    await attemptSms(message, client, dlrUrl, assistantId);
    return;
  }
}

async function attemptSms(message, client, dlrUrl, assistantId = null) {
  const { callback_data, destination, sms } = message;
  const resolvedAssistantId = assistantId || client.rcs_assistant_id || null;

  try {
    const mappings = await trackLinkRepo.getMappingsByClient(client.id);
    const { modifiedText, trackLinkIds, hasUrl } = processMessageLinks(sms.message || sms.text, mappings);

    let smsResponse;
    if (hasUrl) {
      smsResponse = await sparcClient.sendLinkSMS(
        client,
        { ...sms, message: modifiedText },
        destination,
        trackLinkIds
      );
    } else {
      smsResponse = await sparcClient.sendSMS(
        client,
        sms,
        destination,
        resolvedAssistantId
      );
    }

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT);

    if (smsResponse?.transactionId) {
      await messageRepo.updateTransactionId(callback_data, String(smsResponse.transactionId));
    }

    const smsPayload = buildMoeStatusPayload(MESSAGE_STATUSES.SMS_SENT, callback_data);

    setTimeout(async () => {
      try {
        await callbackDispatcher.dispatchStatus(dlrUrl, smsPayload, callback_data);
      } catch (err) {
        logger.error('Delayed SMS_SENT callback failed', { callbackData: callback_data, error: err.message });
      }
    }, 5000);

  } catch (smsError) {
    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.SMS_SENT_FAILED);

    const smsFailPayload = buildMoeStatusPayload(
      MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
      callback_data,
      smsError.message
    );
    await callbackDispatcher.dispatchStatus(dlrUrl, smsFailPayload, callback_data);
  }
}

function buildMoeStatusPayload(moeStatus, callbackData, errorMessage) {
  const item = {
    status: moeStatus,
    callback_data: callbackData ? String(callbackData).replace(/^moe_/, '') : callbackData,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };

  if (errorMessage && FAILED_STATUSES.has(moeStatus)) {
    item.error_message = errorMessage;
  }
  return { statuses: [item] };
}

module.exports = { processMessage, attemptSms, buildMoeStatusPayload };

'use strict';

/**
 * src/services/clevertapService.js
 * Orchestrates RCS sending and SMS fallback for CleverTap.
 */

const sparcClient = require('./sparcClient');
const { mapInbound } = require('../mappers/clevertapMapper');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Process a CleverTap message request.
 */
async function processMessage(payload, client) {
  const { msgId, to, rcsContent, smsContent } = payload;
  const callback_data = msgId;

  try {
    const sparcPayload = mapInbound(payload, env.SPARC_WEBHOOK_URL, client);
    const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);


    // Validate response
    if (Array.isArray(sparcResponse) && sparcResponse[0]?.status?.toUpperCase() !== 'SUCCESS') {
       throw new Error(`SPARC Rejected: ${sparcResponse[0]?.error || 'Unknown'}`);
    } else if (sparcResponse?.failed && sparcResponse.failed.length > 0) {
       throw new Error(`SPARC Rejected: ${sparcResponse.failed[0].error}`);
    }

    const messageId = sparcPayload.messages[0].message_id;
    const submissionId = sparcResponse.submission_id || sparcResponse[0]?.callback_data;

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, submissionId || messageId);

    logger.info('CleverTap RCS sent successfully', { msgId, submissionId });

  } catch (rcsError) {
    logger.warn('CleverTap RCS failed, trying SMS fallback', { msgId, error: rcsError.message });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED);

    if (smsContent || payload.sms) {
      await attemptSms(payload, client);
    } else {
      logger.info('No SMS fallback content provided for CleverTap message', { msgId });
    }
  }
}

/**
 * Attempt SMS Fallback for CleverTap.
 */
async function attemptSms(payload, client) {
  const { msgId, to, smsContent, sms } = payload;
  const smsBlock = smsContent || sms;
  
  if (!smsBlock) return;

  try {
    // URL tracking for SMS
    const mappings = await trackLinkRepo.getMappingsByClient(client.id);
    const { modifiedText, trackLinkIds, hasUrl } = processMessageLinks(smsBlock.body || smsBlock.message, mappings);

    let smsResponse;
    if (hasUrl) {
      await messageRepo.updateHasUrl(msgId, 1);
      smsResponse = await sparcClient.sendLinkSMS(
        client,
        { 
          sender: smsBlock.senderId || smsBlock.sender, 
          message: modifiedText,
          template_id: smsBlock.templateId || smsBlock.template_id
        },
        to,
        trackLinkIds
      );
    } else {
      await messageRepo.updateHasUrl(msgId, 0);
      smsResponse = await sparcClient.sendSMS(
        client,
        { 
          sender: smsBlock.senderId || smsBlock.sender, 
          message: smsBlock.body || smsBlock.message,
          template_id: smsBlock.templateId || smsBlock.template_id
        },
        to
      );
    }

    logger.info('CleverTap SMS fallback sent', { msgId, transactionId: smsResponse?.transactionId });

    await messageRepo.updateStatus(msgId, MESSAGE_STATUSES.SMS_SENT);

    if (smsResponse?.transactionId) {
       await messageRepo.updateSparcTransactionId(msgId, smsResponse.transactionId);
    }

  } catch (smsError) {
    logger.error('CleverTap SMS fallback failed', { msgId, error: smsError.message });
    await messageRepo.updateStatus(msgId, MESSAGE_STATUSES.SMS_SENT_FAILED);
  }
}

module.exports = {
  processMessage,
  attemptSms,
};

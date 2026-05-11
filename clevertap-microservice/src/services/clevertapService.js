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

    // 🔍 DIAGNOSTIC: Log exactly what is being sent to SPARC
    logger.info('[CT-DIAG] Sending to SPARC', { 
      assistantId: sparcPayload.messages?.[0]?.addresses?.[0]?.assistant_id,
      destination: sparcPayload.messages?.[0]?.addresses?.[0]?.mobile_number
    });

    const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);

    // 🔍 DIAGNOSTIC: Log the FULL raw response from SPARC
    logger.info('[CT-DIAG] Raw SPARC Response', { response: JSON.stringify(sparcResponse) });

    // Validate response
    const hasFailures = sparcResponse.failed && sparcResponse.failed.length > 0;
    const sparcStatus = (sparcResponse?.status || (Array.isArray(sparcResponse) ? sparcResponse[0]?.status : '') || '').toUpperCase();
    const isSuccess = !hasFailures && (
      sparcStatus.includes('SUCCESS') || 
      sparcResponse?.success === true ||
      sparcResponse?.message === 'Successfull'
    );

    // 🔍 DIAGNOSTIC: Log decision
    logger.info('[CT-DIAG] Success check', { hasFailures, sparcStatus, isSuccess });

    if (!isSuccess) {
       const firstFail = sparcResponse.failed?.[0] || {};
       const errorMsg = firstFail.error || firstFail.description || firstFail.status || firstFail.reason ||
                        (Array.isArray(sparcResponse) && sparcResponse[0]?.error) ||
                        (sparcResponse.message !== 'Successfull' ? sparcResponse.message : null) ||
                        sparcResponse.description || 
                        'SPARC Rejected Submission';
       throw new Error(errorMsg);
    }

    const messageId = sparcPayload.messages[0].message_id;
    const submissionId = sparcResponse.submission_id || sparcResponse[0]?.callback_data;

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, submissionId || messageId);
    logger.info('[CT-DIAG] ✅ RCS sent successfully — NO SMS fallback will trigger', { msgId });

  } catch (rcsError) {
    logger.warn('[CT-DIAG] ❌ RCS FAILED — Triggering SMS fallback', { msgId, error: rcsError.message });

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED);

    if (smsContent || payload.sms) {
      logger.warn('[CT-DIAG] 📱 SMS fallback executing now', { msgId });
      await attemptSms(payload, client);
    } else {
      logger.info('[CT-DIAG] No SMS fallback content available', { msgId });
    }

    // Re-throw so controller returns the official failure payload
    throw rcsError;
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

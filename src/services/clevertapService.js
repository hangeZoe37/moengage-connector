'use strict';

/**
 * src/services/clevertapService.js
 * Orchestrates RCS sending and SMS fallback for CleverTap.
 */

const sparcClient = require('./sparcClient');
const callbackDispatcher = require('./callbackDispatcher');
const { mapInbound } = require('../mappers/clevertapMapper');
const messageRepo = require('../repositories/messageRepo');
const trackLinkRepo = require('../repositories/trackLinkRepo');
const { processMessageLinks } = require('../utils/urlProcessor');
const { CHANNELS, MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Process a CleverTap message request.
 */
async function processMessage(payload, client) {
  const { msgId, to, rcsContent, smsContent, callbackURL } = payload;
  const callback_data = msgId; // Store msgId in callback_data for matching DLRs

  // 1. Initial Log Setup (already done by controller, but we update status here)
  
  // 2. Try RCS
  try {
    const sparcPayload = mapInbound(payload, env.SPARC_WEBHOOK_URL);
    const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);

    logger.debug('CleverTap RCS submission response', { msgId, sparcResponse });

    // Validate response
    if (Array.isArray(sparcResponse) && sparcResponse[0]?.status?.toUpperCase() !== 'SUCCESS') {
       throw new Error(`SPARC Rejected: ${sparcResponse[0]?.error || 'Unknown'}`);
    } else if (sparcResponse?.failed && sparcResponse.failed.length > 0) {
       throw new Error(`SPARC Rejected: ${sparcResponse.failed[0].error}`);
    }

    const messageId = sparcPayload.messages[0].message_id;
    const submissionId = sparcResponse.submission_id || sparcResponse[0]?.callback_data;

    await messageRepo.updateStatusByConnector(callback_data, MESSAGE_STATUSES.RCS_SENT, 'CLEVERTAP', submissionId || messageId);

    logger.info('CleverTap RCS sent successfully', { msgId, submissionId });

  } catch (rcsError) {
    logger.warn('CleverTap RCS failed, trying SMS fallback', { msgId, error: rcsError.message });

    await messageRepo.updateStatusByConnector(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED, 'CLEVERTAP');

    // 3. SMS Fallback
    if (smsContent) {
      await attemptSms(payload, client);
    } else {
      // No SMS fallback provided, notify CleverTap of failure
      logger.info('No SMS fallback content provided for CleverTap message', { msgId });
      // We don't dispatch failure here, usually we wait for DLR or handle it in callbackDispatcher
    }
  }
}

/**
 * Attempt SMS Fallback for CleverTap.
 */
async function attemptSms(payload, client) {
  const { msgId, to, smsContent } = payload;
  
  try {
    // URL tracking for SMS
    const mappings = await trackLinkRepo.getMappingsByClient(client.id, client.connector_type || 'CLEVERTAP');
    const { modifiedText, trackLinkIds, hasUrl } = processMessageLinks(smsContent.body, mappings);

    let smsResponse;
    if (hasUrl) {
      await messageRepo.updateHasUrlByConnector(msgId, 1, 'CLEVERTAP');
      smsResponse = await sparcClient.sendLinkSMS(
        client,
        { 
          sender: smsContent.senderId, 
          message: modifiedText,
          template_id: smsContent.templateId
        },
        to,
        trackLinkIds
      );
    } else {
      await messageRepo.updateHasUrlByConnector(msgId, 0, 'CLEVERTAP');
      smsResponse = await sparcClient.sendSMS(
        client,
        { 
          sender: smsContent.senderId, 
          message: smsContent.body,
          template_id: smsContent.templateId
        },
        to
      );
    }

    logger.info('CleverTap SMS fallback sent', { msgId, transactionId: smsResponse?.transactionId });

    await messageRepo.updateStatusByConnector(msgId, MESSAGE_STATUSES.SMS_SENT, 'CLEVERTAP');

    if (smsResponse?.transactionId) {
       const sql = 'UPDATE message_logs SET sparc_transaction_id = ? WHERE callback_data = ?';
       await db.connectorQuery('CLEVERTAP', sql, [String(smsResponse.transactionId), msgId]).catch(err => {
         logger.warn('Failed to store CleverTap SMS transactionId', { msgId, error: err.message });
       });
    }

  } catch (smsError) {
    logger.error('CleverTap SMS fallback failed', { msgId, error: smsError.message });
    await messageRepo.updateStatusByConnector(msgId, MESSAGE_STATUSES.SMS_SENT_FAILED, 'CLEVERTAP');
  }
}

module.exports = {
  processMessage,
  attemptSms,
};

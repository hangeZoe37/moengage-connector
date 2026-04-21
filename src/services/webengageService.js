'use strict';

/**
 * src/services/webengageService.js
 * Orchestrates RCS sending for WebEngage.
 */

const sparcClient = require('./sparcClient');
const { mapInbound } = require('../mappers/webengageMapper');
const messageRepo = require('../repositories/messageRepo');
const { MESSAGE_STATUSES } = require('../config/constants');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Process a WebEngage message request.
 */
async function processMessage(payload, client) {
  const { metadata } = payload;
  const { messageId } = metadata;
  let callback_data = messageId;
  if (callback_data && !callback_data.startsWith('web_')) {
    callback_data = `web_${callback_data}`;
  }
  try {
    const sparcPayload = mapInbound(payload, env.SPARC_WEBHOOK_URL);
    const sparcResponse = await sparcClient.sendRCS(client, sparcPayload);

    logger.debug('WebEngage RCS submission response', { messageId, sparcResponse });

    // Validate response from SPARC
    // SPARC V2 response check: { status_code, message, submission_id, success[], failed[] }
    if (sparcResponse?.status_code && sparcResponse.status_code !== 200) {
       throw new Error(`SPARC Error: ${sparcResponse.message || 'Unknown'}`);
    }

    if (sparcResponse?.failed && sparcResponse.failed.length > 0) {
       throw new Error(`SPARC Rejected: ${sparcResponse.failed[0].error}`);
    }

    const internalMsgId = sparcPayload.messages[0].message_id;
    const submissionId = sparcResponse.submission_id || internalMsgId;

    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT, submissionId);

    logger.info('WebEngage RCS sent successfully to SPARC', { messageId, submissionId });

  } catch (error) {
    logger.error('WebEngage RCS delivery failed', { messageId, error: error.message });
    await messageRepo.updateStatus(callback_data, MESSAGE_STATUSES.RCS_SENT_FAILED);
    // Note: WebEngage doesn't define a standard SMS fallback in its RSP spec.
    // DLR controller will handle global fallback if configured in the original message log.
  }
}

module.exports = {
  processMessage,
};

'use strict';

const sparcClient = require('./sparcClient');
const messageRepo = require('../repositories/messageRepo');
const webengageMapper = require('../mappers/webengageMapper');
const logger = require('../config/logger');
const { env } = require('../config/env');

async function processInbound(payload, client) {
  const { rcsData, metadata } = payload;
  const originalId = metadata.messageId;
  const prefixedId = `web_${originalId}`;

  logger.info('Processing WebEngage message', { originalId, recipient: rcsData.toNumber });

  // 1. Prepare SPARC payload
  const sparcPayload = webengageMapper.mapToSparc(
    { 
      ...payload, 
      metadata: { ...metadata, messageId: prefixedId } 
    },
    env.SPARC_WEBHOOK_URL
  );

  // 2. Prepare client credentials
  const credentials = {
    username: client.rcs_username,
    password: client.rcs_password
  };

  // 3. Save to DB (Queued state)
  await messageRepo.create({
    client_id: client.id,
    callback_data: prefixedId,
    recipient: rcsData.toNumber.replace('+', ''),
    status: 'QUEUED',
    channel: 'rcs',
    raw_payload: payload,
    fallback_order: ['rcs'],
    bot_id: rcsData.sender,
    template_name: rcsData.templateData ? rcsData.templateData.templateName : null
  });

  // 4. Submit to SPARC
  try {
    const response = await sparcClient.sendMessage(sparcPayload, credentials);
    
    const sparcMessage = (response.message || '').toUpperCase();
    const hasFailures = response.failed && response.failed.length > 0;
    const isSuccess = !hasFailures && (
      response.status?.toUpperCase() === 'SUCCESS' || 
      response.success === true || 
      sparcMessage === 'SUCCESSFULL' || 
      sparcMessage === 'SUCCESS' ||
      response.status_code === 200
    );

    if (isSuccess) {
      await messageRepo.updateStatus(prefixedId, 'RCS_SENT');
      return { status: 'rcs_accepted', statusCode: 0, message: 'Success' };
    } else {
      // Priority: Find ANY error signal in the failed array
      const firstFail = response.failed?.[0] || {};
      const errorMsg = firstFail.error || firstFail.description || firstFail.status || firstFail.reason || 
                       (response.message !== 'Successfull' ? response.message : null) || 
                       'SPARC submission failed';
      
      throw new Error(errorMsg);
    }
  } catch (error) {
    await messageRepo.updateStatus(prefixedId, 'RCS_SENT_FAILED');
    throw error;
  }
}

module.exports = {
  processInbound
};

'use strict';

/**
 * src/services/sparcClient.js
 * Handles communication with SPARC V2 APIs (RCS and SMS).
 */

const axios = require('axios');
const { env } = require('../config/env');
const logger = require('../config/logger');

const TIMEOUT = 15000;

/**
 * Send RCS message via SPARC.
 */
async function sendRCS(client, payload) {
  const url = `${env.SPARC_API_BASE_URL}/rcs/sendmessage`;
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'serviceAccountName': client.rcs_username,
        'apiPassword': client.rcs_password,
      },
      timeout: TIMEOUT
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    logger.error('SPARC RCS API Error', { status, data, msg: error.message });
    throw new Error(data?.message || error.message);
  }
}

/**
 * Send SMS via SPARC (Basic).
 */
async function sendSMS(client, smsData, to) {
  const url = `${env.SPARC_SMS_API_BASE_URL}/api/v1/send`;
  const toNumber = to.replace(/^\+/, '');
  
  const params = {
    username: env.SPARC_SMS_USERNAME,
    password: env.SPARC_SMS_PASSWORD,
    from: smsData.sender,
    to: toNumber,
    text: smsData.message,
    unicode: 1,
  };

  if (smsData.template_id) {
    params.dltContentId = smsData.template_id;
  }

  try {
    const response = await axios.post(url, null, { params, timeout: TIMEOUT, headers: { accept: 'application/json' } });
    return response.data;
  } catch (error) {
    logger.error('SPARC SMS API Error', { status: error.response?.status, data: error.response?.data, error: error.message });
    throw error;
  }
}

/**
 * Send SMS with tracked links via SPARC.
 */
async function sendLinkSMS(client, smsData, to, trackLinkIds) {
  const url = `${env.SPARC_SMS_API_BASE_URL}/api/v1/sendLink`;
  const toNumber = to.replace(/^\+/, '');

  const params = {
    username: env.SPARC_SMS_USERNAME,
    password: env.SPARC_SMS_PASSWORD,
    from: smsData.sender,
    to: toNumber,
    text: smsData.message,
    trackLinkId: trackLinkIds,
    unicode: 1
  };

  if (smsData.template_id) {
    params.dltContentId = smsData.template_id;
  }

  try {
    const response = await axios.post(url, null, { params, timeout: TIMEOUT, headers: { accept: 'application/json' } });
    return response.data;
  } catch (error) {
    logger.error('SPARC Link SMS API Error', { status: error.response?.status, data: error.response?.data, error: error.message });
    throw error;
  }
}

module.exports = {
  sendRCS,
  sendSMS,
  sendLinkSMS
};

'use strict';

/**
 * src/services/sparcClient.js
 * All SPARC API calls. Axios with client credentials.
 */

const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { env } = require('../config/env');
const { SPARC_REQUEST_TIMEOUT_MS } = require('../config/constants');
const logger = require('../config/logger');

// Global Axios configuration for retries
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors and 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500);
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn('Retrying SPARC API call', {
      retryCount,
      url: requestConfig.url,
      error: error.message
    });
  }
});

/**
 * Create an Axios instance pre-configured with SPARC auth headers for a client.
 * @param {object} clientData - Client row from DB
 * @returns {import('axios').AxiosInstance}
 */
function createClient(clientData) {
  return axios.create({
    baseURL: env.SPARC_API_BASE_URL,
    timeout: SPARC_REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'serviceAccountName': clientData.rcs_username || env.SPARC_SERVICE_ACCOUNT,
      'apiPassword': clientData.rcs_password || env.SPARC_API_PASSWORD,
    },
  });
}

/**
 * Send an RCS message via SPARC.
 * POST {SPARC_API_BASE_URL}/rcs/sendmessage
 *
 * @param {object} clientData - Client row from DB
 * @param {object} sparcPayload - SPARC-formatted payload from inboundMapper
 * @returns {Promise<object>} SPARC API response data
 */
async function sendRCS(clientData, sparcPayload) {
  const client = createClient(clientData);

  logger.info('Calling SPARC RCS sendmessage', {
    clientId: clientData.id,
    messageId: sparcPayload.messages?.[0]?.message_id,
  });

  try {
    const response = await client.post('/rcs/sendmessage', sparcPayload);

    logger.info('SPARC RCS sendmessage succeeded', {
      clientId: clientData.id,
      messageId: sparcPayload.messages?.[0]?.message_id,
      status: response.status,
    });

    return response.data;
  } catch (error) {
    logger.error('SPARC RCS sendmessage failed', {
      clientId: clientData.id,
      messageId: sparcPayload.messages?.[0]?.message_id,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

/**
 * Send an SMS message via SPARC SMS Gateway (fallback).
 * POST https://pgapi.sparc.smartping.io/fe/api/v1/send?username=...&password=...&from=...&text=...&to=...
 *
 * @param {object} clientData - Client row from DB
 * @param {object} smsData    - sms{} block from MoEngage payload { sender, message, template_id }
 * @param {string} destination - Phone number in E.164 format (e.g. +919876543210)
 * @returns {Promise<object>} SPARC SMS API response data
 */
async function sendSMS(clientData, smsData, destination) {
  // SPARC SMS uses a completely different base URL + credentials from RCS
  const smsBaseUrl = env.SPARC_SMS_API_BASE_URL;
  const username = clientData.sms_username || env.SPARC_SMS_USERNAME;
  const password = clientData.sms_password || env.SPARC_SMS_PASSWORD;

  // Normalise phone: SPARC SMS wants digits only (no + prefix), e.g. 919876543210
  const toNumber = destination.replace(/^\+/, '');

  // Build query-param object
  const params = {
    username,
    password,
    unicode: 1,    // SPARC SMS API requires integer 1, not boolean true

    from: smsData.sender,
    text: smsData.message,
    to: toNumber,
  };

  // Attach DLT template ID if present (mandatory for Indian numbers)
  if (smsData.template_id) {
    params.dltContentId = smsData.template_id;
  }

  logger.info('Calling SPARC SMS send API', {
    clientId: clientData.id,
    to: toNumber,
    from: smsData.sender,
  });

  try {
    const response = await axios.post(
      `${smsBaseUrl}/api/v1/send`,
      null,           // no request body — all params are in query string
      {
        params,
        timeout: SPARC_REQUEST_TIMEOUT_MS,
        headers: { accept: 'application/json' },
      }
    );

    logger.info('SPARC SMS send succeeded', {
      clientId: clientData.id,
      to: toNumber,
      transactionId: response.data?.transactionId,
      state: response.data?.state,
    });

    return response.data;
  } catch (error) {
    const sparcError = error.response?.data?.description || error.message;
    logger.error('SPARC SMS send failed', {
      clientId: clientData.id,
      to: toNumber,
      error: sparcError,
      status: error.response?.status,
      data: error.response?.data,
    });
    const customError = new Error(sparcError);
    customError.response = error.response;
    throw customError;
  }
}

/**
 * Send an SMS message containing tracked links via SPARC.
 * POST https://pgapi.sparc.smartping.io/fe/api/v1/sendLink?username=...&trackLinkId=...
 * 
 * @param {object} clientData - Client row from DB
 * @param {object} smsData    - sms{} block from MoEngage payload
 * @param {string} destination - Phone number
 * @param {string} trackLinkIds - Comma separated trackLinkIds
 * @returns {Promise<object>}
 */
async function sendLinkSMS(clientData, smsData, destination, trackLinkIds) {
  const smsBaseUrl = env.SPARC_SMS_API_BASE_URL;
  const username = clientData.sms_username || env.SPARC_SMS_USERNAME;
  const password = clientData.sms_password || env.SPARC_SMS_PASSWORD;
  const toNumber = destination.replace(/^\+/, '');

  const params = {
    username,
    password,
    unicode: true,
    from: smsData.sender,
    text: smsData.message, // This should already be processed with placeholders
    to: toNumber,
    trackLinkId: trackLinkIds
  };

  if (smsData.template_id) {
    params.dltContentId = smsData.template_id;
  }

  logger.info('Calling SPARC SMS sendLink API', {
    clientId: clientData.id,
    to: toNumber,
    trackLinkIds,
  });

  try {
    const response = await axios.post(
      `${smsBaseUrl}/api/v1/sendLink`,
      null,
      {
        params,
        timeout: SPARC_REQUEST_TIMEOUT_MS,
        headers: { accept: 'application/json' },
      }
    );

    return response.data;
  } catch (error) {
    const sparcError = error.response?.data?.description || error.message;
    logger.error('SPARC SMS sendLink failed', {
      clientId: clientData.id,
      to: toNumber,
      error: sparcError,
      data: error.response?.data,
    });
    const customError = new Error(sparcError);
    customError.response = error.response;
    throw customError;
  }
}

/**
 * Fetch assistants from SPARC.
 * GET {SPARC_API_BASE_URL}/rcs/fetchassistants
 *
 * @param {object} clientData - Client row from DB
 * @returns {Promise<object>}
 */
async function fetchAssistants(clientData) {
  const client = createClient(clientData);

  try {
    const response = await client.get('/rcs/fetchassistants');
    return response.data;
  } catch (error) {
    logger.error('SPARC fetchassistants failed', {
      clientId: clientData.id,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { sendRCS, sendSMS, sendLinkSMS, fetchAssistants, createClient };

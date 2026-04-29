'use strict';

const axios = require('axios');
const { env } = require('../config/env');
const logger = require('../config/logger');

/**
 * Communicates with SPARC V2 APIs.
 * Uses client-specific credentials passed from the controller.
 */
async function sendMessage(payload, credentials) {
  const { username, password } = credentials;
  // Sync with Port 3000 endpoint path
  const url = `${env.SPARC_API_BASE_URL}/rcs/sendmessage`;

  logger.debug('Sending request to SPARC', { url, recipient: payload.recipient });

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'serviceAccountName': username,
        'apiPassword': password,
      },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    logger.error('SPARC API Error', { status, data, recipient: payload.recipient });
    throw new Error(data?.message || error.message);
  }
}

module.exports = {
  sendMessage
};

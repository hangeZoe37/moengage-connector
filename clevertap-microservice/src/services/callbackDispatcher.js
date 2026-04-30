'use strict';

/**
 * src/services/callbackDispatcher.js
 * POSTs status/interaction updates to CleverTap callback URL.
 * Includes retry logic with exponential backoff.
 */

const axios = require('axios');
const logger = require('../config/logger');
const { RETRY_CONFIG, CONNECTOR_CALLBACK_TIMEOUT_MS } = require('../config/constants');
const dispatchRepo = require('../repositories/dispatchRepo');

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dispatch a callback payload to CleverTap.
 *
 * @param {string} callbackUrl - The target URL
 * @param {object} payload - The CleverTap-formatted payload
 * @param {string} callbackData - Reconciliation key
 * @param {string} payloadType - Type of payload (STATUS, INTERACTION, etc.)
 * @returns {Promise<boolean>}
 */
async function dispatch(callbackUrl, payload, callbackData, payloadType) {
  if (!callbackUrl) {
    logger.warn('No callback URL provided for dispatch', { callbackData, payloadType });
    return false;
  }

  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      logger.info('Forwarding callback to CleverTap', { callbackData, url: callbackUrl });
      logger.info('--- [CLEVERTAP CALLBACK PAYLOAD START] ---');
      logger.info(JSON.stringify(payload, null, 2));
      logger.info('--- [CLEVERTAP CALLBACK PAYLOAD END] ---');

      const response = await axios.post(callbackUrl, payload, {
        timeout: CONNECTOR_CALLBACK_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });

      const success = response.status >= 200 && response.status < 300;

      // Log attempt to DB
      await dispatchRepo.create({
        callback_data: callbackData,
        payload_type: payloadType,
        attempt_number: attempt,
        http_status: response.status,
        success,
        error_message: null,
      }).catch(err => logger.error('Failed to log dispatch to DB', { error: err.message }));

      if (success) {
        logger.info('CleverTap callback dispatched successfully', {
          callbackData,
          payloadType,
          attempt,
        });
        return true;
      }

      logger.warn('CleverTap callback returned non-2xx', {
        callbackData,
        attempt,
        status: response.status,
      });
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      logger.warn('CleverTap callback dispatch failed', {
        callbackData,
        attempt,
        error: errorMsg,
      });

      await dispatchRepo.create({
        callback_data: callbackData,
        payload_type: payloadType,
        attempt_number: attempt,
        http_status: error.response?.status || null,
        success: false,
        error_message: errorMsg,
      }).catch(err => logger.error('Failed to log failed dispatch to DB', { error: err.message }));
    }

    if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
      const delay = RETRY_CONFIG.DELAYS_MS[attempt - 1] || 3000;
      await sleep(delay);
    }
  }

  logger.error('All CleverTap callback dispatch attempts failed', { callbackData, payloadType });
  return false;
}

module.exports = { dispatch };

'use strict';

/**
 * src/services/callbackDispatcher.js
 * POSTs to MoEngage DLR URL. Handles retries with exponential backoff.
 * 3 attempts: 1s → 2s → 3s
 */

const axios = require('axios');
const logger = require('../config/logger');
const { RETRY_CONFIG, MOE_CALLBACK_TIMEOUT_MS, PAYLOAD_TYPES } = require('../config/constants');
const dispatchRepo = require('../repositories/dispatchRepo');

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dispatch a callback payload to MoEngage DLR URL with retry logic.
 *
 * @param {string} dlrUrl - MoEngage DLR callback URL for this workspace
 * @param {object} payload - MoEngage-formatted callback payload (statuses or events)
 * @param {string} callbackData - The reconciliation key for logging
 * @param {string} payloadType - PAYLOAD_TYPES.STATUS or PAYLOAD_TYPES.SUGGESTION
 * @returns {Promise<boolean>} true if MoEngage accepted (2xx), false if all retries failed
 */
async function dispatch(dlrUrl, payload, callbackData, payloadType) {
  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      logger.info('Dispatching callback to MoEngage', {
        callbackData,
        payloadType,
        attempt,
        url: dlrUrl,
      });

      const response = await axios.post(dlrUrl, payload, {
        timeout: MOE_CALLBACK_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });

      const success = response.status >= 200 && response.status < 300;

      // Log dispatch attempt to DB
      await dispatchRepo.create({
        callback_data: callbackData,
        payload_type: payloadType,
        attempt_number: attempt,
        http_status: response.status,
        success,
        error_message: null,
      });

      if (success) {
        logger.info('MoEngage callback dispatched successfully', {
          callbackData,
          payloadType,
          attempt,
          httpStatus: response.status,
        });
        return true;
      }

      logger.warn('MoEngage callback returned non-2xx', {
        callbackData,
        payloadType,
        attempt,
        httpStatus: response.status,
      });
    } catch (error) {
      const errorMsg = error.message || 'Unknown error';

      logger.warn('MoEngage callback dispatch failed', {
        callbackData,
        payloadType,
        attempt,
        error: errorMsg,
      });

      // Log failed attempt to DB
      await dispatchRepo.create({
        callback_data: callbackData,
        payload_type: payloadType,
        attempt_number: attempt,
        http_status: error.response?.status || null,
        success: false,
        error_message: errorMsg,
      }).catch((dbErr) => {
        logger.error('Failed to log dispatch attempt to DB', {
          callbackData,
          error: dbErr.message,
        });
      });
    }

    // Wait before retrying (skip wait on last attempt)
    if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
      const delay = RETRY_CONFIG.DELAYS_MS[attempt - 1] || 3000;
      await sleep(delay);
    }
  }

  logger.error('All MoEngage callback dispatch attempts failed', {
    callbackData,
    payloadType,
    totalAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
  });

  return false;
}

/**
 * Dispatch a status callback to MoEngage.
 */
async function dispatchStatus(dlrUrl, payload, callbackData) {
  return dispatch(dlrUrl, payload, callbackData, PAYLOAD_TYPES.STATUS);
}

/**
 * Dispatch a suggestion click callback to MoEngage.
 */
async function dispatchSuggestion(dlrUrl, payload, callbackData) {
  return dispatch(dlrUrl, payload, callbackData, PAYLOAD_TYPES.SUGGESTION);
}

module.exports = { dispatch, dispatchStatus, dispatchSuggestion };

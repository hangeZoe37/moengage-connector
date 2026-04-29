'use strict';

const axios = require('axios');
const logger = require('../config/logger');

async function dispatch(url, payload, callbackData, label = 'Callback') {
  logger.info(`Dispatching ${label}`, { url, callbackData });

  // Pretty-print the payload exactly like Port 3000
  logger.info('--- [WEBENGAGE CALLBACK PAYLOAD START] ---');
  logger.info(JSON.stringify(payload, null, 2));
  logger.info('--- [WEBENGAGE CALLBACK PAYLOAD END] ---');

  try {
    const response = await axios.post(url, payload, { timeout: 10000 });
    logger.info(`${label} acknowledged by receiver`, { status: response.status, callbackData });
    return true;
  } catch (error) {
    logger.warn(`${label} dispatch failed`, {
      url,
      callbackData,
      status: error.response?.status,
      error: error.message
    });
    return false;
  }
}

module.exports = {
  dispatch
};

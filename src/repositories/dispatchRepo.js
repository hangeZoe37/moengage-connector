'use strict';

/**
 * src/repositories/dispatchRepo.js
 * SQL operations for callback_dispatch_log table.
 */

const { query } = require('../config/db');

/**
 * Log a callback dispatch attempt.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function create(params) {
  const {
    callback_data,
    payload_type,
    attempt_number,
    http_status,
    success,
    error_message,
  } = params;

  return query(
    `INSERT INTO callback_dispatch_log
      (callback_data, payload_type, attempt_number, http_status, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      callback_data,
      payload_type,
      attempt_number,
      http_status || null,
      success ? 1 : 0,
      error_message || null,
    ]
  );
}

/**
 * Find dispatch logs by callback_data.
 * @param {string} callbackData
 * @returns {Promise<Array>}
 */
async function findByCallbackData(callbackData) {
  return query(
    'SELECT * FROM callback_dispatch_log WHERE callback_data = ? ORDER BY dispatched_at ASC',
    [callbackData]
  );
}

module.exports = { create, findByCallbackData };

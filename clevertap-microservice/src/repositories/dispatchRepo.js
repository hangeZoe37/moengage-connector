'use strict';

/**
 * src/repositories/dispatchRepo.js
 * Logs callback dispatch attempts to CleverTap.
 */

const { pools } = require('../config/db');

async function create(dispatchData) {
  const {
    callback_data,
    payload_type,
    attempt_number,
    http_status,
    success,
    error_message
  } = dispatchData;

  const sql = `
    INSERT INTO callback_dispatches (
      callback_data, payload_type, attempt_number,
      http_status, success, error_message, dispatched_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;

  const [result] = await pools.CLEVERTAP.query(sql, [
    callback_data,
    payload_type,
    attempt_number,
    http_status || null,
    success ? 1 : 0,
    error_message || null
  ]);

  return result;
}

module.exports = {
  create
};

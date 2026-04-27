'use strict';

const { pools } = require('../config/db');

async function create(params) {
  const {
    callback_data,
    payload_type,
    attempt_number,
    http_status,
    success,
    error_message,
  } = params;

  return pools.MOENGAGE.query(
    `INSERT INTO callback_dispatch_log
      (callback_data, payload_type, attempt_number, http_status, success, error_message, dispatched_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      callback_data,
      payload_type || 'STATUS',
      attempt_number || 1,
      http_status || null,
      success ? 1 : 0,
      error_message || null,
    ]
  );
}

module.exports = { create };

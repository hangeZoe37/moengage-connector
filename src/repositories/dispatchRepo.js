'use strict';

/**
 * src/repositories/dispatchRepo.js
 * SQL operations for connector-specific callback_dispatch_log table.
 */

const { query } = require('../config/db');

/**
 * Resolve the connector-specific table name based on payload type.
 * @param {string} payloadType
 * @returns {string}
 */
function dispatchTable(payloadType) {
  if (typeof payloadType === 'string' && payloadType.includes('CLEVERTAP')) {
    return 'clevertap_callback_dispatch_log';
  }
  return 'moengage_callback_dispatch_log';
}

/**
 * Insert a callback dispatch log entry directly into the connector table ONLY.
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

  const specificTable = dispatchTable(payload_type);

  return query(
    `INSERT INTO ${specificTable}
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

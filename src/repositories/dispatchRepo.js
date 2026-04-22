'use strict';

/**
 * src/repositories/dispatchRepo.js
 * SQL operations for callback_dispatch_log table.
 */

const db = require('../config/db');

function parseConnector(payloadType) {
  if (typeof payloadType === 'string') {
    if (payloadType.includes('CLEVERTAP')) return 'CLEVERTAP';
    if (payloadType.includes('WEBENGAGE')) return 'WEBENGAGE';
  }
  return 'MOENGAGE';
}

/**
 * Insert a callback dispatch log entry into the connector db.
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

  const connector = parseConnector(payload_type);

  return db.connectorQuery(
    connector,
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

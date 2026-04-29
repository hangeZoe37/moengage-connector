'use strict';

/**
 * src/repositories/dlrRepo.js
 * Handles persistence for the CleverTap DLR (Delivery Receipt) logs.
 */

const { pools } = require('../config/db');

async function create(dlrData) {
  const {
    callback_data,
    sparc_status,
    moe_status,
    error_message,
    event_timestamp
  } = dlrData;

  const sql = `
    INSERT INTO dlr_events (
      callback_data, sparc_status, moe_status, error_message,
      event_timestamp, callback_dispatched, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, NOW())
  `;

  const [result] = await pools.CLEVERTAP.query(sql, [
    callback_data,
    sparc_status,
    moe_status,
    error_message || null,
    event_timestamp ? new Date(event_timestamp * 1000) : null
  ]);

  return result;
}

async function markDispatched(id) {
  const [result] = await pools.CLEVERTAP.query(
    'UPDATE dlr_events SET callback_dispatched = 1 WHERE id = ?',
    [id]
  );
  return result;
}

module.exports = {
  create,
  markDispatched
};

'use strict';

const { pools } = require('../config/db');

async function create(dlrData) {
  const {
    callback_data,
    sparc_status,
    moe_status,
    error_message,
    event_timestamp
  } = dlrData;

  const [result] = await pools.WEBENGAGE.query(
    `INSERT INTO dlr_events (
      callback_data, sparc_status, moe_status, error_message, event_timestamp, callback_dispatched, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, NOW())`,
    [
      callback_data,
      sparc_status || null,
      moe_status || null,
      error_message || null,
      event_timestamp || null
    ]
  );
  return result;
}

async function markDispatched(id) {
  const [result] = await pools.WEBENGAGE.query(
    'UPDATE dlr_events SET callback_dispatched = 1 WHERE id = ?',
    [id]
  );
  return result;
}

module.exports = {
  create,
  markDispatched
};

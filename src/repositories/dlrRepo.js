'use strict';

/**
 * src/repositories/dlrRepo.js
 * SQL operations for dlr_events table.
 */

const { query } = require('../config/db');

/**
 * Insert a DLR event record.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function create(params) {
  const {
    callback_data,
    sparc_status,
    moe_status,
    error_message,
    event_timestamp,
  } = params;

  return query(
    `INSERT INTO dlr_events 
      (callback_data, sparc_status, moe_status, error_message, event_timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [callback_data, sparc_status, moe_status, error_message || null, event_timestamp || null]
  );
}

/**
 * Mark a DLR event as dispatched (callback sent to MoEngage successfully).
 * @param {number} dlrEventId
 * @returns {Promise<object>}
 */
async function markDispatched(dlrEventId) {
  return query(
    'UPDATE dlr_events SET callback_dispatched = 1 WHERE id = ?',
    [dlrEventId]
  );
}

/**
 * Find DLR events by callback_data.
 * @param {string} callbackData
 * @returns {Promise<Array>}
 */
async function findByCallbackData(callbackData) {
  return query(
    'SELECT * FROM dlr_events WHERE callback_data = ? ORDER BY created_at ASC',
    [callbackData]
  );
}

module.exports = { create, markDispatched, findByCallbackData };

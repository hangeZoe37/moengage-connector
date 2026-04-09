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

/**
 * Get recent DLR events across all messages, paginated.
 * Uses fully parameterized LIMIT/OFFSET — no string interpolation.
 * @param {number} limit
 * @param {number} offset
 * @param {number|null} clientId
 * @returns {Promise<Array>}
 */
async function getRecent(limit = 50, offset = 0, clientId = null) {
  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let sql    = `
    SELECT d.*, m.destination, m.message_type, c.client_name
    FROM dlr_events d
    LEFT JOIN message_logs m ON d.callback_data = m.callback_data
    LEFT JOIN clients c ON m.client_id = c.id
  `;
  const params = [];

  if (clientId) {
    sql += ' WHERE m.client_id = ?';
    params.push(clientId);
  }

  sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  return query(sql, params);
}

/**
 * Count total DLR events.
 * @param {number|null} clientId
 * @returns {Promise<number>}
 */
async function countEvents(clientId = null) {
  let sql = `
    SELECT COUNT(d.id) as total
    FROM dlr_events d
    LEFT JOIN message_logs m ON d.callback_data = m.callback_data
  `;
  const params = [];
  if (clientId) {
    sql += ' WHERE m.client_id = ?';
    params.push(clientId);
  }
  const rows = await query(sql, params);
  return rows[0]?.total || 0;
}

module.exports = { create, markDispatched, findByCallbackData, getRecent, countEvents };

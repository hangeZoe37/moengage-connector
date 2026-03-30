'use strict';

/**
 * src/repositories/messageRepo.js
 * SQL operations for message_logs table.
 */

const { query } = require('../config/db');

/**
 * Insert a new message log entry.
 * @param {object} params
 * @returns {Promise<object>} Insert result
 */
async function create(params) {
  const {
    callback_data,
    workspace_id,
    destination,
    bot_id,
    template_name,
    message_type,
    fallback_order,
    sparc_message_id,
    raw_payload,
  } = params;

  const result = await query(
    `INSERT INTO message_logs 
      (callback_data, workspace_id, destination, bot_id, template_name, 
       message_type, fallback_order, sparc_message_id, status, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)`,
    [
      callback_data,
      workspace_id,
      destination,
      bot_id,
      template_name || null,
      message_type,
      JSON.stringify(fallback_order || ['rcs']),
      sparc_message_id || null,
      JSON.stringify(raw_payload || {}),
    ]
  );
  return result;
}

/**
 * Update message status.
 * @param {string} callbackData
 * @param {string} status
 * @param {string} [sparcMessageId]
 * @returns {Promise<object>}
 */
async function updateStatus(callbackData, status, sparcMessageId = null) {
  const sql = sparcMessageId
    ? 'UPDATE message_logs SET status = ?, sparc_message_id = ? WHERE callback_data = ?'
    : 'UPDATE message_logs SET status = ? WHERE callback_data = ?';

  const params = sparcMessageId
    ? [status, sparcMessageId, callbackData]
    : [status, callbackData];

  return query(sql, params);
}

/**
 * Find a message by callback_data.
 * @param {string} callbackData
 * @returns {Promise<object|null>}
 */
async function findByCallbackData(callbackData) {
  const rows = await query(
    'SELECT * FROM message_logs WHERE callback_data = ? LIMIT 1',
    [callbackData]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { create, updateStatus, findByCallbackData };

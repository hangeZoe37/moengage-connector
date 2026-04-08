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
    client_id,
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
      (callback_data, client_id, destination, bot_id, template_name, 
       message_type, fallback_order, sparc_message_id, status, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)`,
    [
      callback_data,
      client_id,
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
 * Store the SPARC SMS transactionId on a message so SMS DLRs can be correlated.
 * @param {string} callbackData
 * @param {string} transactionId - Returned by SPARC SMS send API
 * @returns {Promise<object>}
 */
async function updateSparcTransactionId(callbackData, transactionId) {
  return query(
    'UPDATE message_logs SET sparc_transaction_id = ? WHERE callback_data = ?',
    [String(transactionId), callbackData]
  );
}

/**
 * Find a message by the SPARC SMS transactionId (used to correlate SMS DLR webhooks).
 * @param {string} transactionId
 * @returns {Promise<object|null>}
 */
async function findBySparcTransactionId(transactionId) {
  const rows = await query(
    'SELECT * FROM message_logs WHERE sparc_transaction_id = ? LIMIT 1',
    [String(transactionId)]
  );
  return rows.length > 0 ? rows[0] : null;
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

/**
 * Find a message by its numeric DB id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  const rows = await query(
    `SELECT m.*, c.client_name FROM message_logs m
     LEFT JOIN clients c ON m.client_id = c.id
     WHERE m.id = ? LIMIT 1`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get aggregated statistics grouped by status.
 */
async function getStats() {
  const rows = await query(`
    SELECT status, COUNT(*) as count 
    FROM message_logs 
    GROUP BY status
  `);
  
  const stats = {};
  for (const row of rows) {
    stats[row.status] = row.count;
  }
  return stats;
}

/**
 * Get recent logs for the dashboard table.
 */
async function getRecentLogs(limit = 50, offset = 0, clientId = null) {
  let sql = `
    SELECT m.*, c.client_name 
    FROM message_logs m
    LEFT JOIN clients c ON m.client_id = c.id
  `;
  const params = [];

  if (clientId) {
    sql += ` WHERE m.client_id = ? `;
    params.push(clientId);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)} `;

  return query(sql, params);
}

/**
 * Get hourly message volume stats for the last 24 hours.
 */
async function getTimelineStats() {
  return query(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
      status,
      COUNT(*) as count
    FROM message_logs
    WHERE created_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY hour, status
    ORDER BY hour ASC
  `);
}

/**
 * Get RCS vs SMS channel breakdown counts.
 */
async function getChannelStats() {
  const rows = await query(`
    SELECT 
      CASE 
        WHEN status LIKE 'SMS_%' THEN 'SMS'
        ELSE 'RCS'
      END AS channel,
      COUNT(*) AS count
    FROM message_logs
    GROUP BY channel
  `);
  const result = { RCS: 0, SMS: 0 };
  for (const row of rows) {
    result[row.channel] = Number(row.count);
  }
  return result;
}

/**
 * Count total messages (optionally filtered by clientId).
 */
async function countMessages(clientId = null) {
  let sql = 'SELECT COUNT(*) as total FROM message_logs';
  const params = [];
  if (clientId) {
    sql += ' WHERE client_id = ?';
    params.push(clientId);
  }
  const rows = await query(sql, params);
  return rows[0]?.total || 0;
}

module.exports = { 
  create, 
  updateStatus, 
  findByCallbackData,
  findById,
  updateSparcTransactionId,
  findBySparcTransactionId,
  getStats, 
  getRecentLogs,
  getTimelineStats,
  getChannelStats,
  countMessages,
};

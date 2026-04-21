'use strict';

/**
 * src/repositories/messageRepo.js
 * SQL operations for connector-specific message_logs tables.
 */

const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * Resolve the connector-specific table name for message logs.
 * @param {string} connectorType
 * @returns {string}
 */
function msgTable(connectorType) {
  if (connectorType === 'CLEVERTAP') return 'clevertap_message_logs';
  if (connectorType === 'WEBENGAGE') return 'webengage_message_logs';
  return 'moengage_message_logs';
}

/**
 * Insert a new message log entry directly into the connector-specific table.
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
    connector_type = 'MOENGAGE',
    callback_url = null
  } = params;

  const specificTable = msgTable(connector_type);

  const values = [
    callback_data,
    client_id,
    destination,
    bot_id,
    template_name    || null,
    message_type,
    JSON.stringify(fallback_order || ['rcs']),
    sparc_message_id || null,
    JSON.stringify(raw_payload   || {}),
    params.has_url || 0,
    connector_type,
    callback_url
  ];

  return query(
    `INSERT INTO ${specificTable}
      (callback_data, client_id, destination, bot_id, template_name,
       message_type, fallback_order, sparc_message_id, status, raw_payload,
       has_url, connector_type, callback_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, NOW(), NOW())`,
    values
  );
}

/**
 * Update message status.
 * Updates the view (which updates underlying tables if MySQL supports it, 
 * but safer to just update the specific table if connector_type is known).
 * When connector_type is unknown, we have to assume the view handles it or update both.
 * MySQL views with UNION ALL are NOT updatable. We must update the physical tables.
 * @param {string} callbackData
 * @param {string} status
 * @param {string} [sparcMessageId]
 * @returns {Promise<object>}
 */
async function updateStatus(callbackData, status, sparcMessageId = null) {
  // Since we don't know the connector here, we must try both physical tables
  // as the UNION view is not updatable in MySQL.
  const params = sparcMessageId
    ? [status, sparcMessageId, callbackData]
    : [status, callbackData];

  const sqlTemplate = sparcMessageId
    ? 'SET status = ?, sparc_message_id = ? WHERE callback_data = ?'
    : 'SET status = ? WHERE callback_data = ?';

  const [res1, res2, res3] = await Promise.all([
    query(`UPDATE moengage_message_logs ${sqlTemplate}`, params),
    query(`UPDATE clevertap_message_logs ${sqlTemplate}`, params),
    query(`UPDATE webengage_message_logs ${sqlTemplate}`, params)
  ]);
  
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

/**
 * Update message status when connector_type is known.
 * @param {string} callbackData
 * @param {string} status
 * @param {string} connectorType
 * @param {string} [sparcMessageId]
 * @returns {Promise<object>}
 */
async function updateStatusInBoth(callbackData, status, connectorType, sparcMessageId = null) {
  const specificTable = msgTable(connectorType);
  const sql = sparcMessageId
    ? `UPDATE ${specificTable} SET status = ?, sparc_message_id = ? WHERE callback_data = ?`
    : `UPDATE ${specificTable} SET status = ? WHERE callback_data = ?`;
  const params = sparcMessageId
    ? [status, sparcMessageId, callbackData]
    : [status, callbackData];

  return query(sql, params);
}

/**
 * Store the SPARC SMS transactionId.
 * @param {string} callbackData
 * @param {string} transactionId
 * @returns {Promise<object>}
 */
async function updateSparcTransactionId(callbackData, transactionId) {
  const params = [String(transactionId), callbackData];
  const [res1, res2, res3] = await Promise.all([
    query('UPDATE moengage_message_logs SET sparc_transaction_id = ? WHERE callback_data = ?', params),
    query('UPDATE clevertap_message_logs SET sparc_transaction_id = ? WHERE callback_data = ?', params),
    query('UPDATE webengage_message_logs SET sparc_transaction_id = ? WHERE callback_data = ?', params)
  ]);
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

/**
 * Store whether the message contains a tracked short URL.
 * @param {string} callbackData
 * @param {number} hasUrlFlag (1 or 0)
 * @returns {Promise<object>}
 */
async function updateHasUrl(callbackData, hasUrlFlag) {
  const params = [hasUrlFlag, callbackData];
  const [res1, res2, res3] = await Promise.all([
    query('UPDATE moengage_message_logs SET has_url = ? WHERE callback_data = ?', params),
    query('UPDATE clevertap_message_logs SET has_url = ? WHERE callback_data = ?', params),
    query('UPDATE webengage_message_logs SET has_url = ? WHERE callback_data = ?', params)
  ]);
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

/**
 * Find a message by the SPARC SMS transactionId.
 * Queries the view.
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
 * Queries the view.
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
 * Queries the view.
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
 * Queries the view.
 * @returns {Promise<object>}
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
 * Queries the view.
 * @param {number} limit
 * @param {number} offset
 * @param {number|null} clientId
 * @returns {Promise<Array>}
 */
async function getRecentLogs(limit = 50, offset = 0, clientId = null) {
  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let sql    = `SELECT m.*, c.client_name FROM message_logs m LEFT JOIN clients c ON m.client_id = c.id`;
  const params = [];

  if (clientId) {
    sql += ' WHERE m.client_id = ?';
    params.push(clientId);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  return query(sql, params);
}

/**
 * Get hourly message volume stats for the last 24 hours.
 * Queries the view.
 * @returns {Promise<Array>}
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
 * Queries the view.
 * @returns {Promise<object>}
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
 * Queries the view.
 * @param {number|null} clientId
 * @returns {Promise<number>}
 */
async function countMessages(clientId = null) {
  let sql    = 'SELECT COUNT(*) as total FROM message_logs';
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
  updateStatusInBoth,
  findByCallbackData,
  findById,
  updateSparcTransactionId,
  updateHasUrl,
  findBySparcTransactionId,
  getStats,
  getRecentLogs,
  getTimelineStats,
  getChannelStats,
  countMessages,
};

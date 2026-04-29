'use strict';

/**
 * src/repositories/messageRepo.js
 * SQL operations for message_logs across multi-db architecture.
 */

const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Helper to parse JSON fields in message logs.
 */
function parseMessageFields(msg) {
  if (!msg) return msg;
  
  // Parse fallback_order or routing_details
  const orderField = msg.fallback_order ? 'fallback_order' : (msg.routing_details ? 'routing_details' : null);
  if (orderField && typeof msg[orderField] === 'string') {
    try { msg.fallback_order = JSON.parse(msg[orderField]); } catch (e) { msg.fallback_order = [msg[orderField]]; }
  } else if (!msg.fallback_order && !msg.routing_details) {
    msg.fallback_order = ['rcs']; // Default
  }

  // Parse raw_payload
  if (typeof msg.raw_payload === 'string') {
    try { msg.raw_payload = JSON.parse(msg.raw_payload); } catch (e) { msg.raw_payload = {}; }
  }

  return msg;
}

/**
 * Insert a new message log entry directly into the connector-specific database.
 * Handles specialized schemas per connector.
 */
async function create(params) {
  const {
    callback_data, client_id, destination, bot_id, template_name,
    message_type, fallback_order, sparc_message_id, raw_payload,
    connector_type = 'MOENGAGE', callback_url = null
  } = params;

  const has_url = params.has_url || 0;
  const status = 'QUEUED';

  let sql = '';
  let values = [];

  switch (connector_type.toUpperCase()) {
    case 'WEBENGAGE':
      // WebEngage Schema: No callback_url, No has_url — uses routing_details instead of fallback_order
      sql = `INSERT INTO message_logs
        (callback_data, client_id, destination, bot_id, template_name,
         message_type, routing_details, sparc_message_id, status, raw_payload,
         connector_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      values = [
        callback_data, client_id, destination, bot_id, template_name || null,
        message_type, JSON.stringify(fallback_order || ['rcs']),
        sparc_message_id || null, status, JSON.stringify(raw_payload || {}),
        connector_type
      ];
      break;

    case 'CLEVERTAP':
      // CleverTap Schema: Has everything
      sql = `INSERT INTO message_logs
        (callback_data, client_id, destination, bot_id, template_name,
         message_type, fallback_order, sparc_message_id, status, raw_payload,
         has_url, connector_type, callback_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      values = [
        callback_data, client_id, destination, bot_id, template_name || null,
        message_type, JSON.stringify(fallback_order || ['rcs']),
        sparc_message_id || null, status, JSON.stringify(raw_payload || {}),
        has_url, connector_type, callback_url
      ];
      break;

    case 'MOENGAGE':
    default:
      // MoEngage Schema: No callback_url
      sql = `INSERT INTO message_logs
        (callback_data, client_id, destination, bot_id, template_name,
         message_type, fallback_order, sparc_message_id, status, raw_payload,
         has_url, connector_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      values = [
        callback_data, client_id, destination, bot_id, template_name || null,
        message_type, JSON.stringify(fallback_order || ['rcs']),
        sparc_message_id || null, status, JSON.stringify(raw_payload || {}),
        has_url, connector_type
      ];
      break;
  }

  return db.connectorQuery(connector_type, sql, values);
}

/**
 * Update message status. Since we don't know the connector, fan out to all 3.
 */
async function updateStatus(callbackData, status, sparcMessageId = null) {
  const params = sparcMessageId
    ? [status, sparcMessageId, callbackData]
    : [status, callbackData];

  const sql = sparcMessageId
    ? 'UPDATE message_logs SET status = ?, sparc_message_id = ? WHERE callback_data = ?'
    : 'UPDATE message_logs SET status = ? WHERE callback_data = ?';

  const [res1, res2, res3] = await db.fanOutQuery(sql, params);
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

/**
 * Update message status when connector_type is known.
 */
async function updateStatusByConnector(callbackData, status, connectorType, sparcMessageId = null) {
  const params = sparcMessageId
    ? [status, sparcMessageId, callbackData]
    : [status, callbackData];

  const sql = sparcMessageId
    ? `UPDATE message_logs SET status = ?, sparc_message_id = ? WHERE callback_data = ?`
    : `UPDATE message_logs SET status = ? WHERE callback_data = ?`;

  return db.connectorQuery(connectorType, sql, params);
}

/**
 * Store the SPARC SMS transactionId. Fan out.
 */
async function updateSparcTransactionId(callbackData, transactionId) {
  const sql = 'UPDATE message_logs SET sparc_transaction_id = ? WHERE callback_data = ?';
  const params = [String(transactionId), callbackData];
  const [res1, res2, res3] = await db.fanOutQuery(sql, params);
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

async function updateHasUrl(callbackData, hasUrlFlag) {
  const sql = 'UPDATE message_logs SET has_url = ? WHERE callback_data = ?';
  const params = [hasUrlFlag, callbackData];
  const [res1, res2, res3] = await db.fanOutQuery(sql, params);
  return res1.affectedRows > 0 ? res1 : (res2.affectedRows > 0 ? res2 : res3);
}

async function updateHasUrlByConnector(callbackData, hasUrlFlag, connectorType) {
  const sql = 'UPDATE message_logs SET has_url = ? WHERE callback_data = ?';
  return db.connectorQuery(connectorType, sql, [hasUrlFlag, callbackData]);
}

async function findBySparcTransactionId(transactionId) {
  const sql = 'SELECT * FROM message_logs WHERE sparc_transaction_id = ? LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [String(transactionId)]);
  let msg = moe[0] || ct[0] || we[0] || null;
  return parseMessageFields(msg);
}

async function findByCallbackData(callbackData) {
  const sql = 'SELECT * FROM message_logs WHERE callback_data = ? LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [callbackData]);
  let msg = moe[0] || ct[0] || we[0] || null;
  return parseMessageFields(msg);
}

async function findById(id, connectorType = null) {
  const sql = `SELECT * FROM message_logs WHERE id = ? LIMIT 1`;
  
  let msg = null;
  let connector = null;

  if (connectorType) {
    const rows = await db.connectorQuery(connectorType, sql, [id]);
    if (rows.length > 0) {
      msg = rows[0];
      connector = connectorType.toUpperCase();
    }
  } else {
    // Fallback to fan-out if no connector specified (legacy or ambiguous call)
    const [moe, ct, we] = await db.fanOutQuery(sql, [id]);
    if (moe.length > 0) { msg = moe[0]; connector = 'MOENGAGE'; }
    else if (ct.length > 0) { msg = ct[0]; connector = 'CLEVERTAP'; }
    else if (we.length > 0) { msg = we[0]; connector = 'WEBENGAGE'; }
  }

  if (msg) {
    msg.connector_type = connector;
    // Enrich with client name from the same siloed DB
    const rows = await db.connectorQuery(connector, 'SELECT client_name FROM clients WHERE id = ?', [msg.client_id]);
    if (rows.length > 0) msg.client_name = rows[0].client_name;
  }
  return parseMessageFields(msg);
}

async function getStats() {
  const sql = 'SELECT status, COUNT(*) as count FROM message_logs GROUP BY status';
  const [moe, ct, we] = await db.fanOutQuery(sql);
  
  const stats = {};
  const mergeRows = (rows) => {
    for (const row of rows) {
      stats[row.status] = (stats[row.status] || 0) + Number(row.count);
    }
  };
  mergeRows(moe); mergeRows(ct); mergeRows(we);
  return stats;
}

async function getRecentLogs(limit = 50, offset = 0, clientId = null) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  
  let sql = 'SELECT * FROM message_logs';
  const params = [];
  if (clientId) {
    sql += ' WHERE client_id = ?';
    params.push(clientId);
  }
  // To paginate across 3 DBs efficiently without pulling millions, 
  // we pull limit+offset from each, merge, sort, and slice.
  sql += ` ORDER BY created_at DESC LIMIT ${safeLimit + offset}`;

  const [moe, ct, we] = await db.fanOutQuery(sql, params);

  // Tag each log with its source connector before merging
  moe.forEach(l => l.connector_type = 'MOENGAGE');
  ct.forEach(l => l.connector_type = 'CLEVERTAP');
  we.forEach(l => l.connector_type = 'WEBENGAGE');
  
  let allLogs = [...moe, ...ct, ...we];
  allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Slice to correct offset window
  const pagedLogs = allLogs.slice(offset, offset + safeLimit);

  if (pagedLogs.length > 0) {
    const clientRepo = require('./clientRepo');
    const allClients = await clientRepo.getAll();
    const clientMap = {};
    // Note: This map is connector-agnostic for the label, which is fine for the log list
    allClients.forEach(c => clientMap[c.id] = c.client_name);
    
    for (const log of pagedLogs) {
      if (log.client_id) log.client_name = clientMap[log.client_id];
    }
  }

  return pagedLogs;
}

async function getTimelineStats() {
  const sql = `
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour, status, COUNT(*) as count
    FROM message_logs
    WHERE created_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY hour, status
  `;
  const [moe, ct, we] = await db.fanOutQuery(sql);
  let allRows = [...moe, ...ct, ...we];

  // We must re-aggregate across the 3 result sets!
  const map = {};
  for (const row of allRows) {
    const key = `${row.hour}_${row.status}`;
    if (!map[key]) {
      map[key] = { hour: row.hour, status: row.status, count: 0 };
    }
    map[key].count += Number(row.count);
  }

  const mergedRows = Object.values(map);
  mergedRows.sort((a, b) => a.hour.localeCompare(b.hour));
  return mergedRows;
}

async function getChannelStats() {
  const sql = `
    SELECT CASE WHEN status LIKE 'SMS_%' THEN 'SMS' ELSE 'RCS' END AS channel, COUNT(*) AS count
    FROM message_logs GROUP BY channel
  `;
  const [moe, ct, we] = await db.fanOutQuery(sql);
  
  const result = { RCS: 0, SMS: 0 };
  const addRows = (rows) => {
    for (const r of rows) result[r.channel] += Number(r.count);
  };
  addRows(moe); addRows(ct); addRows(we);
  return result;
}

async function countMessages(clientId = null) {
  let sql = 'SELECT COUNT(*) as total FROM message_logs';
  const params = [];
  if (clientId) {
    sql += ' WHERE client_id = ?';
    params.push(clientId);
  }
  const [moe, ct, we] = await db.fanOutQuery(sql, params);
  return (Number(moe[0]?.total) || 0) + (Number(ct[0]?.total) || 0) + (Number(we[0]?.total) || 0);
}

module.exports = {
  create, updateStatus, updateStatusByConnector, findByCallbackData,
  findById, updateSparcTransactionId, updateHasUrl, updateHasUrlByConnector,
  findBySparcTransactionId, getStats, getRecentLogs,
  getTimelineStats, getChannelStats, countMessages
};

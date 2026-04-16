'use strict';

/**
 * src/repositories/adminRepo.js
 * SQL operations for the Admin Panel.
 *
 * TABLE ROUTING:
 * When a `connector` filter is provided ('MOENGAGE' or 'CLEVERTAP'), all
 * queries target the connector-specific tables directly, giving the PM
 * a fully isolated view of each connector's data:
 *   - MOENGAGE  → moengage_message_logs  + moengage_dlr_events
 *   - CLEVERTAP → clevertap_message_logs + clevertap_dlr_events
 *
 * When no connector is specified, the original shared tables are used
 * (full cross-connector view — backward compat for any generic queries).
 */

const { query } = require('../config/db');

/**
 * Return the correct message and DLR table names for a given connector.
 * @param {string|null} connector
 * @returns {{ msgTable: string, dlrTable: string }}
 */
function getTables(connector) {
  if (connector === 'CLEVERTAP') {
    return { msgTable: 'clevertap_message_logs', dlrTable: 'clevertap_dlr_events', sugTable: 'clevertap_suggestion_events' };
  }
  if (connector === 'MOENGAGE') {
    return { msgTable: 'moengage_message_logs', dlrTable: 'moengage_dlr_events', sugTable: 'moengage_suggestion_events' };
  }
  // Default: original shared tables (all connectors combined)
  return { msgTable: 'message_logs', dlrTable: 'dlr_events', sugTable: 'suggestion_events' };
}

/**
 * Get the 5 top-level stats for a given date range and connector.
 * @returns {Promise<object>}
 */
async function getTodayStats(dateFrom = null, dateTo = null, connector = null) {
  const { msgTable, dlrTable } = getTables(connector);

  let logDateCondition = `DATE(created_at) = CURDATE()`;
  let dlrDateCondition = `DATE(e.created_at) = CURDATE()`;
  const finalParams = [];

  if (dateFrom && dateTo) {
    logDateCondition = `DATE(created_at) >= ? AND DATE(created_at) <= ?`;
    dlrDateCondition = `DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?`;
    finalParams.push(dateFrom, dateTo, dateFrom, dateTo);
  } else if (dateFrom) {
    logDateCondition = `DATE(created_at) = ?`;
    dlrDateCondition = `DATE(e.created_at) = ?`;
    finalParams.push(dateFrom, dateFrom);
  }

  // When using connector-specific tables, no connector_type WHERE clause needed
  // — the table itself is already scoped. The shared table still supports the
  // original connector filter behaviour when connector is null.
  const connectorClause = (!connector && connector !== null) ? '' : '';
  // Note: for the shared table path (connector=null), we return combined counts.

  const sql = `
    SELECT
      COUNT(*) as total_received,
      SUM(CASE WHEN status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN channel = 'SMS' OR status LIKE 'SMS_%' THEN 1 ELSE 0 END) as sms_fallback,
      (SELECT COUNT(*) FROM ${dlrTable} e WHERE ${dlrDateCondition}) as dlrs_received,
      SUM(CASE WHEN status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as terminal_failures
    FROM (
      SELECT *, CASE WHEN status LIKE 'SMS_%' THEN 'SMS' ELSE 'RCS' END as channel
      FROM ${msgTable}
      WHERE ${logDateCondition}
    ) sub;
  `;

  const rows = await query(sql, finalParams);
  return rows[0] || {
    total_received:    0,
    rcs_sent:          0,
    sms_fallback:      0,
    dlrs_received:     0,
    terminal_failures: 0,
  };
}

/**
 * Get today's stats per client for a given connector.
 * @returns {Promise<Array>}
 */
async function getClientStatsToday(dateFrom = null, dateTo = null, connector = null) {
  const { msgTable, dlrTable } = getTables(connector);

  let dlrDateCondition = `DATE(e.created_at) = CURDATE()`;
  let logDateCondition = `DATE(m.created_at) = CURDATE()`;
  const params = [];

  if (dateFrom && dateTo) {
    dlrDateCondition = `DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?`;
    logDateCondition = `DATE(m.created_at) >= ? AND DATE(m.created_at) <= ?`;
    params.push(dateFrom, dateTo, dateFrom, dateTo);
  } else if (dateFrom) {
    dlrDateCondition = `DATE(e.created_at) = ?`;
    logDateCondition = `DATE(m.created_at) = ?`;
    params.push(dateFrom, dateFrom);
  }

  const sql = `
    SELECT
      c.id as client_id,
      c.client_name,
      SUM(CASE WHEN m.status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND m.message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN (m.status LIKE 'SMS_%' OR m.message_type = 'SMS') THEN 1 ELSE 0 END) as sms_fallback,
      SUM(CASE WHEN m.status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as failed,
      (SELECT COUNT(*) FROM ${dlrTable} e JOIN ${msgTable} m2 ON e.callback_data = m2.callback_data WHERE m2.client_id = c.id AND ${dlrDateCondition}) as dlrs_received,
      COUNT(m.id) as total
    FROM clients c
    LEFT JOIN ${msgTable} m ON c.id = m.client_id AND ${logDateCondition}
    GROUP BY c.id, c.client_name
    ORDER BY c.client_name ASC
  `;
  return query(sql, params);
}

/**
 * Get stuck/unforwarded DLR events for the tracker.
 * Pagination applied in SQL — no in-memory slicing.
 * @param {object} filters
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{events: Array, total: number}>}
 */
async function getDlrTracker(filters = {}, limit = 50, offset = 0) {
  const { clientId, state, dateFrom, dateTo, connector } = filters;
  const { msgTable, dlrTable, sugTable } = getTables(connector);

  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let whereClause = '';
  const params = [];

  if (clientId) {
    whereClause += ' AND m.client_id = ?';
    params.push(clientId);
  }

  if (state === 'stuck') {
    whereClause += ' AND forwarded = 0';
  }

  if (dateFrom) {
    whereClause += ' AND created_at >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ' AND created_at <= ?';
    params.push(dateTo);
  }

  const sql = `
    SELECT * FROM (
      SELECT d.id, d.callback_data as seq_id, c.client_name, d.sparc_status, d.moe_status,
             d.callback_dispatched as forwarded, d.created_at, d.event_timestamp, m.client_id
      FROM ${dlrTable} d
      LEFT JOIN ${msgTable} m ON d.callback_data = m.callback_data
      LEFT JOIN clients c ON m.client_id = c.id
      UNION ALL
      SELECT s.id, s.callback_data as seq_id, c.client_name, 'SUGGEST_CLICK' as sparc_status, s.suggestion_text as moe_status,
             s.callback_dispatched as forwarded, s.created_at, s.event_timestamp, m.client_id
      FROM ${sugTable} s
      LEFT JOIN ${msgTable} m ON s.callback_data = m.callback_data
      LEFT JOIN clients c ON m.client_id = c.id
    ) as combined
    WHERE 1=1 ${whereClause}
    ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;

  // Repeat params twice for UNION combined params?
  // Wait, I wrap it in `FROM ( ... UNION ALL ... ) as combined WHERE 1=1 ${whereClause}`
  // So the whereClause applies to `combined` and params are only needed once!
  
  const [rows, total] = await Promise.all([
    query(sql, params),
    countDlrTracker(filters),
  ]);

  return { events: rows, total };
}

/**
 * Count DLR tracker results (for pagination metadata).
 * @param {object} filters
 * @returns {Promise<number>}
 */
async function countDlrTracker(filters = {}) {
  const { clientId, state, dateFrom, dateTo, connector } = filters;
  const { msgTable, dlrTable, sugTable } = getTables(connector);

  let whereClause = '';
  const params = [];

  if (clientId) {
    whereClause += ' AND client_id = ?';
    params.push(clientId);
  }
  if (state === 'stuck') {
    whereClause += ' AND forwarded = 0';
  }
  if (dateFrom) {
    whereClause += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND created_at <= ?';
    params.push(dateTo);
  }

  const sql = `
    SELECT COUNT(*) as total FROM (
      SELECT d.id, d.callback_dispatched as forwarded, d.created_at, m.client_id
      FROM ${dlrTable} d
      LEFT JOIN ${msgTable} m ON d.callback_data = m.callback_data
      UNION ALL
      SELECT s.id, s.callback_dispatched as forwarded, s.created_at, m.client_id
      FROM ${sugTable} s
      LEFT JOIN ${msgTable} m ON s.callback_data = m.callback_data
    ) as combined
    WHERE 1=1 ${whereClause}
  `;

  const rows = await query(sql, params);
  return rows[0]?.total || 0;
}

/**
 * Message Explorer with SQL-level pagination.
 * @param {object} filters
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{logs: Array, total: number}>}
 */
async function getMessages(filters = {}, limit = 50, offset = 0) {
  const { clientId, status, channel, dateFrom, dateTo, connector } = filters;
  const { msgTable, dlrTable } = getTables(connector);

  const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let sql = `
    SELECT m.id, m.callback_data, c.client_name, m.message_type, m.status,
           m.created_at, m.bot_id, m.destination,
           (SELECT COUNT(*) FROM ${dlrTable} d WHERE d.callback_data = m.callback_data) as total_dlrs,
           (SELECT COUNT(*) FROM ${dlrTable} d WHERE d.callback_data = m.callback_data AND d.callback_dispatched = 1) as forwarded_dlrs,
           (SELECT COUNT(*) FROM ${dlrTable} d WHERE d.callback_data = m.callback_data AND d.moe_status IN ('RCS_DELIVERY_FAILED', 'RCS_SENT_FAILED')) as has_fallback
    FROM ${msgTable} m
    LEFT JOIN clients c ON m.client_id = c.id
    WHERE 1=1
  `;
  let countSql = `SELECT COUNT(m.id) as total FROM ${msgTable} m WHERE 1=1`;
  const params      = [];
  const countParams = [];

  if (clientId) {
    const clause = ' AND m.client_id = ?';
    sql += clause; countSql += clause;
    params.push(clientId); countParams.push(clientId);
  }

  if (status) {
    const clause = ' AND m.status = ?';
    sql += clause; countSql += clause;
    params.push(status); countParams.push(status);
  }

  if (channel) {
    if (channel === 'RCS') {
      const clause = " AND (m.status NOT LIKE 'SMS_%' AND m.message_type != 'SMS')";
      sql += clause; countSql += clause;
    } else if (channel === 'SMS') {
      const clause = " AND (m.status LIKE 'SMS_%' OR m.message_type = 'SMS')";
      sql += clause; countSql += clause;
    }
  }

  if (dateFrom) {
    const clause = ' AND m.created_at >= ?';
    sql += clause; countSql += clause;
    params.push(dateFrom); countParams.push(dateFrom);
  }

  if (dateTo) {
    const clause = ' AND m.created_at <= ?';
    sql += clause; countSql += clause;
    params.push(dateTo); countParams.push(dateTo);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  const [rows, countRow] = await Promise.all([
    query(sql, params),
    query(countSql, countParams),
  ]);

  return { logs: rows, total: countRow[0]?.total || 0 };
}

module.exports = {
  getTodayStats,
  getClientStatsToday,
  getDlrTracker,
  countDlrTracker,
  getMessages,
};

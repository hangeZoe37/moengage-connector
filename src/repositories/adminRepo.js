'use strict';

/**
 * src/repositories/adminRepo.js
 * SQL operations for the Admin Panel.
 */

const { query } = require('../config/db');

/**
 * Get the 5 top-level stats for today.
 */
async function getTodayStats() {
  const sql = `
    SELECT 
      COUNT(*) as total_received,
      SUM(CASE WHEN status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN channel = 'SMS' OR status LIKE 'SMS_%' THEN 1 ELSE 0 END) as sms_fallback,
      (SELECT COUNT(*) FROM dlr_events e WHERE DATE(e.created_at) = CURDATE()) as dlrs_received,
      SUM(CASE WHEN status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as terminal_failures
    FROM (
      SELECT *, CASE WHEN status LIKE 'SMS_%' THEN 'SMS' ELSE 'RCS' END as channel
      FROM message_logs
      WHERE DATE(created_at) = CURDATE()
    ) sub;
  `;
  const rows = await query(sql);
  return rows[0] || {
    total_received: 0,
    rcs_sent: 0,
    sms_fallback: 0,
    dlrs_received: 0,
    terminal_failures: 0
  };
}

/**
 * Get today's stats per client.
 */
async function getClientStatsToday() {
  const sql = `
    SELECT 
      c.id as client_id,
      c.client_name,
      SUM(CASE WHEN m.status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND m.message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN (m.status LIKE 'SMS_%' OR m.message_type = 'SMS') THEN 1 ELSE 0 END) as sms_fallback,
      SUM(CASE WHEN m.status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as failed,
      (SELECT COUNT(*) FROM dlr_events e JOIN message_logs m2 ON e.callback_data = m2.callback_data WHERE m2.client_id = c.id AND DATE(e.created_at) = CURDATE()) as dlrs_received,
      COUNT(m.id) as total
    FROM clients c
    LEFT JOIN message_logs m ON c.id = m.client_id AND DATE(m.created_at) = CURDATE()
    GROUP BY c.id, c.client_name
    ORDER BY c.client_name ASC;
  `;
  return query(sql);
}

/**
 * Status of stuck/exhausted DLRs for the tracker.
 */
async function getDlrTracker(filters = {}) {
  const { clientId, state, dateFrom, dateTo } = filters;
  
  let sql = `
    SELECT d.id, d.callback_data as seq_id, c.client_name, d.sparc_status, d.moe_status,
           d.callback_dispatched as forwarded, d.created_at, d.event_timestamp
    FROM dlr_events d
    LEFT JOIN message_logs m ON d.callback_data = m.callback_data
    LEFT JOIN clients c ON m.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (clientId) {
    sql += ` AND c.id = ?`;
    params.push(clientId);
  }

  if (state === 'stuck') {
    // defined as not forwarded and not DONE
    sql += ` AND d.callback_dispatched = 0`;
  }

  if (dateFrom) {
    sql += ` AND d.created_at >= ?`;
    params.push(dateFrom);
  }
  
  if (dateTo) {
    sql += ` AND d.created_at <= ?`;
    params.push(dateTo);
  }
  
  sql += ` ORDER BY d.created_at DESC`;
  return query(sql, params);
}

/**
 * Message Explorer with complex pagination
 */
async function getMessages(filters = {}, limit = 50, offset = 0) {
  const { clientId, status, channel, dateFrom, dateTo } = filters;

  let sql = `
    SELECT m.id, m.callback_data, c.client_name, m.message_type, m.status, 
           m.created_at, m.bot_id, m.destination,
           (SELECT COUNT(*) FROM dlr_events d WHERE d.callback_data = m.callback_data) as total_dlrs,
           (SELECT COUNT(*) FROM dlr_events d WHERE d.callback_data = m.callback_data AND d.callback_dispatched = 1) as forwarded_dlrs
    FROM message_logs m
    LEFT JOIN clients c ON m.client_id = c.id
    WHERE 1=1
  `;
  let countSql = `SELECT COUNT(m.id) as total FROM message_logs m WHERE 1=1`;
  const params = [];

  if (clientId) {
    const clause = ` AND m.client_id = ?`;
    sql += clause; countSql += clause; params.push(clientId);
  }

  if (status) {
    const clause = ` AND m.status = ?`;
    sql += clause; countSql += clause; params.push(status);
  }

  if (channel) {
    if (channel === 'RCS') {
      const clause = ` AND (m.status NOT LIKE 'SMS_%' AND m.message_type != 'SMS')`;
      sql += clause; countSql += clause;
    } else if (channel === 'SMS') {
      const clause = ` AND (m.status LIKE 'SMS_%' OR m.message_type = 'SMS')`;
      sql += clause; countSql += clause;
    }
  }

  if (dateFrom) {
    const clause = ` AND m.created_at >= ?`;
    sql += clause; countSql += clause; params.push(dateFrom);
  }

  if (dateTo) {
    const clause = ` AND m.created_at <= ?`;
    sql += clause; countSql += clause; params.push(dateTo);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

  const rows = await query(sql, params);
  const countRow = await query(countSql, params);

  return { logs: rows, total: countRow[0]?.total || 0 };
}

module.exports = {
  getTodayStats,
  getClientStatsToday,
  getDlrTracker,
  getMessages
};

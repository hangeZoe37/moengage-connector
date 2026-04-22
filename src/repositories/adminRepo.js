'use strict';

/**
 * src/repositories/adminRepo.js
 * Dashboard aggregations across multiple isolated databases.
 */

const db = require('../config/db');
const clientRepo = require('./clientRepo');

async function getClientsMap() {
  const clients = await clientRepo.getAll();
  const map = { MOENGAGE: {}, CLEVERTAP: {}, WEBENGAGE: {} };
  for (const c of clients) {
    if (map[c.connector_type]) {
      map[c.connector_type][c.id] = c.client_name;
    }
  }
  return map;
}

async function getTodayStats(dateFrom = null, dateTo = null, connector = null) {
  let logCond = `DATE(created_at) = CURDATE()`;
  let dlrCond = `DATE(e.created_at) = CURDATE()`;
  const params = [];

  if (dateFrom && dateTo) {
    logCond = `DATE(created_at) >= ? AND DATE(created_at) <= ?`;
    dlrCond = `DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?`;
    params.push(dateFrom, dateTo, dateFrom, dateTo);
  } else if (dateFrom) {
    logCond = `DATE(created_at) = ?`;
    dlrCond = `DATE(e.created_at) = ?`;
    params.push(dateFrom, dateFrom);
  }

  const sql = `
    SELECT
      COUNT(*) as total_received,
      SUM(CASE WHEN status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN status LIKE 'SMS_%' OR message_type = 'SMS' THEN 1 ELSE 0 END) as sms_fallback,
      (SELECT COUNT(*) FROM dlr_events e WHERE ${dlrCond}) as dlrs_received,
      SUM(CASE WHEN status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as terminal_failures
    FROM message_logs
    WHERE ${logCond}
  `;

  let results = [];
  if (connector) {
    const rows = await db.connectorQuery(connector, sql, params);
    results = [rows[0]];
  } else {
    const arr = await db.fanOutQuery(sql, params);
    results = arr; // [moeRow, ctRow, weRow]
  }

  const aggr = { total_received: 0, rcs_sent: 0, sms_fallback: 0, dlrs_received: 0, terminal_failures: 0 };
  for (const row of results) {
    if (!row) continue;
    aggr.total_received += Number(row.total_received) || 0;
    aggr.rcs_sent += Number(row.rcs_sent) || 0;
    aggr.sms_fallback += Number(row.sms_fallback) || 0;
    aggr.dlrs_received += Number(row.dlrs_received) || 0;
    aggr.terminal_failures += Number(row.terminal_failures) || 0;
  }
  return aggr;
}

async function getClientStatsToday(dateFrom = null, dateTo = null, connector = null) {
  let logCond = `DATE(m.created_at) = CURDATE()`;
  let dlrCond = `DATE(e.created_at) = CURDATE()`;
  const params = [];

  if (dateFrom && dateTo) {
    logCond = `DATE(m.created_at) >= ? AND DATE(m.created_at) <= ?`;
    dlrCond = `DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?`;
    params.push(dateFrom, dateTo, dateFrom, dateTo);
  } else if (dateFrom) {
    logCond = `DATE(m.created_at) = ?`;
    dlrCond = `DATE(e.created_at) = ?`;
    params.push(dateFrom, dateFrom);
  }

  const sql = `
    SELECT
      m.client_id,
      COUNT(m.id) as total,
      SUM(CASE WHEN m.status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') AND m.message_type != 'SMS' THEN 1 ELSE 0 END) as rcs_sent,
      SUM(CASE WHEN (m.status LIKE 'SMS_%' OR m.message_type = 'SMS') THEN 1 ELSE 0 END) as sms_fallback,
      SUM(CASE WHEN m.status IN ('FAILED', 'RCS_SENT_FAILED', 'RCS_DELIVERY_FAILED', 'SMS_SENT_FAILED', 'SMS_DELIVERY_FAILED') THEN 1 ELSE 0 END) as failed,
      (SELECT COUNT(*) FROM dlr_events e JOIN message_logs m2 ON e.callback_data = m2.callback_data WHERE m2.client_id = m.client_id AND ${dlrCond}) as dlrs_received
    FROM message_logs m
    WHERE ${logCond}
    GROUP BY m.client_id
  `;

  let results = [];
  if (connector) {
    results = await db.connectorQuery(connector, sql, params);
  } else {
    const [moe, ct, we] = await db.fanOutQuery(sql, params);
    results = [...moe, ...ct, ...we];
  }

  const clientMap = await getClientsMap();
  const aggrMap = {};

  // Default all clients to 0 so they appear in dashboard
  // Only include clients from the relevant connector if filtered
  for (const [conn, ids] of Object.entries(clientMap)) {
    if (connector && conn !== connector) continue;
    for (const [id, name] of Object.entries(ids)) {
      aggrMap[id] = { client_id: id, client_name: name, total: 0, rcs_sent: 0, sms_fallback: 0, failed: 0, dlrs_received: 0 };
    }
  }

  for (const row of results) {
    if (!row.client_id) continue;
    const item = aggrMap[row.client_id];
    if (item) {
      item.total += Number(row.total);
      item.rcs_sent += Number(row.rcs_sent);
      item.sms_fallback += Number(row.sms_fallback);
      item.failed += Number(row.failed);
      item.dlrs_received += Number(row.dlrs_received);
    }
  }

  const unassigned = Object.values(aggrMap);
  unassigned.sort((a,b) => a.client_name.localeCompare(b.client_name));
  return unassigned;
}

async function getDlrTracker(filters = {}, limit = 50, offset = 0) {
  const { clientId, state, dateFrom, dateTo, connector } = filters;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10)||50,1),200);
  const safeOffset = Math.max(parseInt(offset,10)||0,0);
  
  let clause = '';
  const params = [];
  if (clientId) { clause += ' AND m.client_id = ?'; params.push(clientId); }
  if (state === 'stuck') { clause += ' AND forwarded = 0'; }
  if (dateFrom) { clause += ' AND combined.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { clause += ' AND combined.created_at <= ?'; params.push(dateTo); }

  const sql = `
    SELECT combined.* FROM (
      SELECT d.id, d.callback_data as seq_id, d.sparc_status, d.moe_status,
             d.callback_dispatched as forwarded, d.created_at, d.event_timestamp, m.client_id
      FROM dlr_events d LEFT JOIN message_logs m ON d.callback_data = m.callback_data
      UNION ALL
      SELECT s.id, s.callback_data as seq_id, 'SUGGEST_CLICK' as sparc_status, s.suggestion_text as moe_status,
             s.callback_dispatched as forwarded, s.created_at, s.event_timestamp, m.client_id
      FROM suggestion_events s LEFT JOIN message_logs m ON s.callback_data = m.callback_data
    ) as combined WHERE 1=1 ${clause} 
    ORDER BY created_at DESC LIMIT ${safeLimit + safeOffset}
  `;

  let events = [];
  if (connector) {
    events = await db.connectorQuery(connector, sql, params);
  } else {
    const [moe, ct, we] = await db.fanOutQuery(sql, params);
    events = [...moe, ...ct, ...we];
    events.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }
  
  const paged = events.slice(safeOffset, safeOffset + safeLimit);
  const total = await countDlrTracker(filters);
  
  const clientMap = await getClientsMap();
  for (const e of paged) {
    const connector = e.connector_type || filters.connector || 'MOENGAGE'; // e.connector_type added to DLR events in migration usually
    e.client_name = (clientMap[connector] && clientMap[connector][e.client_id]) || 'Unknown';
  }
  
  return { events: paged, total };
}

async function countDlrTracker(filters = {}) {
  const { clientId, state, dateFrom, dateTo, connector } = filters;
  let clause = '';
  const params = [];
  if (clientId) { clause += ' AND m.client_id = ?'; params.push(clientId); }
  if (state === 'stuck') { clause += ' AND forwarded = 0'; }
  if (dateFrom) { clause += ' AND combined.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { clause += ' AND combined.created_at <= ?'; params.push(dateTo); }

  const sql = `
    SELECT COUNT(*) as total FROM (
      SELECT d.id, d.callback_dispatched as forwarded, d.created_at, m.client_id
      FROM dlr_events d LEFT JOIN message_logs m ON d.callback_data = m.callback_data
      UNION ALL
      SELECT s.id, s.callback_dispatched as forwarded, s.created_at, m.client_id
      FROM suggestion_events s LEFT JOIN message_logs m ON s.callback_data = m.callback_data
    ) as combined WHERE 1=1 ${clause}
  `;

  if (connector) {
    const rows = await db.connectorQuery(connector, sql, params);
    return Number(rows[0]?.total || 0);
  }
  const [moe, ct, we] = await db.fanOutQuery(sql, params);
  return Number(moe[0]?.total||0) + Number(ct[0]?.total||0) + Number(we[0]?.total||0);
}

async function getMessages(filters = {}, limit = 50, offset = 0) {
  const { clientId, status, channel, dateFrom, dateTo, connector } = filters;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10)||50,1),200);
  const safeOffset = Math.max(parseInt(offset,10)||0,0);

  let sql = `
    SELECT m.id, m.callback_data, m.message_type, m.status, m.created_at, m.bot_id, m.destination, m.client_id,
           (SELECT COUNT(*) FROM dlr_events d WHERE d.callback_data = m.callback_data) as total_dlrs,
           (SELECT COUNT(*) FROM dlr_events d WHERE d.callback_data = m.callback_data AND d.callback_dispatched = 1) as forwarded_dlrs,
           (SELECT COUNT(*) FROM dlr_events d WHERE d.callback_data = m.callback_data AND d.moe_status IN ('RCS_DELIVERY_FAILED', 'RCS_SENT_FAILED')) as has_fallback
    FROM message_logs m WHERE 1=1
  `;
  let countSql = 'SELECT COUNT(m.id) as total FROM message_logs m WHERE 1=1';
  const params = [];

  if (clientId) { const c = ' AND m.client_id = ?'; sql += c; countSql += c; params.push(clientId); }
  if (status) { const c = ' AND m.status = ?'; sql += c; countSql += c; params.push(status); }
  if (channel) {
    if (channel==='RCS') { const c = " AND (m.status NOT LIKE 'SMS_%' AND m.message_type != 'SMS')"; sql+=c; countSql+=c; }
    else if (channel==='SMS') { const c = " AND (m.status LIKE 'SMS_%' OR m.message_type = 'SMS')"; sql+=c; countSql+=c; }
  }
  if (dateFrom) { const c = ' AND m.created_at >= ?'; sql+=c; countSql+=c; params.push(dateFrom); }
  if (dateTo) { const c = ' AND m.created_at <= ?'; sql+=c; countSql+=c; params.push(dateTo); }

  sql += ` ORDER BY m.created_at DESC LIMIT ${safeLimit + safeOffset}`;

  let rows = [];
  let total = 0;

  if (connector) {
    const res = await db.connectorQuery(connector, sql, params);
    rows = res;
    const cRes = await db.connectorQuery(connector, countSql, params);
    total = Number(cRes[0]?.total||0);
  } else {
    const [moe, ct, we] = await db.fanOutQuery(sql, params);
    rows = [...moe, ...ct, ...we];
    rows.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const [cMoe, cCt, cWe] = await db.fanOutQuery(countSql, params);
    total = Number(cMoe[0]?.total||0) + Number(cCt[0]?.total||0) + Number(cWe[0]?.total||0);
  }

  const paged = rows.slice(safeOffset, safeOffset + safeLimit);
  const clientMap = await getClientsMap();
  for (const p of paged) {
    const connector = filters.connector || (p.connector_type) || 'MOENGAGE';
    p.client_name = (clientMap[connector] && clientMap[connector][p.client_id]) || 'Unknown';
  }

  return { logs: paged, total };
}

module.exports = { getTodayStats, getClientStatsToday, getDlrTracker, countDlrTracker, getMessages };

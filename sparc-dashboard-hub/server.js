import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7001;

app.use(cors());
app.use(express.json());

// Health Check / Backend Status
app.get('/', (req, res) => {
  res.send('Sparc Dashboard Backend is running on Port 7001. Visit http://localhost:7000 for the UI.');
});

// Database Pools
const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'reset@123',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pools = {
  ADMIN: mysql.createPool({ ...poolConfig, database: process.env.DB_NAME_ADMIN || 'sparc_admin' }),
  MOENGAGE: mysql.createPool({ ...poolConfig, database: process.env.DB_NAME_MOE || 'sparc_moengage_db' }),
  CLEVERTAP: mysql.createPool({ ...poolConfig, database: process.env.DB_NAME_CT || 'sparc_clevertap_db' }),
  WEBENGAGE: mysql.createPool({ ...poolConfig, database: process.env.DB_NAME_WE || 'sparc_webengage_db' })
};

// --- SAFE QUERY HELPER ---
async function safeQuery(pool, sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    const dbName = pool.pool?.config?.connectionConfig?.database || 'unknown';
    console.error(`DB Query Error [${dbName}]:`, err.message);
    return [];
  }
}

async function queryAll(sql, params = []) {
  const [moe, ct, we] = await Promise.all([
    safeQuery(pools.MOENGAGE, sql, params),
    safeQuery(pools.CLEVERTAP, sql, params),
    safeQuery(pools.WEBENGAGE, sql, params)
  ]);
  return { moe, ct, we };
}

function mapClient(c, connector) {
  return {
    ...c,
    client_id: c.id,
    connector_type: connector,
    rcs_sent: 0,
    sms_fallback: 0,
    failed: 0,
    dlrs_received: 0,
    total: 0,
    fallback_rate: 0
  };
}

// --- API ROUTES ---

app.get('/api/stats/overview', async (req, res) => {
  const { dateFrom, dateTo, connector } = req.query;
  const connStr = Array.isArray(connector) ? connector[0] : connector;
  console.log(`[${new Date().toISOString()}] GET /api/stats/overview - Connector: ${connStr || 'ALL'} [${dateFrom || ''} to ${dateTo || ''}]`);
  
  try {
    const activeConnector = (connStr || '').toUpperCase();
    
    // 1. Build Date Filter
    let dateFilter = '1=1';
    const dateParams = [];
    if (dateFrom && dateTo) {
      dateFilter = 'created_at BETWEEN ? AND ?';
      dateParams.push(`${dateFrom} 00:00:00`, `${dateTo} 23:59:59`);
    } else if (dateFrom) {
      dateFilter = 'created_at >= ?';
      dateParams.push(`${dateFrom} 00:00:00`);
    }

    // 2. Global Stats SQL
    const statsSql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') THEN 1 ELSE 0 END) as rcs_sent,
        SUM(CASE WHEN status LIKE 'SMS_%' THEN 1 ELSE 0 END) as sms_fallback,
        SUM(CASE WHEN status IN ('RCS_DELIVERED', 'RCS_READ', 'SMS_DELIVERED', 'SMS_READ') THEN 1 ELSE 0 END) as dlrs
      FROM message_logs
      WHERE ${dateFilter}
    `;

    // 3. Optimized Per-Client Stats SQL
    const clientStatsSql = `
      SELECT 
        c.id as client_id, 
        c.client_name,
        COALESCE(m.total, 0) as total,
        COALESCE(m.rcs_sent, 0) as rcs_sent,
        COALESCE(m.sms_fallback, 0) as sms_fallback,
        COALESCE(m.dlrs_received, 0) as dlrs_received,
        COALESCE(m.failed, 0) as failed
      FROM clients c
      LEFT JOIN (
        SELECT 
          client_id,
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('RCS_SENT', 'RCS_DELIVERED', 'RCS_READ') THEN 1 ELSE 0 END) as rcs_sent,
          SUM(CASE WHEN status LIKE 'SMS_%' THEN 1 ELSE 0 END) as sms_fallback,
          SUM(CASE WHEN status IN ('RCS_DELIVERED', 'RCS_READ', 'SMS_DELIVERED', 'SMS_READ') THEN 1 ELSE 0 END) as dlrs_received,
          SUM(CASE WHEN status LIKE '%FAILED%' THEN 1 ELSE 0 END) as failed
        FROM message_logs
        WHERE ${dateFilter}
        GROUP BY client_id
      ) m ON c.id = m.client_id
      WHERE c.is_active = 1
      ORDER BY c.client_name ASC
    `;

    let globalStats;
    let clientsWithStats = [];

    if (activeConnector && pools[activeConnector]) {
      const [statsRows, clientRows] = await Promise.all([
        safeQuery(pools[activeConnector], statsSql, dateParams),
        safeQuery(pools[activeConnector], clientStatsSql, [...dateParams, ...dateParams])
      ]);

      const row = statsRows[0] || { total: 0, rcs_sent: 0, sms_fallback: 0, dlrs: 0 };
      
      globalStats = {
        total_received: Number(row.total || 0),
        rcs_sent: Number(row.rcs_sent || 0),
        sms_fallback: Number(row.sms_fallback || 0),
        dlrs_received: Number(row.dlrs || 0),
        terminal_failures: Number(row.total || 0) - Number(row.rcs_sent || 0) - Number(row.sms_fallback || 0)
      };

      clientsWithStats = clientRows.map(c => ({
        ...c,
        connector_type: activeConnector,
        fallback_rate: c.total > 0 ? (c.sms_fallback / c.total) * 100 : 0
      }));
    } else {
      const [results, clientResults] = await Promise.all([
        queryAll(statsSql, dateParams),
        queryAll(clientStatsSql, [...dateParams, ...dateParams])
      ]);

      const moe = results.moe[0] || { total: 0, rcs_sent: 0, sms_fallback: 0, dlrs: 0 };
      const ct = results.ct[0] || { total: 0, rcs_sent: 0, sms_fallback: 0, dlrs: 0 };
      const we = results.we[0] || { total: 0, rcs_sent: 0, sms_fallback: 0, dlrs: 0 };

      const total = Number(moe.total || 0) + Number(ct.total || 0) + Number(we.total || 0);
      const rcs = Number(moe.rcs_sent || 0) + Number(ct.rcs_sent || 0) + Number(we.rcs_sent || 0);
      const sms = Number(moe.sms_fallback || 0) + Number(ct.sms_fallback || 0) + Number(we.sms_fallback || 0);
      const dlrs = Number(moe.dlrs || 0) + Number(ct.dlrs || 0) + Number(we.dlrs || 0);

      globalStats = {
        total_received: total,
        rcs_sent: rcs,
        sms_fallback: sms,
        dlrs_received: dlrs,
        terminal_failures: total - rcs - sms
      };

      clientsWithStats = [
        ...clientResults.moe.map(c => ({ ...c, connector_type: 'MOENGAGE', total: Number(c.total), rcs_sent: Number(c.rcs_sent), sms_fallback: Number(c.sms_fallback), dlrs_received: Number(c.dlrs_received), failed: Number(c.failed), fallback_rate: Number(c.total) > 0 ? (Number(c.sms_fallback) / Number(c.total)) * 100 : 0 })),
        ...clientResults.ct.map(c => ({ ...c, connector_type: 'CLEVERTAP', total: Number(c.total), rcs_sent: Number(c.rcs_sent), sms_fallback: Number(c.sms_fallback), dlrs_received: Number(c.dlrs_received), failed: Number(c.failed), fallback_rate: Number(c.total) > 0 ? (Number(c.sms_fallback) / Number(c.total)) * 100 : 0 })),
        ...clientResults.we.map(c => ({ ...c, connector_type: 'WEBENGAGE', total: Number(c.total), rcs_sent: Number(c.rcs_sent), sms_fallback: Number(c.sms_fallback), dlrs_received: Number(c.dlrs_received), failed: Number(c.failed), fallback_rate: Number(c.total) > 0 ? (Number(c.sms_fallback) / Number(c.total)) * 100 : 0 }))
      ];
    }

    res.json({ stats: globalStats, clients: clientsWithStats });
  } catch (error) {
    console.error('Stats Route Error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;
    const clientId = req.query.clientId;
    const status = req.query.status;
    const channel = req.query.channel;
    
    const rawConn = req.query.connector;
    const connector = (Array.isArray(rawConn) ? rawConn[0] : rawConn || '').toUpperCase();
    
    let whereClause = '1=1';
    const params = [];
    
    if (clientId) {
      whereClause += ' AND m.client_id = ?';
      params.push(clientId);
    }
    if (status) {
      whereClause += ' AND m.status = ?';
      params.push(status);
    }
    if (channel) {
      if (channel === 'SMS') {
        whereClause += ` AND m.status LIKE 'SMS_%'`;
      } else if (channel === 'RCS') {
        whereClause += ` AND m.status LIKE 'RCS_%'`;
      }
    }
    
    const countSql = `SELECT COUNT(*) as count FROM message_logs m WHERE ${whereClause}`;
    const sql = `
      SELECT m.*, c.client_name,
        (SELECT COUNT(*) FROM dlr_events WHERE callback_data = m.callback_data) as total_dlrs,
        (SELECT COUNT(*) FROM dlr_events WHERE callback_data = m.callback_data AND callback_dispatched = 1) as forwarded_dlrs
      FROM message_logs m
      LEFT JOIN clients c ON m.client_id = c.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    let allLogs = [];
    let total = 0;
    
    if (connector && pools[connector]) {
      const cRes = await safeQuery(pools[connector], countSql, params);
      total = cRes[0]?.count || 0;
      allLogs = await safeQuery(pools[connector], sql, params);
      allLogs = allLogs.map(r => ({ ...r, connector_type: connector }));
    } else {
      const countRes = await queryAll(countSql, params);
      total = (countRes.moe[0]?.count || 0) + (countRes.ct[0]?.count || 0) + (countRes.we[0]?.count || 0);
      
      const results = await queryAll(sql, params);
      allLogs = [
        ...results.moe.map(r => ({ ...r, connector_type: 'MOENGAGE' })), 
        ...results.ct.map(r => ({ ...r, connector_type: 'CLEVERTAP' })), 
        ...results.we.map(r => ({ ...r, connector_type: 'WEBENGAGE' }))
      ]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    }

    res.json({ logs: allLogs, total, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const rawConn = req.query.connector;
    const connector = (Array.isArray(rawConn) ? rawConn[0] : rawConn || '').toUpperCase();
    const sql = `SELECT * FROM message_logs WHERE id = ?`;
    const dlrSql = `SELECT * FROM dlr_events WHERE callback_data = (SELECT callback_data FROM message_logs WHERE id = ?)`;
    const sugSql = `SELECT * FROM suggestion_events WHERE callback_data = (SELECT callback_data FROM message_logs WHERE id = ?)`;

    let log = null;
    let dlrs = [];
    let suggestions = [];

    if (connector && pools[connector]) {
      const logs = await safeQuery(pools[connector], sql, [id]);
      if (logs.length > 0) {
        log = logs[0];
        dlrs = await safeQuery(pools[connector], dlrSql, [id]);
        suggestions = await safeQuery(pools[connector], sugSql, [id]);
      }
    } else {
      const results = await queryAll(sql, [id]);
      log = [...results.moe, ...results.ct, ...results.we][0];
      if (log) {
        const dRes = await queryAll(dlrSql, [id]);
        dlrs = [...dRes.moe, ...dRes.ct, ...dRes.we];
        
        const sRes = await queryAll(sugSql, [id]);
        suggestions = [...sRes.moe, ...sRes.ct, ...sRes.we];
      }
    }

    if (!log) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: log, dlrEvents: dlrs, suggestionEvents: suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dlr', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const rawConn = req.query.connector;
    const connector = (Array.isArray(rawConn) ? rawConn[0] : rawConn || '').toUpperCase();
    const sql = `
      SELECT 
        'DLR' as event_type,
        d.id,
        d.callback_data as seq_id,
        d.sparc_status,
        d.moe_status as mapped_status,
        d.callback_dispatched as forwarded,
        d.created_at,
        m.destination,
        c.client_name 
      FROM dlr_events d
      LEFT JOIN message_logs m ON d.callback_data = m.callback_data
      LEFT JOIN clients c ON m.client_id = c.id
      
      UNION ALL
      
      SELECT 
        'SUGGESTION' as event_type,
        s.id,
        s.callback_data as seq_id,
        COALESCE(CONCAT('Interaction: ', s.suggestion_text), 'Interaction: Unknown/Postback') as sparc_status,
        COALESCE(s.postback_data, 'No Payload') as mapped_status,
        s.callback_dispatched as forwarded,
        s.created_at,
        m.destination,
        c.client_name
      FROM suggestion_events s
      LEFT JOIN message_logs m ON s.callback_data = m.callback_data
      LEFT JOIN clients c ON m.client_id = c.id
      
      ORDER BY created_at DESC LIMIT ${limit}
    `;
    
    let allEvents;
    if (connector && pools[connector]) {
      allEvents = await safeQuery(pools[connector], sql);
    } else {
      const results = await queryAll(sql);
      allEvents = [...results.moe, ...results.ct, ...results.we]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    }

    res.json({ events: allEvents, total: allEvents.length, limit, offset: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    const rawConn = req.query.connector;
    const connector = (Array.isArray(rawConn) ? rawConn[0] : rawConn || '').toUpperCase();
    const sql = 'SELECT * FROM clients WHERE is_active = 1';
    
    let allClients;
    if (connector && pools[connector]) {
      const rows = await safeQuery(pools[connector], sql);
      allClients = rows.map(c => mapClient(c, connector));
    } else {
      const results = await queryAll(sql);
      allClients = [
        ...results.moe.map(c => mapClient(c, 'MOENGAGE')),
        ...results.ct.map(c => mapClient(c, 'CLEVERTAP')),
        ...results.we.map(c => mapClient(c, 'WEBENGAGE'))
      ];
    }

    res.json({ clients: allClients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  res.json({ token: 'dev-token', message: 'Logged in to Port 7001 Hub' });
});

app.listen(PORT, () => console.log(`Professional Dashboard Hub running on Port ${PORT}`));

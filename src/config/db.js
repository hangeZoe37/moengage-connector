'use strict';

/**
 * src/config/db.js
 * Multi-Database Connection Pool Manager
 */

const mysql = require('mysql2/promise');
const { env } = require('./env');
const logger = require('./logger');

const dbConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionLimit: env.DB_POOL_SIZE,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+00:00',
};

// Create 4 distinct connection pools
const pools = {
  ADMIN: mysql.createPool({ ...dbConfig, database: env.DB_NAME_ADMIN }),
  MOENGAGE: mysql.createPool({ ...dbConfig, database: env.DB_NAME_MOE }),
  CLEVERTAP: mysql.createPool({ ...dbConfig, database: env.DB_NAME_CT }),
  WEBENGAGE: mysql.createPool({ ...dbConfig, database: env.DB_NAME_WE }),
};

function getPool(connectorType) {
  const upName = String(connectorType).toUpperCase();
  return pools[upName] || pools.ADMIN;
}

/**
 * Run a query against the centralized ADMIN db.
 */
async function adminQuery(sql, params = []) {
  try {
    const [rows] = await pools.ADMIN.execute(sql, params);
    return rows;
  } catch (err) {
    logger.error('Admin DB Query Failed', { sql: sql.substring(0, 100), error: err.message });
    throw err;
  }
}

/**
 * Run a query against a specific specific connector database.
 */
async function connectorQuery(connectorType, sql, params = []) {
  const pool = getPool(connectorType);
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    logger.error(`${connectorType} DB Query Failed`, { sql: sql.substring(0, 100), error: err.message });
    throw err;
  }
}

/**
 * Execute the exact same query across MoEngage, CleverTap, and WebEngage databases simultaneously.
 * Returns an array of three result sets.
 */
async function fanOutQuery(sql, params = []) {
  try {
    const [moe, ct, we] = await Promise.all([
      pools.MOENGAGE.execute(sql, params),
      pools.CLEVERTAP.execute(sql, params),
      pools.WEBENGAGE.execute(sql, params)
    ]);
    return [moe[0], ct[0], we[0]]; // returning only the rows array, ignoring fields
  } catch (err) {
    logger.error('FanOut DB Query Failed', { sql: sql.substring(0, 100), error: err.message });
    throw err;
  }
}

async function healthCheck() {
  try {
    await Promise.all([
      pools.ADMIN.execute('SELECT 1'),
      pools.MOENGAGE.execute('SELECT 1'),
      pools.CLEVERTAP.execute('SELECT 1'),
      pools.WEBENGAGE.execute('SELECT 1')
    ]);
    return true;
  } catch {
    return false;
  }
}

// Ensure backwards compatibility where code was simply calling query(sql, params).
// We map it to adminQuery by default if we haven't refactored it yet, to prevent total crash.
const query = adminQuery;

module.exports = { adminQuery, connectorQuery, fanOutQuery, healthCheck, pools, getPool, query };

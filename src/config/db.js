'use strict';

/**
 * src/config/db.js
 * mysql2 connection pool. Exports query() helper. Created once.
 */

const mysql = require('mysql2/promise');
const { env } = require('./env');
const logger = require('./logger');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionLimit: env.DB_POOL_SIZE,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+00:00',
});

/**
 * Execute a parameterized SQL query.
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Array>} Query result rows
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error('Database query failed', {
      sql: sql.substring(0, 200),
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get a connection from the pool for transactions.
 * @returns {Promise<mysql.PoolConnection>}
 */
async function getConnection() {
  return pool.getConnection();
}

/**
 * Check database connectivity.
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    await pool.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { query, getConnection, healthCheck, pool };

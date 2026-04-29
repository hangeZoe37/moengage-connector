'use strict';

const mysql = require('mysql2/promise');
const { env } = require('./env');
const logger = require('./logger');

const pools = {};

function createPool(dbName) {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: dbName,
    connectionLimit: env.DB_POOL_SIZE,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
}

pools.ADMIN = createPool(env.DB_NAME_ADMIN);
pools.CLEVERTAP = createPool(env.DB_NAME_CT);

async function healthCheck() {
  try {
    await pools.ADMIN.query('SELECT 1');
    await pools.CLEVERTAP.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

/**
 * Executes a query against a specific connector pool.
 */
async function connectorQuery(connectorType, sql, params = []) {
  const pool = pools[connectorType];
  if (!pool) {
    throw new Error(`No pool found for connector: ${connectorType}`);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  pools,
  healthCheck,
  connectorQuery
};

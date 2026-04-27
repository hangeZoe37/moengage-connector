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

// Only connect to Admin and MoEngage databases
pools.ADMIN = createPool(env.DB_NAME_ADMIN);
pools.MOENGAGE = createPool(env.DB_NAME_MOE);

async function healthCheck() {
  try {
    await pools.ADMIN.query('SELECT 1');
    await pools.MOENGAGE.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

async function adminQuery(sql, params) {
  const [rows] = await pools.ADMIN.execute(sql, params);
  return rows;
}

async function moengageQuery(sql, params) {
  const [rows] = await pools.MOENGAGE.execute(sql, params);
  return rows;
}

module.exports = {
  pools,
  healthCheck,
  adminQuery,
  moengageQuery,
};

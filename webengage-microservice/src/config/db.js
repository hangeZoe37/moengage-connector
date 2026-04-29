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
pools.WEBENGAGE = createPool(env.DB_NAME_WE);

async function healthCheck() {
  try {
    await pools.ADMIN.query('SELECT 1');
    await pools.WEBENGAGE.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return false;
  }
}

module.exports = {
  pools,
  healthCheck
};

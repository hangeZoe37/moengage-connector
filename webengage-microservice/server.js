'use strict';

require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/config/logger');
const { env } = require('./src/config/env');
const db = require('./src/config/db');

const PORT = env.PORT || 6000;

async function startServer() {
  try {
    const isDbUp = await db.healthCheck();
    if (!isDbUp) {
      logger.error('Failed to connect to database. Server exiting.');
      process.exit(1);
    }

    const server = app.listen(PORT, () => {
      logger.info('WebEngage Microservice started', {
        port: PORT,
        nodeEnv: env.NODE_ENV,
        pid: process.pid,
      });
    });

    const shutdown = (signal) => {
      logger.info(`Received ${signal} — starting graceful shutdown`);
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          if (db.pools.ADMIN) await db.pools.ADMIN.end();
          if (db.pools.WEBENGAGE) await db.pools.WEBENGAGE.end();
          logger.info('Database pools drained');
        } catch (err) {
          logger.error('Error draining pools', { error: err.message });
        }
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on(' SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Error starting server', { error: error.message });
    process.exit(1);
  }
}

startServer();

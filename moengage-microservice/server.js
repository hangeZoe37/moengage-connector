'use strict';

require('dotenv').config();

const app = require('./src/app');
const logger = require('./src/config/logger');
const { pool } = require('./src/config/db');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info('MoEngage Microservice started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid,
  });
});

server.keepAliveTimeout = 90000;
server.headersTimeout   = 91000;
server.timeout = 30000;

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal} — starting graceful shutdown`, { pid: process.pid });

  server.close(async () => {
    logger.info('HTTP server closed — no new connections accepted');

    try {
      const { pools } = require('./src/config/db');
      await Promise.all([
        pools.ADMIN.end(),
        pools.MOENGAGE.end()
      ]);
      logger.info('All MySQL pools drained');
    } catch (err) {
      logger.error('Error draining MySQL pools', { error: err.message });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out — force exiting');
    process.exit(1);
  }, 25000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack  : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

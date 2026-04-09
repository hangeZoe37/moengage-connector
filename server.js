'use strict'; // Force restart to pick up .env changes for local DLR testing

/**
 * server.js — ENTRY POINT ONLY
 * Imports app, calls listen(). Handles graceful shutdown and process crash safety.
 */

require('dotenv').config();

const app = require('./src/app');
const { env } = require('./src/config/env');
const logger = require('./src/config/logger');
const { pool } = require('./src/config/db');

const PORT = env.PORT;

// ─── Start Server ────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info('SPARC-MoEngage Connector started', {
    port: PORT,
    nodeEnv: env.NODE_ENV,
    pid: process.pid,
  });
});

// Prevent long-running zombie connections stalling a deploy restart.
// Nginx upstream keepalive is typically 75s — server timeout must be higher.
server.keepAliveTimeout = 90000;  // 90s
server.headersTimeout   = 91000;  // must be slightly above keepAliveTimeout

// Hard timeout per request — kills stalled handlers after 30s
server.timeout = 30000;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal} — starting graceful shutdown`, { pid: process.pid });

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed — no new connections accepted');

    try {
      // Drain the MySQL connection pool
      await pool.end();
      logger.info('MySQL pool drained — all connections closed');
    } catch (err) {
      logger.error('Error draining MySQL pool during shutdown', { error: err.message });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force-kill if graceful drain takes too long (PM2 uses 30s default kill timeout)
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — force exiting');
    process.exit(1);
  }, 25000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Crash Safety ────────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection — this should never happen in production', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack  : undefined,
  });
  // Do NOT exit — let PM2 monitor and decide. Log is sufficient for debugging.
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — process is in an unknown state, restarting', {
    error: err.message,
    stack: err.stack,
  });
  // Exit after uncaughtException — Node.js docs recommend this
  process.exit(1);
});

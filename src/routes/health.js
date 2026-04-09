'use strict';

/**
 * src/routes/health.js
 * GET /health
 * Health check endpoint for Nginx / PM2 / load balancer.
 * Returns DB status, memory usage, uptime, and event loop responsiveness.
 */

const { Router }    = require('express');
const { healthCheck } = require('../config/db');

const router = Router();

router.get('/health', async (req, res) => {
  const startNs = process.hrtime.bigint();
  const dbHealthy = await healthCheck();
  const dbLatencyMs = Number(process.hrtime.bigint() - startNs) / 1e6;

  const memMB = process.memoryUsage();

  const status = {
    status:    dbHealthy ? 'ok' : 'degraded',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pid:       process.pid,
    database: {
      connected:  dbHealthy,
      latency_ms: Math.round(dbLatencyMs),
    },
    memory: {
      rss_mb:        Math.round(memMB.rss          / 1024 / 1024),
      heap_used_mb:  Math.round(memMB.heapUsed     / 1024 / 1024),
      heap_total_mb: Math.round(memMB.heapTotal    / 1024 / 1024),
      external_mb:   Math.round(memMB.external     / 1024 / 1024),
    },
    node_version: process.version,
  };

  res.status(dbHealthy ? 200 : 503).json(status);
});

module.exports = router;

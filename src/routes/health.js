'use strict';

/**
 * src/routes/health.js
 * GET /health
 * Health check endpoint for Nginx / PM2 / load balancer.
 */

const { Router } = require('express');
const { healthCheck } = require('../config/db');

const router = Router();

router.get('/health', async (req, res) => {
  const dbHealthy = await healthCheck();

  const status = {
    status: dbHealthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
  };

  const httpStatus = dbHealthy ? 200 : 503;
  res.status(httpStatus).json(status);
});

module.exports = router;

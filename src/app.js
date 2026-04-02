'use strict';

/**
 * src/app.js
 * Express setup only. Mounts middleware + routes. No logic.
 */

const express = require('express');
const requestLogger = require('./middleware/requestLogger');
const rateLimiter = require('./middleware/rateLimiter');

// Route imports
const inboundRoutes = require('./routes/inbound');
const sparcWebhookRoutes = require('./routes/sparcWebhook');
const dashboardRoutes = require('./routes/dashboard');
const healthRoutes = require('./routes/health');

const app = express();

// --- Global Middleware ---
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);
app.use(rateLimiter);

// --- Routes ---

// MoEngage inbound (Bearer auth applied at route level)
app.use('/integrations/moengage/rcs', inboundRoutes);

// SPARC webhooks (NO Bearer auth — protected by Nginx IP allowlist)
app.use('/sparc', sparcWebhookRoutes);

// Dashboard API (Basic Auth applied at route level)
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.use('/', healthRoutes);

// --- Temporary Mock Endpoint for Testing MoEngage DLR Delivery ---
// TODO: Delete this once the real MoEngage webhook environment is ready.
app.post('/test/moengage-dlr', (req, res) => {
  const logger = require('./config/logger');
  logger.info('SUCCESS!! Received format for MoEngage DLR locally:', { payload: req.body });
  console.log('\n================ MOENGAGE DLR PAYLOAD DISPATCHED ================');
  console.dir(req.body, { depth: null, colors: true });
  console.log('=================================================================\n');
  res.status(200).json({ status: 'success', message: 'Mock MoEngage DLR Received' });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, _next) => {
  const logger = require('./config/logger');
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

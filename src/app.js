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
const sparcDlrRoutes = require('./routes/sparcDlr');
const sparcInteractionRoutes = require('./routes/sparcInteraction');
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
app.use('/sparc', sparcDlrRoutes);
app.use('/sparc', sparcInteractionRoutes);

// Health check
app.use('/', healthRoutes);

// --- Local Mock Endpoint for Testing MoEngage DLRs ---
app.post('/test/moengage-dlr', (req, res) => {
  const logger = require('./config/logger');
  logger.info('SUCCESS!! Received perfectly formatted MoEngage DLR Locally:', { payload: req.body });
  console.log('\n================ MOENGAGE DLR PAYLOAD RECEIVED ================');
  console.dir(req.body, { depth: null, colors: true });
  console.log('===============================================================\n');
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

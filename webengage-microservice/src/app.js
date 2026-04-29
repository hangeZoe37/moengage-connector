'use strict';

const express = require('express');
const webengageRoutes = require('./routes/webengage');
const sparcWebhookRoutes = require('./routes/sparcWebhook');
const logger = require('./config/logger');

const app = express();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'WebEngage-Microservice' });
});

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/integrations/webengage/rcs', webengageRoutes);
app.use('/sparc', sparcWebhookRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled Error', { error: err.message, stack: err.stack });
  res.status(500).json({ status: 'Error', message: 'Internal server error' });
});

module.exports = app;

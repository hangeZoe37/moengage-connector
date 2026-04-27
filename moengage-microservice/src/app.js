'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

// Route imports
const moengageRoutes = require('./routes/moengage');
const sparcWebhookRoutes = require('./routes/sparcWebhook');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// Routes
// Helper/Sync
app.use('/api/test', syncRoutes);
// Auth
app.use('/api/auth', authRoutes);

// MoEngage inbound
app.use('/integrations/moengage/rcs', moengageRoutes);

// SPARC webhooks
app.use('/sparc', sparcWebhookRoutes);

// Simple Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'moengage-microservice' }));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const clevertapRoutes = require('./routes/clevertap');
const sparcWebhookRoutes = require('./routes/sparcWebhook');
const testRoutes = require('./routes/testRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Compression
app.use(compression());

// Body Parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/test', testRoutes);
app.use('/integrations/clevertap/rcs', clevertapRoutes);
app.use('/sparc', sparcWebhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Safe Mock Endpoint for Loopback Callbacks
app.post('/api/test/clevertap-dlr', (req, res) => {
  res.status(200).json({ status: 'Success', message: 'Callback captured safely' });
});

app.get('/', (req, res) => {
  res.json({ service: 'CleverTap Microservice', status: 'Running' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;

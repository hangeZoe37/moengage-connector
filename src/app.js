'use strict';

/**
 * src/app.js
 * Express setup only. Mounts middleware + routes. No logic.
 */

const express    = require('express');
const helmet     = require('helmet');
const compression = require('compression');
const requestLogger = require('./middleware/requestLogger');
const rateLimiter   = require('./middleware/rateLimiter');

// Route imports
const inboundRoutes      = require('./routes/inbound');
const sparcWebhookRoutes = require('./routes/sparcWebhook');
const dashboardRoutes    = require('./routes/dashboard');
const healthRoutes       = require('./routes/health');
const adminRoutes        = require('./routes/admin');
const authRoutes         = require('./routes/auth');
const clevertapRoutes     = require('./routes/clevertapRoutes');
const webengageRoutes     = require('./routes/webengageRoutes');

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
// Sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(helmet({
  // Allow serving the admin dashboard (static HTML/JS/CSS from /admin/)
  contentSecurityPolicy: false,
}));

// ─── Response Compression ──────────────────────────────────────────────────────
// Gzip JSON responses — important for large dashboard log payloads
app.use(compression());

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(rateLimiter);

// ─── Serve Admin Dashboard (static built assets) ──────────────────────────────
app.use('/admin', express.static('public/admin'));

// ─── Routes ───────────────────────────────────────────────────────────────────

// MoEngage inbound (Bearer auth applied at route level)
app.use('/integrations/moengage/rcs', inboundRoutes);

// CleverTap inbound (Basic auth applied at route level)
app.use('/integrations/clevertap/rcs', clevertapRoutes);

// WebEngage inbound (Basic auth applied at route level)
app.use('/integrations/webengage/rcs', webengageRoutes);

// SPARC webhooks (NO Bearer auth — protected by Nginx IP allowlist)
app.use('/sparc', sparcWebhookRoutes);

// Dashboard API (JWT Auth applied at route level)
app.use('/api/dashboard', dashboardRoutes);

// Admin API (JWT Auth applied at route level)
app.use('/admin-api', adminRoutes);

// Auth API (Login)
app.use('/api/auth', authRoutes);

// Health check
app.use('/', healthRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const logger = require('./config/logger');
  logger.error('Unhandled error', {
    error:  err.message,
    stack:  err.stack,
    path:   req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

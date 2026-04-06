'use strict';

/**
 * src/routes/dashboard.js
 * Routes for the Monitoring Dashboard.
 * All routes are protected by Basic Auth (admin:DASHBOARD_PASSWORD).
 */

const { Router } = require('express');
const dashboardController = require('../controllers/dashboardController');
const basicAuth = require('../middleware/basicAuth');

const router = Router();

// Apply auth to all dashboard endpoints
router.use(basicAuth);

// ── Metrics ──────────────────────────────────────────────────────────────────
router.get('/metrics', dashboardController.getMetrics);

// ── Message Logs ──────────────────────────────────────────────────────────────
router.get('/logs', dashboardController.getLogs);
router.get('/messages/:id', dashboardController.getMessageDetail);

// ── DLR Events ───────────────────────────────────────────────────────────────
router.get('/dlr-events', dashboardController.getDlrEvents);

// ── Clients ───────────────────────────────────────────────────────────────────
router.get('/clients', dashboardController.getClients);
router.post('/clients', dashboardController.onboardClient);
router.put('/clients/:id', dashboardController.updateClient);
router.delete('/clients/:id', dashboardController.deactivateClient);

// ── Live Streaming (SSE) ──────────────────────────────────────────────────────
router.get('/logs/stream', dashboardController.streamLogs);

module.exports = router;

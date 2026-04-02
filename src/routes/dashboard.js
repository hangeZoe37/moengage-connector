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

router.get('/metrics', dashboardController.getMetrics);
router.get('/logs', dashboardController.getLogs);
router.get('/clients', dashboardController.getClients);
router.get('/logs/stream', dashboardController.streamLogs);

module.exports = router;

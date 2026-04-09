'use strict';

/**
 * src/routes/admin.js
 * Admin Panel routes for SPARC-MoEngage RCS Connector.
 * Protected by Basic Auth (same as dashboard — admin:DASHBOARD_PASSWORD).
 */

const { Router }      = require('express');
const adminController = require('../controllers/adminController');
const jwtAuth       = require('../middleware/jwtAuth');

const router = Router();

// All admin routes use JWT Auth
router.use(jwtAuth);

// Overview Stats & Clients Table
router.get('/stats/overview', adminController.getOverviewStats);

// Client Management
router.get('/clients',                  adminController.getClients);
router.post('/clients',                 adminController.createClient);
router.put('/clients/:id',              adminController.updateClient);
router.patch('/clients/:id/status',     adminController.toggleClientStatus);

// Message Explorer
router.get('/messages',                 adminController.getMessages);
router.get('/messages/:msgId',          adminController.getMessageDetail);

// DLR Tracker
router.get('/dlr',                      adminController.getDlrTracker);

module.exports = router;

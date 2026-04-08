'use strict';

/**
 * src/routes/admin.js
 * Admin Panel routes for SPARC-MoEngage RCS Connector.
 */

const { Router } = require('express');
const adminController = require('../controllers/adminController');
const bearerAuth = require('../middleware/bearerAuth');

const router = Router();

// Protect all admin routes with bearerAuth
router.use(bearerAuth);

// Overview Stats & Clients Table
router.get('/stats/overview', adminController.getOverviewStats);

// Client Management
router.get('/clients', adminController.getClients);
router.post('/clients', adminController.createClient);
router.put('/clients/:id', adminController.updateClient);
router.patch('/clients/:id/status', adminController.toggleClientStatus);

// Message Explorer
router.get('/messages', adminController.getMessages);
router.get('/messages/:msgId', adminController.getMessageDetail);

// DLR Tracker
router.get('/dlr', adminController.getDlrTracker);

module.exports = router;

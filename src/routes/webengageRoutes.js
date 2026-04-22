'use strict';

/**
 * src/routes/webengageRoutes.js
 * WebEngage-specific API routes (RSP Gateway).
 */

const express = require('express');
const router = express.Router();
const webengageController = require('../controllers/webengageController');
const basicAuth = require('../middleware/basicAuth');

// WebEngage hits this endpoint to send RCS messages
// Protected by Basic Auth (SPARC credentials)
router.post(['/', '/send'], basicAuth, webengageController.handleInbound);

module.exports = router;

'use strict';

/**
 * src/routes/clevertapRoutes.js
 * CleverTap-specific API routes.
 */

const express = require('express');
const router = express.Router();
const clevertapController = require('../controllers/clevertapController');
const basicAuth = require('../middleware/basicAuth');

// CleverTap hits this endpoint to send RCS messages
// Protected by Basic Auth (SPARC credentials)
router.post('/', basicAuth, clevertapController.handleInbound);

module.exports = router;

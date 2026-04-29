'use strict';

const express = require('express');
const router = express.Router();
const clevertapController = require('../controllers/clevertapController');
const basicAuth = require('../middleware/basicAuth');

// CleverTap hits this endpoint to send RCS messages
router.post(['/', '/send'], basicAuth, clevertapController.handleInbound);

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const webengageController = require('../controllers/webengageController');
const { authenticateClient } = require('../middleware/auth');

router.post('/send', authenticateClient, webengageController.handleInbound);

module.exports = router;

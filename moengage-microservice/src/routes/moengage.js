'use strict';

const express = require('express');
const router = express.Router();
const moengageController = require('../controllers/moengageController');
const bearerAuth = require('../middleware/bearerAuth');
const validatePayload = require('../middleware/validatePayload');

router.post('/send', bearerAuth, validatePayload, moengageController.handleInbound);

module.exports = router;

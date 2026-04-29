'use strict';

const webengageService = require('../services/webengageService');
const logger = require('../config/logger');

async function handleInbound(req, res) {
  try {
    const result = await webengageService.processInbound(req.body, req.client);
    res.status(200).json(result);
  } catch (error) {
    logger.error('WebEngage inbound processing failed', { error: error.message, body: req.body });
    res.status(500).json({ status: 'Error', message: error.message });
  }
}

module.exports = {
  handleInbound
};

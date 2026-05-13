'use strict';

const clientRepo = require('../repositories/clientRepo');
const logger = require('../config/logger');

/**
 * Validates the API key (rcs_username) against the DB.
 * Attaches the client object to the request.
 */
async function authenticateClient(req, res, next) {
  let apiKey = req.headers['x-api-key'] || req.query.apiKey;

  // Support for official WebEngage format: Authorization: Bearer <API_KEY>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.split(' ')[1];
  }

  if (!apiKey) {
    return res.status(401).json({ status: 'Error', message: 'Missing API Key' });
  }

  try {
    const client = await clientRepo.findByApiKey(apiKey);
    if (!client) {
      logger.warn('Authentication failed: Invalid API Key', { apiKey });
      return res.status(403).json({ status: 'Error', message: 'Invalid API Key' });
    }

    req.client = client;
    next();
  } catch (error) {
    logger.error('Auth middleware database error', { error: error.message });
    res.status(500).json({ status: 'Error', message: 'Internal server error' });
  }
}

module.exports = {
  authenticateClient
};

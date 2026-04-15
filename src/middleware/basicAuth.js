'use strict';

/**
 * src/middleware/basicAuth.js
 * Basic Auth (Base64) → client lookup → attaches req.client.
 */

const clientRepo = require('../repositories/clientRepo');
const logger = require('../config/logger');

async function basicAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      logger.warn('Auth failure: missing Authorization header', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Basic') {
      logger.warn('Auth failure: malformed Basic Authorization header', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({ error: 'Invalid Authorization format. Expected: Basic <base64>' });
    }

    const credentials = Buffer.from(parts[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      logger.warn('Auth failure: invalid Basic credentials format', {
        ip: req.ip,
      });
      return res.status(401).json({ error: 'Invalid credentials format' });
    }

    const client = await clientRepo.findByCredentials(username, password);

    if (!client) {
      logger.warn('Auth failure: incorrect Basic credentials', {
        ip: req.ip,
        username,
      });
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    if (!client.is_active) {
      logger.warn('Auth failure: client disabled', {
        clientId: client.id,
        username,
      });
      return res.status(403).json({ error: 'Client is disabled' });
    }

    // Attach client to request
    req.client = client;

    next();
  } catch (error) {
    logger.error('Basic Auth middleware error', { error: error.message });
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

module.exports = basicAuth;

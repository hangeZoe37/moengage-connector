'use strict';

/**
 * src/middleware/bearerAuth.js
 * Token → client lookup → attaches req.client.
 * Reads from DB on every request (no restart needed for new clients).
 */

const clientRepo = require('../repositories/clientRepo');
const logger = require('../config/logger');

async function bearerAuth(req, res, next) {
  try {
    const authHeader = req.headers['authentication'] || req.headers['authorization'];
    const headerName = req.headers['authentication'] ? 'Authentication' : 'Authorization';

    if (!authHeader) {
      logger.warn(`Auth failure: missing ${headerName} header`, {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({ error: `Missing ${headerName} header` });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Auth failure: malformed Authorization header', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: authHeader.substring(0, 10),
      });
      return res.status(401).json({ error: 'Invalid Authorization format. Expected: Bearer <token>' });
    }

    const token = parts[1];

    const client = await clientRepo.findByToken(token);

    if (!client) {
      logger.warn('Auth failure: unknown token', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: token.substring(0, 8) + '...',
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!client.is_active) {
      logger.warn('Auth failure: client disabled', {
        clientId: client.id,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Client is disabled' });
    }

    // Attach workspace to request for downstream use
    req.client = client;

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

module.exports = bearerAuth;

'use strict';

/**
 * src/middleware/basicAuth.js
 * Super-Lenient Auth: Supports Basic, Bearer, and even "Fake Basic" 
 * where a hex token is sent without Base64 encoding.
 */

const clientRepo = require('../repositories/clientRepo');
const logger = require('../config/logger');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ status: 'error', message: 'Missing Authorization Header' });
  }

  try {
    let client;
    const [type, credentials] = authHeader.split(' ');

    if (!credentials) {
      return res.status(401).json({ status: 'error', message: 'Invalid Authorization Format' });
    }

    // 1. Try treating it as a raw token first (Bearer style or Hex-in-Basic style)
    client = await clientRepo.findByToken(credentials);

    // 2. If not found, and it's Basic, try decoding it
    if (!client && type === 'Basic') {
      try {
        const decoded = Buffer.from(credentials, 'base64').toString('utf8');
        if (decoded.includes(':')) {
          const [username, password] = decoded.split(':');
          client = await clientRepo.findByRcsUsername(username);
          if (client && client.rcs_password !== password) {
            client = null;
          }
        } else {
          // If decoded but no colon, maybe the decoded value is the token?
          client = await clientRepo.findByToken(decoded);
        }
      } catch (e) {
        // Not valid base64, ignore
      }
    }

    if (!client) {
      logger.warn('Unauthorized access attempt', { 
        type,
        preview: credentials.substring(0, 15) + '...'
      });
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    // Attach client to request
    req.client = client;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = auth;

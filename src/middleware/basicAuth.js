'use strict';

/**
 * src/middleware/basicAuth.js
 * Protects dashboard endpoints using Basic Authentication.
 */

const { env } = require('../config/env');
const logger = require('../config/logger');

function basicAuth(req, res, next) {
  // Use DASHBOARD_PASSWORD from env, or a fallback for local dev if missing
  const password = env.DASHBOARD_PASSWORD || 'admin123';
  
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, pwd] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && login === 'admin' && pwd && pwd === password) {
    return next();
  }

  logger.warn('Unauthorized access attempt to dashboard', { ip: req.ip });
  
  res.set('WWW-Authenticate', 'Basic realm="Dashboard"');
  res.status(401).send('Authentication required.');
}

module.exports = basicAuth;

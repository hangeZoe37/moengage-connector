'use strict';

/**
 * src/middleware/jwtAuth.js
 * Protects endpoints using Bearer JWT authentication.
 */

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const logger = require('../config/logger');

function jwtAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    logger.warn('Auth failure: missing Authorization header', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('Auth failure: malformed Authorization header', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Invalid Authorization format. Expected: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // attaching decoded payload (e.g. { username: 'admin' }) to req
    next();
  } catch (error) {
    logger.warn('Auth failure: invalid or expired token', { ip: req.ip, path: req.path, error: error.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = jwtAuth;

'use strict';

/**
 * src/middleware/rateLimiter.js
 * express-rate-limit configuration from env vars.
 */

const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const logger = require('../config/logger');

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = limiter;

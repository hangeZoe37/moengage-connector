'use strict';

const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;

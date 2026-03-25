'use strict';

/**
 * src/middleware/requestLogger.js
 * HTTP request/response logging via Winston.
 */

const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    // Attach workspaceId if available (set by bearerAuth middleware)
    if (req.workspace) {
      logData.workspaceId = req.workspace.workspace_id;
    }

    if (res.statusCode >= 500) {
      logger.error('HTTP request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP request completed with client error', logData);
    } else {
      logger.info('HTTP request completed', logData);
    }
  });

  next();
}

module.exports = requestLogger;

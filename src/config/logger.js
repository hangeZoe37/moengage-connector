'use strict';

/**
 * src/config/logger.js
 * Winston instance. Import this everywhere. Never console.log.
 */

const winston = require('winston');

// --- PII Redaction Format ---
const redactPii = winston.format((info) => {
  const redact = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    // Create a new object to avoid mutating the original
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    
    for (const key in newObj) {
      if (typeof newObj[key] === 'object') {
        newObj[key] = redact(newObj[key]);
      } else if (typeof newObj[key] === 'string') {
        // Redact values for specific sensitive keys
        const sensitiveKeys = ['destination', 'to', 'phone', 'mobile', 'toNumber'];
        if (sensitiveKeys.includes(key)) {
          newObj[key] = newObj[key].replace(/(\d{2})(\d+)(\d{2})/, '$1******$3');
        }
      }
    }
    return newObj;
  };

  return redact(info);
});

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    redactPii(), // Apply redaction before serialization
    winston.format.timestamp({ format: 'YYYY-DD-MM HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sparc-connector-hub' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length > 1
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} [${level}]: ${message}${metaStr}`;
              })
            )
          : undefined,
    }),
  ],
});

// In production, also log to file
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}

module.exports = logger;

'use strict';

const winston = require('winston');
const { env } = require('./env');

const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-DD-MM HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: { service: 'sparc-connector-hub' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          return `${timestamp} [${level}]: ${message} ${JSON.stringify(metadata)}`;
        })
      ),
    }),
  ],
});

module.exports = logger;

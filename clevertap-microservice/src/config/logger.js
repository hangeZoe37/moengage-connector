'use strict';

const { createLogger, format, transports } = require('winston');
const { env } = require('./env');

const logger = createLogger({
  level: env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-DD-MM HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.splat()
  ),
  defaultMeta: { service: 'sparc-connector-hub' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...metadata }) => {
          return `${timestamp} [${level}]: ${message} ${JSON.stringify(metadata)}`;
        })
      ),
    }),
  ],
});

module.exports = logger;

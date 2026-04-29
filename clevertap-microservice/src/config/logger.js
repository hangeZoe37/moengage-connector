'use strict';

const { createLogger, format, transports } = require('winston');
const { env } = require('./env');

const logger = createLogger({
  level: env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'clevertap-microservice' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...metadata }) => {
          let meta = '';
          if (Object.keys(metadata).length > 0 && metadata.service) {
             const { service, ...rest } = metadata;
             if (Object.keys(rest).length > 0) {
                meta = JSON.stringify(rest);
             }
          }
          return `${timestamp} [${level}]: ${message} ${meta}`;
        })
      ),
    }),
  ],
});

module.exports = logger;

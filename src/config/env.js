'use strict';

/**
 * src/config/env.js
 * Validates all required env vars at startup. Throws on missing.
 */

const requiredVars = [
  'PORT',
  'NODE_ENV',
  'SPARC_API_BASE_URL',
  'SPARC_WEBHOOK_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
];

const optionalVars = {
  SPARC_SERVICE_ACCOUNT:   'default_account',
  SPARC_API_PASSWORD:      'default_password',
  SPARC_SMS_API_BASE_URL:  'https://pgapi.sparc.smartping.io/fe',
  SPARC_SMS_USERNAME:      '',
  SPARC_SMS_PASSWORD:      '',
  MOENGAGE_DLR_URL:        'https://api-01.moengage.com/rcs/dlr/sparc',
  DB_POOL_SIZE:            '20',    // Increased from 10 — supports PM2 cluster workloads
  LOG_LEVEL:               'info',
  RATE_LIMIT_WINDOW_MS:    '60000',
  RATE_LIMIT_MAX:          '500',
};

function validateEnv() {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in all values.'
    );
  }

  // Apply defaults for optional vars
  for (const [key, defaultValue] of Object.entries(optionalVars)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  }

  return {
    PORT:     parseInt(process.env.PORT, 10),
    NODE_ENV: process.env.NODE_ENV,

    SPARC_API_BASE_URL:     process.env.SPARC_API_BASE_URL,
    SPARC_SERVICE_ACCOUNT:  process.env.SPARC_SERVICE_ACCOUNT,
    SPARC_API_PASSWORD:     process.env.SPARC_API_PASSWORD,

    SPARC_SMS_API_BASE_URL: process.env.SPARC_SMS_API_BASE_URL,
    SPARC_SMS_USERNAME:     process.env.SPARC_SMS_USERNAME,
    SPARC_SMS_PASSWORD:     process.env.SPARC_SMS_PASSWORD,

    SPARC_WEBHOOK_URL:      process.env.SPARC_WEBHOOK_URL,

    DEFAULT_CONNECTOR_URL:  process.env.MOENGAGE_DLR_URL,

    DB_HOST:      process.env.DB_HOST,
    DB_PORT:      parseInt(process.env.DB_PORT, 10),
    DB_NAME:      process.env.DB_NAME,
    DB_USER:      process.env.DB_USER,
    DB_PASSWORD:  process.env.DB_PASSWORD,
    DB_POOL_SIZE: parseInt(process.env.DB_POOL_SIZE, 10),

    LOG_LEVEL: process.env.LOG_LEVEL,

    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10),
    RATE_LIMIT_MAX:       parseInt(process.env.RATE_LIMIT_MAX, 10),

    JWT_SECRET: process.env.JWT_SECRET,
  };
}

const env = validateEnv();

module.exports = { env, validateEnv };

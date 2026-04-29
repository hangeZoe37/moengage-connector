'use strict';

module.exports = {
  env: {
    PORT: process.env.PORT || 6001,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME_ADMIN: process.env.DB_NAME_ADMIN,
    DB_NAME_CT: process.env.DB_NAME_CT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_POOL_SIZE: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
    
    // SPARC API (RCS)
    SPARC_API_BASE_URL: process.env.SPARC_API_BASE_URL,
    SPARC_SERVICE_ACCOUNT: process.env.SPARC_SERVICE_ACCOUNT,
    SPARC_API_PASSWORD: process.env.SPARC_API_PASSWORD,
    SPARC_WEBHOOK_URL: process.env.SPARC_WEBHOOK_URL,
    
    // SPARC SMS API (different from RCS)
    SPARC_SMS_API_BASE_URL: process.env.SPARC_SMS_API_BASE_URL,
    SPARC_SMS_USERNAME: process.env.SPARC_SMS_USERNAME,
    SPARC_SMS_PASSWORD: process.env.SPARC_SMS_PASSWORD,
    
    // CleverTap Callback
    CLEVERTAP_DLR_URL: process.env.CLEVERTAP_DLR_URL,
    
    JWT_SECRET: process.env.JWT_SECRET || 'localdev_jwt_secret',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 20000,
  }
};

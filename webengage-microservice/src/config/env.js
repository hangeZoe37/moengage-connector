'use strict';

module.exports = {
  env: {
    PORT: process.env.PORT || 6000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME_ADMIN: process.env.DB_NAME_ADMIN,
    DB_NAME_WE: process.env.DB_NAME_WE,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_POOL_SIZE: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
    SPARC_API_BASE_URL: process.env.SPARC_API_BASE_URL,
    SPARC_WEBHOOK_URL: process.env.SPARC_WEBHOOK_URL,
    WEBENGAGE_DLR_URL: process.env.WEBENGAGE_DLR_URL,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  }
};

'use strict';

/**
 * server.js — ENTRY POINT ONLY
 * Imports app, calls listen().
 */

require('dotenv').config();

const app = require('./src/app');
const { env } = require('./src/config/env');
const logger = require('./src/config/logger');

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info(`SPARC-MoEngage Connector running on port ${PORT}`, {
    port: PORT,
    nodeEnv: env.NODE_ENV,
  });
});

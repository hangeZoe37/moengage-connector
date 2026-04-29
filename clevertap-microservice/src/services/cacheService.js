'use strict';

/**
 * src/services/cacheService.js
 * Simple in-memory cache for configuration and mappings.
 */

const NodeCache = require('node-cache');

// Default TTL 5 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll(),
};

'use strict';

/**
 * src/services/cacheService.js
 * In-memory cache using node-cache.
 * Used to reduce database load for frequently accessed data (Clients, URL Mappings).
 */

const NodeCache = require('node-cache');
const logger = require('../config/logger');

// Global cache instance: 
// stdTTL: 5 minutes default
// checkperiod: 60 seconds (garbage collection)
const cache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 60,
  useClones: false // performance boost for in-memory objects
});

/**
 * Get item from cache.
 * @param {string} key 
 * @returns {any|undefined}
 */
function get(key) {
  return cache.get(key);
}

/**
 * Set item in cache.
 * @param {string} key 
 * @param {any} value 
 * @param {number} [ttl] - TTL in seconds (overrides default)
 * @returns {boolean}
 */
function set(key, value, ttl) {
  if (ttl) {
    return cache.set(key, value, ttl);
  }
  return cache.set(key, value);
}

/**
 * Delete item from cache.
 * @param {string} key 
 */
function del(key) {
  cache.del(key);
}

/**
 * Clear the entire cache.
 */
function flush() {
  cache.flushAll();
  logger.info('Cache flushed');
}

// Log cache statistics every hour in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const stats = cache.getStats();
    logger.info('Cache Statistics', stats);
  }, 3600000);
}

module.exports = {
  get,
  set,
  del,
  flush,
  cache // raw instance if needed
};

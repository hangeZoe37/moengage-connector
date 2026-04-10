'use strict';

/**
 * src/repositories/trackLinkRepo.js
 * SQL operations for sms_track_links table.
 */

const { query } = require('../config/db');
const cache = require('../services/cacheService');

/**
 * Fetch all target_url -> track_link_id mappings for a specific client.
 * Caches results for 5 minutes.
 * @param {number} clientId 
 * @returns {Promise<Array<{target_url: string, track_link_id: string}>>}
 */
async function getMappingsByClient(clientId) {
  const cacheKey = `mappings_${clientId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const rows = await query(
    'SELECT target_url, track_link_id FROM sms_track_links WHERE client_id = ?',
    [clientId]
  );
  
  cache.set(cacheKey, rows);
  return rows;
}

/**
 * Register a new mapping for a client.
 * @param {number} clientId 
 * @param {string} targetUrl 
 * @param {string} trackLinkId 
 * @returns {Promise<object>}
 */
async function createMapping(clientId, targetUrl, trackLinkId) {
  return query(
    'INSERT INTO sms_track_links (client_id, target_url, track_link_id) VALUES (?, ?, ?)',
    [clientId, targetUrl, trackLinkId]
  );
}

module.exports = {
  getMappingsByClient,
  createMapping,
};

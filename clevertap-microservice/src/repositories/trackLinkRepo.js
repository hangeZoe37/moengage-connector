'use strict';

/**
 * src/repositories/trackLinkRepo.js
 * SQL operations for sms_track_links table in CleverTap database.
 */

const { pools } = require('../config/db');
const cache = require('../services/cacheService');

/**
 * Fetch all target_url -> track_link_id mappings for a specific client.
 * @param {number} clientId 
 * @returns {Promise<Array<{target_url: string, track_link_id: string}>>}
 */
async function getMappingsByClient(clientId) {
  const cacheKey = `mappings_CLEVERTAP_${clientId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [rows] = await pools.CLEVERTAP.query(
    'SELECT target_url, track_link_id FROM sms_track_links WHERE client_id = ?',
    [clientId]
  );
  
  cache.set(cacheKey, rows);
  return rows;
}

/**
 * Find a specific link by its ID in the CleverTap database.
 */
async function findByTrackLinkId(trackLinkId) {
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM sms_track_links WHERE track_link_id = ? ORDER BY id DESC LIMIT 1',
    [trackLinkId]
  );

  return rows[0] || null;
}

module.exports = {
  getMappingsByClient,
  findByTrackLinkId,
};

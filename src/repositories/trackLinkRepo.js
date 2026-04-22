'use strict';

/**
 * src/repositories/trackLinkRepo.js
 * SQL operations for sms_track_links table.
 */

const db = require('../config/db');
const cache = require('../services/cacheService');

/**
 * Fetch all target_url -> track_link_id mappings for a specific client.
 * @param {number} clientId 
 * @param {string} connectorType
 * @returns {Promise<Array<{target_url: string, track_link_id: string}>>}
 */
async function getMappingsByClient(clientId, connectorType = 'MOENGAGE') {
  const cacheKey = `mappings_${connectorType}_${clientId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const rows = await db.connectorQuery(
    connectorType,
    'SELECT target_url, track_link_id FROM sms_track_links WHERE client_id = ?',
    [clientId]
  );
  
  cache.set(cacheKey, rows);
  return rows;
}

/**
 * Register a new mapping for a client.
 */
async function createMapping(clientId, targetUrl, trackLinkId, connectorType = 'MOENGAGE') {
  const result = await db.connectorQuery(
    connectorType,
    'INSERT INTO sms_track_links (client_id, target_url, track_link_id, created_at) VALUES (?, ?, ?, NOW())',
    [clientId, targetUrl, trackLinkId]
  );
  cache.flush();
  return result;
}

/**
 * Find a specific link by its ID across all databases.
 */
async function findByTrackLinkId(trackLinkId) {
  const sql = 'SELECT * FROM sms_track_links WHERE track_link_id = ? ORDER BY id DESC LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [trackLinkId]);

  if (moe.length > 0) return { ...moe[0], connector_type: 'MOENGAGE' };
  if (ct.length > 0) return { ...ct[0], connector_type: 'CLEVERTAP' };
  if (we.length > 0) return { ...we[0], connector_type: 'WEBENGAGE' };
  return null;
}

module.exports = {
  getMappingsByClient,
  createMapping,
  findByTrackLinkId,
};

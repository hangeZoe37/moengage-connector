'use strict';

const { pools } = require('../config/db');

async function getMappingsByClient(clientId) {
  // Simplified for microservice, cache omitted for brevity or implement if needed
  const [rows] = await pools.MOENGAGE.query(
    'SELECT target_url, track_link_id FROM sms_track_links WHERE client_id = ?',
    [clientId]
  );
  return rows;
}

async function createMapping(clientId, targetUrl, trackLinkId) {
  const [result] = await pools.MOENGAGE.query(
    'INSERT INTO sms_track_links (client_id, target_url, track_link_id, created_at) VALUES (?, ?, ?, NOW())',
    [clientId, targetUrl, trackLinkId]
  );
  return result;
}

async function findByTrackLinkId(trackLinkId) {
  const [rows] = await pools.MOENGAGE.query(
    'SELECT * FROM sms_track_links WHERE track_link_id = ? ORDER BY id DESC LIMIT 1',
    [trackLinkId]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  getMappingsByClient,
  createMapping,
  findByTrackLinkId,
};

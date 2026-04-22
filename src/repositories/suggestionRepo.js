'use strict';

/**
 * src/repositories/suggestionRepo.js
 * SQL operations for suggestion_events tables.
 */

const db = require('../config/db');

/**
 * Insert a suggestion click event into the specific connector db.
 */
async function create(params, connectorType = 'MOENGAGE') {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp,
  } = params;

  return db.connectorQuery(
    connectorType,
    `INSERT INTO suggestion_events
      (callback_data, suggestion_text, postback_data, event_timestamp, callback_dispatched, created_at)
     VALUES (?, ?, ?, ?, 0, NOW())`,
    [callback_data, suggestion_text || null, postback_data || null, event_timestamp || null]
  );
}

/**
 * Mark a suggestion event as dispatched.
 */
async function markDispatched(eventId, connectorType = 'MOENGAGE') {
  return db.connectorQuery(
    connectorType,
    `UPDATE suggestion_events SET callback_dispatched = 1 WHERE id = ?`,
    [eventId]
  );
}

/**
 * Find all suggestion events for a given callback_data.
 * Fans out across DBs.
 */
async function findByCallbackData(callbackData) {
  const sql = 'SELECT * FROM suggestion_events WHERE callback_data = ? ORDER BY created_at ASC';
  const [moe, ct, we] = await db.fanOutQuery(sql, [callbackData]);
  
  const merged = [...moe, ...ct, ...we];
  merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return merged;
}

module.exports = { create, markDispatched, findByCallbackData };

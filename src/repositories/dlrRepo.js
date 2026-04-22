'use strict';

/**
 * src/repositories/dlrRepo.js
 * SQL operations for dlr_events table across multiple databases.
 */

const db = require('../config/db');

/**
 * Insert a DLR raw event into the specific connector database.
 */
async function create(params, connectorType = 'MOENGAGE') {
  const {
    callback_data,
    sparc_status,
    moe_status,
    error_message,
    event_timestamp,
  } = params;

  return db.connectorQuery(
    connectorType,
    `INSERT INTO dlr_events
      (callback_data, sparc_status, moe_status, error_message, event_timestamp, callback_dispatched, created_at)
     VALUES (?, ?, ?, ?, ?, 0, NOW())`,
    [
      callback_data,
      sparc_status  || null,
      moe_status    || null,
      error_message || null,
      event_timestamp || null,
    ]
  );
}

/**
 * Mark a DLR event as dispatched for callback.
 */
async function markDispatched(eventId, connectorType = 'MOENGAGE') {
  return db.connectorQuery(
    connectorType, 
    `UPDATE dlr_events SET callback_dispatched = 1 WHERE id = ?`, 
    [eventId]
  );
}

/**
 * Check if a recent generic DLR has arrived for a callback_data.
 * Fans out to all 3 DBs since we may not know the connector.
 */
async function hasRecentGenericDlr(callbackData, withinMinutes = 10) {
  const sql = `SELECT COUNT(*) as count 
     FROM dlr_events 
     WHERE callback_data = ? 
       AND (sparc_status IN ('SENT', 'DELIVERED') OR moe_status IN ('RCS_SENT', 'RCS_DELIVERED', 'SMS_SENT', 'SMS_DELIVERED'))
       AND created_at >= NOW() - INTERVAL ? MINUTE`;
       
  const [moe, ct, we] = await db.fanOutQuery(sql, [callbackData, withinMinutes]);
  return (Number(moe[0]?.count) > 0) || (Number(ct[0]?.count) > 0) || (Number(we[0]?.count) > 0);
}

/**
 * Find all DLR events for a given callback_data.
 * Fans out and merges.
 */
async function findByCallbackData(callbackData) {
  const sql = 'SELECT * FROM dlr_events WHERE callback_data = ? ORDER BY created_at ASC';
  const [moe, ct, we] = await db.fanOutQuery(sql, [callbackData]);
  
  const merged = [...moe, ...ct, ...we];
  merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return merged;
}

module.exports = { create, markDispatched, hasRecentGenericDlr, findByCallbackData };


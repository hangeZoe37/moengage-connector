'use strict';

/**
 * src/repositories/dlrRepo.js
 * SQL operations for connector-specific dlr_events table.
 */

const { query } = require('../config/db');

/**
 * Resolve the connector-specific table name for DLR events.
 * @param {string} connectorType
 * @returns {string}
 */
function dlrTable(connectorType) {
  return connectorType === 'CLEVERTAP'
    ? 'clevertap_dlr_events'
    : 'moengage_dlr_events';
}

/**
 * Insert a DLR raw event into the specific connector table ONLY.
 * @param {object} params
 * @param {string} [connectorType='MOENGAGE']
 * @returns {Promise<object>}
 */
async function create(params, connectorType = 'MOENGAGE') {
  const {
    callback_data,
    sparc_status,
    moe_status,
    error_message,
    event_timestamp,
  } = params;

  const specificTable = dlrTable(connectorType);

  return query(
    `INSERT INTO ${specificTable}
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
 * Mark a DLR event as dispatched for MoEngage callback.
 * Needs to map exactly to the connector.
 * @param {number} eventId The internal numeric DB ID of the DLR
 * @param {string} [connectorType='MOENGAGE']
 * @returns {Promise<object>}
 */
async function markDispatched(eventId, connectorType = 'MOENGAGE') {
  const specificTable = dlrTable(connectorType);

  return query(`UPDATE ${specificTable} SET callback_dispatched = 1 WHERE id = ?`, [eventId]);
}

/**
 * Check if a recent generic DLR has arrived for a callback_data.
 * Reads from the view.
 * @param {string} callbackData
 * @param {number} withinMinutes
 * @returns {Promise<boolean>}
 */
async function hasRecentGenericDlr(callbackData, withinMinutes = 10) {
  const [rows] = await query(
    `SELECT COUNT(*) as count 
     FROM dlr_events 
     WHERE callback_data = ? 
       AND (sparc_status IN ('SENT', 'DELIVERED') OR moe_status IN ('RCS_SENT', 'RCS_DELIVERED', 'SMS_SENT', 'SMS_DELIVERED'))
       AND created_at >= NOW() - INTERVAL ? MINUTE`,
    [callbackData, withinMinutes]
  );
  return rows?.count > 0;
}

/**
 * Find all DLR events for a given callback_data.
 * Queries the view to get across all connectors.
 * @param {string} callbackData
 * @returns {Promise<Array>}
 */
async function findByCallbackData(callbackData) {
  return query(
    'SELECT * FROM dlr_events WHERE callback_data = ? ORDER BY created_at ASC',
    [callbackData]
  );
}

module.exports = { create, markDispatched, hasRecentGenericDlr, findByCallbackData };


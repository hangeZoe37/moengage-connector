'use strict';

/**
 * src/repositories/suggestionRepo.js
 * SQL operations for connector-specific suggestion_events tables.
 */

const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * Resolve the connector-specific suggestion event table name.
 * @param {string} connectorType
 * @returns {string}
 */
function suggestionTable(connectorType) {
  return connectorType === 'CLEVERTAP'
    ? 'clevertap_suggestion_events'
    : 'moengage_suggestion_events';
}

/**
 * Insert a suggestion click event directly into the connector-specific table ONLY.
 * @param {object} params
 * @param {string} [connectorType='MOENGAGE']
 * @returns {Promise<object>}
 */
async function create(params, connectorType = 'MOENGAGE') {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp,
  } = params;

  const specificTable = suggestionTable(connectorType);

  return query(
    `INSERT INTO ${specificTable}
      (callback_data, suggestion_text, postback_data, event_timestamp, callback_dispatched, created_at)
     VALUES (?, ?, ?, ?, 0, NOW())`,
    [callback_data, suggestion_text || null, postback_data || null, event_timestamp || null]
  );
}

/**
 * Mark a suggestion event as dispatched in the specific connector table.
 * @param {number} eventId
 * @param {string} [connectorType='MOENGAGE']
 * @returns {Promise<object>}
 */
async function markDispatched(eventId, connectorType = 'MOENGAGE') {
  const specificTable = suggestionTable(connectorType);
  return query(`UPDATE ${specificTable} SET callback_dispatched = 1 WHERE id = ?`, [eventId]);
}

/**
 * Find all suggestion events for a given callback_data.
 * Queries the view to get across all connectors.
 * @param {string} callbackData
 * @returns {Promise<Array>}
 */
async function findByCallbackData(callbackData) {
  const rows = await query(
    'SELECT * FROM suggestion_events WHERE callback_data = ? ORDER BY created_at ASC',
    [callbackData]
  );
  return rows;
}

module.exports = { create, markDispatched, findByCallbackData };

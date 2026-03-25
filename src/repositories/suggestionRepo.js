'use strict';

/**
 * src/repositories/suggestionRepo.js
 * SQL operations for suggestion_events table.
 */

const { query } = require('../config/db');

/**
 * Insert a suggestion click event.
 * @param {object} params
 * @returns {Promise<object>}
 */
async function create(params) {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp,
  } = params;

  return query(
    `INSERT INTO suggestion_events 
      (callback_data, suggestion_text, postback_data, event_timestamp)
     VALUES (?, ?, ?, ?)`,
    [callback_data, suggestion_text || null, postback_data || null, event_timestamp || null]
  );
}

/**
 * Mark a suggestion event as dispatched.
 * @param {number} eventId
 * @returns {Promise<object>}
 */
async function markDispatched(eventId) {
  return query(
    'UPDATE suggestion_events SET callback_dispatched = 1 WHERE id = ?',
    [eventId]
  );
}

module.exports = { create, markDispatched };

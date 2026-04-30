'use strict';

/**
 * src/repositories/suggestionRepo.js
 * Handles persistence for the CleverTap Interaction/Suggestion logs.
 */

const { pools } = require('../config/db');

async function create(suggestionData) {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp
  } = suggestionData;

  const sql = `
    INSERT INTO suggestion_events (
      callback_data, suggestion_text, postback_data,
      event_timestamp, callback_dispatched, created_at
    ) VALUES (?, ?, ?, ?, 0, NOW())
  `;

  const [result] = await pools.CLEVERTAP.query(sql, [
    callback_data,
    suggestion_text || null,
    postback_data || null,
    event_timestamp ? event_timestamp * 1000 : null
  ]);

  return result;
}

async function markDispatched(id) {
  const [result] = await pools.CLEVERTAP.query(
    'UPDATE suggestion_events SET callback_dispatched = 1 WHERE id = ?',
    [id]
  );
  return result;
}

module.exports = {
  create,
  markDispatched
};

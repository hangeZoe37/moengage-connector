'use strict';

const { pools } = require('../config/db');

async function create(suggestionData) {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp
  } = suggestionData;

  const [result] = await pools.WEBENGAGE.query(
    `INSERT INTO suggestion_events (
      callback_data, suggestion_text, postback_data, event_timestamp, callback_dispatched, created_at
    ) VALUES (?, ?, ?, ?, 0, NOW())`,
    [
      callback_data,
      suggestion_text || null,
      postback_data || null,
      event_timestamp || null
    ]
  );
  return result;
}

async function markDispatched(id) {
  const [result] = await pools.WEBENGAGE.query(
    'UPDATE suggestion_events SET callback_dispatched = 1 WHERE id = ?',
    [id]
  );
  return result;
}

module.exports = {
  create,
  markDispatched
};

'use strict';

const { pools } = require('../config/db');

async function create(data) {
  const {
    callback_data,
    suggestion_text,
    postback_data,
    event_timestamp
  } = data;

  const [result] = await pools.MOENGAGE.query(
    `INSERT INTO suggestion_events (
      callback_data, suggestion_text, postback_data, event_timestamp
    ) VALUES (?, ?, ?, COALESCE(?, UNIX_TIMESTAMP()))`,
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
  const [result] = await pools.MOENGAGE.query(
    'UPDATE suggestion_events SET callback_dispatched = 1 WHERE id = ?',
    [id]
  );
  return result;
}

module.exports = {
  create,
  markDispatched
};

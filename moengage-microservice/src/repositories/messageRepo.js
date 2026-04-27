'use strict';

const { pools } = require('../config/db');

async function create(messageData) {
  const {
    callback_data,
    client_id,
    destination,
    bot_id,
    template_name,
    message_type,
    fallback_order,
    sparc_message_id,
    raw_payload,
    has_url,
    status = 'QUEUED'
  } = messageData;

  const [result] = await pools.MOENGAGE.query(
    `INSERT INTO message_logs (
      callback_data, client_id, destination, bot_id, template_name,
      message_type, fallback_order, sparc_message_id, status, raw_payload,
      has_url, connector_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      callback_data,
      client_id,
      destination,
      bot_id || null,
      template_name || null,
      message_type || 'TEXT',
      fallback_order ? JSON.stringify(fallback_order) : JSON.stringify(['rcs']),
      sparc_message_id || null,
      status,
      typeof raw_payload === 'string' ? raw_payload : JSON.stringify(raw_payload || {}),
      has_url ? 1 : 0,
      'MOENGAGE'
    ]
  );
  return result;
}

async function updateStatus(callbackData, status) {
  const [result] = await pools.MOENGAGE.query(
    'UPDATE message_logs SET status = ? WHERE callback_data = ?',
    [status, callbackData]
  );
  return result;
}

async function findByCallbackData(callbackData) {
  const [rows] = await pools.MOENGAGE.query(
    'SELECT * FROM message_logs WHERE callback_data = ? LIMIT 1',
    [callbackData]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function updateTransactionId(callbackData, transactionId) {
  const [result] = await pools.MOENGAGE.query(
    'UPDATE message_logs SET sparc_transaction_id = ? WHERE callback_data = ?',
    [transactionId, callbackData]
  );
  return result;
}

module.exports = {
  create,
  updateStatus,
  findByCallbackData,
  updateTransactionId
};

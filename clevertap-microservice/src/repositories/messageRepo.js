'use strict';

/**
 * src/repositories/messageRepo.js
 * Handles persistence for the CleverTap message logs.
 */

const { pools } = require('../config/db');

async function create(logData) {
  const {
    callback_data,
    client_id,
    destination,
    bot_id,
    template_name,
    message_type,
    fallback_order,
    raw_payload,
    connector_type = 'CLEVERTAP',
    callback_url,
    has_url = 0
  } = logData;

  const sql = `
    INSERT INTO message_logs (
      callback_data, client_id, destination, bot_id, template_name,
      message_type, fallback_order, raw_payload, connector_type,
      callback_url, has_url, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', NOW(), NOW())
  `;

  const [result] = await pools.CLEVERTAP.query(sql, [
    callback_data,
    client_id,
    destination,
    bot_id || null,
    template_name || null,
    message_type || 'TEXT',
    JSON.stringify(fallback_order || ['rcs']),
    JSON.stringify(raw_payload),
    connector_type,
    callback_url || null,
    has_url
  ]);

  return result;
}

async function findByCallbackData(callbackData) {
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM message_logs WHERE callback_data = ?',
    [callbackData]
  );
  return rows[0];
}

async function findBySparcTransactionId(transactionId) {
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM message_logs WHERE sparc_transaction_id = ?',
    [transactionId]
  );
  return rows[0];
}

async function updateStatus(callbackData, status, sparcMessageId = null) {
  let sql = 'UPDATE message_logs SET status = ?, updated_at = NOW()';
  const params = [status];

  if (sparcMessageId) {
    sql += ', sparc_message_id = ?';
    params.push(sparcMessageId);
  }

  sql += ' WHERE callback_data = ?';
  params.push(callbackData);

  const [result] = await pools.CLEVERTAP.query(sql, params);
  return result;
}

async function updateHasUrl(callbackData, hasUrl) {
  const [result] = await pools.CLEVERTAP.query(
    'UPDATE message_logs SET has_url = ?, updated_at = NOW() WHERE callback_data = ?',
    [hasUrl, callbackData]
  );
  return result;
}

async function updateSparcTransactionId(callbackData, transactionId) {
  const [result] = await pools.CLEVERTAP.query(
    'UPDATE message_logs SET sparc_transaction_id = ?, updated_at = NOW() WHERE callback_data = ?',
    [String(transactionId), callbackData]
  );
  return result;
}

module.exports = {
  create,
  findByCallbackData,
  findBySparcTransactionId,
  updateStatus,
  updateHasUrl,
  updateSparcTransactionId
};

'use strict';

const { pools } = require('../config/db');

async function create(messageData) {
  const {
    client_id,
    callback_data,
    recipient,
    status,
    channel,
    raw_payload,
    fallback_order,
    bot_id,
    template_name
  } = messageData;

  // WebEngage Schema uses 'destination' instead of 'recipient' 
  // and 'routing_details' instead of 'fallback_order'
  const [result] = await pools.WEBENGAGE.query(
    `INSERT INTO message_logs (
      client_id, 
      callback_data, 
      destination, 
      bot_id,
      template_name,
      status, 
      message_type, 
      raw_payload, 
      routing_details, 
      connector_type,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEBENGAGE', NOW(), NOW())`,
    [
      client_id,
      callback_data,
      recipient,
      bot_id || null,
      template_name || null,
      status,
      channel,
      JSON.stringify(raw_payload),
      JSON.stringify(fallback_order || ['rcs'])
    ]
  );
  return result;
}

async function findByCallbackData(callbackData) {
  const [rows] = await pools.WEBENGAGE.query(
    'SELECT * FROM message_logs WHERE callback_data = ?',
    [callbackData]
  );
  return rows[0];
}

async function updateStatus(callbackData, status) {
  const [result] = await pools.WEBENGAGE.query(
    'UPDATE message_logs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE callback_data = ?',
    [status, callbackData]
  );
  return result;
}

module.exports = {
  create,
  findByCallbackData,
  updateStatus
};

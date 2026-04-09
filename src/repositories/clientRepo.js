'use strict';

/**
 * src/repositories/clientRepo.js
 * SQL operations for the clients table.
 */

const { query } = require('../config/db');

/**
 * Find a client by its Bearer token.
 * Used exclusively for inbound request authentication and routing.
 * @param {string} token - Bearer token from Authorization header
 * @returns {Promise<object|null>} Client row or null
 */
async function findByToken(token) {
  const rows = await query(
    'SELECT * FROM clients WHERE bearer_token = ? AND is_active = 1 LIMIT 1',
    [token]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Find a client by ID.
 * @param {number} clientId
 * @returns {Promise<object|null>}
 */
async function findById(clientId) {
  const rows = await query(
    'SELECT * FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all clients for the dashboard/admin list.
 * @returns {Promise<Array>}
 */
async function getAll() {
  return query('SELECT * FROM clients ORDER BY created_at DESC');
}

/**
 * Onboard a new client into the database.
 * @param {object} clientData
 * @returns {Promise<number>} New client ID
 */
async function createClient(clientData) {
  const {
    client_name,
    bearer_token,
    rcs_username,
    rcs_password,
    sms_username,
    sms_password,
    rcs_assistant_id,
  } = clientData;

  const result = await query(
    `INSERT INTO clients (
      client_name, bearer_token, rcs_username, rcs_password,
      sms_username, sms_password, rcs_assistant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client_name,
      bearer_token,
      rcs_username     || null,
      rcs_password     || null,
      sms_username     || null,
      sms_password     || null,
      rcs_assistant_id || null,
    ]
  );

  return result.insertId;
}

/**
 * Update client fields (allowlisted columns only).
 * @param {number} id
 * @param {object} fields - Partial updates
 */
async function updateClient(id, fields) {
  const allowed = [
    'client_name', 'rcs_username', 'rcs_password',
    'sms_username', 'sms_password', 'rcs_assistant_id',
  ];
  const updates = [];
  const params  = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }
  if (updates.length === 0) return;
  params.push(id);
  return query(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, params);
}

/**
 * Soft-deactivate a client (sets is_active = 0).
 * Message history is preserved. Re-enable via toggleClientStatus.
 * @param {number} id
 */
async function deactivateClient(id) {
  return query('UPDATE clients SET is_active = 0 WHERE id = ?', [id]);
}

/**
 * Toggle a client's active status (0 → 1 or 1 → 0).
 * @param {number} id
 */
async function toggleActive(id) {
  return query('UPDATE clients SET is_active = NOT is_active WHERE id = ?', [id]);
}

module.exports = {
  findByToken,
  findById,
  getAll,
  createClient,
  updateClient,
  deactivateClient,
  toggleActive,
};

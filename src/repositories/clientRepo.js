'use strict';

/**
 * src/repositories/clientRepo.js
 * SQL operations for the clients table (dashboard credentials).
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
 */
async function findById(clientId) {
  const rows = await query(
    'SELECT * FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all active clients for the dashboard list.
 */
async function getAll() {
  return query('SELECT * FROM clients ORDER BY created_at DESC');
}

/**
 * Onboard a new client into the database.
 */
async function createClient(clientData) {
  const {
    client_name,
    bearer_token,
    rcs_username,
    rcs_password,
    sms_username,
    sms_password,
    rcs_assistant_id
  } = clientData;

  const result = await query(
    `INSERT INTO clients (
      client_name, bearer_token, rcs_username, rcs_password,
      sms_username, sms_password, rcs_assistant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client_name,
      bearer_token,
      rcs_username || null,
      rcs_password || null,
      sms_username || null,
      sms_password || null,
      rcs_assistant_id || null
    ]
  );
  
  return result.insertId;
}

/**
 * Update client fields.
 * @param {number} id
 * @param {object} fields - Partial updates
 */
async function updateClient(id, fields) {
  const allowed = [
    'client_name', 'rcs_username', 'rcs_password',
    'sms_username', 'sms_password', 'rcs_assistant_id',
  ];
  const updates = [];
  const params = [];
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
 * Permanently delete a client.
 * @param {number} id
 */
async function deactivateClient(id) {
  // Permanently delete instead of setting is_active = 0
  return query('DELETE FROM clients WHERE id = ?', [id]);
}

module.exports = { findByToken, findById, getAll, createClient, updateClient, deactivateClient };

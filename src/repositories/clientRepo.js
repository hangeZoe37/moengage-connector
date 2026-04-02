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

module.exports = { findByToken, findById, getAll };

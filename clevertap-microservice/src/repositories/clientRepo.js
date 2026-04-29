'use strict';

/**
 * src/repositories/clientRepo.js
 * Accesses client configuration from the ADMIN database.
 */

const { pools } = require('../config/db');

async function findById(clientId) {
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM clients WHERE id = ?',
    [clientId]
  );
  return rows[0];
}

async function findByRcsUsername(username) {
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM clients WHERE rcs_username = ?',
    [username]
  );
  return rows[0];
}

async function findByToken(token) {
  // We use the same fan-out logic as the monolith: check raw and hashed versions
  const crypto = require('crypto');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  
  const [rows] = await pools.CLEVERTAP.query(
    'SELECT * FROM clients WHERE (bearer_token = ? OR bearer_token = ?) AND is_active = 1 LIMIT 1',
    [token, hashed]
  );
  return rows[0];
}

module.exports = {
  findById,
  findByRcsUsername,
  findByToken
};

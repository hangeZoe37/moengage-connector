'use strict';

const db = require('../config/db');
const { hashToken } = require('../utils/crypto');

async function findByToken(token) {
  const hashed = hashToken(token);
  
  // Search by plain token OR hashed token in the MoEngage database
  const sql = 'SELECT * FROM clients WHERE (bearer_token = ? OR bearer_token = ?) AND is_active = 1 LIMIT 1';
  const rows = await db.moengageQuery(sql, [token, hashed]);
  
  if (rows.length > 0) {
    return { ...rows[0], connector_type: 'MOENGAGE' };
  }
  return null;
}

async function findById(clientId) {
  const sql = 'SELECT * FROM clients WHERE id = ? LIMIT 1';
  const rows = await db.moengageQuery(sql, [clientId]);
  return rows.length > 0 ? { ...rows[0], connector_type: 'MOENGAGE' } : null;
}

async function getAll() {
  const sql = 'SELECT * FROM clients ORDER BY created_at DESC';
  return db.moengageQuery(sql);
}

module.exports = {
  findByToken,
  findById,
  getAll
};

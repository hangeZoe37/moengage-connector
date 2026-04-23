'use strict';

/**
 * src/repositories/clientRepo.js
 * SQL operations for the clients table.
 */

const db = require('../config/db');
const cache = require('../services/cacheService');
const { hashToken } = require('../utils/crypto');

/**
 * Find a client by its Bearer token.
 * Used exclusively for inbound request authentication and routing.
 * Caches results for 5 minutes.
 * 
 * SEARCH STRATEGY: Fan-out to all 3 connector databases (MOE, CT, WE).
 * 
 * @param {string} token - Bearer token from Authorization header
 * @returns {Promise<object|null>} Client row or null
 */
async function findByToken(token) {
  const hashed = hashToken(token);
  const cacheKey = `client_token_${hashed}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Search by plain token OR hashed token across ALL databases
  const sql = 'SELECT * FROM clients WHERE (bearer_token = ? OR bearer_token = ?) AND is_active = 1 LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [token, hashed]);

  let client = null;
  if (moe.length > 0) {
    client = { ...moe[0], connector_type: 'MOENGAGE' };
  } else if (ct.length > 0) {
    client = { ...ct[0], connector_type: 'CLEVERTAP' };
  } else if (we.length > 0) {
    client = { ...we[0], connector_type: 'WEBENGAGE' };
  }
  
  if (client) {
    cache.set(cacheKey, client);
  }
  return client;
}

/**
 * Find a client by SPARC RCS credentials (User ID and Password).
 * Used for CleverTap Basic Auth.
 * @param {string} username - rcs_username
 * @param {string} password - rcs_password
 * @returns {Promise<object|null>}
 */
async function findByCredentials(username, password) {
  const sql = 'SELECT * FROM clients WHERE rcs_username = ? AND rcs_password = ? AND is_active = 1 LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [username, password]);

  if (moe.length > 0) return { ...moe[0], connector_type: 'MOENGAGE' };
  if (ct.length > 0) return { ...ct[0], connector_type: 'CLEVERTAP' };
  if (we.length > 0) return { ...we[0], connector_type: 'WEBENGAGE' };
  return null;
}

/**
 * Find a client by ID. Requires connectorType since IDs may overlap in different DBs.
 * @param {number} clientId
 * @param {string} connectorType
 * @returns {Promise<object|null>}
 */
async function findById(clientId, connectorType) {
  if (!connectorType) return findAcrossAllById(clientId);

  const rows = await db.connectorQuery(
    connectorType,
    'SELECT * FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );
  return rows.length > 0 ? { ...rows[0], connector_type: connectorType } : null;
}

/**
 * Fallback search for a client ID across all DBs. 
 * Used when the connector_type context is missing (e.g. from older UI states).
 */
async function findAcrossAllById(clientId) {
  const sql = 'SELECT * FROM clients WHERE id = ? LIMIT 1';
  const [moe, ct, we] = await db.fanOutQuery(sql, [clientId]);

  if (moe.length > 0) return { ...moe[0], connector_type: 'MOENGAGE' };
  if (ct.length > 0) return { ...ct[0], connector_type: 'CLEVERTAP' };
  if (we.length > 0) return { ...we[0], connector_type: 'WEBENGAGE' };
  return null;
}

/**
 * Get all clients from all databases or a specific one for the dashboard/admin list.
 * @param {string} [connector] - Optional connector type to filter by
 * @returns {Promise<Array>}
 */
async function getAll(connector) {
  const sql = 'SELECT * FROM clients ORDER BY created_at DESC';
  
  if (connector) {
    const rows = await db.connectorQuery(connector, sql);
    return rows.map(c => ({ ...c, connector_type: connector.toUpperCase() }));
  }

  const [moe, ct, we] = await db.fanOutQuery(sql);
  
  return [
    ...moe.map(c => ({ ...c, connector_type: 'MOENGAGE' })),
    ...ct.map(c => ({ ...c, connector_type: 'CLEVERTAP' })),
    ...we.map(c => ({ ...c, connector_type: 'WEBENGAGE' }))
  ];
}

/**
 * Onboard a new client into a specific database.
 * @param {object} clientData
 * @param {string} connectorType
 * @returns {Promise<number>} New client ID
 */
async function createClient(clientData, connectorType = 'MOENGAGE') {
  const {
    client_name,
    bearer_token,
    rcs_username,
    rcs_password,
    sms_username,
    sms_password,
    rcs_assistant_id,
  } = clientData;

  const result = await db.connectorQuery(
    connectorType,
    `INSERT INTO clients (
      client_name, bearer_token, rcs_username, rcs_password,
      sms_username, sms_password, rcs_assistant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client_name,
      hashToken(bearer_token), // Store hashed token
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
 * Update client fields in its specific database.
 * @param {number} id
 * @param {object} fields - Partial updates
 * @param {string} connectorType
 */
async function updateClient(id, fields, connectorType = 'MOENGAGE') {
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
  
  const result = await db.connectorQuery(
    connectorType,
    `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, 
    params
  );
  
  cache.flush();
  return result;
}

/**
 * Soft-deactivate a client.
 * @param {number} id
 * @param {string} connectorType
 */
async function deactivateClient(id, connectorType = 'MOENGAGE') {
  return db.connectorQuery(connectorType, 'UPDATE clients SET is_active = 0 WHERE id = ?', [id]);
}

/**
 * Toggle a client's active status.
 * @param {number} id
 * @param {string} connectorType
 */
async function toggleActive(id, connectorType = 'MOENGAGE') {
  const result = await db.connectorQuery(connectorType, 'UPDATE clients SET is_active = NOT is_active WHERE id = ?', [id]);
  cache.flush(); 
  return result;
}

module.exports = {
  findByToken,
  findById,
  findAcrossAllById,
  getAll,
  createClient,
  updateClient,
  deactivateClient,
  toggleActive,
  findByCredentials,
};

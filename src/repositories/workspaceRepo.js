'use strict';

/**
 * src/repositories/workspaceRepo.js
 * SQL operations for workspace_tokens table.
 */

const { query } = require('../config/db');

/**
 * Find a workspace by its Bearer token.
 * @param {string} token - Bearer token from Authorization header
 * @returns {Promise<object|null>} Workspace row or null
 */
async function findByToken(token) {
  const rows = await query(
    'SELECT * FROM workspace_tokens WHERE bearer_token = ? LIMIT 1',
    [token]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Find a workspace by workspace_id.
 * @param {string} workspaceId
 * @returns {Promise<object|null>}
 */
async function findById(workspaceId) {
  const rows = await query(
    'SELECT * FROM workspace_tokens WHERE workspace_id = ? LIMIT 1',
    [workspaceId]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = { findByToken, findById };

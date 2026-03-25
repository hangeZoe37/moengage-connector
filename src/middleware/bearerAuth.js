'use strict';

/**
 * src/middleware/bearerAuth.js
 * Token → workspace lookup → attaches req.workspace.
 * Reads from DB on every request (no restart needed for new workspaces).
 */

const workspaceRepo = require('../repositories/workspaceRepo');
const logger = require('../config/logger');

async function bearerAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['authentication'];

    if (!authHeader) {
      logger.warn('Auth failure: missing Authorization header', {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Auth failure: malformed Authorization header', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: authHeader.substring(0, 10),
      });
      return res.status(401).json({ error: 'Invalid Authorization format. Expected: Bearer <token>' });
    }

    const token = parts[1];

    const workspace = await workspaceRepo.findByToken(token);

    if (!workspace) {
      logger.warn('Auth failure: unknown token', {
        ip: req.ip,
        path: req.path,
        tokenPrefix: token.substring(0, 8) + '...',
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!workspace.is_active) {
      logger.warn('Auth failure: workspace disabled', {
        workspaceId: workspace.workspace_id,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Workspace is disabled' });
    }

    // Attach workspace to request for downstream use
    req.workspace = workspace;

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

module.exports = bearerAuth;

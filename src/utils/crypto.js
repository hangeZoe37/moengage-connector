'use strict';

const crypto = require('crypto');

/**
 * Hash a plain text token using SHA-256.
 * @param {string} token 
 * @returns {string} 64-character hex hash
 */
function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashToken };

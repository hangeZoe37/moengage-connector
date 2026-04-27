'use strict';

const crypto = require('crypto');

/**
 * SHA-256 hashing for bearer tokens to match the main project logic.
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashToken
};

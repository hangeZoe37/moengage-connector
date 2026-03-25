'use strict';

/**
 * src/config/constants.js
 * Enums + config values. No hardcoded strings in logic files.
 */

/** Message content types from MoEngage */
const MESSAGE_TYPES = Object.freeze({
  TEXT: 'TEXT',
  CARD: 'CARD',
  MEDIA: 'MEDIA',
  CAROUSEL: 'CAROUSEL',
});

/** Internal message processing statuses */
const MESSAGE_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  RCS_SENT: 'RCS_SENT',
  RCS_FAILED: 'RCS_FAILED',
  SMS_SENT: 'SMS_SENT',
  SMS_FAILED: 'SMS_FAILED',
  DONE: 'DONE',
});

/** Callback dispatch payload types */
const PAYLOAD_TYPES = Object.freeze({
  STATUS: 'STATUS',
  SUGGESTION: 'SUGGESTION',
});

/** Fallback channel identifiers */
const CHANNELS = Object.freeze({
  RCS: 'rcs',
  SMS: 'sms',
});

/** Retry configuration for MoEngage callback dispatching */
const RETRY_CONFIG = Object.freeze({
  MAX_ATTEMPTS: 3,
  DELAYS_MS: [1000, 2000, 3000], // exponential backoff: 1s → 2s → 3s
});

/** HTTP timeout for SPARC API calls (ms) */
const SPARC_REQUEST_TIMEOUT_MS = 4000; // must be < 5s MoEngage timeout

/** HTTP timeout for MoEngage callback (ms) */
const MOE_CALLBACK_TIMEOUT_MS = 5000;

module.exports = {
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  PAYLOAD_TYPES,
  CHANNELS,
  RETRY_CONFIG,
  SPARC_REQUEST_TIMEOUT_MS,
  MOE_CALLBACK_TIMEOUT_MS,
};

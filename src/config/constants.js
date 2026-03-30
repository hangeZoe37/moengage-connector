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
  /**
   * Carousel is not supported yet by MoEngage
   * CAROUSEL: 'CAROUSEL',
   */
});

/** Internal message processing statuses */
const MESSAGE_STATUSES = Object.freeze({
  // ── Queued ──────────────────────────────────────────────────
  QUEUED: 'QUEUED',               // Message received from MoEngage, not yet sent

  // ── RCS send outcomes (reported by SPARC on submission) ─────
  RCS_SENT: 'RCS_SENT',           // Accepted by RCS network
  RCS_SENT_FAILED: 'RCS_SENT_FAILED', // Rejected at send time (invalid number, etc.)

  // ── RCS delivery / engagement (DLR callbacks from SPARC) ────
  RCS_DELIVERED: 'RCS_DELIVERED', // Handset confirmed receipt
  RCS_DELIVERY_FAILED: 'RCS_DELIVERY_FAILED', // Handset unreachable / expired
  RCS_READ: 'RCS_READ',           // User opened the message

  // ── SMS fallback send outcomes ───────────────────────────────
  SMS_SENT: 'SMS_SENT',           // Accepted by SMS network
  SMS_SENT_FAILED: 'SMS_SENT_FAILED', // Rejected at send time

  // ── SMS delivery (DLR callbacks from SPARC) ──────────────────
  SMS_DELIVERED: 'SMS_DELIVERED', // Handset confirmed receipt
  SMS_DELIVERY_FAILED: 'SMS_DELIVERY_FAILED', // Handset unreachable / expired

  // ── Terminal state ───────────────────────────────────────────
  DONE: 'DONE',                   // Final callback sent back to MoEngage successfully
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
const MOE_CALLBACK_TIMEOUT_MS = 15000;

module.exports = {
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  PAYLOAD_TYPES,
  CHANNELS,
  RETRY_CONFIG,
  SPARC_REQUEST_TIMEOUT_MS,
  MOE_CALLBACK_TIMEOUT_MS,
};

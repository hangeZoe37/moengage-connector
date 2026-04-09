'use strict';

/**
 * src/mappers/dlrMapper.js
 * SPARC status → MoEngage status. STATUS_MAP lives here. Nowhere else.
 * PURE FUNCTION — no DB, no API calls, no side effects.
 */

/**
 * Maps raw SPARC status strings to MoEngage status enums.
 * These are the exact eventType values SPARC uses in its DLR callbacks.
 */
const STATUS_MAP = Object.freeze({
  // ── SPARC canonical event types ──────────────────────────────────────────
  'SEND_MESSAGE_SUCCESS':   'RCS_SENT',
  'SEND_MESSAGE_FAILURE':   'RCS_DELIVERY_FAILED',
  'MESSAGE_DELIVERED':      'RCS_DELIVERED',
  'MESSAGE_READ':           'RCS_READ',
  'MESSAGE_DELIVERY_FAILED':'RCS_DELIVERY_FAILED',

  // ── SMS fallback events from SPARC ────────────────────────────────────────
  'SMS_SENT':               'SMS_SENT',
  'SMS_DELIVERED':          'SMS_DELIVERED',
  'SMS_DELIVERY_FAILED':    'SMS_DELIVERY_FAILED',
  'SMS_FAILED':             'SMS_DELIVERY_FAILED',

  // ── Lowercase aliases (legacy / safety) ───────────────────────────────────
  'sent':                   'RCS_SENT',
  'delivered':              'RCS_DELIVERED',
  'read':                   'RCS_READ',
  'failed':                 'RCS_DELIVERY_FAILED',
  'sms_sent':               'SMS_SENT',
  'sms_delivered':          'SMS_DELIVERED',
  'sms_failed':             'SMS_DELIVERY_FAILED',
});

/**
 * MoEngage expects error_message field ONLY for FAILED statuses.
 * Also includes SMS_SENT_FAILED so error_message is captured there too.
 */
const FAILED_STATUSES = new Set([
  'RCS_DELIVERY_FAILED',
  'RCS_SENT_FAILED',
  'SMS_DELIVERY_FAILED',
  'SMS_SENT_FAILED',
]);

/**
 * Maps a SPARC DLR event to MoEngage callback format.
 * @param {object} sparcEvent - Raw DLR event from SPARC
 * @returns {object} MoEngage-formatted status callback payload
 */
function mapDlrEvent(sparcEvent) {
  const eventRoot = sparcEvent.eventData || sparcEvent;
  const entity = eventRoot.entity || {};

  // Support both nested SPARC format AND flat Postman formats
  const sparcStatus = (entity.eventType || eventRoot.status || sparcEvent.status || '').toUpperCase();
  const moeStatus = STATUS_MAP[sparcStatus] || 'UNKNOWN';
  
  const callbackData = sparcEvent.seq_id || sparcEvent.seqId || eventRoot.seqId || sparcEvent.callback_data;

  // Convert SPARC ISO 8601 (e.g. 2026-03-28T15:21...) to MoEngage Epoch Seconds
  let timestampSeconds = Math.floor(Date.now() / 1000);
  if (entity.sendTime) {
    timestampSeconds = Math.floor(new Date(entity.sendTime).getTime() / 1000);
    // Fallback if Invalid Date
    if (isNaN(timestampSeconds)) timestampSeconds = Math.floor(Date.now() / 1000);
  }

  const statusItem = {
    status: moeStatus,
    callback_data: callbackData,
    timestamp: String(timestampSeconds),
  };

  // Only include error_message for failed statuses
  if (FAILED_STATUSES.has(moeStatus) && entity.error && entity.error.message) {
    statusItem.error_message = entity.error.message;
  }

  return {
    statuses: [statusItem],
  };
}

/**
 * Check if a MoEngage status represents a failure.
 * @param {string} moeStatus
 * @returns {boolean}
 */
function isFailedStatus(moeStatus) {
  return FAILED_STATUSES.has(moeStatus);
}

/**
 * Translate a raw SPARC status string to a MoEngage status.
 * @param {string} sparcStatus
 * @returns {string}
 */
function translateStatus(sparcStatus) {
  return STATUS_MAP[(sparcStatus || '').toUpperCase()] || 'UNKNOWN';
}

module.exports = {
  STATUS_MAP,
  FAILED_STATUSES,
  mapDlrEvent,
  isFailedStatus,
  translateStatus,
};

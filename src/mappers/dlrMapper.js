'use strict';

/**
 * src/mappers/dlrMapper.js
 * SPARC status → MoEngage status. STATUS_MAP lives here. Nowhere else.
 * PURE FUNCTION — no DB, no API calls, no side effects.
 */

/**
 * Maps raw SPARC status strings to MoEngage status enums.
 * TODO: Verify these exact strings with the SPARC team before production.
 */
const STATUS_MAP = Object.freeze({
  'sent':                'RCS_SENT',
  'rcs_sent':            'RCS_SENT',
  'delivered':           'RCS_DELIVERED',
  'rcs_delivered':       'RCS_DELIVERED',
  'read':                'RCS_READ',
  'rcs_read':            'RCS_READ',
  'failed':              'RCS_DELIVERY_FAILED',
  'rcs_failed':          'RCS_DELIVERY_FAILED',
  'rcs_delivery_failed': 'RCS_DELIVERY_FAILED',
  'undelivered':         'RCS_DELIVERY_FAILED',
  'sms_sent':            'SMS_SENT',
  'sms_delivered':       'SMS_DELIVERED',
  'sms_failed':          'SMS_DELIVERY_FAILED',
  'sms_delivery_failed': 'SMS_DELIVERY_FAILED',
});

/** MoEngage expects error_message field ONLY for FAILED statuses */
const FAILED_STATUSES = new Set(['RCS_DELIVERY_FAILED', 'SMS_DELIVERY_FAILED']);

/**
 * Maps a SPARC DLR event to MoEngage callback format.
 * @param {object} sparcEvent - Raw DLR event from SPARC
 * @returns {object} MoEngage-formatted status callback payload
 */
function mapDlrEvent(sparcEvent) {
  // TODO: Confirm exact field names with SPARC team (seq_id vs message_id vs ref_id)
  const sparcStatus = (sparcEvent.status || '').toLowerCase();
  const moeStatus = STATUS_MAP[sparcStatus] || 'UNKNOWN';
  const callbackData = sparcEvent.seq_id || sparcEvent.callback_data || sparcEvent.ref_id;

  const statusItem = {
    status: moeStatus,
    callback_data: callbackData,
    timestamp: String(sparcEvent.timestamp || Math.floor(Date.now() / 1000)),
  };

  // Only include error_message for failed statuses
  if (FAILED_STATUSES.has(moeStatus) && sparcEvent.error_message) {
    statusItem.error_message = sparcEvent.error_message;
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
  return STATUS_MAP[(sparcStatus || '').toLowerCase()] || 'UNKNOWN';
}

module.exports = {
  STATUS_MAP,
  FAILED_STATUSES,
  mapDlrEvent,
  isFailedStatus,
  translateStatus,
};

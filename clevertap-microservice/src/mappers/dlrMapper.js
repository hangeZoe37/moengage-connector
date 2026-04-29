'use strict';

/**
 * src/mappers/dlrMapper.js
 * Maps SPARC statuses to internal statuses.
 */

const { MESSAGE_STATUSES } = require('../config/constants');

const STATUS_MAP = {
  'SUBMITTED':       MESSAGE_STATUSES.RCS_SENT,
  'SENT':            MESSAGE_STATUSES.RCS_SENT,
  'DELIVERED':       MESSAGE_STATUSES.RCS_DELIVERED,
  'READ':            MESSAGE_STATUSES.RCS_READ,
  'FAILED':          MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  'UNDELIVERED':      MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  'EXPIRED':         MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  'DELETED':         MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  'REJECTED':        MESSAGE_STATUSES.RCS_DELIVERY_FAILED,
  
  // SMS statuses
  'DELIVERY_SUCCESS': MESSAGE_STATUSES.SMS_DELIVERED,
  'DELIVERY_FAILURE': MESSAGE_STATUSES.SMS_DELIVERY_FAILED,
};

function translateStatus(sparcStatus) {
  const status = (sparcStatus || '').toUpperCase();
  return STATUS_MAP[status] || MESSAGE_STATUSES.RCS_SENT_FAILED;
}

module.exports = { translateStatus };

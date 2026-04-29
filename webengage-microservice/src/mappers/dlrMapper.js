'use strict';

const STATUS_MAP = Object.freeze({
  'SEND_MESSAGE_SUCCESS':   'RCS_SENT',
  'SEND_MESSAGE_FAILURE':   'RCS_DELIVERY_FAILED',
  'MESSAGE_DELIVERED':      'RCS_DELIVERED',
  'MESSAGE_READ':           'RCS_READ',
  'MESSAGE_DELIVERY_FAILED':'RCS_DELIVERY_FAILED',
  'REPLY':                  'RCS_READ',
  'INTERACTION':            'RCS_READ',
  'SUGGEST_CLICK':          'SUGGEST_CLICK',
});

function translateStatus(sparcStatus) {
  return STATUS_MAP[(sparcStatus || '').toUpperCase()] || 'UNKNOWN';
}

module.exports = {
  translateStatus
};

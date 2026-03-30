'use strict';

/**
 * tests/mappers/dlrMapper.test.js
 * Unit tests for SPARC -> MoEngage DLR status mapping.
 */

const {
  STATUS_MAP,
  FAILED_STATUSES,
  mapDlrEvent,
  isFailedStatus,
  translateStatus,
} = require('../../src/mappers/dlrMapper');

describe('dlrMapper', () => {
  describe('STATUS_MAP', () => {
    it('should map SPARC canonical RCS event types to MoEngage statuses', () => {
      expect(STATUS_MAP['SEND_MESSAGE_SUCCESS']).toBe('RCS_SENT');
      expect(STATUS_MAP['MESSAGE_DELIVERED']).toBe('RCS_DELIVERED');
      expect(STATUS_MAP['MESSAGE_READ']).toBe('RCS_READ');
      expect(STATUS_MAP['SEND_MESSAGE_FAILURE']).toBe('RCS_DELIVERY_FAILED');
      expect(STATUS_MAP['MESSAGE_DELIVERY_FAILED']).toBe('RCS_DELIVERY_FAILED');
    });

    it('should map SPARC SMS event types to MoEngage SMS statuses', () => {
      expect(STATUS_MAP['SMS_SENT']).toBe('SMS_SENT');
      expect(STATUS_MAP['SMS_DELIVERED']).toBe('SMS_DELIVERED');
      expect(STATUS_MAP['SMS_DELIVERY_FAILED']).toBe('SMS_DELIVERY_FAILED');
      expect(STATUS_MAP['SMS_FAILED']).toBe('SMS_DELIVERY_FAILED');
    });

    it('should map legacy lowercase aliases as fallback', () => {
      expect(STATUS_MAP['sent']).toBe('RCS_SENT');
      expect(STATUS_MAP['delivered']).toBe('RCS_DELIVERED');
      expect(STATUS_MAP['sms_sent']).toBe('SMS_SENT');
      expect(STATUS_MAP['sms_delivered']).toBe('SMS_DELIVERED');
      expect(STATUS_MAP['sms_failed']).toBe('SMS_DELIVERY_FAILED');
    });
  });

  describe('FAILED_STATUSES', () => {
    it('should include all RCS failure states', () => {
      expect(FAILED_STATUSES.has('RCS_DELIVERY_FAILED')).toBe(true);
      expect(FAILED_STATUSES.has('RCS_SENT_FAILED')).toBe(true);
    });

    it('should include all SMS failure states', () => {
      expect(FAILED_STATUSES.has('SMS_DELIVERY_FAILED')).toBe(true);
      expect(FAILED_STATUSES.has('SMS_SENT_FAILED')).toBe(true);
    });

    it('should NOT include success statuses', () => {
      expect(FAILED_STATUSES.has('RCS_SENT')).toBe(false);
      expect(FAILED_STATUSES.has('RCS_DELIVERED')).toBe(false);
      expect(FAILED_STATUSES.has('RCS_READ')).toBe(false);
      expect(FAILED_STATUSES.has('SMS_SENT')).toBe(false);
      expect(FAILED_STATUSES.has('SMS_DELIVERED')).toBe(false);
    });
  });

  describe('translateStatus', () => {
    it('should translate uppercase SPARC status', () => {
      expect(translateStatus('MESSAGE_DELIVERED')).toBe('RCS_DELIVERED');
    });

    it('should be case-insensitive', () => {
      expect(translateStatus('message_delivered')).toBe('RCS_DELIVERED');
      expect(translateStatus('Send_Message_Success')).toBe('RCS_SENT');
    });

    it('should return UNKNOWN for unmapped status', () => {
      expect(translateStatus('SOME_RANDOM_STATUS')).toBe('UNKNOWN');
    });

    it('should handle empty/null gracefully', () => {
      expect(translateStatus('')).toBe('UNKNOWN');
      expect(translateStatus(null)).toBe('UNKNOWN');
    });
  });

  describe('isFailedStatus', () => {
    it('should return true for all failure statuses', () => {
      expect(isFailedStatus('RCS_DELIVERY_FAILED')).toBe(true);
      expect(isFailedStatus('RCS_SENT_FAILED')).toBe(true);
      expect(isFailedStatus('SMS_DELIVERY_FAILED')).toBe(true);
      expect(isFailedStatus('SMS_SENT_FAILED')).toBe(true);
    });

    it('should return false for success statuses', () => {
      expect(isFailedStatus('RCS_SENT')).toBe(false);
      expect(isFailedStatus('RCS_DELIVERED')).toBe(false);
      expect(isFailedStatus('SMS_SENT')).toBe(false);
    });
  });

  describe('mapDlrEvent', () => {
    const epochSecs = Math.floor(new Date('2026-03-28T15:21:39Z').getTime() / 1000);

    it('should map a wrapped successful DLR event (eventData wrapper)', () => {
      const sparcEvent = {
        eventData: {
          entity: {
            eventType: 'MESSAGE_DELIVERED',
            sendTime: '2026-03-28T15:21:39Z',
          },
        },
        seqId: 'cb_12345',
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses).toHaveLength(1);
      expect(result.statuses[0].status).toBe('RCS_DELIVERED');
      expect(result.statuses[0].callback_data).toBe('cb_12345');
      expect(result.statuses[0].timestamp).toBe(String(epochSecs));
      expect(result.statuses[0].error_message).toBeUndefined();
    });

    it('should map a flattened failure event payload (no eventData wrapper)', () => {
      const sparcEvent = {
        entity: {
          eventType: 'SEND_MESSAGE_FAILURE',
          sendTime: '2026-03-28T15:21:39Z',
          error: { message: 'User Not Found' },
        },
        seqId: 'cb_99',
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses[0].status).toBe('RCS_DELIVERY_FAILED');
      expect(result.statuses[0].callback_data).toBe('cb_99');
      expect(result.statuses[0].error_message).toBe('User Not Found');
      expect(result.statuses[0].timestamp).toBe(String(epochSecs));
    });

    it('should map MESSAGE_DELIVERY_FAILED correctly', () => {
      const sparcEvent = {
        eventData: {
          entity: { eventType: 'MESSAGE_DELIVERY_FAILED', error: { message: 'Timeout' } },
        },
        seqId: 'cb_timeout',
      };
      const result = mapDlrEvent(sparcEvent);
      expect(result.statuses[0].status).toBe('RCS_DELIVERY_FAILED');
      expect(result.statuses[0].error_message).toBe('Timeout');
    });

    it('should NOT include error_message for success statuses even if present in payload', () => {
      const sparcEvent = {
        eventData: {
          entity: { eventType: 'SEND_MESSAGE_SUCCESS', error: { message: 'ignored' } },
        },
        seqId: 'cb_100',
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses[0].status).toBe('RCS_SENT');
      expect(result.statuses[0].error_message).toBeUndefined();
    });

    it('should fallback to current time when sendTime is missing', () => {
      const before = Math.floor(Date.now() / 1000);
      const sparcEvent = {
        eventData: { entity: { eventType: 'MESSAGE_READ' } },
        seqId: 'cb_read',
      };
      const result = mapDlrEvent(sparcEvent);
      const after = Math.floor(Date.now() / 1000);
      const ts = parseInt(result.statuses[0].timestamp, 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('should handle seq_id at root level (flat format)', () => {
      const sparcEvent = {
        entity: { eventType: 'MESSAGE_DELIVERED' },
        seq_id: 'flat_cb',
      };
      const result = mapDlrEvent(sparcEvent);
      expect(result.statuses[0].callback_data).toBe('flat_cb');
      expect(result.statuses[0].status).toBe('RCS_DELIVERED');
    });
  });
});

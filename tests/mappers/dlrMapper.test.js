'use strict';

/**
 * tests/mappers/dlrMapper.test.js
 * Unit tests for SPARC → MoEngage DLR status mapping.
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
    it('should map all RCS sent variants to RCS_SENT', () => {
      expect(STATUS_MAP['sent']).toBe('RCS_SENT');
      expect(STATUS_MAP['rcs_sent']).toBe('RCS_SENT');
    });

    it('should map all delivered variants to RCS_DELIVERED', () => {
      expect(STATUS_MAP['delivered']).toBe('RCS_DELIVERED');
      expect(STATUS_MAP['rcs_delivered']).toBe('RCS_DELIVERED');
    });

    it('should map read variants to RCS_READ', () => {
      expect(STATUS_MAP['read']).toBe('RCS_READ');
      expect(STATUS_MAP['rcs_read']).toBe('RCS_READ');
    });

    it('should map all failure variants to RCS_DELIVERY_FAILED', () => {
      expect(STATUS_MAP['failed']).toBe('RCS_DELIVERY_FAILED');
      expect(STATUS_MAP['rcs_failed']).toBe('RCS_DELIVERY_FAILED');
      expect(STATUS_MAP['rcs_delivery_failed']).toBe('RCS_DELIVERY_FAILED');
      expect(STATUS_MAP['undelivered']).toBe('RCS_DELIVERY_FAILED');
    });

    it('should map SMS statuses correctly', () => {
      expect(STATUS_MAP['sms_sent']).toBe('SMS_SENT');
      expect(STATUS_MAP['sms_delivered']).toBe('SMS_DELIVERED');
      expect(STATUS_MAP['sms_failed']).toBe('SMS_DELIVERY_FAILED');
      expect(STATUS_MAP['sms_delivery_failed']).toBe('SMS_DELIVERY_FAILED');
    });
  });

  describe('FAILED_STATUSES', () => {
    it('should include RCS_DELIVERY_FAILED', () => {
      expect(FAILED_STATUSES.has('RCS_DELIVERY_FAILED')).toBe(true);
    });

    it('should include SMS_DELIVERY_FAILED', () => {
      expect(FAILED_STATUSES.has('SMS_DELIVERY_FAILED')).toBe(true);
    });

    it('should NOT include success statuses', () => {
      expect(FAILED_STATUSES.has('RCS_SENT')).toBe(false);
      expect(FAILED_STATUSES.has('RCS_DELIVERED')).toBe(false);
      expect(FAILED_STATUSES.has('SMS_SENT')).toBe(false);
    });
  });

  describe('translateStatus', () => {
    it('should translate lowercase SPARC status', () => {
      expect(translateStatus('delivered')).toBe('RCS_DELIVERED');
    });

    it('should be case-insensitive', () => {
      expect(translateStatus('DELIVERED')).toBe('RCS_DELIVERED');
    });

    it('should return UNKNOWN for unmapped status', () => {
      expect(translateStatus('some_random_status')).toBe('UNKNOWN');
    });

    it('should handle null/undefined', () => {
      expect(translateStatus(null)).toBe('UNKNOWN');
      expect(translateStatus(undefined)).toBe('UNKNOWN');
    });
  });

  describe('isFailedStatus', () => {
    it('should return true for failure statuses', () => {
      expect(isFailedStatus('RCS_DELIVERY_FAILED')).toBe(true);
      expect(isFailedStatus('SMS_DELIVERY_FAILED')).toBe(true);
    });

    it('should return false for success statuses', () => {
      expect(isFailedStatus('RCS_SENT')).toBe(false);
      expect(isFailedStatus('RCS_DELIVERED')).toBe(false);
    });
  });

  describe('mapDlrEvent', () => {
    it('should map a successful DLR event to MoEngage format', () => {
      const sparcEvent = {
        status: 'delivered',
        seq_id: 'cb_12345',
        timestamp: 1741234567,
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses).toHaveLength(1);
      expect(result.statuses[0].status).toBe('RCS_DELIVERED');
      expect(result.statuses[0].callback_data).toBe('cb_12345');
      expect(result.statuses[0].timestamp).toBe('1741234567');
      expect(result.statuses[0].error_message).toBeUndefined();
    });

    it('should include error_message only for FAILED statuses', () => {
      const sparcEvent = {
        status: 'failed',
        seq_id: 'cb_99',
        timestamp: 1741234567,
        error_message: 'User not RCS capable',
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses[0].status).toBe('RCS_DELIVERY_FAILED');
      expect(result.statuses[0].error_message).toBe('User not RCS capable');
    });

    it('should NOT include error_message for success statuses', () => {
      const sparcEvent = {
        status: 'delivered',
        seq_id: 'cb_100',
        error_message: 'should be ignored',
      };

      const result = mapDlrEvent(sparcEvent);

      expect(result.statuses[0].error_message).toBeUndefined();
    });
  });
});

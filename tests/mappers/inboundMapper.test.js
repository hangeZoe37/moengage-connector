'use strict';

/**
 * tests/mappers/inboundMapper.test.js
 * Unit tests for MoEngage → SPARC payload mapping.
 */

const {
  mapMessageToSparc,
  buildAddressProperties,
  mapInboundPayload,
  buildSparcVariables,
  buildSparcCardVariables
} = require('../../src/mappers/inboundMapper');

describe('inboundMapper', () => {
  const DLR_URL = 'https://connector.example.com/sparc/dlr';

  describe('buildSparcVariables', () => {
    it('should map TEXT parameters to SPARC variable format', () => {
      const parameters = { name: 'John', orderId: '123' };
      const result = buildSparcVariables(parameters);
      expect(result).toEqual([
        { name: '{{1}}', value: 'John' },
        { name: '{{2}}', value: '123' },
      ]);
    });
  });

  describe('buildAddressProperties', () => {
    it('should map MoEngage suggestions to SPARC format', () => {
      const content = {
        type: 'TEXT',
        data: { text: 'Hello' },
        suggestions: [
          { type: 'REPLY', text: 'Yes', postback_data: 'yes_clicked' },
          { type: 'DIAL_PHONE', text: 'Call Us', postback_data: 'call_clicked', phone: '12345' }
        ]
      };
      const result = buildAddressProperties(content);
      
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toEqual({
        reply: { text: 'Yes', postback_data: 'yes_clicked' }
      });
      expect(result.suggestions[1]).toEqual({
        dial_action: {
          dial_phone: { phoneNumber: '12345' },
          text: 'Call Us',
          postback_data: 'call_clicked'
        }
      });
    });

    it('should map SHOW_LOCATION suggestion correctly', () => {
      const content = {
        type: 'TEXT',
        data: { text: 'Loc' },
        suggestions: [
          { type: 'SHOW_LOCATION', text: 'HQ', postback_data: 'hq', latitude: '10.5', longitude: '20.5', label: 'Office' }
        ]
      };
      const result = buildAddressProperties(content);
      expect(result.suggestions[0].location_action.show_location).toEqual({
        latitude: 10.5,
        longitude: 20.5,
        label: 'Office'
      });
    });
  });

  describe('mapMessageToSparc', () => {
    it('should use template_id from rcs when available (MoEngage spec)', () => {
      const message = {
        destination: '919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT', data: {} },
        rcs: { bot_id: 'bot_1', template_id: 'official_tpl_id', template_name: 'ignored_name' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].template_name).toBe('official_tpl_id');
    });

    it('should fallback to template_name if template_id is missing', () => {
      const message = {
        destination: '919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT', data: {} },
        rcs: { bot_id: 'bot_1', template_name: 'legacy_name' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].template_name).toBe('legacy_name');
    });

    it('should strip + prefix from destination for SPARC', () => {
      const message = {
        destination: '+919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT', data: {} },
        rcs: { bot_id: 'bot_1' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].addresses[0].mobile_number).toBe('919876543210');
    });
  });

  describe('mapInboundPayload', () => {
    it('should map multiple messages (Bulk Support)', () => {
      const payload = {
        messages: [
          {
            destination: '919876543210',
            callback_data: 'cb_1',
            content: { type: 'TEXT', data: {} },
            rcs: { bot_id: 'bot_1' },
          },
          {
            destination: '919876543211',
            callback_data: 'cb_2',
            content: { type: 'TEXT', data: {} },
            rcs: { bot_id: 'bot_1' },
          },
        ],
      };

      const result = mapInboundPayload(payload, DLR_URL);

      expect(result).toHaveLength(2);
      expect(result[0].messages[0].addresses[0].seq_id).toBe('cb_1');
      expect(result[1].messages[0].addresses[0].seq_id).toBe('cb_2');
    });
  });
});

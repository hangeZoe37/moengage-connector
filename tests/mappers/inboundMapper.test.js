'use strict';

/**
 * tests/mappers/inboundMapper.test.js
 * Unit tests for MoEngage → SPARC payload mapping.
 */

const {
  mapMessageToSparc,
  buildVariables,
  mapInboundPayload,
} = require('../../src/mappers/inboundMapper');

describe('inboundMapper', () => {
  const DLR_URL = 'https://connector.example.com/sparc/dlr';

  describe('buildVariables', () => {
    it('should map TEXT parameters to SPARC variable format', () => {
      const content = {
        type: 'TEXT',
        parameters: { name: 'John', orderId: '123' },
      };
      const result = buildVariables(content);
      expect(result).toEqual([
        { name: 'name', value: 'John' },
        { name: 'orderId', value: '123' },
      ]);
    });

    it('should return empty array for TEXT with no parameters', () => {
      const content = { type: 'TEXT' };
      const result = buildVariables(content);
      expect(result).toEqual([]);
    });

    it('should map CARD content to SPARC variables', () => {
      const content = {
        type: 'CARD',
        title: 'Welcome',
        description: 'Card body text',
        orientation: 'HORIZONTAL',
        alignment: 'LEFT',
        media: { media_url: 'https://example.com/image.jpg' },
      };
      const result = buildVariables(content);
      expect(result.orientation).toBe('HORIZONTAL');
      expect(result.media_height_or_width).toBe('LEFT');
      expect(result.media_url).toBe('https://example.com/image.jpg');
      expect(result.card_title_variables).toEqual([{ name: '{{1}}', value: 'Welcome' }]);
      expect(result.card_variables).toEqual([{ name: '{{1}}', value: 'Card body text' }]);
    });

    it('should map MEDIA content as CARD with no title/description', () => {
      const content = {
        type: 'MEDIA',
        media_url: 'https://example.com/video.mp4',
      };
      const result = buildVariables(content);
      expect(result.orientation).toBe('HORIZONTAL');
      expect(result.media_url).toBe('https://example.com/video.mp4');
      expect(result.card_title_variables).toEqual([]);
      expect(result.card_variables).toEqual([]);
    });

    it('should map CAROUSEL content with cards', () => {
      const content = {
        type: 'CAROUSEL',
        orientation: 'VERTICAL',
        card_width: 'LARGE',
        cards: [
          {
            media_url: 'https://example.com/1.jpg',
            card_title_variables: [{ name: '{{1}}', value: 'Card 1' }],
            card_variables: [{ name: '{{1}}', value: 'Desc 1' }],
          },
        ],
      };
      const result = buildVariables(content);
      expect(result.orientation).toBe('VERTICAL');
      expect(result.card_width).toBe('LARGE');
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].media_url).toBe('https://example.com/1.jpg');
    });

    it('should throw for unsupported message type', () => {
      const content = { type: 'UNKNOWN' };
      expect(() => buildVariables(content)).toThrow('Unsupported message type');
    });
  });

  describe('mapMessageToSparc', () => {
    it('should set seq_id equal to callback_data (critical reconciliation key)', () => {
      const message = {
        destination: '+919876543210',
        callback_data: 'moe_cb_12345',
        content: { type: 'TEXT', parameters: { name: 'Test' } },
        rcs: { bot_id: 'bot_123', template_id: 'tpl_text' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].addresses[0].seq_id).toBe('moe_cb_12345');
    });

    it('should strip + prefix from destination for SPARC', () => {
      const message = {
        destination: '+919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT' },
        rcs: { bot_id: 'bot_1' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].addresses[0].mobile_number).toBe('919876543210');
    });

    it('should include DLR webhook URL', () => {
      const message = {
        destination: '919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT' },
        rcs: { bot_id: 'bot_1' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.dlr_url).toEqual([{ url: DLR_URL }]);
    });

    it('should use template_id from rcs when available', () => {
      const message = {
        destination: '919876543210',
        callback_data: 'cb_1',
        content: { type: 'TEXT' },
        rcs: { bot_id: 'bot_1', template_id: 'my_template' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].template_name).toBe('my_template');
    });

    it('should fallback to generated template name when no template_id', () => {
      const message = {
        destination: '919876543210',
        callback_data: 'cb_1',
        content: { type: 'CARD', media: { media_url: 'https://x.com/i.jpg' } },
        rcs: { bot_id: 'bot_1' },
      };

      const result = mapMessageToSparc(message, DLR_URL);

      expect(result.messages[0].template_name).toBe('moe_card');
    });
  });

  describe('mapInboundPayload', () => {
    it('should map multiple messages', () => {
      const payload = {
        messages: [
          {
            destination: '919876543210',
            callback_data: 'cb_1',
            content: { type: 'TEXT' },
            rcs: { bot_id: 'bot_1' },
          },
          {
            destination: '919876543211',
            callback_data: 'cb_2',
            content: { type: 'TEXT' },
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

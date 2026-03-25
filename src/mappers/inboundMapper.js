'use strict';

/**
 * src/mappers/inboundMapper.js
 * MoEngage payload → SPARC sendmessage payload.
 * PURE FUNCTION — no DB, no API calls, no side effects.
 *
 * Critical: seq_id MUST equal callback_data for DLR reconciliation.
 */

const { MESSAGE_TYPES } = require('../config/constants');

/**
 * Generate a unique message ID for SPARC.
 * @returns {string}
 */
function generateMessageId() {
  const randomId = Math.random().toString(36).substring(2, 10);
  return `moe_${Date.now()}_${randomId}`;
}

/**
 * Build SPARC variables based on message content type.
 * @param {object} content - MoEngage message content object
 * @returns {object|Array} Variables for SPARC payload
 */
function buildVariables(content) {
  switch (content.type) {
    case MESSAGE_TYPES.TEXT:
      return content.parameters
        ? Object.entries(content.parameters).map(([name, value]) => ({
            name,
            value: String(value),
          }))
        : [];

    case MESSAGE_TYPES.CARD:
      return {
        orientation: content.orientation || 'VERTICAL',
        media_height_or_width: content.alignment || content.height || 'MEDIUM',
        media_height: content.height || '',
        media_url: content.media ? content.media.media_url : '',
        card_title_variables: content.title
          ? [{ name: '{{1}}', value: content.title }]
          : [],
        card_variables: content.description
          ? [{ name: '{{1}}', value: content.description }]
          : [],
      };

    case MESSAGE_TYPES.MEDIA:
      // SPARC has no standalone MEDIA type — treat as CARD with no title/description
      // TODO: Confirm with SPARC if they have a native file message type
      return {
        orientation: 'HORIZONTAL',
        media_height_or_width: 'LEFT',
        media_height: '',
        media_url: content.media_url,
        card_title_variables: [],
        card_variables: [],
      };

    case MESSAGE_TYPES.CAROUSEL:
      return {
        orientation: content.orientation || 'VERTICAL',
        media_height_or_width: content.height || 'MEDIUM',
        card_width: content.card_width || 'MEDIUM',
        cards: (content.cards || []).map((card) => ({
          media_url: card.media_url || '',
          card_title_variables: card.card_title_variables || [],
          card_variables: card.card_variables || [],
        })),
      };

    default:
      throw new Error(`Unsupported message type: ${content.type}`);
  }
}

/**
 * Map a single MoEngage message item to a SPARC sendmessage payload.
 * @param {object} message - Single message from MoEngage messages array
 * @param {string} dlrWebhookUrl - SPARC DLR webhook URL
 * @returns {object} SPARC-formatted payload
 */
function mapMessageToSparc(message, dlrWebhookUrl) {
  const { destination, callback_data, content, rcs } = message;

  return {
    messages: [
      {
        message_id: generateMessageId(),
        template_name: rcs.template_id || `moe_${content.type.toLowerCase()}`,
        ttl: 300,
        addresses: [
          {
            assistant_id: rcs.bot_id,
            mobile_number: destination.replace('+', ''), // SPARC: no + prefix
            seq_id: callback_data, // ← THE RECONCILIATION KEY — never change this
            variables: buildVariables(content),
          },
        ],
      },
    ],
    dlr_url: [{ url: dlrWebhookUrl }],
  };
}

/**
 * Map the full MoEngage inbound payload to an array of SPARC payloads.
 * @param {object} moEngagePayload - Full MoEngage request body
 * @param {string} dlrWebhookUrl - SPARC DLR webhook URL
 * @returns {Array<object>} Array of SPARC-formatted payloads
 */
function mapInboundPayload(moEngagePayload, dlrWebhookUrl) {
  return moEngagePayload.messages.map((message) =>
    mapMessageToSparc(message, dlrWebhookUrl)
  );
}

module.exports = {
  mapMessageToSparc,
  mapInboundPayload,
  buildVariables,
  generateMessageId,
};

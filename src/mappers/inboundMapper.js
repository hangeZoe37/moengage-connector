'use strict';

/**
 * src/mappers/inboundMapper.js
 * MoEngage payload -> SPARC RCS sendmessage payload.
 * PURE FUNCTION — no DB, no API calls, no side effects.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MoEngage -> SPARC Mapping Summary
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * COMMON FIELDS (all types)
 * ┌───────────────────────────────────┬──────────────────────────────────────┐
 * │ MoEngage field                    │ SPARC field                          │
 * ├───────────────────────────────────┼──────────────────────────────────────┤
 * │ message.destination               │ addresses[].mobile_number (+stripped)│
 * │ message.callback_data             │ addresses[].seq_id  ← reconcile key  │
 * │ message.rcs.bot_id                │ addresses[].assistant_id             │
 * │ message.rcs.template_id           │ messages[].template_name             │
 * └───────────────────────────────────┴──────────────────────────────────────┘
 *
 * TEXT  (content.type = "TEXT")
 * ┌───────────────────────────────────┬──────────────────────────────────────┐
 * │ content.data.text                 │ NOT MAPPED if it's template based    │
 * │ content.data.parameters           │ variables[0] { name:"{{1}}", value } │
 * │ content.suggestions[]             │ suggestions[] (mapped to SPARC)      │
 * └───────────────────────────────────┴──────────────────────────────────────┘
 *
 * CARD  (content.type = "CARD")
 * ┌───────────────────────────────────┬──────────────────────────────────────┐
 * │ content.data.title                │ card_title_variables[0]              │
 * │ content.data.description          │ card_variables[0]                    │
 * │ content.data.orientation          │ IGNORED BY SPARC (uses templates)    │
 * │ content.data.alignment/height     │ IGNORED BY SPARC (uses templates)    │
 * │ content.data.media.media_url      │ UNKNOWN IN SPARC DOCS. Assuming      │
 * │                                   │ template handles media.              │
 * │ content.suggestions[]             │ UNKNOWN IN SPARC DOCS for CARD.      │
 * └───────────────────────────────────┴──────────────────────────────────────┘
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
 * Build SPARC variables array (used by Plain Text and Rich Text).
 * SPARC formats variables as: [ { name: "{{1}}", value: "val" }, ... ]
 * 
 * @param {object} parameters - MoEngage content.data.parameters object
 * @returns {Array} SPARC variables array
 */
function buildSparcVariables(parameters) {
  if (!parameters || typeof parameters !== 'object') {
    return [];
  }
  
  // SPARC examples use {{1}}, {{2}} based mapping. 
  // We assume MoEngage passes them in order via Object.values()
  return Object.values(parameters).map((value, index) => ({
    name: `{{${index + 1}}}`,
    value: String(value)
  }));
}

/**
 * Build SPARC variables object (used by Rich Card).
 * SPARC formats card variables as: 
 * { 
 *   card_title_variables: [ { name: "{{1}}", value: "title" } ],
 *   card_variables: [ { name: "{{1}}", value: "desc1" }, { name: "{{2}}", value: "desc2" } ]
 * }
 * 
 * @param {object} contentData - MoEngage content.data object for CARD
 * @returns {object} SPARC card variables object
 */
function buildSparcCardVariables(contentData) {
  const variables = {};

  if (contentData.title) {
    variables.card_title_variables = [
      { name: '{{1}}', value: contentData.title }
    ];
  } else {
    variables.card_title_variables = [];
  }

  const cardVars = [];
  // Add description as the first card variable if it exists
  if (contentData.description) {
    cardVars.push({ name: '{{1}}', value: contentData.description });
  }
  
  // If parameters exist, append them as card_variables
  if (contentData.parameters && typeof contentData.parameters === 'object') {
    const startIdx = contentData.description ? 2 : 1;
    Object.values(contentData.parameters).forEach((val, idx) => {
      cardVars.push({ name: `{{${startIdx + idx}}}`, value: String(val) });
    });
  }
  
  variables.card_variables = cardVars;
  
  return variables;
}

/**
 * Map MoEngage suggestions to SPARC RCS suggestion format.
 *
 * @param {Array} suggestions - MoEngage suggestions array
 * @returns {Array} SPARC-formatted suggestions
 */
function mapSuggestions(suggestions) {
  if (!suggestions || !Array.isArray(suggestions)) return [];

  return suggestions.map((s) => {
    switch (s.type) {
      case 'REPLY':
        return {
          reply: {
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'OPEN_URL':
        return {
          url_action: {
            open_url: { url: s.url },
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'DIAL_PHONE':
        return {
          dial_action: {
            dial_phone: { phoneNumber: s.phone },
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'SHOW_LOCATION':
        return {
          location_action: {
            show_location: {
              latitude: Number(s.latitude),
              longitude: Number(s.longitude),
              label: s.label,
            },
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'QUERY_LOCATION':
        return {
          location_action: {
            query_location: {
              query: s.query,
            },
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'REQUEST_LOCATION':
        return {
          location_action: {
            request_location: {},
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      case 'CREATE_CAL_EVENT':
        return {
          calendar_action: {
            create_calendar_event: {
              startTime: s.start_time,
              endTime: s.end_time,
              title: s.title,
              description: s.description,
            },
            text: s.text,
            postback_data: s.postback_data,
          },
        };

      default:
        // Fallback to simple reply if type is unknown but text exists
        return {
          reply: {
            text: s.text || 'Action',
            postback_data: s.postback_data || 'unknown',
          },
        };
    }
  });
}

/**
 * Build SPARC properties based on message content type.
 * Returns the `variables` property for the address block.
 *
 * @param {object} content - MoEngage message content object
 * @returns {object} { variables: Array|Object }
 */
function buildAddressProperties(content) {
  // Defensive check for missing data
  const data = content.data || {};
  const baseProperties = {};
  
  // MoEngage can send suggestions at the content level
  if (content.suggestions) {
    baseProperties.suggestions = mapSuggestions(content.suggestions);
  }

  switch (content.type) {
    case MESSAGE_TYPES.TEXT:
      // TEXT type uses array of variables
      const textVars = buildSparcVariables(data.parameters);
      return { 
        ...baseProperties,
        ...(textVars.length > 0 ? { variables: textVars } : {})
      };
      
    case MESSAGE_TYPES.CARD:
      // CARD type uses an object containing array of card_title_variables & card_variables
      return { 
        ...baseProperties,
        variables: buildSparcCardVariables(data) 
      };

    case MESSAGE_TYPES.MEDIA:
      // SPARC examples DO NOT explicitly show Media JSON payload.
      // Treating MEDIA like CARD with empty title/desc as fallback.
      return { 
        ...baseProperties,
        variables: buildSparcCardVariables(data) 
      };

    default:
      // For any unknown types, return base properties (suggestions)
      return baseProperties;
  }
}

/**
 * Build the full SPARC addresses block for a single message.
 * Includes variables at the address level.
 *
 * @param {object} message - Single MoEngage message
 * @returns {object} Single SPARC address entry
 */
function buildAddress(message) {
  const { destination, callback_data, content, rcs } = message;

  const address = {
    seq_id: callback_data, // The reconciliation key
    assistant_id: rcs.bot_id,
    mobile_number: destination.replace('+', ''), // SPARC typically requires no '+'
    ...buildAddressProperties(content)
  };

  return address;
}

/**
 * Map a single MoEngage message item to a SPARC sendmessage payload.
 * @param {object} message - Single message from MoEngage messages array
 * @param {string} dlrWebhookUrl - SPARC DLR webhook URL
 * @returns {object} SPARC-formatted payload
 */
function mapMessageToSparc(message, dlrWebhookUrl) {
  const { content, rcs } = message;

  return {
    messages: [
      {
        message_id: generateMessageId(),
        template_name: rcs.template_id || rcs.template_name || `moe_${content.type.toLowerCase()}`,
        ttl: "300s", // Updated to match SPARC example "300s" instead of int 300
        addresses: [buildAddress(message)],
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
  buildAddressProperties,
  buildSparcVariables,
  buildSparcCardVariables,
  generateMessageId,
};

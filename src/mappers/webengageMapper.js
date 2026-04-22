'use strict';

/**
 * src/mappers/webengageMapper.js
 * WebEngage payload -> SPARC RCS payload.
 * SPARC DLR -> WebEngage DSN payload.
 */

const { MESSAGE_TYPES } = require('../config/constants');

/**
 * Generate a unique message ID for SPARC submission level.
 */
function generateSubmissionId() {
  const randomId = Math.random().toString(36).substring(2, 10);
  return `we_${Date.now()}_${randomId}`;
}

/**
 * Map WebEngage buttons to SPARC RCS suggestion format.
 */
function mapButtons(buttons) {
  if (!buttons || !Array.isArray(buttons)) return [];

  return buttons.map((b) => {
    const type = (b.type || '').toUpperCase();
    const postback = b.postback_data || b.text || 'unknown';

    if (type === 'OPEN_URL') {
      return {
        action: {
          plainText: b.text || 'Open Link',
          postBack: { data: postback },
          openUrl: { url: b.url }
        }
      };
    } else if (type === 'CALL_PHONE_NUMBER') {
      return {
        action: {
          plainText: b.text || 'Call',
          postBack: { data: postback },
          dialerAction: { phoneNumber: b.phone_number }
        }
      };
    } else {
      // SUGGESTED_REPLY
      return {
        reply: {
          plainText: b.text || 'Reply',
          postBack: { data: postback }
        }
      };
    }
  });
}

/**
 * Map WebEngage templateDetails to SPARC content format.
 */
function mapContent(type, details) {
  if (type === 'TEXT') {
    return {
      plainText: details.text || '',
      ...(details.buttonDetails?.buttons && { suggestions: mapButtons(details.buttonDetails.buttons) })
    };
  }

  if (type === 'RICH_CARD') {
    const content = {
      cardTitle: details.title || ' ',
      cardDescription: details.text || ' ',
    };

    if (details.mediaUrl) {
      content.cardMedia = {
        mediaHeight: (details.mediaHeight || 'MEDIUM').toUpperCase(),
        contentInfo: {
          fileUrl: details.mediaUrl,
          contentType: (details.mediaType || 'IMAGE').toUpperCase()
        }
      };
    }

    if (details.buttonDetails?.buttons) {
      content.suggestions = mapButtons(details.buttonDetails.buttons);
    }

    return {
      richCardDetails: {
        standalone: {
          cardOrientation: (details.orientation || 'VERTICAL').toUpperCase(),
          content: content
        }
      }
    };
  }

  if (type === 'RICH_CAROUSEL') {
    const cards = details.cards || [];
    return {
      richCardDetails: {
        carousel: {
          cardWidth: (details.cardWidth || 'MEDIUM').toUpperCase() === 'SMALL' ? 'SMALL_WIDTH' : 'MEDIUM_WIDTH',
          contents: cards.map(c => ({
            cardTitle: c.title || ' ',
            cardDescription: c.text || ' ',
            ...(c.mediaUrl && {
              cardMedia: {
                mediaHeight: (details.mediaHeight || 'SHORT').toUpperCase(),
                contentInfo: { fileUrl: c.mediaUrl, contentType: (c.mediaType || 'IMAGE').toUpperCase() }
              }
            }),
            ...(c.buttonDetails?.buttons && { suggestions: mapButtons(c.buttonDetails.buttons) })
          }))
        }
      }
    };
  }

  return {};
}

/**
 * Map WebEngage Template variables to SPARC variables array.
 */
function mapTemplateVariables(parameters) {
  if (!parameters || typeof parameters !== 'object') return [];
  // WebEngage passes parameters as a map: { "key1": "val1" }
  // We map them to {{1}}, {{2}} based on order if they are simple, 
  // but if they name them specifically, we might need different logic.
  // Standard mindset: map map entries to {{name}}
  return Object.entries(parameters).map(([key, value]) => ({
    name: `{{${key}}}`,
    value: String(value)
  }));
}

/**
 * Main WebEngage Inbound Mapper: WebEngage -> SPARC
 */
function mapInbound(webEngagePayload, dlrWebhookUrl) {
  const { rcsData, metadata } = webEngagePayload;
  const { toNumber, sender, templateData } = rcsData;
  const { messageId } = metadata;

  const sparcAddress = {
    seq_id: messageId, // Crucial for reconciliation
    assistant_id: sender,
    mobile_number: toNumber.replace('+', ''),
  };

  // Ensure 91 prefix for 10-digit numbers
  if (sparcAddress.mobile_number.length === 10) {
    sparcAddress.mobile_number = '91' + sparcAddress.mobile_number;
  }

  const sparcMessage = {
    message_id: generateSubmissionId(),
    ttl: "3600s",
    addresses: [sparcAddress],
  };

  const type = (templateData.type || 'TEXT').toUpperCase();

  if (templateData.templateName && templateData.templateName !== 'null') {
    sparcMessage.template_name = templateData.templateName;
    sparcAddress.variables = mapTemplateVariables(templateData.parameters);
  } else {
    sparcMessage.content = mapContent(type, templateData.templateDetails || {});
  }

  return {
    messages: [sparcMessage],
    dlr_url: [{ url: dlrWebhookUrl }],
  };
}

/**
 * Map internal status to WebEngage status tokens.
 */
function mapToWebEngageStatus(internalStatus) {
  const map = {
    'RCS_DELIVERED': 'rcs_delivered',
    'SMS_DELIVERED': 'rcs_delivered', 
    'RCS_SENT':      'rcs_delivered',      
    'SMS_SENT':      'rcs_delivered',
    'RCS_SENT_FAILED': 'rcs_failed',
    'RCS_DELIVERY_FAILED': 'rcs_failed',
    'SMS_DELIVERY_FAILED': 'rcs_failed',
    'RCS_READ':      'rcs_read',    
    'RCS_CLICKED':   'rcs_clicked',
    'RCS_REPLIED':   'rcs_replied'
  };
  return map[internalStatus] || 'rcs_failed';
}

/**
 * Map SPARC DLR Metadata to WebEngage DSN Payload
 */
function mapDlrToWebEngage(messageId, status, message, description = 'Success') {
  // Strip internal prefix if present
  const externalId = messageId.replace(/^web_/, '');

  return {
    version: '1.0',
    messageId: externalId,
    toNumber: message.destination,
    sender: message.bot_id,
    status: mapToWebEngageStatus(status),
    statusCode: status.includes('FAILED') ? 1000 : 0,
    reason: description,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+0000') 
  };
}

/**
 * Map SPARC Interaction metadata to WebEngage DSN Payload
 */
function mapInteractionToWebEngage(messageId, sparcEvent, message) {
  const isClick = !!(sparcEvent.url || sparcEvent.open_url);
  const interactionType = (sparcEvent.interactionType || '').toUpperCase();
  
  let status = 'RCS_REPLIED';
  if (interactionType === 'VIEW') {
    status = 'RCS_READ';
  } else if (isClick || interactionType === 'OPEN_URL') {
    status = 'RCS_CLICKED';
  }
  
  const externalId = messageId.replace(/^web_/, '');

  return {
    version: '1.0',
    messageId: externalId,
    toNumber: message.destination,
    sender: message.bot_id,
    status: mapToWebEngageStatus(status),
    statusCode: 0,
    reason: 'Success',
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+0000')
  };
}

module.exports = {
  mapInbound,
  mapDlrToWebEngage,
  mapInteractionToWebEngage,
  generateSubmissionId
};

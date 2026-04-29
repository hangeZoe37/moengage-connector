'use strict';

/**
 * Maps WebEngage RSP payloads to SPARC V2 RCS format.
 */
function mapToSparc(payload, dlrWebhookUrl) {
  const { rcsData, metadata } = payload;
  const { templateData, toNumber, sender } = rcsData;
  
  const sparcAddress = {
    seq_id: metadata.messageId, 
    assistant_id: sender,
    mobile_number: toNumber.replace('+', ''),
  };

  // 91 prefix for 10-digit numbers
  if (sparcAddress.mobile_number.length === 10) {
    sparcAddress.mobile_number = '91' + sparcAddress.mobile_number;
  }

  const sparcMessage = {
    message_id: `we_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
 * Map Template variables to SPARC variables array.
 */
function mapTemplateVariables(parameters) {
  if (!parameters || typeof parameters !== 'object') return [];
  return Object.entries(parameters).map(([key, value]) => ({
    name: `{{${key}}}`,
    value: String(value)
  }));
}

/**
 * Map templateDetails to SPARC content format.
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
  }).filter(Boolean);
}

/**
 * Map internal status to WebEngage status tokens.
 */
function mapToWebEngageStatus(internalStatus) {
  const map = {
    'RCS_DELIVERED': 'rcs_delivered',
    'RCS_SENT':      'rcs_delivered',      
    'RCS_SENT_FAILED': 'rcs_failed',
    'RCS_DELIVERY_FAILED': 'rcs_failed',
    'RCS_READ':      'rcs_read',    
    'RCS_CLICKED':   'rcs_clicked',
    'RCS_REPLIED':   'rcs_replied'
  };
  return map[internalStatus] || 'rcs_failed';
}

/**
 * Maps SPARC DLR to WebEngage DSN format (Version 1.0).
 */
function mapToWebEngage(callbackData, sparcStatus, message, error = null) {
  const cleanId = callbackData ? String(callbackData).replace(/^web_/, '') : callbackData;
  const weStatus = mapToWebEngageStatus(sparcStatus);

  return {
    version: '1.0',
    messageId: cleanId,
    toNumber: message ? `+${message.destination}` : null,
    sender: message ? message.bot_id : null,
    status: weStatus,
    statusCode: weStatus === 'rcs_failed' ? 1000 : 0,
    reason: error || (weStatus === 'rcs_failed' ? 'Failed' : 'Success'),
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+0000')
  };
}

/**
 * Maps SPARC Interaction to WebEngage Interaction format (Version 1.0).
 */
function mapInteractionToWebEngage(callbackData, sparcEvent, message) {
  const cleanId = callbackData ? String(callbackData).replace(/^web_/, '') : callbackData;
  const interactionType = (sparcEvent.interactionType || '').toUpperCase();
  
  let status = 'rcs_replied';
  if (interactionType === 'VIEW') {
    status = 'rcs_read';
  } else if (interactionType === 'OPEN_URL' || sparcEvent.url) {
    status = 'rcs_clicked';
  }

  return {
    version: '1.0',
    messageId: cleanId,
    toNumber: message ? `+${message.destination}` : null,
    sender: message ? message.bot_id : null,
    status: status,
    statusCode: 0,
    reason: 'Success',
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+0000')
  };
}

module.exports = {
  mapToSparc,
  mapToWebEngage,
  mapInteractionToWebEngage
};

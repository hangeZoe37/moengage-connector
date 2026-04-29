'use strict';

/**
 * src/mappers/clevertapMapper.js
 * CleverTap payload -> SPARC RCS payload.
 */

/**
 * Generate a unique message ID for SPARC (submission level).
 */
function generateMessageId() {
  const randomId = Math.random().toString(36).substring(2, 10);
  return `ct_${Date.now()}_${randomId}`;
}

/**
 * Map CleverTap suggestions to SPARC RCS suggestion format.
 */
function mapSuggestions(suggestions) {
  if (!suggestions || !Array.isArray(suggestions)) return [];

  return suggestions.map((s) => {
    const postback = s.postbackData || s.postback || s.url || s.phone || s.text || 'unknown';
    const type = (s.type || (s.url ? 'OPEN_URL' : s.phone ? 'DIAL_PHONE' : 'REPLY')).toUpperCase();

    if (type === 'OPEN_URL' || s.url) {
      return {
        url_action: {
          open_url: { url: s.url },
          text: s.text || 'Open Link',
          postback_data: postback,
        },
      };
    } else if (type === 'DIAL_PHONE' || s.phone) {
      return {
        dial_action: {
          dial_phone: { phoneNumber: s.phone },
          text: s.text || 'Call',
          postback_data: postback,
        },
      };
    } else {
      return {
        reply: {
          text: s.text || 'Reply',
          postback_data: postback,
        },
      };
    }
  });
}

/**
 * Map CleverTap Rich Card content to SPARC standalone rich card.
 */
function mapCard(card) {
  const content = {
    cardTitle: card.title || ' ',
    cardDescription: card.description || card.text || ' ',
  };

  const media = card.media || {};
  const fileUrl = media.mediaUrl || card.mediaUrl;

  if (fileUrl) {
    content.cardMedia = {
      mediaHeight: media.height || 'MEDIUM',
      contentInfo: {
        fileUrl: fileUrl,
        thumbnailUrl: media.thumbnailUrl || null,
      }
    };
    if (media.type) {
      content.cardMedia.contentInfo.contentType = media.type.toUpperCase();
    }
  }

  const suggestions = mapSuggestions(card.suggestions);
  if (suggestions.length > 0) {
    content.suggestions = suggestions.map(s => {
      if (s.url_action) {
        return { action: { plainText: s.url_action.text, postBack: { data: s.url_action.postback_data }, openUrl: { url: s.url_action.open_url.url } } };
      }
      if (s.dial_action) {
        return { action: { plainText: s.dial_action.text, postBack: { data: s.dial_action.postback_data }, dialerAction: { phoneNumber: s.dial_action.dial_phone.phoneNumber } } };
      }
      return { reply: { plainText: s.reply.text, postBack: { data: s.reply.postback_data } } };
    });
  }

  return {
    richCardDetails: {
      standalone: {
        cardOrientation: 'VERTICAL',
        content: content
      }
    }
  };
}

/**
 * Map CleverTap Template parameters.
 */
function mapTemplateVariables(parameters) {
  if (!parameters || !Array.isArray(parameters)) return [];
  return parameters.map((val, idx) => ({
    name: `{{${idx + 1}}}`,
    value: String(val)
  }));
}

/**
 * Main Inbound Mapper: CleverTap -> SPARC
 */
function mapInbound(cleverTapPayload, dlrWebhookUrl, client) {
  const { msgId, to, rcsContent } = cleverTapPayload;
  const { content, senderId } = rcsContent;

  const sparcAddress = {
    seq_id: msgId, 
    assistant_id: client.rcs_assistant_id, // Force from DB
    assistantid: client.rcs_assistant_id,  // Alternative naming
    mobile_number: to.replace('+', '').replace(/^91/, ''),
  };

  if (sparcAddress.mobile_number.length === 10) {
    sparcAddress.mobile_number = '91' + sparcAddress.mobile_number;
  }

  const sparcMessage = {
    message_id: generateMessageId(),
    ttl: "3600s",
    addresses: [sparcAddress],
  };

  const type = (content.type || '').toUpperCase();

  if (type === 'TEXT') {
    sparcMessage.content = { plainText: content.text || '' };
    const suggestions = mapSuggestions(content.suggestions);
    if (suggestions.length > 0) {
      sparcMessage.content.suggestions = suggestions.map(s => {
        if (s.url_action) return { action: { plainText: s.url_action.text, postBack: { data: s.url_action.postback_data }, openUrl: { url: s.url_action.open_url.url } } };
        return { reply: { plainText: s.reply.text, postBack: { data: s.reply.postback_data } } };
      });
    }
  } else if (type === 'CARD') {
    sparcMessage.content = mapCard(content);
  } else if (type === 'CAROUSEL') {
    const cards = content.cardContents || content.cards || [];
    let cardWidth = content.cardWidth || 'MEDIUM_WIDTH';
    if (cardWidth === 'MEDIUM') cardWidth = 'MEDIUM_WIDTH';
    if (cardWidth === 'SMALL') cardWidth = 'SMALL_WIDTH';

    sparcMessage.content = {
      richCardDetails: {
        carousel: {
          cardWidth: cardWidth,
          contents: cards.map(c => mapCard(c).richCardDetails.standalone.content)
        }
      }
    };
    const topSuggestions = mapSuggestions(content.suggestions);
    if (topSuggestions.length > 0) {
      sparcMessage.content.suggestions = topSuggestions.map(s => {
        if (s.url_action) return { action: { plainText: s.url_action.text, postBack: { data: s.url_action.postback_data }, openUrl: { url: s.url_action.open_url.url } } };
        return { reply: { plainText: s.reply.text, postBack: { data: s.reply.postback_data } } };
      });
    }
  } else if (type === 'TEMPLATE') {
    sparcMessage.template_name = content.templateId;
    sparcAddress.variables = mapTemplateVariables(content.parameters);
  }

  return {
    messages: [sparcMessage],
    dlr_url: [{ url: dlrWebhookUrl }],
  };
}

/**
 * Map SPARC DLR to CleverTap format.
 */
function mapDlrToCleverTap(msgId, status, errorDetails = null) {
  let ctEvent = 'failed';
  if (status.includes('DELIVERED')) ctEvent = 'delivered';
  if (status === 'RCS_READ') ctEvent = 'viewed';
  
  // Non-final/intermediate statuses
  if (['RCS_SENT', 'SMS_SENT', 'QUEUED'].includes(status)) return null; 

  const channel = status.startsWith('SMS_') ? "SMS" : "RCS";
  const item = {
    channel,
    meta: msgId ? String(msgId).replace(/^cl_/, '') : msgId
  };

  if (ctEvent === 'failed') {
    item.ts = Math.floor(Date.now() / 1000);
    const errCode = String(errorDetails?.code || '');
    if (errCode.includes('2002')) item.code = 2002;
    else if (errCode.includes('2004')) item.code = 2004;
    else if (errCode.includes('901')) item.code = 901;
    else item.code = 904;
  }

  return [{ event: ctEvent, data: [item] }];
}

/**
 * Map SPARC Interaction to CleverTap format.
 */
function mapInteractionToCleverTap(msgId, sparcEvent, message) {
  const isClick = !!(sparcEvent.url || sparcEvent.open_url);
  const interactionType = (sparcEvent.interactionType || '').toUpperCase();
  
  let event = 'replied';
  if (interactionType === 'VIEW') {
    event = 'read';
  } else if (isClick || interactionType === 'OPEN_URL') {
    event = 'clicked';
  }

  const channel = (message.status || '').startsWith('SMS_') ? "SMS" : "RCS";
  const item = {
    channel,
    meta: msgId ? String(msgId).replace(/^cl_/, '') : msgId
  };

  if (event === 'clicked') {
    item.ts = Math.floor(Date.now() / 1000);
    item.url = sparcEvent.url || sparcEvent.open_url || '';
    item.userAgent = sparcEvent.userAgent || 'SPARC-RCS-Agent';
    item.shortUrl = sparcEvent.shortUrl || item.url;
  } else {
    item.type = "text";
    item.fromPhone = message.destination || '';
    item.toPhone = sparcEvent.toPhone || ''; 
    item.incomingText = sparcEvent.suggestion_text || sparcEvent.text || '';
    const postback = sparcEvent.postback_data || sparcEvent.postback;
    if (postback) item.postback = postback;
  }

  return [{ event, data: [item] }];
}

module.exports = {
  mapInbound,
  mapDlrToCleverTap,
  mapInteractionToWebEngage: mapInteractionToCleverTap, // Keeping compatibility if needed
  mapInteractionToCleverTap
};

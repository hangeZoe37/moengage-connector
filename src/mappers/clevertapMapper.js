'use strict';

/**
 * src/mappers/clevertapMapper.js
 * CleverTap payload -> SPARC RCS payload & SMS Fallback payload.
 */

const { MESSAGE_TYPES } = require('../config/constants');

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
    // CleverTap format support: s.type, s.postbackData, s.text
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
    cardDescription: card.description || card.text || ' ', // Space fallback instead of empty string
  };

  const media = card.media || {};
  const fileUrl = media.mediaUrl || card.mediaUrl;

  if (fileUrl) {
    content.cardMedia = {
      mediaHeight: media.height || 'MEDIUM',
      contentInfo: {
        fileUrl: fileUrl,
        thumbnailUrl: media.thumbnailUrl || null,
        // forceRefresh removed as it's not in the official sample
      }
    };
    // Include type if provided (IMAGE/VIDEO)
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
 * Map CleverTap Template to SPARC template variables.
 */
/**
 * Map CleverTap Template to SPARC template variables.
 * parameters: ["John", "20%"] -> {{1}}: John, {{2}}: 20%
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
function mapInbound(cleverTapPayload, dlrWebhookUrl) {
  const { msgId, to, rcsContent } = cleverTapPayload;
  const { content, senderId } = rcsContent;

  const sparcAddress = {
    seq_id: msgId, 
    assistant_id: senderId,
    mobile_number: to.replace('+', '').replace(/^91/, ''), // Ensure 10-digit if requested, or keep 91
  };

  // Re-add 91 if it was stripped and we need it, but SPARC usually handles it.
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
    sparcMessage.content = {
      plainText: content.text || '',
    };
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
    // CleverTap Uses cardContents, SPARC uses contents
    const cards = content.cardContents || content.cards || [];
    
    // SPARC Official specifies "MEDIUM_WIDTH" in the carousel object
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
    // Support top-level suggestions for carousels
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
 * Map SPARC DLR Metadata to CleverTap Callback Payload
 */
/**
 * Map SPARC DLR Metadata to CleverTap Callback Payload
 */
function mapDlrToCleverTap(msgId, status, errorDetails = null) {
  let ctEvent = 'failed';
  if (status === 'RCS_DELIVERED' || status === 'SMS_DELIVERED') ctEvent = 'delivered';
  if (status === 'RCS_READ') ctEvent = 'viewed';
  
  // We only notify on final states or delivery
  if (status === 'RCS_SENT' || status === 'SMS_SENT' || status === 'QUEUED') return null; 

  const channel = (status || '').startsWith('SMS_') ? "SMS" : "RCS";

  const item = {
    channel,
    meta: msgId ? String(msgId).replace(/^cl_/, '') : msgId
  };


  if (ctEvent === 'failed') {
    item.ts = Math.floor(Date.now() / 1000);
    // Typical CleverTap codes: 2002 (Invalid), 2004 (Disabled), 901 (DND), 904 (General)
    const errCode = String(errorDetails?.code || '');
    if (errCode.includes('2002')) item.code = 2002;
    else if (errCode.includes('2004')) item.code = 2004;
    else if (errCode.includes('901')) item.code = 901;
    else item.code = 904;
  }

  return [{
    event: ctEvent,
    data: [item]
  }];
}

/**
 * Map SPARC Interaction metadata to CleverTap Callback Payload
 */
function mapInteractionToCleverTap(msgId, sparcEvent, message) {
  const isClick = !!(sparcEvent.url || sparcEvent.open_url);
  
  let event = 'replied';
  if (isClick) event = 'clicked';

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
    if (postback) {
      item.postback = postback;
    }
  }

  return [{
    event,
    data: [item]
  }];
}

module.exports = {
  mapInbound,
  mapDlrToCleverTap,
  mapInteractionToCleverTap,
};

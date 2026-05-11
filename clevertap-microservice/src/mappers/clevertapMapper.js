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

  // Use senderId from request payload — if wrong, SPARC will reject and trigger SMS fallback
  // Only fall back to DB value if senderId is completely absent
  const resolvedAssistantId = senderId || client.rcs_assistant_id;

  const sparcAddress = {
    seq_id: msgId, 
    assistant_id: resolvedAssistantId,
    assistantid: resolvedAssistantId,
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

const { mapCleverTapCallbackError } = require('../utils/clevertapErrorMapper');

/**
 * Map SPARC DLR to CleverTap format.
 */
function mapDlrToCleverTap(msgId, status, errorDetails = null) {
  let ctEvent = 'failed';
  if (status.includes('DELIVERED')) ctEvent = 'delivered';
  if (status === 'RCS_READ') ctEvent = 'viewed';
  
  // Non-final/intermediate statuses — skip
  if (['RCS_SENT', 'SMS_SENT', 'QUEUED'].includes(status)) return null;

  // Determine channel from status string
  const channel = status.startsWith('SMS_') ? 'SMS' : 'RCS';

  const cleanId = msgId ? String(msgId).replace(/^cl_/, '') : msgId;
  const item = {
    ts: Math.floor(Date.now() / 1000),
    channel,
    meta: cleanId,
  };

  if (ctEvent === 'failed') {
    const sparcError = errorDetails?.message || errorDetails || status;
    item.code = mapCleverTapCallbackError(sparcError);
  }

  return [{ event: ctEvent, data: [item] }];
}

/**
 * Map SPARC Interaction to CleverTap format.
 */
function mapInteractionToCleverTap(msgId, sparcEvent, message) {
  // Check all possible SPARC field names for interaction type
  const interactionType = (
    sparcEvent.interactionType || 
    sparcEvent.suggestion_type || 
    sparcEvent.type || 
    ''
  ).toUpperCase();

  // Check all possible SPARC field names for URL (indicates a click)
  const urlValue = sparcEvent.url || sparcEvent.open_url || 
                   sparcEvent.openUrl?.url || sparcEvent.url_action?.open_url?.url;

  const postback = (sparcEvent.postback_data || sparcEvent.postback || '').toUpperCase();
  const incomingText = (sparcEvent.suggestion_text || sparcEvent.text || sparcEvent.incomingText || '').toUpperCase();

  const isClick = !!(urlValue) || 
                  interactionType === 'OPEN_URL' || 
                  interactionType === 'URL_ACTION' ||
                  postback.includes('URL') || postback.includes('CLICK') ||
                  incomingText.includes('(URL)') || incomingText.includes('CLICKED');

  const isView = interactionType === 'VIEW' || interactionType === 'READ';

  let event = 'replied'; // default
  if (isView) {
    event = 'read';
  } else if (isClick) {
    event = 'clicked';
  }

  const channel = (message.status || '').startsWith('SMS_') ? 'SMS' : 'RCS';
  const cleanMeta = msgId ? String(msgId).replace(/^cl_/, '') : msgId;
  const resolvedUrl = urlValue || '';

  let item;
  if (event === 'clicked') {
    // Exact spec format: ts, channel, meta, userAgent, url, shortUrl
    item = {
      ts: Math.floor(Date.now() / 1000),
      channel,
      meta: cleanMeta,
      userAgent: sparcEvent.userAgent || sparcEvent.user_agent || 'SPARC-RCS-Agent',
      url: resolvedUrl,
      shortUrl: sparcEvent.shortUrl || sparcEvent.short_url || resolvedUrl
    };
  } else if (event === 'read') {
    item = {
      ts: Math.floor(Date.now() / 1000),
      channel,
      meta: cleanMeta
    };
  } else {
    // replied
    item = {
      ts: Math.floor(Date.now() / 1000),
      channel,
      meta: cleanMeta,
      type: 'text',
      fromPhone: message.destination || '',
      toPhone: sparcEvent.toPhone || '',
      incomingText: sparcEvent.suggestion_text || sparcEvent.text || ''
    };
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

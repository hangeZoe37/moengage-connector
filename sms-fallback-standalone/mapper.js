'use strict';

const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  CARD: 'CARD',
  MEDIA: 'MEDIA'
};

function generateMessageId() {
  const randomId = Math.random().toString(36).substring(2, 10);
  return `moe_${Date.now()}_${randomId}`;
}

function buildSparcVariables(parameters) {
  if (!parameters || typeof parameters !== 'object') return [];
  return Object.values(parameters).map((value, index) => ({
    name: `{{${index + 1}}}`,
    value: String(value)
  }));
}

function buildSparcCardVariables(contentData) {
  const variables = {};
  if (contentData.title) {
    variables.card_title_variables = [{ name: '{{1}}', value: contentData.title }];
  } else {
    variables.card_title_variables = [];
  }
  const cardVars = [];
  if (contentData.description) {
    cardVars.push({ name: '{{1}}', value: contentData.description });
  }
  if (contentData.parameters && typeof contentData.parameters === 'object') {
    const startIdx = contentData.description ? 2 : 1;
    Object.values(contentData.parameters).forEach((val, idx) => {
      cardVars.push({ name: `{{${startIdx + idx}}}`, value: String(val) });
    });
  }
  variables.card_variables = cardVars;
  return variables;
}

function buildAddressProperties(content) {
  const data = content.data || {};
  switch (content.type) {
    case MESSAGE_TYPES.TEXT:
      const textVars = buildSparcVariables(data.parameters);
      return textVars.length > 0 ? { variables: textVars } : {};
    case MESSAGE_TYPES.CARD:
    case MESSAGE_TYPES.MEDIA:
      return { variables: buildSparcCardVariables(data) };
    default:
      return {};
  }
}

function buildNonTemplatedContent(content) {
  const { type, data } = content;
  switch (type) {
    case MESSAGE_TYPES.TEXT:
      return { plainText: data?.text || '' };

    case MESSAGE_TYPES.CARD: {
      const cardContent = {
        cardTitle: data?.title || '',
        cardDescription: data?.description || '',
      };
      if (data?.media?.media_url) {
        cardContent.cardMedia = {
          mediaHeight: data?.height || 'TALL',
          contentInfo: { fileUrl: data.media.media_url }
        };
      }
      return {
        richCardDetails: {
          standalone: {
            cardOrientation: data?.orientation || 'VERTICAL',
            content: cardContent
          }
        }
      };
    }

    case MESSAGE_TYPES.MEDIA: {
      return {
        richCardDetails: {
          standalone: {
            cardOrientation: 'VERTICAL',
            content: {
              cardMedia: {
                mediaHeight: 'TALL',
                contentInfo: { fileUrl: data?.media_url || data?.media?.media_url || '' }
              }
            }
          }
        }
      };
    }
    default:
      if (content.richCardDetails || content.textMessage || content.plainText) {
         return content;
      }
      return {};
  }
}

function buildAddress(message, isTemplated) {
  const { destination, callback_data, rcs } = message;
  const content = rcs?.message_content || message.content;
  const address = {
    seq_id: callback_data,
    assistant_id: rcs.bot_id,
    mobile_number: destination.replace('+', ''),
  };
  if (isTemplated) {
    Object.assign(address, buildAddressProperties(content));
  }
  return address;
}

function mapMessageToSparc(message, dlrWebhookUrl) {
  const { rcs } = message;
  const content = rcs?.message_content || message.content;
  const templateName = rcs?.template_id ?? rcs?.template_name ?? null;
  const isTemplated = Boolean(templateName) && templateName !== 'null' && templateName !== 'undefined';

  const sparcMessage = {
    message_id: generateMessageId(),
    ttl: "300s",
    addresses: [buildAddress(message, isTemplated)],
  };

  if (isTemplated) {
    sparcMessage.template_name = templateName;
  } else {
    sparcMessage.content = buildNonTemplatedContent(content);
  }

  return {
    messages: [sparcMessage],
    dlr_url: [{ url: dlrWebhookUrl }],
  };
}

module.exports = { mapMessageToSparc };

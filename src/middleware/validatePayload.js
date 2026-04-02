'use strict';

/**
 * src/middleware/validatePayload.js
 * Zod validation for inbound MoEngage payload.
 * Discriminated by content.type: TEXT | CARD | MEDIA | CAROUSEL.
 */

const { z } = require('zod');
const logger = require('../config/logger');

// --- Sub-schemas ---

const suggestionSchema = z.object({
  type: z.enum(['REPLY', 'OPEN_URL', 'DIAL_PHONE', 'SHOW_LOCATION', 'QUERY_LOCATION', 'REQUEST_LOCATION', 'CREATE_CAL_EVENT']),
  text: z.string(),
  postback_data: z.string().optional(),
  url: z.string().optional(),
  phone: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  label: z.string().optional(),
  query: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const mediaSchema = z.object({
  media_url: z.string().url(),
  content_type: z.string().optional(),
});

// MoEngage docs specify message_content contains "type", "data", "suggestions"

const textDataSchema = z.object({
  text: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
});

// Accept either an array of suggestions or a single suggestion object
const suggestionsSchemaRoot = z.union([
  z.array(suggestionSchema),
  suggestionSchema.transform(val => [val])
]).optional();

const textContentSchema = z.object({
  type: z.literal('TEXT'),
  data: textDataSchema,
  suggestions: suggestionsSchemaRoot,
});

const cardDataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  orientation: z.enum(['HORIZONTAL', 'VERTICAL']).or(z.literal('')).optional(),
  alignment: z.enum(['LEFT', 'RIGHT', 'CENTER']).or(z.literal('')).optional(),
  height: z.enum(['SHORT', 'MEDIUM', 'TALL']).or(z.literal('')).optional(),
  media: mediaSchema.optional(),
  parameters: z.record(z.string(), z.any()).optional(),
});

const cardContentSchema = z.object({
  type: z.literal('CARD'),
  data: cardDataSchema,
  suggestions: suggestionsSchemaRoot,
});

const mediaDataSchema = z.object({
  media_url: z.string().url(),
  content_type: z.string().optional(),
});

const mediaContentSchema = z.object({
  type: z.literal('MEDIA'),
  data: mediaDataSchema,
  suggestions: suggestionsSchemaRoot,
});

const contentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  cardContentSchema,
  mediaContentSchema,
]);

// --- RCS channel schema ---
const rcsChannelSchema = z.object({
  bot_id: z.string(),
  template_id: z.string().nullish(), // Accept strict null for International users
  template_name: z.string().nullish(), 
  message_content: contentSchema, 
});

// --- SMS fallback schema ---
const smsChannelSchema = z.object({
  sender: z.string().optional(),
  template_id: z.string().nullish(),
  template_name: z.string().nullish(),
  message: z.string().optional(),
}).optional();

// --- Single message item ---
const messageItemSchema = z.object({
  destination: z.string().min(1),
  callback_data: z.string().min(1),
  rcs: rcsChannelSchema,
  sms: smsChannelSchema,
  fallback_order: z.array(z.string()).optional(),
});

// --- Top-level payload ---
const inboundPayloadSchema = z.object({
  messages: z.array(messageItemSchema).min(1),
});

/**
 * Express middleware: validates req.body against the MoEngage inbound schema.
 */
function validatePayload(req, res, next) {
  const result = inboundPayloadSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn('Payload validation failed', {
      errors,
      clientId: req.client?.id,
    });

    return res.status(400).json({
      error: 'Invalid payload',
      details: errors,
    });
  }

  // To maintain compatibility with older controllers/mappers, we hoist `message_content` up to `content`
  // since the previous generic mapper assumed `message.content` directly.
  const modifiedData = result.data;
  if (modifiedData.messages) {
    modifiedData.messages = modifiedData.messages.map(msg => ({
      ...msg,
      content: msg.rcs.message_content, // Hoist it so inboundMapper.js receives it correctly
    }));
  }

  // Replace body with parsed (typed) data
  req.body = modifiedData;
  next();
}

module.exports = validatePayload;
module.exports.inboundPayloadSchema = inboundPayloadSchema;

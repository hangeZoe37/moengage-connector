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

const textContentSchema = z.object({
  type: z.literal('TEXT'),
  data: textDataSchema,
  suggestions: z.array(suggestionSchema).optional(),
});

const cardDataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  orientation: z.enum(['HORIZONTAL', 'VERTICAL']).optional(),
  alignment: z.enum(['LEFT', 'RIGHT', 'CENTER']).optional(),
  height: z.enum(['SHORT', 'MEDIUM', 'TALL']).optional(),
  media: mediaSchema.optional(),
  parameters: z.record(z.string(), z.any()).optional(),
});

const cardContentSchema = z.object({
  type: z.literal('CARD'),
  data: cardDataSchema,
  suggestions: z.array(suggestionSchema).optional(),
});

const mediaDataSchema = z.object({
  media_url: z.string().url(),
  content_type: z.string().optional(),
});

const mediaContentSchema = z.object({
  type: z.literal('MEDIA'),
  data: mediaDataSchema,
  suggestions: z.array(suggestionSchema).optional(), // Can also be just an object based on docs, but we'll accept array
});

const contentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  cardContentSchema,
  mediaContentSchema,
]);

// --- RCS channel schema ---
const rcsChannelSchema = z.object({
  bot_id: z.string(),
  template_id: z.string().optional(), // Reverting from template_name to template_id to match MoEngage docs
  template_name: z.string().optional(), // Keep template_name as an alias/fallback
  message_content: contentSchema, 
});

// --- SMS fallback schema ---
const smsChannelSchema = z.object({
  sender: z.string().optional(),
  template_id: z.string().optional(),
  template_name: z.string().optional(),
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
      workspaceId: req.workspace?.workspace_id,
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

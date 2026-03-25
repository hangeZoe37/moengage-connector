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
  type: z.string(),
  text: z.string(),
  postback_data: z.string().optional(),
  url: z.string().optional(),
  phone_number: z.string().optional(),
});

const mediaSchema = z.object({
  media_url: z.string().url(),
  media_type: z.string().optional(),
  file_name: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

const cardContentSchema = z.object({
  type: z.literal('CARD'),
  title: z.string().optional(),
  description: z.string().optional(),
  media: mediaSchema.optional(),
  orientation: z.enum(['HORIZONTAL', 'VERTICAL']).optional(),
  alignment: z.string().optional(),
  height: z.string().optional(),
  suggestions: z.array(suggestionSchema).optional(),
});

const textContentSchema = z.object({
  type: z.literal('TEXT'),
  text: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  suggestions: z.array(suggestionSchema).optional(),
});

const mediaContentSchema = z.object({
  type: z.literal('MEDIA'),
  media_url: z.string().url(),
  media_type: z.string().optional(),
  thumbnail_url: z.string().optional(),
  suggestions: z.array(suggestionSchema).optional(),
});

const carouselCardSchema = z.object({
  media_url: z.string().optional(),
  card_title_variables: z.array(z.any()).optional(),
  card_variables: z.array(z.any()).optional(),
  suggestions: z.array(suggestionSchema).optional(),
});

const carouselContentSchema = z.object({
  type: z.literal('CAROUSEL'),
  orientation: z.enum(['HORIZONTAL', 'VERTICAL']).optional(),
  height: z.string().optional(),
  card_width: z.string().optional(),
  cards: z.array(carouselCardSchema).min(1),
  suggestions: z.array(suggestionSchema).optional(),
});

const contentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  cardContentSchema,
  mediaContentSchema,
  carouselContentSchema,
]);

// --- RCS channel schema ---
const rcsChannelSchema = z.object({
  bot_id: z.string(),
  template_id: z.string().optional(),
});

// --- SMS fallback schema ---
const smsChannelSchema = z.object({
  sender: z.string().optional(),
  template_id: z.string().optional(),
  message: z.string().optional(),
}).optional();

// --- Single message item ---
const messageItemSchema = z.object({
  destination: z.string().min(1),
  callback_data: z.string().min(1),
  content: contentSchema,
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

  // Replace body with parsed (typed) data
  req.body = result.data;
  next();
}

module.exports = validatePayload;
module.exports.inboundPayloadSchema = inboundPayloadSchema;

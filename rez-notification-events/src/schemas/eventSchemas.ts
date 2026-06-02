/**
 * Centralized Zod schemas for all event types processed by the notification worker.
 *
 * Canonical types: @rez/shared-types/entities/notification
 * FIXED: Using local types
 *
 * Canonical NotificationChannel enum (4 canonical + 1 extended values):
 * - push: push notifications (canonical)
 * - email: email notifications (canonical)
 * - sms: SMS notifications (canonical)
 * - in_app: in-app notifications (canonical)
 * - whatsapp: WhatsApp notifications (extended, not in base canonical)
 *
 * BE-EVT-029: Provides runtime validation for all incoming events.
 * Replaces the plain TypeScript interface in worker.ts with strict Zod schemas.
 */

import { z } from 'zod';

// ── Primitive sub-schemas ────────────────────────────────────────────────────

const objectIdSchema = z.string().length(24, 'ObjectId must be exactly 24 hex characters');

const notificationPayloadSchema = z.object({
  title: z.string().min(1, 'title is required'),
  body: z.string().min(1, 'body is required'),
  data: z.record(z.unknown()).optional(),
  channelId: z.string().optional(),
  priority: z.enum(['low', 'default', 'high', 'urgent']).optional(),
  emailSubject: z.string().optional(),
  emailHtml: z.string().optional(),
  emailTemplateId: z.string().optional(),
  emailTemplateData: z.record(z.unknown()).optional(),
  smsMessage: z.string().optional(),
  whatsappTemplateId: z.string().optional(),
  whatsappTemplateVars: z.array(z.string()).optional(),
});

const baseEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  eventType: z.string().min(1, 'eventType is required'),
  userId: z.string().min(1, 'userId is required'),
  // Canonical NotificationChannel enum — includes all 4 canonical values + whatsapp
  channels: z
    .array(z.enum(['push', 'email', 'sms', 'whatsapp', 'in_app']))
    .min(1, 'At least one channel is required'),
  payload: notificationPayloadSchema,
  category: z.string().optional(),
  source: z.string().optional(),
  createdAt: z.string().datetime({ message: 'createdAt must be an ISO 8601 datetime' }),
});

// ── Specific event-type schemas ──────────────────────────────────────────────

/**
 * coin_earned — triggered when a user earns coins from a transaction.
 */
export const coinEarnedEventSchema = baseEventSchema.extend({
  eventType: z.literal('coin_earned'),
  payload: notificationPayloadSchema.extend({
    data: z
      .object({
        coins: z.number().int().positive(),
        source: z.string(),
        email: z.string().email().optional(),
        transactionId: z.string().optional(),
        merchantName: z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * streak_at_risk — triggered when a user's daily streak is about to expire.
 */
export const streakAtRiskEventSchema = baseEventSchema.extend({
  eventType: z.literal('streak_at_risk'),
  payload: notificationPayloadSchema.extend({
    data: z
      .object({
        streakCount: z.number().int().nonnegative(),
        hoursRemaining: z.number().positive(),
        email: z.string().email().optional(),
      })
      .optional(),
  }),
});

/**
 * streak_milestone — triggered when a user reaches a streak milestone.
 */
export const streakMilestoneEventSchema = baseEventSchema.extend({
  eventType: z.literal('streak_milestone'),
  payload: notificationPayloadSchema.extend({
    data: z
      .object({
        streakCount: z.number().int().positive(),
        rewardCoins: z.number().int().nonnegative().optional(),
        email: z.string().email().optional(),
      })
      .optional(),
  }),
});

/**
 * payment_received — transactional payment notification.
 */
export const paymentReceivedEventSchema = baseEventSchema.extend({
  eventType: z.literal('payment_received'),
  payload: notificationPayloadSchema.extend({
    data: z
      .object({
        amount: z.number().positive(),
        currency: z.string().default('INR'),
        merchantName: z.string().optional(),
        email: z.string().email().optional(),
        transactionId: z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * order_update — order status change notification.
 */
export const orderUpdateEventSchema = baseEventSchema.extend({
  eventType: z.literal('order_update'),
  payload: notificationPayloadSchema.extend({
    data: z
      .object({
        orderId: z.string(),
        status: z.string(),
        email: z.string().email().optional(),
      })
      .optional(),
  }),
});

/**
 * Fallback schema for unknown event types that still pass base structural
 * validation. Allows the worker to process events without blocking on
 * unknown types, but validates the base contract is respected.
 * Note: Cannot be used inside a discriminatedUnion because eventType
 * is a general string, not a literal.
 */
export const genericEventSchema = baseEventSchema;

/**
 * Union of all known event schemas.
 * Unknown event types can be validated against genericEventSchema separately.
 */
export const notificationEventSchema = z.discriminatedUnion('eventType', [
  coinEarnedEventSchema,
  streakAtRiskEventSchema,
  streakMilestoneEventSchema,
  paymentReceivedEventSchema,
  orderUpdateEventSchema,
]);

// ── Type exports ─────────────────────────────────────────────────────────────

export type CoinEarnedEvent = z.infer<typeof coinEarnedEventSchema>;
export type StreakAtRiskEvent = z.infer<typeof streakAtRiskEventSchema>;
export type StreakMilestoneEvent = z.infer<typeof streakMilestoneEventSchema>;
export type PaymentReceivedEvent = z.infer<typeof paymentReceivedEventSchema>;
export type OrderUpdateEvent = z.infer<typeof orderUpdateEventSchema>;
export type GenericEvent = z.infer<typeof genericEventSchema>;
export type NotificationEventV2 = z.infer<typeof notificationEventSchema>;

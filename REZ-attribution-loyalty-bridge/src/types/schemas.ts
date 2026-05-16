/**
 * Zod Schemas for Attribution-Loyalty Bridge
 * Input validation for all API requests and service integrations
 */

import { z } from 'zod';

// ============================================
// CHANNEL TYPES
// ============================================

export const ChannelTypeSchema = z.enum([
  'search',
  'social',
  'display',
  'video',
  'email',
  'sms',
  'push',
  'dooh',
  'print',
  'ooh',
  'walkin',
  'qr',
  'organic',
  'referral',
  'wallet',
  'loyalty',
  'creator',
  'aggregator',
  'direct',
  'unknown'
]);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

// ============================================
// ATTRIBUTION MODEL TYPES
// ============================================

export const AttributionModelSchema = z.enum([
  'first_touch',
  'last_touch',
  'last_non_direct',
  'linear',
  'time_decay',
  'position_based',
  'data_driven'
]);

// ============================================
// CONVERSION TYPES
// ============================================

export const ConversionTypeSchema = z.enum([
  'purchase',
  'signup',
  'lead',
  'subscription',
  'download',
  'app_install',
  'visit'
]);

export const ConversionStatusSchema = z.enum([
  'pending',
  'completed',
  'voided',
  'refunded',
  'suspected'
]);

// ============================================
// CASHBACK CALCULATION SCHEMAS
// ============================================

export const CashbackRequestSchema = z.object({
  conversionId: z.string().min(1, 'Conversion ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  merchantId: z.string().min(1, 'Merchant ID is required'),
  orderValue: z.number().positive('Order value must be positive'),
  currency: z.string().default('INR'),
  channels: z.array(ChannelTypeSchema).min(1, 'At least one channel is required'),
  campaignId: z.string().optional(),
  attributionModel: AttributionModelSchema.default('last_touch'),
  attributedRevenue: z.record(ChannelTypeSchema, z.number()).optional(),
  metadata: z.record(z.any()).optional()
});

export type CashbackRequest = z.infer<typeof CashbackRequestSchema>;

// ============================================
// LOYALTY TRIGGER SCHEMAS
// ============================================

export const LoyaltyTriggerRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  merchantId: z.string().min(1, 'Merchant ID is required'),
  rewardType: z.enum(['coins', 'cashback', 'points', 'discount']),
  rewardAmount: z.number().positive('Reward amount must be positive'),
  coinType: z.enum(['rez', 'prive', 'branded', 'promo', 'cashback', 'referral']).default('rez'),
  source: z.string().min(1, 'Source is required'),
  referenceId: z.string().min(1, 'Reference ID is required'),
  referenceType: z.enum(['conversion', 'attribution', 'campaign', 'referral']),
  channels: z.array(ChannelTypeSchema).optional(),
  campaignId: z.string().optional(),
  multiplier: z.number().min(1).max(10).default(1),
  expiresIn: z.number().int().positive().optional(), // Days until expiry
  metadata: z.record(z.any()).optional()
});

export type LoyaltyTriggerRequest = z.infer<typeof LoyaltyTriggerRequestSchema>;

// ============================================
// BRIDGE EVENT SCHEMAS
// ============================================

export const BridgeEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum([
    'conversion.completed',
    'conversion.refunded',
    'conversion.voided',
    'attribution.updated',
    'campaign.started',
    'campaign.ended',
    'multiplier.changed'
  ]),
  timestamp: z.string().datetime(),
  payload: z.record(z.any()),
  metadata: z.object({
    source: z.string(),
    correlationId: z.string().optional()
  }).optional()
});

export type BridgeEvent = z.infer<typeof BridgeEventSchema>;

// ============================================
// REWARD CALCULATION SCHEMAS
// ============================================

export interface ChannelRewardConfig {
  baseCoinsPerHundred: number;
  bonusMultiplier: number;
  maxCashbackPercent: number;
}

export const ChannelRewardConfigSchema = z.record(
  ChannelTypeSchema,
  z.object({
    baseCoinsPerHundred: z.number().min(0),
    bonusMultiplier: z.number().min(1),
    maxCashbackPercent: z.number().min(0).max(100)
  })
);

// ============================================
// CAMPAIGN MULTIPLIER SCHEMAS
// ============================================

export const CampaignMultiplierSchema = z.record(z.string(), z.number().min(1).max(10));

// ============================================
// BRIDGE RECORD SCHEMAS
// ============================================

export const BridgeRecordStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'partial'
]);

export const CreateBridgeRecordSchema = z.object({
  bridgeId: z.string().uuid(),
  conversionId: z.string(),
  customerId: z.string(),
  merchantId: z.string(),
  orderValue: z.number(),
  currency: z.string().default('INR'),

  // Attribution data
  attributedChannels: z.array(ChannelTypeSchema),
  attributionModel: AttributionModelSchema,
  attributedRevenue: z.record(ChannelTypeSchema, z.number()).optional(),

  // Reward calculations
  totalCoins: z.number(),
  totalCashback: z.number(),
  channelBreakdown: z.record(
    ChannelTypeSchema,
    z.object({
      coins: z.number(),
      cashback: z.number(),
      percentage: z.number()
    })
  ),

  // Campaign data
  campaignId: z.string().optional(),
  campaignMultiplier: z.number().default(1),

  // Status
  status: BridgeRecordStatusSchema.default('pending'),

  // Error handling
  errorMessage: z.string().optional(),
  retryCount: z.number().default(0),

  metadata: z.record(z.any()).optional()
});

export type CreateBridgeRecord = z.infer<typeof CreateBridgeRecordSchema>;

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

export const NotificationPayloadSchema = z.object({
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['reward', 'milestone', 'campaign', 'expiry']),
  data: z.object({
    coinsEarned: z.number().optional(),
    cashbackEarned: z.number().optional(),
    totalBalance: z.number().optional(),
    campaignName: z.string().optional(),
    expiryDate: z.string().datetime().optional()
  }).optional()
});

// ============================================
// API RESPONSE SCHEMAS
// ============================================

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.any()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime()
  })
});

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const AttributionWebhookSchema = z.object({
  event: z.enum(['conversion.created', 'conversion.updated', 'conversion.deleted']),
  timestamp: z.string().datetime(),
  data: z.object({
    conversionId: z.string(),
    customerId: z.string(),
    merchantId: z.string(),
    orderId: z.string().optional(),
    status: ConversionStatusSchema,
    type: ConversionTypeSchema,
    value: z.object({
      amount: z.number(),
      currency: z.string()
    }),
    channels: z.array(ChannelTypeSchema),
    attributionModel: AttributionModelSchema,
    attributedRevenue: z.record(ChannelTypeSchema, z.number()).optional(),
    campaignId: z.string().optional()
  })
});

export type AttributionWebhook = z.infer<typeof AttributionWebhookSchema>;

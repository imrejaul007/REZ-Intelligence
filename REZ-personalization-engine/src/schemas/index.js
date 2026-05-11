/**
 * Zod Validation Schemas for rez-personalization-engine
 *
 * Validates personalization requests, interactions, and user profile updates.
 */

const { z } = require('zod');

// ── Enums ─────────────────────────────────────────────────────────────────

const CommunicationStyleSchema = z.enum(['formal', 'casual', 'friendly', 'professional', 'mixed']);
const PriceSensitivityTierSchema = z.enum(['budget', 'moderate', 'premium', 'luxury', 'insensitive']);
const ActivityFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'occasional']);
const ProfileSourceSchema = z.enum(['explicit', 'implicit', 'hybrid']);
const InteractionTypeSchema = z.enum(['view', 'click', 'hover', 'add_to_cart', 'purchase', 'like', 'share', 'save', 'review', 'dismiss']);
const RecommendationTypeSchema = z.enum(['for_you', 'similar', 'trending', 'new', 'popular', 'category', 'complementary']);

// ── Behavioral Pattern ───────────────────────────────────────────────────

const BehavioralPatternSchema = z.object({
  type: z.string().min(1),
  frequency: z.number().int().min(0).default(0),
  lastObserved: z.date().default(() => new Date()),
  confidence: z.number().min(0).max(1).default(0),
  metadata: z.record(z.unknown()).default({}),
});

const BehavioralPatternUpdateSchema = z.object({
  type: z.string().min(1),
  frequency: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── Preference Vector ─────────────────────────────────────────────────────

const PreferenceVectorSchema = z.object({
  dimension: z.string().min(1),
  value: z.number().min(-1).max(1),
  updatedAt: z.date().default(() => new Date()),
});

const PreferenceVectorUpdateSchema = z.object({
  dimension: z.string().min(1),
  value: z.number().min(-1).max(1),
});

// ── Content Affinity ─────────────────────────────────────────────────────

const ContentAffinitySchema = z.object({
  contentType: z.string().min(1),
  category: z.string().min(1),
  score: z.number().min(0).max(1),
  interactionCount: z.number().int().min(0).default(0),
  lastInteraction: z.date().optional(),
  positiveInteractions: z.number().int().min(0).default(0),
  negativeInteractions: z.number().int().min(0).default(0),
});

// ── Notification Timing Preference ────────────────────────────────────────

const NotificationTimingPreferenceSchema = z.object({
  morningStart: z.number().int().min(0).max(23).default(8),
  morningEnd: z.number().int().min(0).max(23).default(12),
  afternoonStart: z.number().int().min(0).max(23).default(12),
  afternoonEnd: z.number().int().min(0).max(23).default(17),
  eveningStart: z.number().int().min(0).max(23).default(17),
  eveningEnd: z.number().int().min(0).max(23).default(21),
  preferredDays: z.array(z.number().int().min(0).max(6)).default([]),
  timezone: z.string().default('UTC'),
  optimalTimes: z.array(z.date()).default([]),
});

// ── Brand Preference ──────────────────────────────────────────────────────

const BrandPreferenceSchema = z.object({
  brandId: z.string().min(1),
  brandName: z.string().optional(),
  affinity: z.number().min(0).max(1).default(0),
  interactionCount: z.number().int().min(0).default(0),
});

const BrandPreferenceUpdateSchema = z.object({
  brandId: z.string().min(1),
  brandName: z.string().optional(),
  affinity: z.number().min(0).max(1),
  interactionCount: z.number().int().min(0).optional(),
});

// ── Category Interest ─────────────────────────────────────────────────────

const CategoryInterestSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().optional(),
  interestScore: z.number().min(0).max(1).default(0),
  clickThroughRate: z.number().min(0).max(1).default(0),
  conversionRate: z.number().min(0).max(1).default(0),
  lastViewed: z.date().optional(),
});

const CategoryInterestUpdateSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().optional(),
  interestScore: z.number().min(0).max(1),
  clickThroughRate: z.number().min(0).max(1).optional(),
  conversionRate: z.number().min(0).max(1).optional(),
});

// ── User DNA Profile Updates ───────────────────────────────────────────────

const UserDNAProfileUpdateSchema = z.object({
  behavioralPattern: BehavioralPatternUpdateSchema.optional(),
  preferenceVector: PreferenceVectorUpdateSchema.optional(),
  communicationStyle: CommunicationStyleSchema.optional(),
  notificationTiming: NotificationTimingPreferenceSchema.optional(),
  priceSensitivityTier: PriceSensitivityTierSchema.optional(),
  brandPreferences: z.array(BrandPreferenceUpdateSchema).optional(),
  categoryInterests: z.array(CategoryInterestUpdateSchema).optional(),
  contentAffinity: ContentAffinitySchema.optional(),
  engagement: z.object({
    engagementScore: z.number().min(0).max(1),
    activityFrequency: ActivityFrequencySchema.optional(),
  }).optional(),
  diversityPreferences: z.object({
    diversityTolerance: z.number().min(0).max(1),
    noveltySeeking: z.number().min(0).max(1),
  }).optional(),
});

const UserDNAProfileSchema = z.object({
  userId: z.string().min(1),
  behavioralPatterns: z.array(BehavioralPatternSchema).default([]),
  preferenceVector: z.array(PreferenceVectorSchema).default([]),
  contentAffinityScores: z.array(ContentAffinitySchema).default([]),
  communicationStyle: CommunicationStyleSchema.default('mixed'),
  notificationTimingPreference: NotificationTimingPreferenceSchema,
  priceSensitivityTier: PriceSensitivityTierSchema.default('moderate'),
  averageOrderValue: z.number().min(0).default(0),
  brandPreferences: z.array(BrandPreferenceSchema).default([]),
  categoryInterests: z.array(CategoryInterestSchema).default([]),
  engagementScore: z.number().min(0).max(1).default(0.5),
  activityFrequency: ActivityFrequencySchema.default('weekly'),
  lastActiveAt: z.date().optional(),
  diversityTolerance: z.number().min(0).max(1).default(0.5),
  noveltySeeking: z.number().min(0).max(1).default(0.5),
  personalizationVersion: z.number().int().default(1),
  profileCompleteness: z.number().min(0).max(1).default(0),
  source: ProfileSourceSchema.default('implicit'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// ── Interaction ────────────────────────────────────────────────────────────

const InteractionSchema = z.object({
  userId: z.string().min(1),
  itemId: z.string().min(1),
  itemType: z.string().default('product'),
  type: InteractionTypeSchema,
  context: z.record(z.unknown()).optional(),
  value: z.number().default(1),
  duration: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const CreateInteractionSchema = InteractionSchema.extend({
  userId: z.string().min(1),
  itemId: z.string().min(1),
  type: InteractionTypeSchema,
});

// ── Recommendation Request ─────────────────────────────────────────────────

const RecommendationRequestSchema = z.object({
  userId: z.string().min(1),
  type: RecommendationTypeSchema.default('for_you'),
  limit: z.number().int().min(1).max(100).default(10),
  context: z.record(z.unknown()).optional(),
});

// ── Homepage Request ───────────────────────────────────────────────────────

const HomepageRequestSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
  refresh: z.boolean().default(false),
});

// ── Search Personalization ─────────────────────────────────────────────────

const SearchPersonalizationRequestSchema = z.object({
  userId: z.string().min(1),
  query: z.string().optional(),
  results: z.array(z.record(z.unknown())).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ── Batch Request ─────────────────────────────────────────────────────────

const BatchRequestItemSchema = z.object({
  type: z.enum(['homepage', 'recommendations', 'similar']),
  userId: z.string().min(1),
  params: z.record(z.unknown()).optional(),
});

const BatchRequestSchema = z.object({
  requests: z.array(BatchRequestItemSchema).min(1).max(100),
});

// ── Campaign Track ────────────────────────────────────────────────────────

const CampaignTrackSchema = z.object({
  campaignId: z.string().min(1),
  interactions: z.array(z.object({
    userId: z.string().min(1),
    itemId: z.string().min(1),
    type: InteractionTypeSchema,
    timestamp: z.string().datetime().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
});

// ── Similar Items Request ──────────────────────────────────────────────────

const SimilarItemsRequestSchema = z.object({
  itemId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
  userId: z.string().optional(),
});

// ── Validation Helper ─────────────────────────────────────────────────────

function validateBody(schema) {
  return (data) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}

function validateQuery(schema) {
  return (query) => {
    const result = schema.safeParse(query);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}

// ── Express Request Validation ────────────────────────────────────────────

function validateRequest(schema) {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        errors.push(`Body: ${result.error.message}`);
      } else {
        req.body = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        errors.push(`Query: ${result.error.message}`);
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        errors.push(`Params: ${result.error.message}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

module.exports = {
  // Enums
  CommunicationStyleSchema,
  PriceSensitivityTierSchema,
  ActivityFrequencySchema,
  ProfileSourceSchema,
  InteractionTypeSchema,
  RecommendationTypeSchema,

  // Schemas
  BehavioralPatternSchema,
  PreferenceVectorSchema,
  ContentAffinitySchema,
  NotificationTimingPreferenceSchema,
  BrandPreferenceSchema,
  CategoryInterestSchema,
  UserDNAProfileSchema,
  UserDNAProfileUpdateSchema,
  InteractionSchema,
  CreateInteractionSchema,
  RecommendationRequestSchema,
  HomepageRequestSchema,
  SearchPersonalizationRequestSchema,
  BatchRequestSchema,
  BatchRequestItemSchema,
  CampaignTrackSchema,
  SimilarItemsRequestSchema,

  // Validators
  validateBody,
  validateQuery,
  validateRequest,
};

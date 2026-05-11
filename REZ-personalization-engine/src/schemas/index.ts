/**
 * Zod Validation Schemas for rez-personalization-engine
 * Type-safe request/response validation with detailed error messages
 */

import { z, ZodError, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// ENUMS (derived from src/types/index.ts)
// ============================================================================

export const CommunicationStyleSchema = z.enum(['formal', 'casual', 'friendly', 'professional', 'mixed']);
export const PriceSensitivityTierSchema = z.enum(['budget', 'moderate', 'premium', 'luxury', 'insensitive']);
export const ProfileSourceSchema = z.enum(['explicit', 'implicit', 'hybrid']);
export const ActivityFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'occasional']);
export const ItemTypeSchema = z.enum(['product', 'content', 'service', 'ad']);
export const InteractionTypeSchema = z.enum(['view', 'click', 'hover', 'add_to_cart', 'purchase', 'like', 'share', 'save', 'review', 'dismiss']);
export const InteractionContextSourceSchema = z.enum(['homepage', 'search', 'recommendation', 'category', 'direct', 'email', 'notification']);
export const CampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);
export const ABTestVariantSchema = z.enum(['control', 'variant_a', 'variant_b', 'variant_c']);
export const ChannelTypeSchema = z.enum(['push', 'email', 'sms', 'in_app', 'ad']);
export const ChannelFrequencySchema = z.enum(['realtime', 'daily', 'weekly', 'monthly']);
export const StockLevelSchema = z.enum(['high', 'medium', 'low', 'out']);
export const OutcomeTypeSchema = z.enum(['none', 'converted', 'abandoned', 'saved']);

// ============================================================================
// USER DNA PROFILE SCHEMAS
// ============================================================================

export const BehavioralPatternSchema = z.object({
  type: z.string().min(1, 'Pattern type is required'),
  frequency: z.number().int().min(0).default(0),
  lastObserved: z.date().default(() => new Date()),
  confidence: z.number().min(0).max(1).default(0),
  metadata: z.record(z.unknown()).default({})
});

export const PreferenceVectorSchema = z.object({
  dimension: z.string().min(1, 'Dimension is required'),
  value: z.number().min(-1).max(1),
  updatedAt: z.date().default(() => new Date())
});

export const ContentAffinitySchema = z.object({
  contentType: z.string().min(1, 'Content type is required'),
  category: z.string().min(1, 'Category is required'),
  score: z.number().min(0).max(1).default(0),
  interactionCount: z.number().int().min(0).default(0),
  lastInteraction: z.date().default(() => new Date()),
  positiveInteractions: z.number().int().min(0).default(0),
  negativeInteractions: z.number().int().min(0).default(0)
});

export const BrandPreferenceSchema = z.object({
  brandId: z.string().min(1, 'Brand ID is required'),
  brandName: z.string().default(''),
  affinity: z.number().min(0).max(1).default(0),
  interactionCount: z.number().int().min(0).default(0)
});

export const CategoryInterestSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  categoryName: z.string().default(''),
  interestScore: z.number().min(0).max(1).default(0),
  clickThroughRate: z.number().min(0).default(0),
  conversionRate: z.number().min(0).default(0),
  lastViewed: z.date().optional()
});

export const NotificationTimingPreferenceSchema = z.object({
  morningStart: z.number().int().min(0).max(23).default(8),
  morningEnd: z.number().int().min(0).max(23).default(12),
  afternoonStart: z.number().int().min(0).max(23).default(12),
  afternoonEnd: z.number().int().min(0).max(23).default(17),
  eveningStart: z.number().int().min(0).max(23).default(17),
  eveningEnd: z.number().int().min(0).max(23).default(21),
  preferredDays: z.array(z.number().int().min(0).max(6)).default([]),
  timezone: z.string().default('UTC'),
  optimalTimes: z.array(z.date()).default([])
});

export const UserDNAProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
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
  lastActiveAt: z.date().default(() => new Date()),
  diversityTolerance: z.number().min(0).max(1).default(0.5),
  noveltySeeking: z.number().min(0).max(1).default(0.5),
  personalizationVersion: z.number().int().min(1).default(1),
  lastUpdated: z.date().default(() => new Date()),
  profileCompleteness: z.number().min(0).max(1).default(0),
  createdAt: z.date().default(() => new Date()),
  source: ProfileSourceSchema.default('implicit')
});

// Update schema - partial, only allows specific fields to be updated
export const UserDNAProfileUpdateSchema = z.object({
  communicationStyle: CommunicationStyleSchema.optional(),
  priceSensitivityTier: PriceSensitivityTierSchema.optional(),
  categoryInterests: z.array(CategoryInterestSchema).optional(),
  brandPreferences: z.array(BrandPreferenceSchema).optional(),
  notificationTimingPreference: NotificationTimingPreferenceSchema.partial().optional(),
  behavioralPattern: z.object({
    type: z.string().min(1),
    metadata: z.record(z.unknown()).optional()
  }).optional(),
  preferenceVector: z.array(z.object({
    dimension: z.string().min(1),
    value: z.number().min(-1).max(1)
  })).optional(),
  contentAffinity: z.object({
    contentType: z.string().min(1),
    category: z.string().min(1),
    score: z.number().min(0).max(1)
  }).optional(),
  engagement: z.object({
    engagementScore: z.number().min(0).max(1),
    activityFrequency: ActivityFrequencySchema.optional()
  }).optional(),
  diversityPreferences: z.object({
    diversityTolerance: z.number().min(0).max(1).optional(),
    noveltySeeking: z.number().min(0).max(1).optional()
  }).optional()
});

// ============================================================================
// CONTENT ITEM SCHEMAS
// ============================================================================

export const ItemFeaturesSchema = z.object({
  price_tier: z.number().int().min(0).max(4).default(0),
  quality_tier: z.number().int().min(0).max(4).default(0),
  popularity: z.number().default(0),
  recency: z.number().default(0),
  engagement_rate: z.number().default(0),
  conversion_rate: z.number().default(0)
});

export const ContentItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: ItemTypeSchema,
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  attributes: z.record(z.unknown()).default({}),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.string().optional()),
  price: z.number().min(0).optional(),
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).default(0),
  features: ItemFeaturesSchema,
  embedding: z.array(z.number()).optional(),
  available: z.boolean().default(true),
  stockLevel: StockLevelSchema.default('high'),
  popularityScore: z.number().default(0),
  trendingScore: z.number().default(0),
  viewCount: z.number().int().min(0).default(0),
  likeCount: z.number().int().min(0).default(0),
  shareCount: z.number().int().min(0).default(0),
  purchaseCount: z.number().int().min(0).default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const ContentItemCreateSchema = ContentItemSchema;
export const ContentItemUpdateSchema = ContentItemSchema.partial().omit({ itemId: true, createdAt: true });

// ============================================================================
// INTERACTION SCHEMAS
// ============================================================================

export const InteractionContextSchema = z.object({
  source: InteractionContextSourceSchema,
  position: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  deviceType: z.string().optional(),
  location: z.string().optional(),
  referralCode: z.string().optional()
});

export const InteractionOutcomeSchema = z.object({
  type: OutcomeTypeSchema.default('none'),
  value: z.number().default(0)
});

export const InteractionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: ItemTypeSchema,
  type: InteractionTypeSchema,
  context: InteractionContextSchema,
  value: z.number().default(1),
  duration: z.number().positive().optional(),
  metadata: z.record(z.unknown()).default({}),
  rating: z.number().min(1).max(5).optional(),
  feedback: z.string().optional(),
  outcome: InteractionOutcomeSchema,
  timestamp: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

// Request DTOs
export const RecordInteractionRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: ItemTypeSchema.default('product'),
  type: InteractionTypeSchema,
  context: InteractionContextSchema.partial().optional(),
  value: z.number().default(1),
  duration: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
  rating: z.number().min(1).max(5).optional()
});

// ============================================================================
// PERSONALIZATION CAMPAIGN SCHEMAS
// ============================================================================

export const TargetingSchema = z.object({
  userSegments: z.array(z.string()).default([]),
  minEngagementScore: z.number().min(0).max(1).default(0),
  maxEngagementScore: z.number().min(0).max(1).default(1),
  priceTiers: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  excludeUsers: z.array(z.string()).default([])
});

export const ContentRulesSchema = z.object({
  itemTypes: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  minRating: z.number().min(0).max(5).optional(),
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().min(0).optional(),
  brands: z.array(z.string()).default([])
});

export const PersonalizationWeightsSchema = z.object({
  collaborativeWeight: z.number().min(0).max(1).default(0.4),
  contentBasedWeight: z.number().min(0).max(1).default(0.35),
  popularityWeight: z.number().min(0).max(1).default(0.15),
  diversityWeight: z.number().min(0).max(1).default(0.1)
});

export const ABTestMetricsSchema = z.object({
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
  revenue: z.number().min(0).default(0)
});

export const ABTestSchema = z.object({
  enabled: z.boolean().default(false),
  testId: z.string().optional(),
  variant: ABTestVariantSchema.optional(),
  metrics: ABTestMetricsSchema.default(() => ({}))
});

export const ChannelTemplateSchema = z.object({
  subject: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional()
});

export const ChannelTimingSchema = z.object({
  hour: z.number().int().min(0).max(23).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional()
});

export const ChannelSchema = z.object({
  channel: ChannelTypeSchema,
  enabled: z.boolean().default(true),
  frequency: ChannelFrequencySchema.default('realtime'),
  timing: ChannelTimingSchema.optional(),
  template: ChannelTemplateSchema.optional()
});

export const CampaignMetricsSchema = z.object({
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
  revenue: z.number().min(0).default(0),
  engagement: z.number().min(0).default(0)
});

export const CampaignScheduleSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  timezone: z.string().default('UTC')
});

export const PersonalizationCampaignSchema = z.object({
  campaignId: z.string().min(1, 'Campaign ID is required'),
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  targeting: TargetingSchema,
  contentRules: ContentRulesSchema,
  personalization: PersonalizationWeightsSchema,
  abTest: ABTestSchema,
  channels: z.array(ChannelSchema).default([]),
  status: CampaignStatusSchema.default('draft'),
  metrics: CampaignMetricsSchema.default(() => ({})),
  schedule: CampaignScheduleSchema,
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

// ============================================================================
// RECOMMENDATION REQUEST SCHEMA
// ============================================================================

export const RecommendationRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: z.enum(['for_you', 'similar', 'trending', 'new', 'popular', 'category', 'complementary']).default('for_you'),
  limit: z.number().int().min(1).max(100).default(10),
  excludeCategories: z.array(z.string()).optional(),
  includeCategories: z.array(z.string()).optional()
});

export const SearchPersonalizationRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  query: z.string().min(1, 'Search query is required'),
  results: z.array(z.object({
    itemId: z.string(),
    title: z.string().optional(),
    category: z.string().optional(),
    price: z.number().optional(),
    score: z.number().optional()
  })).min(1, 'At least one search result is required'),
  limit: z.number().int().min(1).max(100).default(20)
});

export const BatchRequestItemSchema = z.object({
  type: z.enum(['homepage', 'recommendations']),
  userId: z.string().min(1, 'User ID is required'),
  params: z.object({
    type: z.enum(['for_you', 'similar', 'trending', 'new', 'popular', 'category', 'complementary']).optional(),
    limit: z.number().int().min(1).max(100).optional()
  }).optional()
});

export const BatchRequestSchema = z.object({
  requests: z.array(BatchRequestItemSchema).min(1, 'At least one batch request is required')
});

export const CampaignTrackingRequestSchema = z.object({
  interactions: z.array(z.object({
    userId: z.string(),
    itemId: z.string(),
    itemType: ItemTypeSchema.optional(),
    type: InteractionTypeSchema,
    context: InteractionContextSchema.partial().optional(),
    value: z.number().optional(),
    duration: z.number().optional(),
    metadata: z.record(z.unknown()).optional()
  })).optional()
});

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const InteractionListQuerySchema = PaginationQuerySchema.extend({
  userId: z.string().optional(),
  itemId: z.string().optional(),
  type: InteractionTypeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

export const ContentListQuerySchema = PaginationQuerySchema.extend({
  category: z.string().optional(),
  itemType: ItemTypeSchema.optional(),
  brandId: z.string().optional(),
  available: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(['-popularityScore', 'popularityScore', '-createdAt', 'createdAt', '-rating', 'rating', '-price', 'price']).default('-popularityScore')
});

export const HomepageQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  refresh: z.enum(['true', 'false']).transform(v => v === 'true').default(false)
});

export const RecommendationsQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  type: z.enum(['for_you', 'similar', 'trending', 'new', 'popular', 'category', 'complementary']).default('for_you'),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

export const SimilarItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export const AnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30)
});

export const CleanupQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90)
});

// ============================================================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  data?: unknown;
}

/**
 * Parse Zod errors into a structured format
 */
function parseZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
}

/**
 * Create a validation middleware for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Request body validation failed',
        details: parseZodErrors(result.error)
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Query parameter validation failed',
        details: parseZodErrors(result.error)
      });
      return;
    }

    req.query = result.data as typeof req.query;
    next();
  };
}

/**
 * Create a validation middleware for route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Route parameter validation failed',
        details: parseZodErrors(result.error)
      });
      return;
    }

    req.params = result.data as typeof req.params;
    next();
  };
}

/**
 * Validate data with a schema and return structured result
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: parseZodErrors(result.error)
    };
  }

  return {
    success: true,
    errors: [],
    data: result.data
  };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CommunicationStyle = z.infer<typeof CommunicationStyleSchema>;
export type PriceSensitivityTier = z.infer<typeof PriceSensitivityTierSchema>;
export type ProfileSource = z.infer<typeof ProfileSourceSchema>;
export type ActivityFrequency = z.infer<typeof ActivityFrequencySchema>;
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type InteractionType = z.infer<typeof InteractionTypeSchema>;
export type InteractionContextSource = z.infer<typeof InteractionContextSourceSchema>;
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
export type ABTestVariant = z.infer<typeof ABTestVariantSchema>;
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
export type ChannelFrequency = z.infer<typeof ChannelFrequencySchema>;
export type StockLevel = z.infer<typeof StockLevelSchema>;

export type UserDNAProfile = z.infer<typeof UserDNAProfileSchema>;
export type UserDNAProfileUpdate = z.infer<typeof UserDNAProfileUpdateSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type Interaction = z.infer<typeof InteractionSchema>;
export type PersonalizationCampaign = z.infer<typeof PersonalizationCampaignSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

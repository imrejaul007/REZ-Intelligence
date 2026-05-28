/**
 * Zod Validation Schemas for rez-targeting-engine
 *
 * Validates API requests for campaigns, segments, templates, and triggers.
 */

import { z } from 'zod';

// Re-export z for convenience
export { z };

// ── Enums ───────────────────────────────────────────────────────────────────

export const CampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']);
export const PacingModeSchema = z.enum(['even', 'accelerated', 'front_loaded']);
export const SendTimeSchema = z.enum(['optimal', 'morning', 'afternoon', 'evening', 'night', 'specific']);
export const ChannelSchema = z.enum(['banner', 'push', 'in_app', 'sms', 'email']);
export const TriggerStatusSchema = z.enum(['queued', 'sent', 'delivered', 'viewed', 'clicked', 'converted', 'failed']);
export const SegmentTypeSchema = z.enum(['ltv', 'recency', 'frequency', 'behavior', 'demographic', 'composite']);
export const SegmentConditionOperatorSchema = z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'between', 'contains']);
export const CombinatorSchema = z.enum(['AND', 'OR']);
export const PrimaryMetricSchema = z.enum(['ctr', 'conversion', 'engagement', 'revenue']);

// ── Targeting Rules ────────────────────────────────────────────────────────

export const TargetingRulesSchema = z.object({
  user_segments: z.array(z.string()).min(0),
  exclusions: z.array(z.string()).min(0),
  recency_days: z.number().int().min(0).max(365),
  min_orders: z.number().int().min(0),
  custom_conditions: z.record(z.unknown()).optional(),
});

// ── Content Rules ──────────────────────────────────────────────────────────

export const ContentRulesSchema = z.object({
  ad_template_id: z.string().min(1),
  fallback_offer: z.string(),
  personalization_enabled: z.boolean().optional(),
  dynamic_content: z.boolean().optional(),
});

// ── Budget Rules ────────────────────────────────────────────────────────────

export const BudgetRulesSchema = z.object({
  daily_limit: z.number().min(0),
  cost_per_impression: z.number().min(0).max(100),
  lifetime_limit: z.number().min(0).optional(),
  pacing_mode: PacingModeSchema.optional(),
});

// ── Scheduling Rules ────────────────────────────────────────────────────────

export const SchedulingRulesSchema = z.object({
  send_time: SendTimeSchema,
  timezone: z.string().min(1),
  specific_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  blacklisted_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

// ── Campaign Rules ─────────────────────────────────────────────────────────

export const CampaignRulesSchema = z.object({
  targeting: TargetingRulesSchema,
  content: ContentRulesSchema,
  budget: BudgetRulesSchema,
  scheduling: SchedulingRulesSchema,
});

// ── AB Test Config ──────────────────────────────────────────────────────────

export const ABVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  ad_template_id: z.string().min(1),
  description: z.string().optional(),
});

export const ABTestConfigSchema = z.object({
  enabled: z.boolean(),
  variants: z.array(ABVariantSchema).min(2),
  primary_metric: PrimaryMetricSchema,
  min_sample_size: z.number().int().min(10),
  test_duration_days: z.number().int().min(1).max(90),
});

// ── Campaign ───────────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  rules: CampaignRulesSchema,
  ab_test_config: ABTestConfigSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  created_by: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  status: CampaignStatusSchema.optional(),
});

export const CampaignSchema = CreateCampaignSchema.extend({
  campaign_id: z.string(),
  status: CampaignStatusSchema,
  created_at: z.date(),
  updated_at: z.date(),
  created_by: z.string(),
});

// ── Segment Criteria ───────────────────────────────────────────────────────

export const SegmentConditionSchema = z.object({
  field: z.string().min(1),
  operator: SegmentConditionOperatorSchema,
  value: z.unknown(),
});

export const SegmentCriteriaSchema = z.object({
  type: SegmentTypeSchema,
  conditions: z.array(SegmentConditionSchema).min(1),
  combinator: CombinatorSchema,
});

// ── User Segment ──────────────────────────────────────────────────────────

export const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  criteria: SegmentCriteriaSchema,
  priority: z.number().int().min(0).max(100).default(50),
});

export const UpdateSegmentSchema = CreateSegmentSchema.partial();

export const UserSegmentSchema = CreateSegmentSchema.extend({
  segment_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

// ── Template Design ────────────────────────────────────────────────────────

export const TemplateDesignColorsSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  text: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const TemplateDesignSchema = z.object({
  layout: z.string().min(1),
  colors: TemplateDesignColorsSchema.optional(),
  font_size: z.string().optional(),
  spacing: z.string().optional(),
});

// ── Template Content ──────────────────────────────────────────────────────

export const TemplateContentSchema = z.object({
  headline: z.string().max(100).optional(),
  body: z.string().min(1).max(500),
  cta_text: z.string().max(30).optional(),
  cta_url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  deep_link: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── Ad Template ────────────────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  channel: ChannelSchema,
  content: TemplateContentSchema,
  design: TemplateDesignSchema,
  targeting: z.object({
    min_age: z.number().int().min(13).max(120).optional(),
    max_age: z.number().int().min(13).max(120).optional(),
    preferred_segments: z.array(z.string()).optional(),
  }).optional(),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const AdTemplateSchema = CreateTemplateSchema.extend({
  template_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  is_active: z.boolean(),
});

// ── User Context ──────────────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  preferred_send_time: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  timezone: z.string().min(1),
  notification_enabled: z.boolean(),
  email_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  push_enabled: z.boolean(),
});

export const UserAttributesSchema = z.object({
  ltv: z.number().min(0),
  total_orders: z.number().int().min(0),
  avg_order_value: z.number().min(0),
  last_order_date: z.string().datetime().optional(),
  first_order_date: z.string().datetime().optional(),
  days_since_last_order: z.number().int().min(0),
  browsing_frequency: z.number().min(0),
  purchase_frequency: z.number().min(0),
  is_discount_responsive: z.boolean(),
  preferred_categories: z.array(z.string()),
  device_type: z.string().optional(),
  email_verified: z.boolean().optional(),
  phone_verified: z.boolean().optional(),
  age: z.number().int().min(13).max(120).optional(),
  location: z.string().optional(),
});

export const UserContextSchema = z.object({
  user_id: z.string().min(1),
  segments: z.array(z.string()),
  attributes: UserAttributesSchema,
  preferences: UserPreferencesSchema,
});

// ── Campaign Trigger ──────────────────────────────────────────────────────

export const CreateTriggerSchema = z.object({
  campaign_id: z.string().min(1),
  user_id: z.string().min(1),
  variant_id: z.string().optional(),
  channel: ChannelSchema,
});

export const UpdateTriggerSchema = z.object({
  status: TriggerStatusSchema.optional(),
  sent_at: z.string().datetime().optional(),
  delivered_at: z.string().datetime().optional(),
  viewed_at: z.string().datetime().optional(),
  clicked_at: z.string().datetime().optional(),
  error: z.string().optional(),
});

export const CampaignTriggerSchema = CreateTriggerSchema.extend({
  trigger_id: z.string(),
  status: TriggerStatusSchema,
  sent_at: z.string().datetime().optional(),
  delivered_at: z.string().datetime().optional(),
  viewed_at: z.string().datetime().optional(),
  clicked_at: z.string().datetime().optional(),
  cost: z.number().min(0),
  error: z.string().optional(),
});

// ── Audience Preview ──────────────────────────────────────────────────────

export const AudiencePreviewSchema = z.object({
  campaign_id: z.string(),
  total_matching: z.number().int().min(0),
  by_segment: z.array(z.object({
    segment_id: z.string(),
    segment_name: z.string(),
    count: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  })),
  excluded_count: z.number().int().min(0),
  breakdown: z.object({
    meets_recency: z.number().int().min(0),
    meets_min_orders: z.number().int().min(0),
    meets_custom_conditions: z.number().int().min(0),
  }),
});

// ── Type Exports ──────────────────────────────────────────────────────────

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
export type PacingMode = z.infer<typeof PacingModeSchema>;
export type SendTime = z.infer<typeof SendTimeSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type TriggerStatus = z.infer<typeof TriggerStatusSchema>;
export type SegmentType = z.infer<typeof SegmentTypeSchema>;
export type SegmentConditionOperator = z.infer<typeof SegmentConditionOperatorSchema>;
export type Combinator = z.infer<typeof CombinatorSchema>;
export type PrimaryMetric = z.infer<typeof PrimaryMetricSchema>;

export type TargetingRules = z.infer<typeof TargetingRulesSchema>;
export type ContentRules = z.infer<typeof ContentRulesSchema>;
export type BudgetRules = z.infer<typeof BudgetRulesSchema>;
export type SchedulingRules = z.infer<typeof SchedulingRulesSchema>;
export type CampaignRules = z.infer<typeof CampaignRulesSchema>;
export type ABVariant = z.infer<typeof ABVariantSchema>;
export type ABTestConfig = z.infer<typeof ABTestConfigSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type SegmentCriteria = z.infer<typeof SegmentCriteriaSchema>;
export type SegmentCondition = z.infer<typeof SegmentConditionSchema>;
export type UserSegment = z.infer<typeof UserSegmentSchema>;
export type TemplateDesign = z.infer<typeof TemplateDesignSchema>;
export type TemplateContent = z.infer<typeof TemplateContentSchema>;
export type AdTemplate = z.infer<typeof AdTemplateSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserAttributes = z.infer<typeof UserAttributesSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type CampaignTrigger = z.infer<typeof CampaignTriggerSchema>;
export type AudiencePreview = z.infer<typeof AudiencePreviewSchema>;

// ── Pagination ──────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ── Validation Middleware Factory ────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (query: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } => {
    const result = schema.safeParse(query);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}

// ── Express Request Validation Middleware ─────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

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
      } else {
        req.query = result.data as typeof req.query;
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
        success: false,
        error: {
          message: 'Validation failed',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}

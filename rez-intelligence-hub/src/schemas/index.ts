/**
 * Zod Validation Schemas for rez-intelligence-hub
 *
 * Validates user/merchant profile requests and finance intelligence operations.
 */

import { z } from 'zod';

export { z };

// ── User Preferences ───────────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  cuisines: z.array(z.string()).default([]),
  price_range: z.enum(['budget', 'moderate', 'premium', 'luxury']).optional(),
  time_pattern: z.string().optional(),
  dietary: z.array(z.string()).default([]),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ── Intent Signals ────────────────────────────────────────────────────────

export const IntentSignalsSchema = z.object({
  current_intent: z.string().optional(),
  intent_confidence: z.number().min(0).max(1).optional(),
  purchase_probability: z.number().min(0).max(1).optional(),
});

export type IntentSignals = z.infer<typeof IntentSignalsSchema>;

// ── User Behavior ────────────────────────────────────────────────────────

export const UserBehaviorSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'occasional']).optional(),
  avg_order_value: z.number().min(0).optional(),
  engagement_level: z.enum(['low', 'medium', 'high']).optional(),
});

export type UserBehavior = z.infer<typeof UserBehaviorSchema>;

// ── Derived Signals ─────────────────────────────────────────────────────

export const DerivedSignalsSchema = z.object({
  preferences: UserPreferencesSchema,
  intent_signals: IntentSignalsSchema,
  behavior: UserBehaviorSchema,
});

export type DerivedSignals = z.infer<typeof DerivedSignalsSchema>;

// ── User Profile ─────────────────────────────────────────────────────────

export const CreateUserProfileSchema = z.object({
  userId: z.string().min(1),
  derived_signals: DerivedSignalsSchema.optional(),
  segments: z.array(z.string()).default([]),
});

export const UpdateUserProfileSchema = z.object({
  derived_signals: DerivedSignalsSchema.partial().optional(),
  segments: z.array(z.string()).optional(),
});

export const UserProfileSchema = z.object({
  userId: z.string(),
  derived_signals: DerivedSignalsSchema,
  segments: z.array(z.string()),
  updatedAt: z.date().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// ── User Event ────────────────────────────────────────────────────────────

export const CreateUserEventSchema = z.object({
  userId: z.string().min(1),
  event_type: z.enum([
    'order_completed',
    'order_placed',
    'browse',
    'search',
    'wishlist_add',
    'cart_add',
    'review_submitted',
    'payment_completed',
    'refund_requested',
    'support_ticket',
    'credit_score_checked',
    'loan_application_submitted',
    'loan_approved',
    'loan_rejected',
    'bnpl_used',
    'payment_overdue',
    'loan_repaid_ontime',
  ]),
  event_data: z.record(z.unknown()).optional(),
});

export const UserEventSchema = CreateUserEventSchema.extend({
  timestamp: z.date().default(() => new Date()),
});

export type UserEvent = z.infer<typeof UserEventSchema>;

// ── Merchant Profile ──────────────────────────────────────────────────────

export const MerchantDerivedSignalsSchema = z.object({
  demand_pattern: z.enum(['stable', 'seasonal', 'growing', 'declining']).optional(),
  customer_type: z.array(z.string()).default([]),
  pricing_behavior: z.enum(['competitive', 'premium', 'discount', 'dynamic']).optional(),
});

export const CreateMerchantProfileSchema = z.object({
  merchantId: z.string().min(1),
  derived_signals: MerchantDerivedSignalsSchema.optional(),
  segments: z.array(z.string()).default([]),
});

export const MerchantProfileSchema = z.object({
  merchantId: z.string(),
  derived_signals: MerchantDerivedSignalsSchema,
  segments: z.array(z.string()),
  updatedAt: z.date().optional(),
});

export type MerchantProfile = z.infer<typeof MerchantProfileSchema>;

// ── Finance Intelligence ─────────────────────────────────────────────────

export const FinancialSignalsSchema = z.object({
  creditScoreChecks: z.number().int().min(0).default(0),
  loanApplications: z.number().int().min(0).default(0),
  approvals: z.number().int().min(0).default(0),
  rejections: z.number().int().min(0).default(0),
  bnplUsage: z.number().int().min(0).default(0),
  avgScore: z.number().min(0).max(850).default(0),
});

export const UserFinancialProfileSchema = z.object({
  userId: z.string(),
  financialSignals: FinancialSignalsSchema,
  intentStrength: z.number().min(0).max(1),
  recommendedActions: z.array(z.string()),
});

export type UserFinancialProfile = z.infer<typeof UserFinancialProfileSchema>;

// ── Risk Assessment ──────────────────────────────────────────────────────

export const RiskAssessmentSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.string()),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// ── Credit Boost Suggestion ──────────────────────────────────────────────

export const CreditBoostSuggestionSchema = z.object({
  userId: z.string().min(1),
  boostType: z.enum(['engagement_bonus', 'loyalty_bonus', 'referral_bonus']),
  boostAmount: z.number().int().min(1).max(100),
  reason: z.string().min(1),
  source: z.string().min(1),
});

// ── Pagination ───────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

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

// ── Express Request Validation ────────────────────────────────────────────

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

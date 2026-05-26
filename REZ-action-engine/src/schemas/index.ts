/**
 * Zod Validation Schemas for rez-action-engine
 *
 * Validates action requests, approvals, and event submissions.
 * Built to match the types defined in src/types/action-levels.ts
 */

import { z } from 'zod';

// ── Action Enums ──────────────────────────────────────────────────────────

export const ActionLevelSchema = z.enum(['1', '2', '3', '4']);
export const ActionStatusSchema = z.enum(['pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'cancelled']);

// ── Action Request ─────────────────────────────────────────────────────────

export const ActionRequestSchema = z.object({
  actionId: z.string().min(1),
  eventId: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

// ── Action Result ─────────────────────────────────────────────────────────

export const ActionResultSchema = z.object({
  success: z.boolean(),
  actionId: z.string(),
  executionId: z.string().uuid(),
  status: ActionStatusSchema,
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  executedAt: z.date(),
  executionTimeMs: z.number().int().min(0).optional(),
});

export type ActionResult = z.infer<typeof ActionResultSchema>;

// ── Approval Request ──────────────────────────────────────────────────────

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  actionId: z.string().min(1),
  eventId: z.string().min(1),
  payload: z.record(z.unknown()),
  status: ActionStatusSchema,
  requestedAt: z.date(),
  requestedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().optional(),
  rejectedAt: z.date().optional(),
  rejectedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ── Approval Actions ──────────────────────────────────────────────────────

export const ApproveRequestSchema = z.object({
  approverId: z.string().optional(),
});

export const RejectRequestSchema = z.object({
  rejectorId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export const CancelRequestSchema = z.object({
  cancelledBy: z.string().optional(),
});

// ── Event Submission ──────────────────────────────────────────────────────

export const EventSubmissionSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  source: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EventSubmission = z.infer<typeof EventSubmissionSchema>;

// ── Action Notification ───────────────────────────────────────────────────

export const ActionNotificationSchema = z.object({
  type: z.string().min(1),
  notification: z.object({
    actionId: z.string().min(1),
    actionName: z.string().optional(),
    eventId: z.string().optional(),
    userId: z.string().optional(),
    success: z.boolean().optional(),
    error: z.string().optional(),
    executionId: z.string().optional(),
    executionTimeMs: z.number().optional(),
  }).optional(),
});

export type ActionNotification = z.infer<typeof ActionNotificationSchema>;

// ── Pagination ────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: ActionStatusSchema.optional(),
});

// ── Action Stats Query ───────────────────────────────────────────────────

export const ActionStatsQuerySchema = z.object({
  actionId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

// ── Trigger Revival Types ────────────────────────────────────────────────

export const TriggerTypeSchema = z.enum([
  'price_drop',
  'return_user',
  'seasonality',
  'offer_match',
  'manual',
  'inventory.low.reorder_suggestion',
  'inventory.critical.alert',
  'customer.order.ship_notification',
  'customer.abandoned_cart.reminder',
  'supplier.delivery.delay_notification',
  'finance.invoice.auto_generation',
  'dashboard.daily_report',
]);

// ── Validation Middleware Factory ────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: any } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: (result as any).error };
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (query: unknown): { success: true; data: T } | { success: false; errors: any } => {
    const result = schema.safeParse(query);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: (result as any).error };
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
        errors.push(`Body: ${(result as any).error.message}`);
      } else {
        req.body = result.data;
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        errors.push(`Query: ${(result as any).error.message}`);
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        errors.push(`Params: ${(result as any).error.message}`);
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

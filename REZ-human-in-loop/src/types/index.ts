import { z } from 'zod';

export const EscalationLevelSchema = z.enum(['info', 'warning', 'approval_required', 'block']);
export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;

export const EscalationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']);
export type EscalationStatus = z.infer<typeof EscalationStatusSchema>;

export const EscalationSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  agentId: z.string(),
  level: EscalationLevelSchema,
  title: z.string(),
  description: z.string(),
  context: z.record(z.unknown()).default({}),
  suggestedActions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    action: z.string(),
    params: z.record(z.unknown()).optional(),
  })).default([]),
  assignedTo: z.string().optional(),
  status: EscalationStatusSchema.default('pending'),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
  resolution: z.string().optional(),
});

export type Escalation = z.infer<typeof EscalationSchema>;

export const CreateEscalationSchema = z.object({
  caseId: z.string(),
  agentId: z.string(),
  level: EscalationLevelSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  context: z.record(z.unknown()).optional().default({}),
  suggestedActions: z.array(z.object({
    label: z.string(),
    action: z.string(),
    params: z.record(z.unknown()).optional(),
  })).optional().default([]),
  assignedTo: z.string().optional(),
  timeoutMinutes: z.number().int().positive().optional().default(30),
});

export type CreateEscalation = z.infer<typeof CreateEscalationSchema>;

export const ResolveEscalationSchema = z.object({
  resolvedBy: z.string(),
  resolution: z.string().min(1),
  action: z.enum(['approved', 'rejected']),
});

export type ResolveEscalation = z.infer<typeof ResolveEscalationSchema>;

export const EscalationQuerySchema = z.object({
  status: EscalationStatusSchema.optional(),
  level: EscalationLevelSchema.optional(),
  assignedTo: z.string().optional(),
  agentId: z.string().optional(),
  caseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type EscalationQuery = z.infer<typeof EscalationQuerySchema>;

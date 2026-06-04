import { z } from 'zod';

/**
 * Campaign status
 */
export enum CampaignStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Campaign type
 */
export enum CampaignType {
  ACQUISITION = 'acquisition',
  RETENTION = 'retention',
  REACTIVATION = 'reactivation',
  UPSELL = 'upsell',
  BRAND = 'brand',
  PROMOTIONAL = 'promotional'
}

/**
 * Campaign channel
 */
export enum CampaignChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  SOCIAL = 'social',
  REFERRAL = 'referral',
  AD = 'ad'
}

/**
 * Campaign priority
 */
export enum CampaignPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

/**
 * Approval status
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested'
}

/**
 * Approval action
 */
export enum ApprovalAction {
  CREATE = 'create',
  MODIFY = 'modify',
  DELETE = 'delete',
  PAUSE = 'pause',
  RESUME = 'resume',
  SCALE = 'scale',
  KILL = 'kill'
}

/**
 * Campaign content
 */
export const CampaignContentSchema = z.object({
  title: z.string().max(100),
  headline: z.string().max(200),
  body: z.string().max(1000),
  cta: z.object({
    text: z.string().max(30),
    action: z.string(),
    deepLink: z.string().optional()
  }),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  variants: z.array(z.object({
    id: z.string(),
    content: z.object({
      title: z.string().optional(),
      headline: z.string().optional(),
      body: z.string().optional(),
      imageUrl: z.string().optional()
    }),
    weight: z.number()
  })).optional()
});

export type CampaignContent = z.infer<typeof CampaignContentSchema>;

/**
 * Campaign targeting
 */
export const CampaignTargetingSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    criteria: z.record(z.any())
  })),
  excludeSegments: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).optional(),
  frequency: z.object({
    maxImpressions: z.number().optional(),
    minInterval: z.number().optional(),
    capping: z.object({
      daily: z.number().optional(),
      weekly: z.number().optional(),
      total: z.number().optional()
    }).optional()
  }).optional(),
  scheduling: z.object({
    timezone: z.string().default('Asia/Kolkata'),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    timeWindows: z.array(z.object({
      start: z.string(),
      end: z.string()
    })).optional()
  }).optional()
});

export type CampaignTargeting = z.infer<typeof CampaignTargetingSchema>;

/**
 * Campaign budget
 */
export const CampaignBudgetSchema = z.object({
  total: z.number().positive(),
  spent: z.number().min(0).default(0),
  currency: z.string().default('INR'),
  dailyLimit: z.number().positive().optional(),
  bidStrategy: z.enum(['cpc', 'cpm', 'cpa', 'fixed']).optional(),
  bidAmount: z.number().positive().optional()
});

export type CampaignBudget = z.infer<typeof CampaignBudgetSchema>;

/**
 * Campaign schedule
 */
export const CampaignScheduleSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
  duration: z.number().positive().optional(),
  timezone: z.string().default('Asia/Kolkata')
});

export type CampaignSchedule = z.infer<typeof CampaignScheduleSchema>;

/**
 * Campaign performance metrics
 */
export const CampaignMetricsSchema = z.object({
  impressions: z.number().default(0),
  reach: z.number().default(0),
  clicks: z.number().default(0),
  conversions: z.number().default(0),
  revenue: z.number().default(0),
  ctr: z.number().default(0),
  cvr: z.number().default(0),
  cpc: z.number().default(0),
  cpa: z.number().default(0),
  roas: z.number().default(0),
  engagementScore: z.number().default(0),
  audienceQuality: z.number().default(0)
});

export type CampaignMetrics = z.infer<typeof CampaignMetricsSchema>;

/**
 * Performance thresholds for auto-optimization
 */
export const PerformanceThresholdsSchema = z.object({
  minCtr: z.number().optional(),
  maxCpc: z.number().optional(),
  minCvr: z.number().optional(),
  maxCpa: z.number().optional(),
  minRoas: z.number().optional(),
  minEngagement: z.number().optional(),
  autoPauseEnabled: z.boolean().default(true),
  autoScaleEnabled: z.boolean().default(true),
  scaleThreshold: z.number().default(0.2),
  pauseThreshold: z.number().default(-0.3)
});

export type PerformanceThresholds = z.infer<typeof PerformanceThresholdsSchema>;

/**
 * Main campaign schema
 */
export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(CampaignType),
  channel: z.nativeEnum(CampaignChannel),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  priority: z.nativeEnum(CampaignPriority).default(CampaignPriority.NORMAL),
  experimentId: z.string().optional(),
  content: CampaignContentSchema,
  targeting: CampaignTargetingSchema,
  budget: CampaignBudgetSchema,
  schedule: CampaignScheduleSchema,
  metrics: CampaignMetricsSchema.default({}),
  performanceThresholds: PerformanceThresholdsSchema.default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  launchedAt: z.string().optional(),
  completedAt: z.string().optional(),
  owner: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type Campaign = z.infer<typeof CampaignSchema>;

/**
 * Approval request
 */
export const ApprovalRequestSchema = z.object({
  id: z.string(),
  entityType: z.enum(['experiment', 'campaign']),
  entityId: z.string(),
  action: z.nativeEnum(ApprovalAction),
  previousState: z.record(z.any()),
  proposedState: z.record(z.any()),
  status: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.PENDING),
  requestedBy: z.string(),
  requestedAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  comments: z.string().optional(),
  autoApproved: z.boolean().default(false),
  expiresAt: z.string().optional()
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

/**
 * Audit log entry
 */
export const AuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  entityType: z.enum(['experiment', 'campaign', 'approval']),
  entityId: z.string(),
  action: z.string(),
  performedBy: z.string(),
  actorType: z.enum(['system', 'ai', 'human']),
  previousState: z.record(z.any()).optional(),
  newState: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

/**
 * Create campaign request
 */
export const CreateCampaignRequestSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500),
  type: z.nativeEnum(CampaignType),
  channel: z.nativeEnum(CampaignChannel),
  experimentId: z.string().optional(),
  content: CampaignContentSchema,
  targeting: CampaignTargetingSchema,
  budget: z.object({
    total: z.number().positive(),
    currency: z.string().optional(),
    dailyLimit: z.number().positive().optional()
  }),
  schedule: CampaignScheduleSchema,
  priority: z.nativeEnum(CampaignPriority).optional(),
  owner: z.string(),
  tags: z.array(z.string()).optional(),
  autoApprove: z.boolean().default(false)
});

export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

/**
 * Campaign update request
 */
export const UpdateCampaignRequestSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  content: CampaignContentSchema.optional(),
  targeting: CampaignTargetingSchema.optional(),
  budget: CampaignBudgetSchema.partial().optional(),
  schedule: CampaignScheduleSchema.partial().optional(),
  priority: z.nativeEnum(CampaignPriority).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  performanceThresholds: PerformanceThresholdsSchema.partial().optional(),
  tags: z.array(z.string()).optional()
});

export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

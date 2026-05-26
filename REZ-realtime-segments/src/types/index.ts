import { z } from 'zod';

// Segment Rule Operators
export const SegmentOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'contains'
]);

export type SegmentOperator = z.infer<typeof SegmentOperatorSchema>;

// Segment Rule Schema
export const SegmentRuleSchema = z.object({
  field: z.string().min(1),
  operator: SegmentOperatorSchema,
  value: z.unknown(),
  logic: z.enum(['AND', 'OR']).optional().default('AND') as z.ZodDefault<z.ZodEnum<['AND', 'OR']>>
});

export type SegmentRule = z.infer<typeof SegmentRuleSchema>;

// Segment Definition Schema
export const SegmentDefinitionSchema = z.object({
  segmentId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  rules: z.array(SegmentRuleSchema).min(1),
  refreshInterval: z.number().min(1).default(60)
});

export type SegmentDefinition = z.infer<typeof SegmentDefinitionSchema>;

// User Data for Evaluation
export interface UserData {
  userId: string;
  lifetime: {
    totalSpend: number;
    totalOrders: number;
    avgOrderValue: number;
    tenureDays: number;
  };
  activity: {
    last30Days: {
      orders: number;
      visits: number;
    };
    engagement: {
      engagementIndex: number;
    };
  };
  signals: {
    competitor: {
      switchRisk: string;
      loyaltyScore: number;
    };
    behavioral: {
      cashbackSensitivity: number;
      dealSeeking: number;
      luxuryAffinity: number;
    };
    social: {
      influenceTier: string;
    };
    location: {
      segments: string[];
    };
  };
  [key: string]: unknown;
}

// Segment Evaluation Result
export interface SegmentEvaluationResult {
  segmentId: string;
  segmentName: string;
  userId: string;
  matches: boolean;
  evaluatedAt: string;
  evaluationTimeMs: number;
  matchedRules: string[];
  failedRules: string[];
}

// User Segment Membership
export interface UserSegmentMembership {
  userId: string;
  segmentId: string;
  segmentName: string;
  enteredAt: string;
  exitedAt: string | null;
  isActive: boolean;
}

// Segment Statistics
export interface SegmentStats {
  segmentId: string;
  segmentName: string;
  totalMembers: number;
  newMembersToday: number;
  churnedMembersToday: number;
  avgMembershipDuration: number;
  lastRefreshed: string;
}

// Webhook Event Types
export const SegmentEventTypeSchema = z.enum([
  'USER_ENTERED_SEGMENT',
  'USER_EXITED_SEGMENT'
]);

export type SegmentEventType = z.infer<typeof SegmentEventTypeSchema>;

// Webhook Event Payload
export interface SegmentEventPayload {
  eventType: SegmentEventType;
  userId: string;
  segmentId: string;
  segmentName: string;
  timestamp: string;
  previousMembership: boolean;
  currentMembership: boolean;
}

// Segment Evaluation Job
export interface SegmentEvaluationJob {
  jobId: string;
  segmentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  usersProcessed: number;
  usersMatched: number;
  error: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

// Cache Entry
export interface CachedEvaluation {
  userId: string;
  segmentId: string;
  result: SegmentEvaluationResult;
  cachedAt: string;
  expiresAt: string;
}

// Pre-defined Segment IDs
export const SEGMENT_IDS = {
  HIGH_SPENDER: 'high_spender',
  AT_RISK: 'at_risk',
  LOYAL_CUSTOMER: 'loyal_customer',
  POWER_USER: 'power_user',
  DISCOUNT_SENSITIVE: 'discount_sensitive',
  LUXURY_BUYER: 'luxury_buyer',
  INFLUENCER: 'influencer',
  NEW_CUSTOMER: 'new_customer',
  DORMANT: 'dormant',
  FREQUENT_VISITOR: 'frequent_visitor'
} as const;

export type SegmentId = typeof SEGMENT_IDS[keyof typeof SEGMENT_IDS];

import { z } from 'zod';
import { FraudPatternType } from '../config/patterns';
import { RiskLevel } from '../models/RiskProfile';

// Intent types for fraud-specific operations
export enum FraudIntent {
  ANALYZE_TRANSACTION = 'ANALYZE_TRANSACTION',
  CHECK_BLACKLIST = 'CHECK_BLACKLIST',
  ASSESS_RISK = 'ASSESS_RISK',
  CREATE_FRAUD_CASE = 'CREATE_FRAUD_CASE',
  UPDATE_CASE_STATUS = 'UPDATE_CASE_STATUS',
  GET_CASE_DETAILS = 'GET_CASE_DETAILS',
  LIST_FRAUD_CASES = 'LIST_FRAUD_CASES',
  GET_RISK_PROFILE = 'GET_RISK_PROFILE',
  UPDATE_RISK_PROFILE = 'UPDATE_RISK_PROFILE',
  ADD_TO_BLACKLIST = 'ADD_TO_BLACKLIST',
  REMOVE_FROM_BLACKLIST = 'REMOVE_FROM_BLACKLIST',
  GET_BLACKLIST_STATS = 'GET_BLACKLIST_STATS',
  GENERATE_ALERT = 'GENERATE_ALERT',
  ESCALATE_CASE = 'ESCALATE_CASE',
  MARK_FALSE_POSITIVE = 'MARK_FALSE_POSITIVE',
  RESOLVE_CASE = 'RESOLVE_CASE',
}

// Zod schemas for intent validation
export const AnalyzeTransactionSchema = z.object({
  transactionId: z.string().min(1),
  userId: z.string().optional(),
  accountId: z.string().optional(),
  orderId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchantCategory: z.string().optional(),
  merchantId: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  ipAddress: z.string().optional(),
  billingCountry: z.string().optional(),
  billingCity: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingCity: z.string().optional(),
  isNewPaymentMethod: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export const CheckBlacklistSchema = z.object({
  type: z.enum(['IP_ADDRESS', 'DEVICE_FINGERPRINT', 'EMAIL', 'PHONE', 'CARD_HASH', 'ACCOUNT', 'USER']),
  value: z.string().min(1),
});

export const CreateFraudCaseSchema = z.object({
  userId: z.string().optional(),
  accountId: z.string().optional(),
  transactionId: z.string().optional(),
  orderId: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  detectedPatterns: z.array(z.object({
    type: z.string(),
    name: z.string(),
    score: z.number().min(0).max(100),
    evidence: z.record(z.unknown()).optional(),
  })).optional(),
  riskFactors: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const UpdateCaseStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED', 'ESCALATED']),
  notes: z.string().optional(),
  reviewedBy: z.string().optional(),
});

export const AddToBlacklistSchema = z.object({
  type: z.enum(['IP_ADDRESS', 'DEVICE_FINGERPRINT', 'EMAIL', 'PHONE', 'CARD_HASH', 'ACCOUNT', 'USER']),
  value: z.string().min(1),
  reason: z.enum([
    'FRAUD_CONFIRMED', 'CHARGEBACK', 'REFUND_ABUSE', 'POLICY_VIOLATION',
    'VELOCITY_VIOLATION', 'CARD_TESTING', 'BOT_ACTIVITY', 'MANUAL_REVIEW',
    'ACCOUNT_TAKEOVER', 'TEST_ACCOUNT', 'OTHER'
  ]),
  severity: z.enum(['WARN', 'BLOCK', 'INVESTIGATE']).default('BLOCK'),
  userId: z.string().optional(),
  transactionId: z.string().optional(),
  isPermanent: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const RiskAssessmentSchema = z.object({
  userId: z.string().optional(),
  accountId: z.string().optional(),
  transactionId: z.string().optional(),
  amount: z.number().optional(),
  includeHistory: z.boolean().default(true),
});

// Intent handlers interface
export interface IntentHandler<TInput, TOutput> {
  handle(input: TInput): Promise<TOutput>;
  validate(input: unknown): TInput;
}

// Response types
export interface FraudAnalysisResponse {
  decision: 'ALLOW' | 'DENY' | 'CHALLENGE' | 'REVIEW';
  riskScore: number;
  riskLevel: RiskLevel;
  detectedPatterns: Array<{
    type: FraudPatternType;
    name: string;
    score: number;
    evidence: Record<string, unknown>;
  }>;
  riskFactors: string[];
  message: string;
  caseId?: string;
  requiresAction: boolean;
  processingTimeMs: number;
}

export interface FraudCaseResponse {
  caseId: string;
  status: string;
  severity: string;
  riskScore: number;
  detectedPatterns: Array<{
    type: string;
    name: string;
    score: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskProfileResponse {
  profileId: string;
  userId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  totalTransactions: number;
  fraudCaseCount: number;
  isKnownFraudster: boolean;
  accountStanding: string;
  lastRiskAssessmentAt?: Date;
}

export interface BlacklistResponse {
  entryId: string;
  type: string;
  value: string;
  reason: string;
  severity: string;
  isActive: boolean;
  addedAt: Date;
  expiresAt?: Date;
}

// Intent metadata for routing
export interface IntentMetadata {
  name: FraudIntent;
  description: string;
  requiresAuth: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export const INTENT_METADATA: Record<FraudIntent, IntentMetadata> = {
  [FraudIntent.ANALYZE_TRANSACTION]: {
    name: FraudIntent.ANALYZE_TRANSACTION,
    description: 'Analyze a transaction for fraud indicators',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.CHECK_BLACKLIST]: {
    name: FraudIntent.CHECK_BLACKLIST,
    description: 'Check if an entity is blacklisted',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 200 },
  },
  [FraudIntent.ASSESS_RISK]: {
    name: FraudIntent.ASSESS_RISK,
    description: 'Assess overall risk for a user or account',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.CREATE_FRAUD_CASE]: {
    name: FraudIntent.CREATE_FRAUD_CASE,
    description: 'Create a new fraud investigation case',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.UPDATE_CASE_STATUS]: {
    name: FraudIntent.UPDATE_CASE_STATUS,
    description: 'Update the status of a fraud case',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.GET_CASE_DETAILS]: {
    name: FraudIntent.GET_CASE_DETAILS,
    description: 'Get details of a specific fraud case',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.LIST_FRAUD_CASES]: {
    name: FraudIntent.LIST_FRAUD_CASES,
    description: 'List fraud cases with filters',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.GET_RISK_PROFILE]: {
    name: FraudIntent.GET_RISK_PROFILE,
    description: 'Get risk profile for a user',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.UPDATE_RISK_PROFILE]: {
    name: FraudIntent.UPDATE_RISK_PROFILE,
    description: 'Update user risk profile',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.ADD_TO_BLACKLIST]: {
    name: FraudIntent.ADD_TO_BLACKLIST,
    description: 'Add an entity to the blacklist',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.REMOVE_FROM_BLACKLIST]: {
    name: FraudIntent.REMOVE_FROM_BLACKLIST,
    description: 'Remove an entity from the blacklist',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.GET_BLACKLIST_STATS]: {
    name: FraudIntent.GET_BLACKLIST_STATS,
    description: 'Get blacklist statistics',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.GENERATE_ALERT]: {
    name: FraudIntent.GENERATE_ALERT,
    description: 'Generate a fraud alert',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  [FraudIntent.ESCALATE_CASE]: {
    name: FraudIntent.ESCALATE_CASE,
    description: 'Escalate a fraud case for review',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.MARK_FALSE_POSITIVE]: {
    name: FraudIntent.MARK_FALSE_POSITIVE,
    description: 'Mark a fraud case as false positive',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
  [FraudIntent.RESOLVE_CASE]: {
    name: FraudIntent.RESOLVE_CASE,
    description: 'Resolve a fraud case',
    requiresAuth: true,
    rateLimit: { windowMs: 60000, maxRequests: 50 },
  },
};

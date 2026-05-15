import { z } from 'zod';

// ============================================================
// Enums
// ============================================================

export const AIProvider = z.enum(['anthropic', 'openai', 'google', 'local']);
export type AIProvider = z.infer<typeof AIProvider>;

export const ModelTier = z.enum(['fast', 'balanced', 'powerful', 'max']);
export type ModelTier = z.infer<typeof ModelTier>;

export const RequestStatus = z.enum(['success', 'error', 'fallback']);
export type RequestStatus = z.infer<typeof RequestStatus>;

// ============================================================
// Request/Response Types
// ============================================================

export interface RouteOptions {
  userId?: string;
  prompt: string;
  systemPrompt?: string;
  tier?: ModelTier;
  preferredProvider?: AIProvider;
  fallback?: boolean;
  maxCost?: number;
  timeout?: number;
}

export interface ProviderResult {
  content: string;
  provider: AIProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  stopReason?: string;
}

export interface UsageSummary {
  provider: AIProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface AnalyticsSummary {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
}

export interface UsageAnalytics {
  summary: AnalyticsSummary;
  byProvider: Array<{ _id: string; count: number; cost: number }>;
  byModel: Array<{ _id: string; count: number; cost: number }>;
  topUsers: Array<{ _id: string; count: number; cost: number }>;
}

// ============================================================
// Cost Configuration
// ============================================================

export interface ModelCost {
  input: number;
  output: number;
}

export type ModelCosts = Record<string, ModelCost>;

// ============================================================
// Zod Schemas for Validation
// ============================================================

export const GenerateRequestSchema = z.object({
  userId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  systemPrompt: z.string().optional(),
  tier: ModelTier.default('balanced'),
  provider: AIProvider.optional(),
  fallback: z.boolean().default(true),
  maxCost: z.number().positive().optional(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const EstimateRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  tier: ModelTier.default('balanced'),
  provider: AIProvider.optional(),
});

export type EstimateRequest = z.infer<typeof EstimateRequestSchema>;

export const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  provider: AIProvider.optional(),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

// ============================================================
// Database Models (Mongoose)
// ============================================================

export interface IRequestLog {
  requestId: string;
  userId?: string;
  provider: string;
  model: string;
  tier: string;
  prompt: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latency: number;
  status: RequestStatus;
  error?: string;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  fallbackTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Express Request Extensions
// ============================================================

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

import { z } from 'zod';

/**
 * Confidence Score Types for REZ Agent OS v3
 */

// Weight configuration for scoring factors
export const CONFIDENCE_WEIGHTS = {
  intentMatch: 0.35,
  contextRelevance: 0.30,
  historyAccuracy: 0.25,
  loadFactor: 0.10,
} as const;

export type ConfidenceWeightKey = keyof typeof CONFIDENCE_WEIGHTS;

/**
 * Input for scoring request
 */
export const ScoringRequestSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  intent: z.string().min(1, 'Intent is required'),
  context: z.object({
    domain: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  taskComplexity: z.number().min(0).max(1).optional().default(0.5),
  requiredCapabilities: z.array(z.string()).optional(),
});

export type ScoringRequest = z.infer<typeof ScoringRequestSchema>;

/**
 * Individual score components
 */
export interface ScoreComponent {
  score: number;
  weight: number;
  weightedScore: number;
  details: {
    rawScore: number;
    factors: Record<string, number>;
    explanation: string;
  };
}

/**
 * Complete confidence score result
 */
export interface ConfidenceScoreResult {
  overallScore: number;
  agentId: string;
  intent: string;
  components: {
    intentMatch: ScoreComponent;
    contextRelevance: ScoreComponent;
    historyAccuracy: ScoreComponent;
    loadFactor: ScoreComponent;
  };
  timestamp: Date;
  metadata: {
    processingTimeMs: number;
    cacheHit: boolean;
    version: string;
  };
}

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAINING = 'draining',
  OVERLOADED = 'overloaded',
  MAINTENANCE = 'maintenance',
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  domains: string[];
  maxConcurrentTasks: number;
  specializations: string[];
  supportedLanguages: string[];
  version: string;
}

/**
 * Agent load metrics
 */
export interface AgentLoadMetrics {
  currentLoad: number;
  maxLoad: number;
  queueDepth: number;
  averageResponseTimeMs: number;
  successRate: number;
}

/**
 * Agent metrics stored in MongoDB
 */
export interface IAgentMetrics {
  agentId: string;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  loadMetrics: AgentLoadMetrics;
  performance: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    averageConfidenceScore: number;
    lastTaskTimestamp: Date | null;
  };
  intentAccuracy: Map<string, {
    attempts: number;
    successes: number;
    averageScore: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Confidence score document stored in MongoDB
 */
export interface IConfidenceScore {
  id: string;
  agentId: string;
  intent: string;
  overallScore: number;
  components: {
    intentMatch: number;
    contextRelevance: number;
    historyAccuracy: number;
    loadFactor: number;
  };
  context: {
    domain?: string;
    urgency?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  };
  taskComplexity: number;
  requiredCapabilities: string[];
  metadata: {
    processingTimeMs: number;
    cacheHit: boolean;
  };
  createdAt: Date;
}

/**
 * History entry for tracking agent performance
 */
export interface HistoryEntry {
  agentId: string;
  intent: string;
  domain: string;
  success: boolean;
  confidenceScore: number;
  responseTimeMs: number;
  timestamp: Date;
}

/**
 * Intent matching result
 */
export interface IntentMatchResult {
  score: number;
  matchedCapabilities: string[];
  unmatchedCapabilities: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
  explanation: string;
}

/**
 * Context analysis result
 */
export interface ContextAnalysisResult {
  score: number;
  relevanceFactors: {
    domainMatch: number;
    urgencyAdjustment: number;
    sessionContext: number;
  };
  explanation: string;
}

/**
 * History accuracy result
 */
export interface HistoryAccuracyResult {
  score: number;
  totalAttempts: number;
  successRate: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  explanation: string;
}

/**
 * Load factor result
 */
export interface LoadFactorResult {
  score: number;
  currentLoadPercentage: number;
  queueDepth: number;
  availableCapacity: number;
  recommendation: 'increase' | 'maintain' | 'decrease';
  explanation: string;
}

/**
 * API Error response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  dependencies: {
    mongodb: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}

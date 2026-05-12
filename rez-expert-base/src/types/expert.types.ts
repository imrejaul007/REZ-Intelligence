/**
 * Expert Types - Shared type definitions for expert agents
 */

export interface ExpertConfig {
  expertId: string;
  name: string;
  industry: string;
  version: string;
  description: string;
  tone: ExpertTone;
  expertiseLevel: ExpertiseLevel;
  capabilities: ExpertCapability[];
  knowledgeBase?: KnowledgeBaseConfig;
  modelConfig?: ModelConfig;
  workflowConfig?: WorkflowConfig;
  rateLimitConfig?: RateLimitConfig;
}

export type ExpertTone = 'professional' | 'friendly' | 'casual' | 'formal' | 'empathetic';

export type ExpertiseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ExpertCapability {
  domain: string;
  actions: string[];
  description: string;
  examples?: string[];
  confidenceRange: {
    min: number;
    max: number;
  };
}

export interface ExpertMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  averageConfidence: number;
  cacheHitRate: number;
  uptimeSeconds: number;
  lastRequestAt?: string;
  requestsByPriority: Record<string, number>;
  requestsByStatus: Record<string, number>;
}

export interface KnowledgeBaseConfig {
  enabled: boolean;
  provider: 'redis' | 'mongodb' | 'hybrid';
  cacheTtlSeconds: number;
  maxResults: number;
  similarityThreshold: number;
  namespace: string;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  modelName: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface WorkflowConfig {
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  name: string;
  handler: string;
  timeoutMs: number;
  required: boolean;
  fallback?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface ExpertHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    cache: boolean;
    model: boolean;
    dependencies: boolean;
  };
  latencyMs: number;
  uptimeSeconds: number;
}

export interface ExpertState {
  expertId: string;
  status: 'initializing' | 'ready' | 'processing' | 'error' | 'shutdown';
  currentRequests: number;
  lastError?: string;
  metrics: ExpertMetrics;
}

export interface ExpertEvent {
  type: 'request' | 'response' | 'error' | 'metrics' | 'health';
  expertId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ExpertQuery {
  expertId?: string;
  industry?: string;
  capability?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ExpertListResult {
  experts: ExpertConfig[];
  total: number;
  offset: number;
  limit: number;
}

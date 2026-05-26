/**
 * Tenant Types
 * Defines 3 client types with different intelligence sharing rules
 */

// Client Types
export enum ClientType {
  REZ_ECOSYSTEM = 'rez_ecosystem',
  NON_REZ = 'non_rez',
  RABTUL_SAAS = 'rabtul_saas'
}

// Intelligence sharing levels
export enum IntelligenceLevel {
  FULL = 'full',           // REZ ecosystem - complete sharing
  ANONYMIZED = 'anonymized', // External - anonymous patterns only
  ISOLATED = 'isolated'     // Rabtul SaaS - plugin-specific only
}

// Tenant Configuration
export interface TenantConfig {
  tenantId: string;
  clientType: ClientType;
  merchantId?: string;
  displayName: string;
  industry: string;
  knowledgeBaseId: string;
  intelligenceLevel: IntelligenceLevel;
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  features: {
    intentPrediction: boolean;
    recommendations: boolean;
    automatedResponses: boolean;
    analytics: boolean;
    multiLanguage: boolean;
  };
  privacy: {
    shareAnonymizedData: boolean;
    allowCrossTenantLearning: boolean;
    dataRetentionDays: number;
  };
}

// Knowledge Base Types
export interface KnowledgeBaseEntry {
  id: string;
  tenantId: string;
  category: 'faq' | 'policy' | 'product' | 'process' | 'custom';
  question?: string;
  answer?: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Tenant Context (request-scoped)
export interface TenantContext {
  tenantId: string;
  clientType: ClientType;
  merchantId?: string;
  knowledgeBaseId: string;
  intelligenceLevel: IntelligenceLevel;
  permissions: string[];
  dataIsolation: 'strict' | 'standard' | 'shared';
}

// API Response Types
export interface TenantResponse<T = unknown> {
  success: boolean;
  data?: T;
  tenant: {
    tenantId: string;
    clientType: ClientType;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Rate Limit Info
export interface RateLimitInfo {
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

// Tenant Statistics
export interface TenantStats {
  tenantId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  topIntents: Array<{ intent: string; count: number }>;
  activeUsers: number;
  lastActivity: Date;
}

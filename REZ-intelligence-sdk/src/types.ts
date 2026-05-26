/**
 * REZ Intelligence SDK - Enhanced Types
 *
 * Comprehensive type definitions for all REZ Intelligence services
 */

// ============================================
// CLIENT CONFIG
// ============================================

export interface IntelligenceClientConfig {
  /** Base URL for the API (default: http://localhost:4300) */
  baseUrl?: string;
  /** API key for tenant authentication */
  apiKey?: string;
  /** Internal token for service-to-service auth */
  internalToken?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retryAttempts?: number;
  /** Enable caching (default: true) */
  cacheEnabled?: boolean;
  /** Cache TTL in ms (default: 60000) */
  cacheTtl?: number;
}

// ============================================
// API RESPONSE
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ============================================
// CLIENT TYPES
// ============================================

export enum ClientType {
  /** Full intelligence sharing within REZ ecosystem */
  REZ_ECOSYSTEM = 'REZ_ECOSYSTEM',
  /** Strict tenant isolation for external partners */
  NON_REZ = 'NON_REZ',
  /** Plugin-based SaaS with subscription billing */
  RABTUL_SAAS = 'RABTUL_SAAS',
}

export enum IntelligenceLevel {
  /** Full AI capabilities, shared user graph */
  FULL = 'FULL',
  /** Isolated data, anonymized patterns */
  ISOLATED = 'ISOLATED',
  /** Only anonymized patterns shared */
  ANONYMIZED = 'ANONYMIZED',
}

export enum IntentCategory {
  COMMERCE = 'commerce',
  LIFESTYLE = 'lifestyle',
  FOOD = 'food',
  TRAVEL = 'travel',
  HEALTH = 'health',
  ENTERTAINMENT = 'entertainment',
  UTILITY = 'utility',
}

// ============================================
// TENANT CONTEXT
// ============================================

export interface TenantContext {
  tenantId: string;
  clientType: ClientType;
  knowledgeBaseId: string;
  intelligenceLevel: IntelligenceLevel;
  permissions: string[];
  dataIsolation: 'shared' | 'strict';
}

export interface TenantResponse {
  tenantId: string;
  clientType: ClientType;
  displayName: string;
  industry?: string;
  merchantId?: string;
  intelligenceLevel: IntelligenceLevel;
  dataIsolation: 'shared' | 'strict';
  permissions: string[];
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTenantRequest {
  clientType: ClientType;
  displayName: string;
  industry: string;
  merchantId?: string;
  intelligenceLevel?: IntelligenceLevel;
}

// ============================================
// PRIVACY
// ============================================

export interface PrivacyCheckRequest {
  targetTenantId: string;
}

export interface PrivacyCheckResponse {
  allowed: boolean;
  reason?: string;
  level: 'strict' | 'standard' | 'shared';
}

// ============================================
// USER PROFILE
// ============================================

export interface UserProfile {
  userId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  preferences?: UserPreferences;
  segments?: string[];
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue?: number;
  memberSince?: string;
  metadata?: Record<string, unknown>;
}

export interface UserPreferences {
  categories?: string[];
  cuisine?: string[];
  priceRange?: ('budget' | 'medium' | 'premium')[];
  brands?: string[];
  notificationPreferences?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  };
}

// ============================================
// INTENT
// ============================================

export interface IntentPredictRequest {
  userId: string;
  context?: IntentContext;
}

export interface IntentContext {
  location?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
  };
  time?: {
    hour: number;
    dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    isWeekend?: boolean;
  };
  device?: 'mobile' | 'desktop' | 'tablet';
  recentSearches?: string[];
  recentCategories?: string[];
}

export interface IntentPrediction {
  userId: string;
  primaryIntent: Intent;
  secondaryIntents: Intent[];
  contextFactors?: ContextFactor[];
  modelVersion?: string;
  processingTimeMs?: number;
}

export interface Intent {
  intent: string;
  confidence: number;
  category: IntentCategory;
  urgency?: 'low' | 'medium' | 'high';
  estimatedBudget?: {
    min: number;
    max: number;
  };
}

export interface ContextFactor {
  factor: string;
  influence: 'positive' | 'negative' | 'neutral';
  value: string;
}

export interface BatchIntentRequest {
  requests: IntentPredictRequest[];
}

// ============================================
// RECOMMENDATIONS
// ============================================

export interface RecommendationRequest {
  userId: string;
  limit?: number;
  categories?: string[];
  exclude?: string[];
  context?: {
    lat?: number;
    lng?: number;
  };
}

export interface Recommendation {
  id: string;
  type: 'product' | 'restaurant' | 'service' | 'content' | 'offer';
  name: string;
  description?: string;
  imageUrl?: string;
  score: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// ML PREDICTIONS
// ============================================

export interface ChurnPredictRequest {
  userId: string;
  lookbackDays?: number;
}

export interface ChurnPrediction {
  userId: string;
  churnRisk: {
    probability: number;
    level: 'low' | 'medium' | 'high';
    factors?: PredictionFactor[];
  };
  recommendedActions?: {
    action: string;
    priority: 'low' | 'medium' | 'high';
    expectedLift?: number;
  }[];
  modelVersion?: string;
}

export interface LTVPredictRequest {
  userId: string;
  predictionMonths?: number;
}

export interface LTVPrediction {
  userId: string;
  ltv: number;
  confidence: number;
  breakdown?: {
    historical: number;
    predicted: number;
  };
  modelVersion?: string;
}

export interface PredictionFactor {
  name: string;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
}

// ============================================
// WORKFLOWS
// ============================================

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  entryNodeId?: string;
  nodeCount?: number;
  executionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkflowList {
  workflows: Workflow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  entryNodeId?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  config: {
    actionType?: string;
    params?: Record<string, unknown>;
  };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  progress?: number;
  currentNode?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface CreateExecutionRequest {
  workflowId: string;
  trigger?: {
    type: 'manual' | 'event' | 'webhook' | 'scheduled';
    source?: string;
  };
  variables?: Record<string, unknown>;
}

// ============================================
// TIMELINE
// ============================================

export interface TimelineEvent {
  userId: string;
  eventType: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ============================================
// KNOWLEDGE GRAPH
// ============================================

export interface KnowledgeEntry {
  id?: string;
  type: string;
  name: string;
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
}

// ============================================
// EVENTS
// ============================================

export interface TrackEventRequest {
  event: string;
  userId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

// ============================================
// HEALTH
// ============================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version?: string;
  timestamp: string;
}

// ============================================
// LEGACY TYPES (for backward compatibility)
// ============================================

export interface UserPrediction {
  type: string;
  prediction: unknown;
  confidence: number;
  timeframe: { start: string; end: string };
  factors: PredictionFactor[];
}

export interface UserSegment {
  id: string;
  name: string;
  type: 'behavioral' | 'demographic' | 'RFM' | 'lifecycle' | 'custom';
  criteria?: Record<string, unknown>;
  size?: number;
}

export interface Sequence {
  id: string;
  entityId: string;
  entityType: 'user' | 'merchant' | 'product';
  events: { eventType: string; timestamp: string }[];
  patterns?: TemporalPattern[];
}

export interface TemporalPattern {
  id: string;
  type: 'recurring' | 'seasonal' | 'trend' | 'cyclical' | 'habit';
  name: string;
  confidence: number;
  frequency?: string;
  nextExpected?: string;
}

export interface Habit {
  id: string;
  name: string;
  type: 'purchase' | 'browsing' | 'engagement' | 'location' | 'time';
  confidence: number;
  frequency?: string;
  streak?: number;
  nextExpected?: string;
}

export interface BehavioralTransition {
  fromState: string;
  toState: string;
  probability: number;
  estimatedDate?: string;
  factors: { name: string; contribution: number; direction: 'positive' | 'negative' | 'neutral' }[];
}

export interface SignalAggregation {
  signals: {
    type: string;
    value: number;
    direction: 'up' | 'down' | 'stable';
    confidence: number;
  }[];
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  triggers: string[];
  recommendations: string[];
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance: number;
  rating?: number;
  priceLevel?: number;
}

export interface PredictionExplanation {
  predictionId: string;
  predictionType: string;
  explanation: string;
  factors: { name: string; importance: number; direction: 'positive' | 'negative' }[];
  confidence: number;
}

export interface DecisionResult {
  recommendedOption?: string;
  ranking: { optionId: string; score: number }[];
  confidence: number;
  reasoning: string;
}

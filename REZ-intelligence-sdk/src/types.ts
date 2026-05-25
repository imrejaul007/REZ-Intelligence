/**
 * REZ Intelligence SDK - Types
 *
 * Unified TypeScript client for all REZ Intelligence services
 */

// ============================================
// CLIENT TYPES
// ============================================

export interface IntelligenceClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
}

export interface ServiceEndpoint {
  name: string;
  url: string;
  methods: string[];
}

// ============================================
// UNIFIED RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: Date;
  duration: number;
  cached?: boolean;
}

// ============================================
// USER INTELLIGENCE
// ============================================

export interface UserProfile {
  id: string;
  demographics?: {
    age?: number;
    gender?: string;
    location?: string;
    income?: string;
  };
  preferences?: {
    categories?: string[];
    brands?: string[];
    priceRange?: { min: number; max: number };
  };
  engagement?: {
    level: 'dormant' | 'low' | 'medium' | 'high' | 'super';
    score: number;
    tenure: number;
    lastActive: Date;
  };
  lifecycle?: {
    stage: LifecycleStage;
    healthScore: number;
    riskFactors?: string[];
  };
}

export type LifecycleStage =
  | 'acquisition'
  | 'onboarding'
  | 'activation'
  | 'engagement'
  | 'retention'
  | 'churn_risk'
  | 'churned'
  | 'reactivation'
  | 'advocacy';

export interface UserPrediction {
  type: PredictionType;
  prediction: unknown;
  confidence: number;
  timeframe: { start: Date; end: Date };
  factors: PredictionFactor[];
}

export type PredictionType =
  | 'churn_risk'
  | 'ltv'
  | 'next_purchase'
  | 'product_interest'
  | 'engagement_dip'
  | 'upgrade_probability';

export interface PredictionFactor {
  name: string;
  importance: number;
  value: unknown;
}

export interface UserSegment {
  id: string;
  name: string;
  type: SegmentType;
  criteria: SegmentCriteria;
  size: number;
}

export type SegmentType =
  | 'behavioral'
  | 'demographic'
  | 'RFM'
  | 'lifecycle'
  | 'custom';

export interface SegmentCriteria {
  field: string;
  operator: string;
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
  conditions?: SegmentCriteria[];
}

// ============================================
// INTENT & RECOMMENDATIONS
// ============================================

export interface IntentPrediction {
  intent: string;
  confidence: number;
  alternatives: {
    intent: string;
    confidence: number;
  }[];
  context?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  item: RecommendationItem;
  score: number;
  reasons: string[];
}

export type RecommendationType =
  | 'product'
  | 'content'
  | 'merchant'
  | 'offer'
  | 'action';

export interface RecommendationItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// TEMPORAL INTELLIGENCE
// ============================================

export interface Sequence {
  id: string;
  entityId: string;
  entityType: 'user' | 'merchant' | 'product';
  events: SequenceEvent[];
  patterns?: TemporalPattern[];
}

export interface SequenceEvent {
  eventType: string;
  timestamp: Date;
  properties?: Record<string, unknown>;
}

export interface TemporalPattern {
  id: string;
  type: PatternType;
  name: string;
  confidence: number;
  frequency: string;
  nextExpected?: Date;
}

export type PatternType =
  | 'recurring'
  | 'seasonal'
  | 'trend'
  | 'cyclical'
  | 'habit';

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  confidence: number;
  frequency: string;
  regularity: number;
  streak: number;
  nextExpected: Date;
}

export type HabitType =
  | 'purchase'
  | 'browsing'
  | 'engagement'
  | 'location'
  | 'time';

export interface BehavioralTransition {
  fromState: string;
  toState: string;
  probability: number;
  estimatedDate?: Date;
  factors: TransitionFactor[];
}

export interface TransitionFactor {
  name: string;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
}

// ============================================
// CONTEXT & SIGNALS
// ============================================

export interface UserContext {
  userId: string;
  sessionId: string;
  location?: {
    lat: number;
    lng: number;
    city?: string;
  };
  time: {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
  };
  device?: {
    type: string;
    os: string;
    browser?: string;
  };
  referringChannel?: string;
  previousIntents?: string[];
}

export interface BehavioralSignal {
  type: SignalType;
  value: number;
  direction: 'up' | 'down' | 'stable';
  confidence: number;
  timestamp: Date;
}

export type SignalType =
  | 'engagement'
  | 'satisfaction'
  | 'frustration'
  | 'churn_risk'
  | 'upsell_ready'
  | 'defection_risk';

export interface SignalAggregation {
  signals: BehavioralSignal[];
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  triggers: string[];
  recommendations: string[];
}

// ============================================
// LOCATION INTELLIGENCE
// ============================================

export interface LocationContext {
  currentLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    source?: string;
  };
  homeLocation?: {
    lat: number;
    lng: number;
    city?: string;
  };
  workLocation?: {
    lat: number;
    lng: number;
    city?: string;
  };
  frequentLocations: FrequentLocation[];
}

export interface FrequentLocation {
  name: string;
  category: string;
  lat: number;
  lng: number;
  visitFrequency: number;
  avgDwellTime: number;
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

export interface LocationPrediction {
  type: 'next_location' | 'visit_probability' | 'crowd_level';
  prediction: {
    location?: { lat: number; lng: number };
    probability?: number;
    crowdLevel?: 'low' | 'medium' | 'high';
  };
  confidence: number;
  timeframe: { start: Date; end: Date };
}

// ============================================
// EXPLAINABILITY
// ============================================

export interface PredictionExplanation {
  predictionId: string;
  predictionType: string;
  originalPrediction: unknown;
  explanation: string;
  factors: ExplanationFactor[];
  confidence: number;
  counterfactuals?: Counterfactual[];
  generatedAt: Date;
}

export interface ExplanationFactor {
  name: string;
  importance: number;
  value: unknown;
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface Counterfactual {
  condition: string;
  originalValue: unknown;
  hypotheticalValue: unknown;
  predictedChange: unknown;
  feasibility: 'easy' | 'moderate' | 'difficult';
}

// ============================================
// DECISION SUPPORT
// ============================================

export interface DecisionRequest {
  context: Record<string, unknown>;
  options: DecisionOption[];
  criteria: DecisionCriteria[];
}

export interface DecisionOption {
  id: string;
  name: string;
  description?: string;
  attributes: Record<string, unknown>;
}

export interface DecisionCriteria {
  name: string;
  weight: number;
  type: 'benefit' | 'cost';
  metric: string;
}

export interface DecisionResult {
  recommendedOption?: string;
  ranking: {
    optionId: string;
    score: number;
    factors: { criterion: string; score: number }[];
  }[];
  confidence: number;
  reasoning: string;
}

// ============================================
// CAMPAIGN & OFFERS
// ============================================

export interface CampaignTargeting {
  segmentIds?: string[];
  criteria?: SegmentCriteria[];
  exclusions?: string[];
  budget?: {
    total: number;
    perUser?: number;
  };
  constraints?: {
    maxPerUser?: number;
    minUserAge?: number;
    locationFilter?: string[];
  };
}

export interface OfferOptimization {
  offerType: 'discount' | 'cashback' | 'points' | 'freebie' | 'bundle';
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    minPurchase?: number;
    maxDiscount?: number;
  };
  targetMetrics: {
    primary: string;
    secondary?: string;
    constraints?: Record<string, number>;
  };
  estimatedImpact?: {
    conversionLift: number;
    revenueImpact: number;
    roi: number;
  };
}

// ============================================
// ANALYTICS
// ============================================

export interface UserAnalytics {
  userId: string;
  period: { start: Date; end: Date };
  engagement: {
    sessions: number;
    avgSessionDuration: number;
    pageViews: number;
    actions: number;
  };
  revenue: {
    total: number;
    avgOrderValue: number;
    orders: number;
  };
  conversion: {
    rate: number;
    funnelSteps: { step: string; count: number; dropoff: number }[];
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
    ltv: number;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

export type ServiceName =
  | 'intent'
  | 'predictive'
  | 'signal'
  | 'temporal'
  | 'explainability'
  | 'hyperlocal'
  | 'recommendation'
  | 'segmentation'
  | 'campaign'
  | 'decision';

export interface ServiceHealth {
  name: ServiceName;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  uptime: number;
  lastChecked: Date;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
}

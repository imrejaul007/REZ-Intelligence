// Core Types for REZ Predictive Engine

export type PredictionType = 'churn' | 'ltv' | 'revisit' | 'conversion';
export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type PredictionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Prediction factor showing what influenced the prediction
 */
export interface Factor {
  name: string;
  impact: number; // Positive or negative influence (-1 to 1)
  value: string | number;
  description?: string;
}

/**
 * Base prediction interface
 */
export interface Prediction {
  userId: string;
  type: PredictionType;
  score: number; // 0-100
  probability: number; // 0-1
  confidence: number; // 0-1
  factors: Factor[];
  recommendation: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Churn prediction result
 */
export interface ChurnPredictionResult {
  risk: ChurnRisk;
  daysUntilChurn: number;
  topFactors: string[];
  retentionOffers: string[];
}

/**
 * Churn prediction with full details
 */
export interface ChurnPrediction extends Prediction {
  type: 'churn';
  result: ChurnPredictionResult;
}

/**
 * LTV prediction result
 */
export interface LTVPredictionResult {
  predictedLTV30: number;
  predictedLTV90: number;
  predictedLTV365: number;
  tier: CustomerTier;
  confidence: number;
  monthlyValue: number;
  retentionRate: number;
}

/**
 * LTV prediction with full details
 */
export interface LTVPrediction extends Prediction {
  type: 'ltv';
  result: LTVPredictionResult;
}

/**
 * Revisit prediction result
 */
export interface RevisitPredictionResult {
  daysUntilNextVisit: number;
  predictedVisitDate: Date;
  visitProbability: number;
  optimalEngagementWindow: {
    start: Date;
    end: Date;
  };
  suggestedActions: string[];
}

/**
 * Revisit prediction with full details
 */
export interface RevisitPrediction extends Prediction {
  type: 'revisit';
  result: RevisitPredictionResult;
}

/**
 * Conversion prediction result
 */
export interface ConversionPredictionResult {
  conversionProbability: number;
  predictedConversionDate?: Date;
  funnelStage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'purchase';
  barriers: string[];
  incentives: string[];
  timeToConversion?: number; // days
}

/**
 * Conversion prediction with full details
 */
export interface ConversionPrediction extends Prediction {
  type: 'conversion';
  result: ConversionPredictionResult;
}

/**
 * Union type for all predictions
 */
export type AnyPrediction = ChurnPrediction | LTVPrediction | RevisitPrediction | ConversionPrediction;

/**
 * User profile for predictions
 */
export interface UserProfile {
  userId: string;
  email?: string;
  phone?: string;
  firstOrderDate?: Date;
  lastOrderDate?: Date;
  totalOrders: number;
  avgOrderValue: number;
  ordersPerMonth: number;
  totalSpend: number;
  preferredCategories: string[];
  preferredPaymentMethods: string[];
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  referralSource?: string;
  tags: string[];
  engagementScore: number; // 0-100
  loginFrequency: number; // logins per week
  lastLoginDate?: Date;
  cartAbandonmentRate?: number; // 0-1
  emailOpenRate?: number; // 0-1
  pushNotificationClickRate?: number; // 0-1
  loyaltyPoints?: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  accountAge: number; // days
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Batch prediction request
 */
export interface BatchPredictionRequest {
  userIds: string[];
  types: PredictionType[];
  options?: {
    useCache?: boolean;
    forceRefresh?: boolean;
  };
}

/**
 * Batch prediction response
 */
export interface BatchPredictionResponse {
  jobId: string;
  status: PredictionStatus;
  totalRequested: number;
  completed: number;
  failed: number;
  results?: AnyPrediction[];
  errors?: Array<{ userId: string; error: string }>;
  estimatedCompletionTime?: Date;
}

/**
 * At-risk segment
 */
export interface AtRiskSegment {
  riskLevel: ChurnRisk;
  count: number;
  users: Array<{
    userId: string;
    score: number;
    primaryReason: string;
    recommendedAction: string;
  }>;
  totalPotentialRevenueAtRisk: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
  requestId: string;
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    cache?: boolean;
  };
  timestamp: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Segment filter options
 */
export interface SegmentFilter {
  riskLevels?: ChurnRisk[];
  minScore?: number;
  maxScore?: number;
  minLastOrderDays?: number;
  maxLastOrderDays?: number;
  tiers?: CustomerTier[];
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Retention offer templates
 */
export interface RetentionOffer {
  type: 'discount' | 'free_delivery' | 'loyalty_points' | 'cashback' | 'gift';
  value: number;
  title: string;
  description: string;
  minOrderValue?: number;
  validDays: number;
}

/**
 * Prediction model training data
 */
export interface TrainingDataPoint {
  features: {
    recency: number;
    frequency: number;
    monetary: number;
    engagementScore: number;
    accountAge: number;
    emailOpenRate: number;
    cartAbandonmentRate: number;
  };
  label: number; // 0 or 1 for churn
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
  totalPredictions: number;
  predictionsByType: Record<PredictionType, number>;
  averageConfidence: number;
  predictionsLast24h: number;
  errorRate: number;
  averageLatencyMs: number;
}

/**
 * REZ Explainability Engine - Type Definitions
 *
 * Central type definitions for all explainability components
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// CORE EXPLANATION TYPES
// ============================================

export interface ExplanationFactor {
  name: string;
  value: number;
  impact: number; // Percentage impact on prediction
  importance: number; // Feature importance score (0-1)
  percentage: number; // Contribution percentage
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
  shapValue?: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface Explanation {
  predictionId: string;
  modelType: string;
  originalPrediction: number;
  predictionLabel: string;
  confidence: number;
  factors: ExplanationFactor[];
  reasoning: string;
  naturalLanguageExplanation: string;
  counterfactuals: Counterfactual[];
  featureImportance: FeatureImportance[];
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
  generatedAt: Date;
}

export interface Counterfactual {
  id: string;
  condition: string;
  currentValue: number;
  alternativeValue: number;
  impactOnPrediction: number;
  impactPercentage: number;
  description: string;
  actionability: 'easy' | 'moderate' | 'hard';
  effort: string;
  expectedOutcome: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  shapValue: number;
  shapConfidence: {
    lower: number;
    upper: number;
  };
  percentage: number;
  rank: number;
}

export interface DecisionRule {
  id: string;
  rule: string;
  antecedent: string; // IF condition
  consequent: string; // THEN outcome
  confidence: number;
  support: number;
  lift: number;
  coverage: number;
  modelType: ModelType;
  generatedAt: Date;
  examples: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
}

export interface NarrativeExplanation {
  id: string;
  predictionId: string;
  summary: string;
  sections: NarrativeSection[];
  keyInsight: string;
  actionableRecommendation: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  generatedAt: Date;
}

export interface NarrativeSection {
  title: string;
  content: string;
  type: 'background' | 'analysis' | 'comparison' | 'recommendation';
  dataPoints?: { label: string; value: string; trend?: 'up' | 'down' | 'stable' }[];
}

// ============================================
// MODEL TYPES
// ============================================

export type ModelType =
  | 'churn_predictor'
  | 'ltv_predictor'
  | 'revisit_predictor'
  | 'conversion_predictor'
  | 'recommendation_engine'
  | 'price_predictor'
  | 'demand_forecast'
  | 'fraud_detector'
  | 'segmentation'
  | 'propensity_scorer';

export interface PredictionContext {
  userId?: string;
  merchantId?: string;
  orderId?: string;
  sessionId?: string;
  features: Record<string, number>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ExplanationRequest {
  modelType: ModelType;
  predictionId: string;
  prediction: number;
  features: Record<string, number>;
  context?: Partial<PredictionContext>;
  options?: ExplanationOptions;
}

export interface ExplanationOptions {
  includeCounterfactuals?: boolean;
  includeFeatureImportance?: boolean;
  includeConfidenceInterval?: boolean;
  includeNarrative?: boolean;
  maxFactors?: number;
  maxCounterfactuals?: number;
  samplingIterations?: number;
  confidenceLevel?: number; // For SHAP confidence intervals
}

export interface ExplanationResponse {
  success: boolean;
  explanation?: Explanation;
  error?: string;
  cached?: boolean;
  processingTimeMs?: number;
}

// ============================================
// SHAP TYPES
// ============================================

export interface SHAPResult {
  feature: string;
  shapValue: number;
  expectedValue: number;
  contribution: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  interactionEffects?: {
    feature: string;
    interactionValue: number;
  }[];
}

export interface SHAPConfiguration {
  samplingMethod: 'monte_carlo' | 'permutation' | 'kernel' | 'tree';
  nSamples: number;
  maxFeatures: number;
  randomSeed: number;
  computeInteractions: boolean;
}

export interface SHAPBackgroundData {
  samples: Record<string, number>[];
  aggregations: {
    mean: Record<string, number>;
    std: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
  };
}

// ============================================
// COUNTERFACTUAL TYPES
// ============================================

export interface CounterfactualRequest {
  predictionId: string;
  modelType: ModelType;
  features: Record<string, number>;
  prediction: number;
  targetPrediction?: number; // What we want to achieve
  constraints?: CounterfactualConstraints;
}

export interface CounterfactualConstraints {
  maxChanges: number;
  allowedFeatures?: string[]; // Which features can be changed
  disallowedFeatures?: string[]; // Which features cannot be changed
  valueRanges?: Record<string, { min: number; max: number }>;
  costWeights?: Record<string, number>; // Cost of changing each feature
}

export interface CounterfactualResult {
  id: string;
  originalPrediction: number;
  targetPrediction?: number;
  counterfactuals: Counterfactual[];
  nearestDesiredOutcome: Counterfactual | null;
  summary: string;
  feasibilityScore: number;
  generatedAt: Date;
}

// ============================================
// RULE EXTRACTION TYPES
// ============================================

export interface RuleExtractionRequest {
  modelType: ModelType;
  dataset: RuleExtractionDataPoint[];
  options?: RuleExtractionOptions;
}

export interface RuleExtractionDataPoint {
  features: Record<string, number>;
  prediction: number;
  actualOutcome?: number;
  weight?: number;
}

export interface RuleExtractionOptions {
  minSupport: number;
  minConfidence: number;
  maxDepth: number;
  algorithm: 'decision_tree' | 'association_rules' | 'sequential_covering';
  featureNames?: Record<string, string>;
}

export interface RuleExtractionResult {
  rules: DecisionRule[];
  modelInfo: {
    totalDataPoints: number;
    featuresUsed: string[];
    coverage: number;
    averageConfidence: number;
  };
  generatedAt: Date;
  processingTimeMs: number;
}

// ============================================
// NARRATIVE GENERATION TYPES
// ============================================

export interface NarrativeGenerationRequest {
  predictionId: string;
  modelType: ModelType;
  features: Record<string, number>;
  prediction: number;
  factors: ExplanationFactor[];
  counterfactuals?: Counterfactual[];
  context?: PredictionContext;
  audience?: 'technical' | 'business' | 'end_user';
  tone?: 'formal' | 'friendly' | 'urgent';
}

export interface NarrativeGenerationResult {
  narrative: NarrativeExplanation;
  alternativeFormats: {
    email: string;
    sms: string;
    push: string;
  };
  generatedAt: Date;
}

// ============================================
// AUDIT TYPES
// ============================================

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  modelType: ModelType;
  predictionId: string;
  explanationId: string;
  request: Partial<ExplanationRequest>;
  response: Explanation | null;
  latencyMs: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  modelType?: ModelType;
  action?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// TRUST & COMPLIANCE TYPES
// ============================================

export interface TrustScore {
  entityId: string;
  entityType: 'user' | 'merchant' | 'campaign';
  overallScore: number; // 0-100
  factors: {
    transparency: number;
    consistency: number;
    accuracy: number;
    fairness: number;
  };
  lastUpdated: Date;
  history?: {
    date: Date;
    score: number;
  }[];
}

export interface ComplianceReport {
  id: string;
  reportType: 'gdpr' | 'audit' | 'regulatory';
  period: {
    start: Date;
    end: Date;
  };
  modelExplanations: number;
  auditEntries: number;
  averageLatency: number;
  cacheHitRate: number;
  coverage: {
    users: number;
    predictions: number;
    models: number;
  };
  generatedAt: Date;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IExplanation extends Document {
  predictionId: { type: String; required: true; unique: true; index: true };
  modelType: { type: String; required: true; enum: ModelType };
  originalPrediction: number;
  predictionLabel: String;
  confidence: number;
  factors: ExplanationFactor[];
  reasoning: String;
  naturalLanguageExplanation: String;
  counterfactuals: Counterfactual[];
  featureImportance: FeatureImportance[];
  confidenceInterval?: { lower: number; upper: number };
  context: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditEntry extends Document {
  id: { type: String; required: true; unique: true; index: true };
  timestamp: { type: Date; default: Date; index: true };
  userId?: String;
  action: String;
  modelType: String;
  predictionId: String;
  explanationId: String;
  request: mongoose.Schema.Types.Mixed;
  response?: mongoose.Schema.Types.Mixed;
  latencyMs: Number;
  userAgent?: String;
  ipAddress?: String;
}

export interface ICounterfactual extends Document {
  decisionId: { type: String; required: true; index: true };
  originalFeatures: mongoose.Schema.Types.Mixed;
  originalPrediction: Number;
  counterfactualFeatures: mongoose.Schema.Types.Mixed;
  alternativePrediction: Number;
  changes: mongoose.Schema.Types.Mixed;
  impact: Number;
  feasibilityScore: Number;
  createdAt: Date;
}

export interface IRule extends Document {
  ruleId: { type: String; required: true; unique: true; index: true };
  modelType: { type: String; required: true; enum: ModelType };
  antecedent: String;
  consequent: String;
  confidence: Number;
  support: Number;
  lift: Number;
  coverage: Number;
  examples: mongoose.Schema.Types.Mixed;
  generatedAt: Date;
}

// ============================================
// SERVICE RESPONSE TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  cache: {
    size: number;
    hitRate: number;
  };
  models: {
    [key in ModelType]?: {
      explanations: number;
      avgLatency: number;
    };
  };
}

// ============================================
// COEFFICIENT LIBRARY
// ============================================

export interface ModelCoefficients {
  modelType: ModelType;
  coefficients: Record<string, number>;
  intercept: number;
  featureDescriptions: Record<string, string>;
  exampleValues: Record<string, { min: number; max: number; typical: number }>;
  featureDomains: Record<string, 'numeric' | 'categorical' | 'binary'>;
}

// Default feature descriptions for common models
export const DEFAULT_FEATURE_DESCRIPTIONS: Record<string, string> = {
  // User features
  days_since_last_order: 'Number of days since last order',
  order_frequency: 'Average orders per month',
  avg_order_value: 'Average order value in rupees',
  total_orders: 'Total number of orders',
  session_frequency: 'App session frequency per week',
  time_on_app: 'Average time spent on app per session',

  // Behavioral features
  cart_abandonment_rate: 'Rate of cart abandonment',
  wishlist_usage: 'Frequency of wishlist usage',
  search_frequency: 'Frequency of product searches',
  review_submission: 'Rate of review submissions',

  // Engagement features
  push_notification_open_rate: 'Rate of opening push notifications',
  email_open_rate: 'Email open rate',
  referral_count: 'Number of successful referrals',
  loyalty_tier: 'Current loyalty tier (0-4)',

  // Merchant features
  merchant_rating: 'Average merchant rating',
  merchant_review_count: 'Number of merchant reviews',
  delivery_time_avg: 'Average delivery time in minutes',
  order_accuracy: 'Rate of accurate orders',

  // Product features
  product_rating: 'Average product rating',
  product_views: 'Number of product page views',
  add_to_cart_rate: 'Rate of adding to cart after view',
  purchase_after_view_rate: 'Rate of purchase after viewing',

  // Contextual features
  is_weekend: 'Whether order is on weekend (0/1)',
  is_holiday: 'Whether order is on holiday (0/1)',
  time_of_day: 'Hour of day (0-23)',
  day_of_week: 'Day of week (0-6)',
  season: 'Current season (0-3)',

  // Demographic features
  user_age_group: 'Age group (0-5)',
  user_city_tier: 'City tier (1-3)',
  device_type: 'Device type (0-2)',

  // Economic features
  disposable_income_index: 'Disposable income index',
  spending_power_tier: 'Spending power tier (0-4)',
  price_sensitivity: 'Price sensitivity score',

  // Loyalty features
  points_balance: 'Current loyalty points balance',
  points_redeemed_ratio: 'Ratio of points redeemed',
  tier_progress_percent: 'Progress to next tier percentage',

  // Churn-specific features
  inactivity_days: 'Days since last activity',
  engagement_score: 'Overall engagement score',
  support_ticket_count: 'Number of support tickets',
  complaint_count: 'Number of complaints',

  // Fraud-specific features
  order_velocity: 'Rate of orders per hour',
  new_address_ratio: 'Ratio of new delivery addresses',
  device_fingerprint_mismatch: 'Device fingerprint mismatch indicator',
  unusual_time_pattern: 'Unusual ordering time pattern',
  payment_method_risk: 'Payment method risk score',

  // LTV-specific features
  customer_age_days: 'Customer account age in days',
  first_purchase_gap: 'Days between signup and first purchase',
  cross_category_purchases: 'Number of categories purchased',

  // Demand features
  historical_demand: 'Historical demand baseline',
  competitor_availability: 'Competitor stock availability',
  weather_index: 'Weather impact on demand',
};

export const MODEL_COEFFICIENTS: Record<ModelType, ModelCoefficients> = {
  churn_predictor: {
    modelType: 'churn_predictor',
    coefficients: {
      inactivity_days: 0.35,
      engagement_score: -0.25,
      order_frequency: -0.20,
      avg_order_value: -0.15,
      push_notification_open_rate: -0.10,
      support_ticket_count: 0.15,
      complaint_count: 0.10,
      points_balance: -0.05,
    },
    intercept: 0.5,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      inactivity_days: { min: 0, max: 90, typical: 7 },
      engagement_score: { min: 0, max: 100, typical: 50 },
      order_frequency: { min: 0, max: 30, typical: 4 },
      avg_order_value: { min: 50, max: 5000, typical: 300 },
      push_notification_open_rate: { min: 0, max: 1, typical: 0.3 },
      support_ticket_count: { min: 0, max: 20, typical: 1 },
      complaint_count: { min: 0, max: 10, typical: 0 },
      points_balance: { min: 0, max: 10000, typical: 500 },
    },
    featureDomains: {
      inactivity_days: 'numeric',
      engagement_score: 'numeric',
      order_frequency: 'numeric',
      avg_order_value: 'numeric',
      push_notification_open_rate: 'numeric',
      support_ticket_count: 'numeric',
      complaint_count: 'numeric',
      points_balance: 'numeric',
    },
  },
  ltv_predictor: {
    modelType: 'ltv_predictor',
    coefficients: {
      total_orders: 0.30,
      avg_order_value: 0.35,
      order_frequency: 0.15,
      loyalty_tier: 0.10,
      referral_count: 0.05,
      points_redeemed_ratio: 0.05,
      customer_age_days: 0.10,
      cross_category_purchases: 0.05,
    },
    intercept: 1000,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      total_orders: { min: 1, max: 500, typical: 20 },
      avg_order_value: { min: 50, max: 5000, typical: 300 },
      order_frequency: { min: 0, max: 30, typical: 4 },
      loyalty_tier: { min: 0, max: 4, typical: 1 },
      referral_count: { min: 0, max: 50, typical: 2 },
      points_redeemed_ratio: { min: 0, max: 1, typical: 0.5 },
      customer_age_days: { min: 1, max: 3650, typical: 365 },
      cross_category_purchases: { min: 1, max: 20, typical: 5 },
    },
    featureDomains: {
      total_orders: 'numeric',
      avg_order_value: 'numeric',
      order_frequency: 'numeric',
      loyalty_tier: 'categorical',
      referral_count: 'numeric',
      points_redeemed_ratio: 'numeric',
      customer_age_days: 'numeric',
      cross_category_purchases: 'numeric',
    },
  },
  revisit_predictor: {
    modelType: 'revisit_predictor',
    coefficients: {
      days_since_last_order: 0.30,
      order_frequency: -0.25,
      avg_order_value: -0.15,
      cart_abandonment_rate: 0.10,
      wishlist_usage: 0.10,
      time_on_app: 0.10,
    },
    intercept: 0.7,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      days_since_last_order: { min: 0, max: 30, typical: 5 },
      order_frequency: { min: 0, max: 30, typical: 4 },
      avg_order_value: { min: 50, max: 5000, typical: 300 },
      cart_abandonment_rate: { min: 0, max: 1, typical: 0.4 },
      wishlist_usage: { min: 0, max: 100, typical: 10 },
      time_on_app: { min: 0, max: 3600, typical: 300 },
    },
    featureDomains: {
      days_since_last_order: 'numeric',
      order_frequency: 'numeric',
      avg_order_value: 'numeric',
      cart_abandonment_rate: 'numeric',
      wishlist_usage: 'numeric',
      time_on_app: 'numeric',
    },
  },
  conversion_predictor: {
    modelType: 'conversion_predictor',
    coefficients: {
      add_to_cart_rate: 0.30,
      product_views: 0.20,
      search_frequency: 0.15,
      purchase_after_view_rate: 0.25,
      price_sensitivity: -0.10,
    },
    intercept: 0.3,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      add_to_cart_rate: { min: 0, max: 1, typical: 0.2 },
      product_views: { min: 0, max: 500, typical: 50 },
      search_frequency: { min: 0, max: 100, typical: 10 },
      purchase_after_view_rate: { min: 0, max: 1, typical: 0.1 },
      price_sensitivity: { min: 0, max: 100, typical: 50 },
    },
    featureDomains: {
      add_to_cart_rate: 'numeric',
      product_views: 'numeric',
      search_frequency: 'numeric',
      purchase_after_view_rate: 'numeric',
      price_sensitivity: 'numeric',
    },
  },
  recommendation_engine: {
    modelType: 'recommendation_engine',
    coefficients: {
      order_frequency: 0.25,
      avg_order_value: 0.20,
      wishlist_usage: 0.15,
      cart_abandonment_rate: 0.10,
      loyalty_tier: 0.10,
      review_submission: 0.10,
      search_frequency: 0.10,
    },
    intercept: 0.5,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      order_frequency: { min: 0, max: 30, typical: 4 },
      avg_order_value: { min: 50, max: 5000, typical: 300 },
      wishlist_usage: { min: 0, max: 100, typical: 10 },
      cart_abandonment_rate: { min: 0, max: 1, typical: 0.4 },
      loyalty_tier: { min: 0, max: 4, typical: 1 },
      review_submission: { min: 0, max: 1, typical: 0.1 },
      search_frequency: { min: 0, max: 100, typical: 10 },
    },
    featureDomains: {
      order_frequency: 'numeric',
      avg_order_value: 'numeric',
      wishlist_usage: 'numeric',
      cart_abandonment_rate: 'numeric',
      loyalty_tier: 'categorical',
      review_submission: 'numeric',
      search_frequency: 'numeric',
    },
  },
  price_predictor: {
    modelType: 'price_predictor',
    coefficients: {
      demand_index: 0.40,
      competitor_avg_price: 0.30,
      cost_price: 0.20,
      season: 0.05,
      is_weekend: 0.05,
    },
    intercept: 50,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      demand_index: { min: 0, max: 100, typical: 50 },
      competitor_avg_price: { min: 50, max: 5000, typical: 300 },
      cost_price: { min: 20, max: 2000, typical: 150 },
      season: { min: 0, max: 3, typical: 1 },
      is_weekend: { min: 0, max: 1, typical: 0.3 },
    },
    featureDomains: {
      demand_index: 'numeric',
      competitor_avg_price: 'numeric',
      cost_price: 'numeric',
      season: 'categorical',
      is_weekend: 'binary',
    },
  },
  demand_forecast: {
    modelType: 'demand_forecast',
    coefficients: {
      historical_demand: 0.40,
      time_of_day: 0.15,
      day_of_week: 0.15,
      is_weekend: 0.10,
      is_holiday: 0.10,
      season: 0.10,
    },
    intercept: 100,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      historical_demand: { min: 0, max: 1000, typical: 100 },
      time_of_day: { min: 0, max: 23, typical: 12 },
      day_of_week: { min: 0, max: 6, typical: 3 },
      is_weekend: { min: 0, max: 1, typical: 0.3 },
      is_holiday: { min: 0, max: 1, typical: 0.05 },
      season: { min: 0, max: 3, typical: 1 },
    },
    featureDomains: {
      historical_demand: 'numeric',
      time_of_day: 'numeric',
      day_of_week: 'categorical',
      is_weekend: 'binary',
      is_holiday: 'binary',
      season: 'categorical',
    },
  },
  fraud_detector: {
    modelType: 'fraud_detector',
    coefficients: {
      order_velocity: 0.30,
      new_address_ratio: 0.25,
      device_fingerprint_mismatch: 0.20,
      unusual_time_pattern: 0.15,
      payment_method_risk: 0.10,
    },
    intercept: 0.1,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      order_velocity: { min: 0, max: 10, typical: 1 },
      new_address_ratio: { min: 0, max: 1, typical: 0.1 },
      device_fingerprint_mismatch: { min: 0, max: 1, typical: 0 },
      unusual_time_pattern: { min: 0, max: 1, typical: 0 },
      payment_method_risk: { min: 0, max: 100, typical: 10 },
    },
    featureDomains: {
      order_velocity: 'numeric',
      new_address_ratio: 'numeric',
      device_fingerprint_mismatch: 'binary',
      unusual_time_pattern: 'binary',
      payment_method_risk: 'numeric',
    },
  },
  segmentation: {
    modelType: 'segmentation',
    coefficients: {
      order_frequency: 0.25,
      avg_order_value: 0.25,
      engagement_score: 0.20,
      loyalty_tier: 0.15,
      referral_count: 0.15,
    },
    intercept: 0,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      order_frequency: { min: 0, max: 30, typical: 4 },
      avg_order_value: { min: 50, max: 5000, typical: 300 },
      engagement_score: { min: 0, max: 100, typical: 50 },
      loyalty_tier: { min: 0, max: 4, typical: 1 },
      referral_count: { min: 0, max: 50, typical: 2 },
    },
    featureDomains: {
      order_frequency: 'numeric',
      avg_order_value: 'numeric',
      engagement_score: 'numeric',
      loyalty_tier: 'categorical',
      referral_count: 'numeric',
    },
  },
  propensity_scorer: {
    modelType: 'propensity_scorer',
    coefficients: {
      engagement_score: 0.30,
      order_frequency: 0.20,
      cart_abandonment_rate: 0.15,
      wishlist_usage: 0.15,
      push_notification_open_rate: 0.10,
      session_frequency: 0.10,
    },
    intercept: 0.5,
    featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
    exampleValues: {
      engagement_score: { min: 0, max: 100, typical: 50 },
      order_frequency: { min: 0, max: 30, typical: 4 },
      cart_abandonment_rate: { min: 0, max: 1, typical: 0.4 },
      wishlist_usage: { min: 0, max: 100, typical: 10 },
      push_notification_open_rate: { min: 0, max: 1, typical: 0.3 },
      session_frequency: { min: 0, max: 50, typical: 10 },
    },
    featureDomains: {
      engagement_score: 'numeric',
      order_frequency: 'numeric',
      cart_abandonment_rate: 'numeric',
      wishlist_usage: 'numeric',
      push_notification_open_rate: 'numeric',
      session_frequency: 'numeric',
    },
  },
};

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  cached?: boolean;
  processingTimeMs?: number;
}

export interface BatchApiResponse<T> {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    data?: T;
    error?: string;
    cached?: boolean;
  }>;
}

// Export re-exports handled at module level above

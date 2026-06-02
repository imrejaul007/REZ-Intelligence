// ============================================
// REZ Temporal Intelligence - Core Types
// ============================================

/**
 * Action types in user behavior sequences
 */
export type ActionType = 
  | 'browse' 
  | 'search' 
  | 'view_product' 
  | 'add_to_cart' 
  | 'remove_from_cart'
  | 'view_cart' 
  | 'initiate_checkout' 
  | 'add_payment'
  | 'complete_purchase' 
  | 'add_to_wishlist' 
  | 'share' 
  | 'review'
  | 'login' 
  | 'logout' 
  | 'signup'
  | 'view_order'
  | 'cancel_order'
  | 'refund'
  | 'subscribe'
  | 'unsubscribe'
  | 'custom';

/**
 * Time period for temporal analysis
 */
export type TimePeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Day of week for pattern analysis
 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Confidence level for predictions
 */
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

/**
 * Pattern type detected
 */
export type PatternType = 
  | 'sequential'      // Sequential patterns (A -> B -> C)
  | 'periodic'        // Periodic/cyclical patterns
  | 'temporal'        // Time-of-day/day-of-week patterns
  | 'session'         // Session-based patterns
  | 'funnel'          // Conversion funnel patterns
  | 'abandonment'     // Cart/checkout abandonment patterns
  | 'engagement';     // Engagement patterns

/**
 * Session type
 */
export type SessionType = 'browse' | 'search' | 'purchase' | 'abandoned' | 'mixed';

/**
 * ============================================
 * Event Types
 * ============================================
 */

/**
 * Single event in a behavior sequence
 */
export interface BehaviorEvent {
  eventId: string;
  userId: string;
  action: ActionType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  sessionId: string;
  duration?: number; // Time spent on action in ms
  productId?: string;
  categoryId?: string;
  amount?: number;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

/**
 * User session containing multiple events
 */
export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  events?: BehaviorEvent[];
  sessionType: SessionType;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  isActive: boolean;
  totalDuration?: number; // Total session duration in ms
  eventCount: number;
  actions: ActionType[];
}

/**
 * ============================================
 * Sequence Analysis Types
 * ============================================
 */

/**
 * Transition probability in Markov chain
 */
export interface TransitionProbability {
  from: ActionType;
  to: ActionType;
  probability: number;
  count: number; // Number of times this transition occurred
}

/**
 * Markov chain model for sequence prediction
 */
export interface MarkovChainModel {
  userId: string;
  states: ActionType[];
  transitionMatrix: Record<ActionType, Record<ActionType, number>>;
  initialProbabilities: Record<ActionType, number>;
  order: number; // 1 = first-order, 2 = second-order, etc.
  trainedAt: Date;
  eventCount: number;
  entropy: number; // Measure of predictability
}

/**
 * Detected sequence pattern
 */
export interface SequencePattern {
  patternId: string;
  userId: string;
  sequence: ActionType[];
  frequency: number;
  averageDuration: number; // Average time to complete sequence
  conversionRate: number; // If sequence leads to purchase
  firstOccurrence: Date;
  lastOccurrence: Date;
  confidence: number;
}

/**
 * Sequence analysis result
 */
export interface SequenceAnalysisResult {
  userId: string;
  analyzedAt: Date;
  totalEvents: number;
  totalSessions: number;
  uniquePaths: number;
  mostCommonSequence: ActionType[];
  averageSequenceLength: number;
  funnelDropOffPoints: Array<{
    from: ActionType;
    to: ActionType;
    dropOffRate: number;
  }>;
  conversionFunnel: Array<{
    stage: ActionType;
    count: number;
    percentage: number;
  }>;
  markovModel?: MarkovChainModel;
  patterns: SequencePattern[];
  insights: string[];
}

/**
 * ============================================
 * Pattern Detection Types
// ============================================
 */

/**
 * Recurring temporal pattern
 */
export interface TemporalPattern {
  patternId: string;
  userId: string;
  patternType: PatternType;
  description: string;
  confidence: number;
  occurrences: Date[];
  frequency: TimePeriod;
  peakTimes?: {
    dayOfWeek?: DayOfWeek[];
    hourOfDay?: number[];
  };
  value?: number; // Average order value for this pattern
  conversionRate?: number;
  detectedAt: Date;
  nextExpectedOccurrence?: Date;
}

/**
 * Periodic pattern detected via Fourier analysis
 */
export interface PeriodicPattern {
  patternId: string;
  userId: string;
  period: number; // Period in hours/days
  strength: number; // 0-1, strength of periodicity
  phase: number; // Phase offset in the cycle
  amplitude: number;
  confidence: number;
  examples: Date[];
}

/**
 * Pattern detection result
 */
export interface PatternDetectionResult {
  userId: string;
  detectedAt: Date;
  patterns: TemporalPattern[];
  periodicPatterns: PeriodicPattern[];
  confidence: ConfidenceLevel;
  summary: string;
  recommendations: string[];
}

/**
 * ============================================
 * Temporal Prediction Types
// ============================================
 */

/**
 * Next action prediction
 */
export interface NextActionPrediction {
  userId: string;
  predictedAt: Date;
  currentState: ActionType;
  predictions: Array<{
    action: ActionType;
    probability: number;
    confidence: ConfidenceLevel;
    estimatedTime: number; // Time until action in ms
    context?: string;
  }>;
  timeUntilPrediction: number; // Time horizon for prediction
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
  lastEvent?: BehaviorEvent;
  sessionContext?: {
    sessionId: string;
    eventsInSession: number;
    sessionDuration: number;
  };
}

/**
 * Time-based prediction
 */
export interface TimeBasedPrediction {
  userId: string;
  predictionType: 'next_action' | 'next_session' | 'purchase_timing' | 'engagement';
  predictedAt: Date;
  predictions: Array<{
    timestamp: Date;
    probability: number;
    action?: ActionType;
    confidence: ConfidenceLevel;
  }>;
  optimalEngagementWindow: {
    start: Date;
    end: Date;
    probability: number;
  };
  factors: Array<{
    name: string;
    impact: number;
  }>;
}

/**
 * Session prediction
 */
export interface SessionPrediction {
  userId: string;
  predictedAt: Date;
  nextSession: {
    predictedStart: Date;
    predictedDuration: number;
    predictedType: SessionType;
    predictedActions: ActionType[];
    confidence: ConfidenceLevel;
  };
  sessionPatterns: Array<{
    dayOfWeek: DayOfWeek;
    hourOfDay: number;
    frequency: number;
    averageDuration: number;
  }>;
}

/**
 * ============================================
 * Session Intelligence Types
// ============================================
 */

/**
 * Session intelligence analysis
 */
export interface SessionIntelligence {
  userId: string;
  analyzedAt: Date;
  sessionStats: {
    totalSessions: number;
    averageSessionDuration: number;
    averageEventsPerSession: number;
    mostActiveDay: DayOfWeek;
    mostActiveHour: number;
    sessionTypes: Record<SessionType, number>;
  };
  behavioralSegments: Array<{
    segment: string;
    score: number;
    description: string;
  }>;
  engagementIndicators: {
    browseToCartRate: number;
    cartToPurchaseRate: number;
    averageTimeToPurchase: number;
    returnRate: number;
    sessionFrequency: number; // Sessions per week
  };
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    detectedAt: Date;
  }>;
}

/**
 * Session comparison result
 */
export interface SessionComparison {
  userId: string;
  comparedAt: Date;
  currentSession: UserSession;
  historicalAverage: {
    duration: number;
    events: number;
    actions: ActionType[];
  };
  deviation: {
    durationDeviation: number; // % difference from average
    eventDeviation: number;
    engagementScore: number;
  };
  isAnomalous: boolean;
  anomalyReason?: string;
}

/**
 * ============================================
 * API Request/Response Types
// ============================================
 */

/**
 * Sequence analysis request
 */
export interface SequenceAnalysisRequest {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  sessionIds?: string[];
  includeMarkovModel?: boolean;
  minEvents?: number;
}

/**
 * Pattern detection request
 */
export interface PatternDetectionRequest {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  patternTypes?: PatternType[];
  minOccurrences?: number;
}

/**
 * Recurring patterns request
 */
export interface RecurringPatternsRequest {
  userId: string;
  patternType?: PatternType;
  limit?: number;
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
    cache: boolean;
  };
  metrics: {
    totalSequences: number;
    totalPatterns: number;
    predictionsLast24h: number;
    averageLatencyMs: number;
  };
  timestamp: Date;
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
  totalSequences: number;
  totalPatterns: number;
  predictionsLast24h: number;
  averageConfidence: number;
  errorRate: number;
  averageLatencyMs: number;
}

/**
 * Training data for Markov chain
 */
export interface MarkovTrainingData {
  userId: string;
  sequences: ActionType[][];
  weights?: number[]; // Optional weights for each sequence
}

/**
 * REZ Temporal Intelligence - Types
 *
 * Sequence learning, habit detection, behavioral transitions, lifecycle prediction
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// CORE TEMPORAL TYPES
// ============================================

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface TemporalPattern {
  id: string;
  name: string;
  type: PatternType;
  description: string;
  confidence: number; // 0-1
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'yearly';
  occurrences: number;
  lastOccurrence: Date;
  nextExpected?: Date;
}

export type PatternType =
  | 'recurring'
  | 'seasonal'
  | 'trend'
  | 'cyclical'
  | 'anomaly'
  | 'habit'
  | 'ritual'
  | 'event_driven';

export interface Sequence {
  id: string;
  entityId: string;
  entityType: 'user' | 'merchant' | 'product' | 'location';
  events: SequenceEvent[];
  length: number;
  startTime: Date;
  endTime: Date;
  pattern?: string;
  embedding?: number[]; // Vector representation
}

export interface SequenceEvent {
  eventType: string;
  timestamp: Date;
  duration?: number; // ms
  properties?: Record<string, unknown>;
  location?: {
    lat: number;
    lng: number;
  };
}

// ============================================
// HABIT TYPES
// ============================================

export interface Habit {
  id: string;
  entityId: string;
  entityType: 'user' | 'merchant';
  name: string;
  description: string;
  type: HabitType;
  confidence: number; // 0-1
  frequency: HabitFrequency;
  regularity: number; // 0-1 (how consistent)
  strength: number; // 0-1 (how ingrained)
  triggers: string[]; // What triggers this habit
  contexts: HabitContext[];
  firstObserved: Date;
  lastObserved: Date;
  nextExpected: Date;
  streak: number;
  maxStreak: number;
  disruption?: HabitDisruption;
}

export type HabitType =
  | 'purchase'
  | 'browsing'
  | 'engagement'
  | 'communication'
  | 'location'
  | 'time'
  | 'social'
  | 'content';

export type HabitFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'event_based';

export interface HabitContext {
  time?: {
    dayOfWeek?: number[]; // 0-6
    hourOfDay?: number[];
    month?: number[];
  };
  location?: {
    city?: string[];
    area?: string[];
    venueType?: string[];
  };
  state?: {
    weather?: string[];
    mood?: string[];
    activity?: string[];
  };
}

export interface HabitDisruption {
  detected: Date;
  cause: string;
  severity: 'minor' | 'moderate' | 'major';
  expectedDuration?: number; // days
  recoveryProbability?: number;
}

// ============================================
// BEHAVIORAL TRANSITION TYPES
// ============================================

export interface BehavioralTransition {
  id: string;
  entityId: string;
  entityType: 'user' | 'merchant';
  fromState: string;
  toState: string;
  type: TransitionType;
  confidence: number;
  trigger?: string;
  factors: TransitionFactor[];
  startedAt: Date;
  completedAt?: Date;
  progress?: number; // 0-1
  prediction?: {
    expectedCompletion: Date;
    likelihood: number;
  };
}

export interface PredictedTransition {
  state: string;
  probability: number;
  estimatedDate?: Date;
  factors: TransitionFactor[];
}

export type TransitionType =
  | 'engagement'
  | 'disengagement'
  | 'upgrade'
  | 'downgrade'
  | 'activation'
  | 'churn'
  | 'retention'
  | 'advocacy'
  | 'dormancy'
  | 'reactivation';

export interface TransitionFactor {
  name: string;
  contribution: number; // 0-1
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
}

// ============================================
// LIFECYCLE TYPES
// ============================================

export interface LifecycleStage {
  id: string;
  name: string;
  type: LifecycleStageType;
  description: string;
  characteristics: string[];
  typicalDuration?: {
    min: number;
    max: number;
    average: number;
  };
  progressionCriteria: ProgressionCriterion[];
  exitCriteria: ProgressionCriterion[];
}

export type LifecycleStageType =
  | 'acquisition'
  | 'onboarding'
  | 'activation'
  | 'engagement'
  | 'retention'
  | 'churn_risk'
  | 'churned'
  | 'reactivation'
  | 'advocacy'
  | 'dormancy';

export interface ProgressionCriterion {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  weight: number;
}

export interface LifecycleTransition {
  fromStage: LifecycleStageType;
  toStage: LifecycleStageType;
  transitionedAt: Date;
  duration: number; // days in previous stage
}

export interface LifecycleState {
  entityId: string;
  entityType: 'user' | 'merchant';
  currentStage: LifecycleStageType;
  stageEnteredAt: Date;
  timeInStage: number; // days
  progression: number; // 0-1 to next stage
  predictedNextStage?: LifecycleStageType;
  predictedTransitionDate?: Date;
  history: LifecycleTransition[];
  health: {
    score: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    riskFactors: string[];
  };
}

// ============================================
// TEMPORAL PREDICTION TYPES
// ============================================

export interface TemporalPrediction {
  id: string;
  entityId: string;
  predictionType: PredictionType;
  prediction: string;
  confidence: number;
  timeframe: {
    start: Date;
    end: Date;
  };
  factors: PredictionFactor[];
  reasoning: string;
  confidenceInterval?: {
    pessimistic: Date;
    expected: Date;
    optimistic: Date;
  };
  generatedAt: Date;
}

export type PredictionType =
  | 'next_action'
  | 'churn_date'
  | 'purchase_timing'
  | 'engagement_dip'
  | 'upgrade_probability'
  | 'seasonal_pattern'
  | 'lifecycle_transition';

export interface PredictionFactor {
  name: string;
  importance: number; // 0-1
  description: string;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface AnalyzeSequenceRequest {
  entityId: string;
  entityType: 'user' | 'merchant' | 'product' | 'location';
  events: SequenceEvent[];
  options?: {
    detectPattern?: boolean;
    generateEmbedding?: boolean;
    predictNext?: boolean;
  };
}

export interface AnalyzeSequenceResponse {
  success: boolean;
  sequence?: Sequence;
  patterns?: TemporalPattern[];
  predictions?: TemporalPrediction[];
  error?: string;
}

export interface DetectHabitsRequest {
  entityId: string;
  entityType: 'user' | 'merchant';
  events: SequenceEvent[];
  options?: {
    minConfidence?: number;
    minFrequency?: number;
  };
}

export interface DetectHabitsResponse {
  success: boolean;
  habits?: Habit[];
  newHabits?: Habit[];
  disruptedHabits?: Habit[];
  error?: string;
}

export interface PredictTransitionRequest {
  entityId: string;
  entityType: 'user' | 'merchant';
  currentState: string;
  targetState?: string;
}

export interface PredictTransitionResponse {
  success: boolean;
  currentState: string;
  predictedTransitions: PredictedTransition[];
  error?: string;
}

export interface GetLifecycleRequest {
  entityId: string;
  entityType: 'user' | 'merchant';
}

export interface GetLifecycleResponse {
  success: boolean;
  lifecycle?: LifecycleState;
  recommendations?: string[];
  error?: string;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface ISequence extends Document {
  entityId: String;
  entityType: String;
  events: [SequenceEvent];
  length: Number;
  startTime: Date;
  endTime: Date;
  pattern: String;
  embedding: [Number];
  createdAt: Date;
  updatedAt: Date;
}

export interface IHabit extends Document {
  entityId: String;
  entityType: String;
  name: String;
  description: String;
  type: String;
  confidence: Number;
  frequency: String;
  regularity: Number;
  strength: Number;
  triggers: [String];
  contexts: [mongoose.Schema.Types.Mixed];
  firstObserved: Date;
  lastObserved: Date;
  nextExpected: Date;
  streak: Number;
  maxStreak: Number;
  disruption: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBehavioralTransition extends Document {
  entityId: String;
  entityType: String;
  fromState: String;
  toState: String;
  type: String;
  confidence: Number;
  trigger: String;
  factors: [mongoose.Schema.Types.Mixed];
  startedAt: Date;
  completedAt: Date;
  progress: Number;
  prediction: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILifecycleState extends Document {
  entityId: String;
  entityType: String;
  currentStage: String;
  stageEnteredAt: Date;
  timeInStage: Number;
  progression: Number;
  predictedNextStage: String;
  predictedTransitionDate: Date;
  history: [mongoose.Schema.Types.Mixed];
  health: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemporalPrediction extends Document {
  entityId: String;
  predictionType: String;
  prediction: String;
  confidence: Number;
  timeframe: mongoose.Schema.Types.Mixed;
  factors: [mongoose.Schema.Types.Mixed];
  reasoning: String;
  confidenceInterval: mongoose.Schema.Types.Mixed;
  generatedAt: Date;
  expiresAt: Date;
}

// ============================================
// SERVICE TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  sequences: number;
  habits: number;
  predictions: number;
  lastProcessed: Date;
}

export interface TemporalStats {
  totalSequences: number;
  totalHabits: number;
  totalTransitions: number;
  totalPredictions: number;
  avgSequenceLength: number;
  avgHabitConfidence: number;
  byType: Record<string, number>;
}

// ============================================
// TEMPORAL FEATURES
// ============================================

export interface TemporalFeatures {
  // Time-based
  hourOfDay: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  quarter: number;
  year: number;
  isWeekend: boolean;
  isHoliday: boolean;
  timeSinceLastActivity: number; // seconds

  // Recency features
  recencyScore: number;
  frequencyScore: number;
  tenureScore: number;

  // Pattern features
  consistencyScore: number; // How regular is the behavior
  seasonalityScore: number; // How seasonal is the behavior
  trendScore: number; // Is behavior trending up/down

  // Engagement lifecycle
  engagementLevel: 'dormant' | 'low' | 'medium' | 'high' | 'super';
  lifecycleStage: LifecycleStageType;

  // Habit strength
  habitStrength: number; // 0-1
  habitConfidence: number; // 0-1

  // Predicted next
  predictedNextAction?: string;
  predictedNextTime?: Date;
  predictedChurnRisk?: number;
}

/**
 * Calculate temporal features from event history
 */
export function calculateTemporalFeatures(
  events: SequenceEvent[],
  currentTime: Date = new Date()
): TemporalFeatures {
  if (events.length === 0) {
    return {
      hourOfDay: currentTime.getHours(),
      dayOfWeek: currentTime.getDay(),
      dayOfMonth: currentTime.getDate(),
      month: currentTime.getMonth(),
      quarter: Math.floor(currentTime.getMonth() / 3),
      year: currentTime.getFullYear(),
      isWeekend: currentTime.getDay() === 0 || currentTime.getDay() === 6,
      isHoliday: false,
      timeSinceLastActivity: 0,
      recencyScore: 0,
      frequencyScore: 0,
      tenureScore: 0,
      consistencyScore: 0,
      seasonalityScore: 0,
      trendScore: 0,
      engagementLevel: 'dormant',
      lifecycleStage: 'acquisition',
      habitStrength: 0,
      habitConfidence: 0,
    };
  }

  const lastEvent = events[events.length - 1];
  const firstEvent = events[0];

  const timeSinceLast = (currentTime.getTime() - lastEvent.timestamp.getTime()) / 1000;

  // Calculate frequency
  const totalDays = (lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24) || 1;
  const frequency = events.length / totalDays;

  // Calculate tenure
  const tenureDays = (currentTime.getTime() - firstEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate recency (inverse of time since last)
  const recencyScore = Math.max(0, 1 - timeSinceLast / (7 * 24 * 60 * 60)); // 7 days max

  // Frequency score (0-1, with 1 being daily)
  const frequencyScore = Math.min(1, frequency);

  // Tenure score (0-1, with 1 being > 1 year)
  const tenureScore = Math.min(1, tenureDays / 365);

  // Consistency (standard deviation of time between events)
  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push((events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()) / (1000 * 60 * 60 * 24));
  }
  const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  const stdDev = intervals.length > 0
    ? Math.sqrt(intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length)
    : 0;
  const consistencyScore = Math.max(0, 1 - stdDev / (avgInterval || 1));

  // Seasonality - check if events cluster at specific times
  const hourCounts: Record<number, number> = {};
  const dowCounts: Record<number, number> = {};
  events.forEach(e => {
    hourCounts[e.timestamp.getHours()] = (hourCounts[e.timestamp.getHours()] || 0) + 1;
    dowCounts[e.timestamp.getDay()] = (dowCounts[e.timestamp.getDay()] || 0) + 1;
  });
  const maxHourCount = Math.max(...Object.values(hourCounts), 1);
  const maxDowCount = Math.max(...Object.values(dowCounts), 1);
  const seasonalityScore = ((maxHourCount / events.length) + (maxDowCount / events.length)) / 2;

  // Trend - simple linear regression on timestamps
  let trendScore = 0;
  if (events.length >= 3) {
    const eventValues = events.map((_, i) => i);
    const timeValues = events.map(e => e.timestamp.getTime());
    const n = events.length;
    const sumX = eventValues.reduce((a, b) => a + b, 0);
    const sumY = timeValues.reduce((a, b) => a + b, 0);
    const sumXY = eventValues.reduce((sum, x, i) => sum + x * timeValues[i], 0);
    const sumX2 = eventValues.reduce((sum, x) => sum + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    trendScore = Math.max(-1, Math.min(1, slope / (1000 * 60 * 60 * 24))); // Normalize to days
  }

  // Engagement level
  let engagementLevel: 'dormant' | 'low' | 'medium' | 'high' | 'super' = 'dormant';
  const engagementScore = recencyScore * 0.4 + frequencyScore * 0.3 + tenureScore * 0.3;
  if (engagementScore > 0.8) engagementLevel = 'super';
  else if (engagementScore > 0.6) engagementLevel = 'high';
  else if (engagementScore > 0.3) engagementLevel = 'medium';
  else if (engagementScore > 0.1) engagementLevel = 'low';

  // Lifecycle stage
  let lifecycleStage: LifecycleStageType = 'acquisition';
  if (tenureDays > 30) {
    if (recencyScore > 0.7) lifecycleStage = 'retention';
    else if (recencyScore > 0.3) lifecycleStage = 'engagement';
    else lifecycleStage = 'churn_risk';
  } else if (tenureDays > 7) {
    lifecycleStage = 'activation';
  }

  return {
    hourOfDay: currentTime.getHours(),
    dayOfWeek: currentTime.getDay(),
    dayOfMonth: currentTime.getDate(),
    month: currentTime.getMonth(),
    quarter: Math.floor(currentTime.getMonth() / 3),
    year: currentTime.getFullYear(),
    isWeekend: currentTime.getDay() === 0 || currentTime.getDay() === 6,
    isHoliday: false,
    timeSinceLastActivity: timeSinceLast,
    recencyScore,
    frequencyScore,
    tenureScore,
    consistencyScore,
    seasonalityScore,
    trendScore,
    engagementLevel,
    lifecycleStage,
    habitStrength: consistencyScore * frequencyScore,
    habitConfidence: consistencyScore,
  };
}

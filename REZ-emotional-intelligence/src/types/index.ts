/**
 * REZ Emotional Intelligence - Type Definitions
 *
 * Core types for mood tracking, sentiment analysis, and wellness scoring
 */

// ============================================
// EMOTION TYPES
// ============================================

export type EmotionType =
  | 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise'
  | 'anticipation' | 'trust' | 'disgust' | 'acceptance' | 'disappointment'
  | 'calm' | 'anxious' | 'energetic' | 'tired' | 'hopeful'
  | 'frustrated' | 'grateful' | 'lonely' | 'content' | 'overwhelmed';

export type SentimentPolarity = 'positive' | 'negative' | 'neutral';

export interface EmotionScore {
  emotion: EmotionType;
  score: number; // 0-100
  confidence: number; // 0-1
}

export interface SentimentAnalysis {
  polarity: SentimentPolarity;
  score: number; // -100 to 100
  emotions: EmotionScore[];
  intensity: number; // 0-100
  keywords: string[];
}

// ============================================
// MOOD TYPES
// ============================================

export type MoodState =
  | 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'
  | 'anxious' | 'calm' | 'energetic' | 'tired' | 'stressed' | 'peaceful';

export interface MoodEntry {
  id?: string;
  _id?: string;
  userId: string;
  timestamp: Date;
  mood: MoodState;
  primaryEmotion: EmotionType;
  secondaryEmotions: EmotionType[];
  intensity: number; // 0-100
  energy: number; // 0-100 (low to high)
  arousal: number; // 0-100 (dull to alert)
  triggers?: string[];
  notes?: string;
  location?: {
    lat: number;
    lng: number;
    place?: string;
  };
  context?: {
    activity?: string;
    weather?: string;
    social?: boolean;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

export interface MoodPattern {
  timeOfDay: Record<string, number>; // average mood by hour
  dayOfWeek: Record<string, number>; // average mood by weekday
  locationCorrelations: Record<string, number>; // mood by location
  activityCorrelations: Record<string, number>; // mood by activity
  weatherCorrelations: Record<string, number>; // mood by weather
  socialCorrelations: Record<string, number>; // mood with/without social
}

export interface MoodTrend {
  direction: 'improving' | 'declining' | 'stable' | 'volatile';
  delta: number; // change from previous period
  volatility: number; // 0-100
  forecast: number; // predicted next mood
}

// ============================================
// WELLNESS TYPES
// ============================================

export interface WellnessScore {
  overall: number; // 0-100
  mental: number;
  emotional: number;
  social: number;
  purpose: number; // sense of purpose
  growth: number; // personal growth
}

export interface WellnessDimensions {
  stress: number; // 0-100 (low stress is good)
  resilience: number; // 0-100
  mindfulness: number; // 0-100
  gratitude: number; // 0-100
  socialConnection: number; // 0-100
  lifeSatisfaction: number; // 0-100
}

export interface WellnessTrend {
  period: 'daily' | 'weekly' | 'monthly';
  scores: WellnessScore[];
  trajectory: 'improving' | 'declining' | 'stable';
  riskFactors: string[];
  protectiveFactors: string[];
}

// ============================================
// SPIRITUAL & MEANING TYPES
// ============================================

export type LifeMeaning =
  | 'family' | 'career' | 'creativity' | 'community'
  | 'adventure' | 'knowledge' | 'spirituality' | 'service'
  | 'health' | 'relationships' | 'legacy' | 'freedom';

export interface LifeMeaningScores {
  primary: LifeMeaning;
  secondary: LifeMeaning[];
  clarity: number; // 0-100 how clear they feel about meaning
  fulfillment: number; // 0-100 current fulfillment level
}

export interface SpiritualWellbeing {
  innerPeace: number; // 0-100
  connection: number; // 0-100 (connection to something greater)
  meaning: number; // 0-100
  gratitude: number; // 0-100
  forgiveness: number; // 0-100
  hope: number; // 0-100
}

// ============================================
// BEHAVIORAL SIGNALS
// ============================================

export interface EmotionalSignals {
  // Communication patterns
  messageTone: SentimentPolarity;
  responseTime: 'quick' | 'normal' | 'slow';
  emojiUsage: number; // frequency 0-100
  capsUsage: number; // 0-100
  typoRate: number; // 0-100

  // Activity patterns
  engagementLevel: number; // 0-100
  socialActivity: number; // 0-100
  purchaseBehavior: SentimentPolarity;
  browsingPattern: 'exploring' | 'focused' | 'aimless';

  // Temporal patterns
  activeTimeOfDay: string;
  peakHours: string[];
  sleepQuality: number; // 0-100 inferred

  // Content preferences
  contentTypes: string[];
  sentimentTrend: SentimentPolarity;
}

// ============================================
// CONTEXT AGGREGATION
// ============================================

export interface EmotionalContext {
  userId: string;
  timestamp: Date;

  // Current state
  currentMood: MoodState;
  currentEmotions: EmotionScore[];
  currentEnergy: number;

  // Trends
  moodTrend: MoodTrend;
  wellnessScore: WellnessScore;
  emotionalSignals: EmotionalSignals;

  // Aggregations
  last24h: {
    averageMood: number;
    moodSwings: number;
    dominantEmotion: EmotionType;
  };
  last7d: {
    averageMood: number;
    trend: 'improving' | 'declining' | 'stable' | 'volatile';
    peakDay: string;
    lowDay: string;
  };

  // Predictions
  predictedMoodTomorrow: MoodState;
  riskFlags: string[]; // e.g., ['potential_burnout', 'isolation_risk']
}

// ============================================
// COSMIC OS INTEGRATION TYPES
// ============================================

export interface CosmicMoodOutput {
  cosmicState: {
    energyLevel: 'high' | 'medium' | 'low';
    emotionalTone: string;
    socialEnergy: number;
    focusScore: number;
    relationshipEnergy: string;
    financialFlow: string;
    growthInsight: string;
  };
  suggestedActions: string[];
  timingAdvice: string;
  interpretation: {
    symbolic: string;
    practical: string;
  };
}

// ============================================
// EVENT TYPES
// ============================================

export interface EmotionalEvent {
  type: 'mood_checkin' | 'journal_entry' | 'sentiment_detected' | 'wellness_update' | 'crisis_detected';
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  source: 'user' | 'system' | 'ai' | 'lifestyle_app';
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface MoodCheckInRequest {
  userId: string;
  mood: MoodState;
  intensity?: number;
  triggers?: string[];
  notes?: string;
  context?: MoodEntry['context'];
}

export interface MoodCheckInResponse {
  success: boolean;
  moodEntry: MoodEntry;
  trend: MoodTrend;
  wellnessScore: WellnessScore;
  cosmicInterpretation?: string;
}

export interface SentimentAnalysisRequest {
  text?: string;
  userId?: string;
  source?: 'chat' | 'review' | 'social' | 'journal';
}

export interface SentimentAnalysisResponse {
  sentiment: SentimentAnalysis;
  recommendations: string[];
}

export interface WellnessAssessmentRequest {
  userId: string;
  signals?: EmotionalSignals;
  explicitAnswers?: Record<string, number>;
}

export interface EmotionalContextRequest {
  userId: string;
  includePredictions?: boolean;
  includeCosmicInterpretation?: boolean;
}

export interface EmotionalContextResponse {
  context: EmotionalContext;
  cosmicOutput?: CosmicMoodOutput;
  actionRecommendations: string[];
}

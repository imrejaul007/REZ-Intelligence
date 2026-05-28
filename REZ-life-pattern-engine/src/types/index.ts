/**
 * REZ Life Pattern Engine - Type Definitions
 *
 * Daily/weekly/seasonal patterns, routine detection, life events
 */

// ============================================
// TIME PATTERNS
// ============================================

export type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Season = 'spring' | 'summer' | 'monsoon' | 'autumn' | 'winter';

export interface TimePattern {
  timeOfDay: Record<TimeOfDay, number>; // frequency score 0-100
  dayOfWeek: Record<DayOfWeek, number>;
  season: Record<Season, number>;
  peakHours: string[]; // ['09:00', '18:00']
  averageSessionDuration: number; // minutes
}

// ============================================
// ROUTINE PATTERNS
// ============================================

export interface RoutinePattern {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: 'morning' | 'work' | 'commute' | 'evening' | 'night' | 'weekend' | 'fitness' | 'social';
  pattern: {
    daysOfWeek: DayOfWeek[];
    startTime: string; // HH:mm
    endTime: string;
    frequency: number; // times per week
    confidence: number; // 0-1 how consistent
  };
  activities: string[];
  locations: string[];
  triggers: string[];
  outcomes: string[];
  detectedAt: Date;
  lastActive: Date;
  streak?: {
    current: number;
    longest: number;
  };
}

export interface RoutineVariations {
  weekdayRoutine: RoutinePattern[];
  weekendRoutine: RoutinePattern[];
  holidayRoutine: RoutinePattern | null;
  travelRoutine: RoutinePattern[];
}

// ============================================
// LIFESTYLE PATTERNS
// ============================================

export interface LifestyleProfile {
  chronotype: 'early_bird' | 'night_owl' | 'intermediate'; // sleep-wake pattern
  activityLevel: 'sedentary' | 'moderate' | 'active' | 'very_active';
  socialPattern: 'extroverted' | 'introverted' | 'balanced';
  routineLevel: 'highly_routine' | 'moderate_routine' | 'spontaneous';
  workLifeBalance: number; // 0-100
}

export interface ConsumptionPattern {
  cuisinePreferences: Record<string, number>;
  diningTimes: Record<TimeOfDay, number>;
  diningLocation: Record<'home' | 'restaurant' | 'delivery' | 'work', number>;
  budgetTier: 'budget' | 'moderate' | 'premium' | 'luxury';
  shoppingFrequency: 'rare' | 'occasional' | 'regular' | 'frequent';
  spendingCategories: Record<string, number>;
}

// ============================================
// LIFE EVENTS
// ============================================

export type LifeEventType =
  | 'new_job' | 'job_change' | 'promotion' | 'job_loss'
  | 'relocation' | 'travel' | 'vacation' | 'home_purchase' | 'home_rental'
  | 'relationship_start' | 'relationship_end' | 'marriage' | 'birth' | 'death'
  | 'health_change' | 'injury' | 'recovery' | 'pregnancy'
  | 'education_start' | 'education_end' | 'graduation'
  | 'retirement' | 'milestone_birthday' | 'anniversary';

export interface LifeEvent {
  id: string;
  userId: string;
  type: LifeEventType;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  impact: {
    emotional: number; // -100 to 100
    financial: number; // -100 to 100
    social: number; // -100 to 100
    routine: number; // -100 to 100
  };
  detectedFrom: string[]; // data sources that detected this
  confidence: number; // 0-1
  status: 'predicted' | 'detected' | 'confirmed' | 'completed';
  createdAt: Date;
}

// ============================================
// LIFE STAGES
// ============================================

export type LifeStage =
  | 'student' | 'early_career' | 'career_growth' | 'mid_career'
  | 'late_career' | 'retirement'
  | 'single' | 'dating' | 'relationship' | 'married' | 'parenting' | 'empty_nest';

export interface LifeStageAnalysis {
  current: LifeStage;
  confidence: number;
  indicators: {
    career: string[];
    relationship: string[];
    financial: string[];
    lifestyle: string[];
  };
  transitionSignals?: {
    from: LifeStage;
    to: LifeStage;
    confidence: number;
    timeline?: string;
  };
}

// ============================================
// RHYTHMS & CYCLES
// ============================================

export interface LifeRhythm {
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  pattern: number[]; // scores for each unit
  peak: number; // index of peak
  trough: number; // index of trough
  amplitude: number; // difference between peak and trough
  stability: number; // 0-1 how consistent
}

export interface CyclicalPatterns {
  weekly: LifeRhythm;
  monthly: LifeRhythm;
  quarterly: LifeRhythm;
  yearly: LifeRhythm;
}

// ============================================
// PREDICTIVE PATTERNS
// ============================================

export interface PredictedRoutine {
  activity: string;
  time: string;
  location: string;
  confidence: number;
  basedOn: string; // reason for prediction
}

export interface UpcomingEventPrediction {
  type: LifeEventType;
  likelihood: number; // 0-1
  timeframe: string; // 'next_week', 'next_month', 'next_quarter'
  signals: string[];
}

// ============================================
// CONTEXT OUTPUT
// ============================================

export interface LifePatternContext {
  userId: string;
  timestamp: Date;

  // Current patterns
  currentRoutine: RoutinePattern[];
  lifestyle: LifestyleProfile;
  consumption: ConsumptionPattern;

  // Temporal
  timePattern: TimePattern;
  rhythms: CyclicalPatterns;

  // Life stage
  lifeStage: LifeStageAnalysis;

  // Events
  recentEvents: LifeEvent[];
  upcomingPredictions: UpcomingEventPrediction[];

  // Predictions
  next24h: PredictedRoutine[];
  routineConsistency: number; // 0-100 how consistent today is

  // Insights
  insights: {
    routineGaps: string[];
    optimizationSuggestions: string[];
    upcomingChanges: string[];
  };
}

// ============================================
// API TYPES
// ============================================

export interface DetectRoutineRequest {
  userId: string;
  events: Array<{
    type: string;
    timestamp: Date;
    duration?: number;
    location?: { lat: number; lng: number; name?: string };
    properties?: Record<string, unknown>;
  }>;
  options?: {
    minFrequency?: number;
    minConfidence?: number;
  };
}

export interface RecordActivityRequest {
  userId: string;
  activity: string;
  timestamp: Date;
  duration?: number;
  location?: { lat: number; lng: number; name?: string };
  metadata?: Record<string, unknown>;
}

export interface LifeEventDetectionRequest {
  userId: string;
  signals: Array<{
    type: string;
    value: unknown;
    timestamp: Date;
    source: string;
  }>;
}

export interface LifePatternRequest {
  userId: string;
  includePredictions?: boolean;
  includeRituals?: boolean;
}

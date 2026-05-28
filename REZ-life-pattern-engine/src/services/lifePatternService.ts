/**
 * REZ Life Pattern Engine - Core Service
 *
 * Daily/weekly/seasonal patterns, routine detection, life events
 */

import mongoose, { Schema, Document } from 'mongoose';
import { format, getHours, getDay, getMonth, differenceInDays, startOfWeek, addDays } from 'date-fns';
import type {
  RoutinePattern,
  LifeEvent,
  LifeStageAnalysis,
  LifeStage,
  TimePattern,
  LifestyleProfile,
  ConsumptionPattern,
  CyclicalPatterns,
  LifeRhythm,
  PredictedRoutine,
  TimeOfDay,
  DayOfWeek,
  Season,
  RoutineVariations,
} from '../types/index.js';

// ============================================
// MONGODB MODELS
// ============================================

export interface RoutineDocument extends Omit<RoutinePattern, 'id'>, Document {}

const routineSchema = new Schema<RoutineDocument>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: {
    type: String,
    enum: ['morning', 'work', 'commute', 'evening', 'night', 'weekend', 'fitness', 'social'],
    required: true,
  },
  pattern: {
    daysOfWeek: [String],
    startTime: String,
    endTime: String,
    frequency: Number,
    confidence: Number,
  },
  activities: [String],
  locations: [String],
  triggers: [String],
  outcomes: [String],
  detectedAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  streak: {
    current: Number,
    longest: Number,
  },
});

export const RoutineModel = mongoose.model<RoutineDocument>('Routine', routineSchema);

export interface LifeEventDocument extends Omit<LifeEvent, 'id'>, Document {}

const lifeEventSchema = new Schema<LifeEventDocument>({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  impact: {
    emotional: Number,
    financial: Number,
    social: Number,
    routine: Number,
  },
  detectedFrom: [String],
  confidence: Number,
  status: {
    type: String,
    enum: ['predicted', 'detected', 'confirmed', 'completed'],
    default: 'detected',
  },
  createdAt: { type: Date, default: Date.now },
});

export const LifeEventModel = mongoose.model<LifeEventDocument>('LifeEvent', lifeEventSchema);

export interface ActivityDocument extends Document {
  userId: string;
  activity: string;
  timestamp: Date;
  duration?: number;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

const activitySchema = new Schema<ActivityDocument>({
  userId: { type: String, required: true, index: true },
  activity: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  duration: Number,
  location: {
    lat: Number,
    lng: Number,
    name: String,
  },
  metadata: Schema.Types.Mixed,
});

export const ActivityModel = mongoose.model<ActivityDocument>('Activity', activitySchema);

// ============================================
// TIME UTILITIES
// ============================================

const TIME_MAPPINGS: Record<number, TimeOfDay> = {
  5: 'early_morning', 6: 'early_morning', 7: 'early_morning',
  8: 'morning', 9: 'morning', 10: 'morning', 11: 'morning',
  12: 'midday', 13: 'midday',
  14: 'afternoon', 15: 'afternoon', 16: 'afternoon', 17: 'afternoon',
  18: 'evening', 19: 'evening', 20: 'evening',
  21: 'night', 22: 'night', 23: 'night',
  0: 'late_night', 1: 'late_night', 2: 'late_night', 3: 'late_night', 4: 'late_night',
};

const DAY_MAPPINGS: Record<number, DayOfWeek> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

const SEASON_MAPPINGS: Record<number, Season> = {
  2: 'spring', 3: 'spring', 4: 'spring',
  5: 'summer', 6: 'summer', 7: 'summer',
  8: 'monsoon', 9: 'monsoon', 10: 'monsoon',
  11: 'winter', 0: 'winter', 1: 'winter',
};

function getTimeOfDay(date: Date): TimeOfDay {
  return TIME_MAPPINGS[getHours(date)] || 'afternoon';
}

function getDayOfWeek(date: Date): DayOfWeek {
  return DAY_MAPPINGS[getDay(date)];
}

function getSeason(date: Date): Season {
  return SEASON_MAPPINGS[getMonth(date)];
}

// ============================================
// ROUTINE DETECTION
// ============================================

export async function detectRoutines(userId: string, events: any[]): Promise<RoutinePattern[]> {
  if (events.length < 5) return [];

  // Group activities by type
  const activityGroups: Record<string, any[]> = {};
  for (const event of events) {
    const key = event.type || event.activity;
    if (!activityGroups[key]) activityGroups[key] = [];
    activityGroups[key].push(event);
  }

  const routines: RoutinePattern[] = [];

  // Analyze each activity group
  for (const [activityType, activityEvents] of Object.entries(activityGroups)) {
    if (activityEvents.length < 3) continue;

    // Analyze time patterns
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const event of activityEvents) {
      const timestamp = new Date(event.timestamp);
      const hour = getHours(timestamp);
      const day = getDay(timestamp);

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;

      if (event.duration) {
        totalDuration += event.duration;
        durationCount++;
      }
    }

    // Find peak hours
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => `${h.padStart(2, '0')}:00`);

    // Find most common days
    const days = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => DAY_MAPPINGS[parseInt(d)]);

    // Determine if weekday or weekend pattern
    const weekdayCount = days.filter(d => !['saturday', 'sunday'].includes(d)).length;
    const category = weekdayCount > 3 ? 'work' :
      days.includes('saturday') || days.includes('sunday') ? 'weekend' : 'evening';

    // Calculate confidence
    const consistency = activityEvents.length / events.length;
    const frequency = activityEvents.length / 4; // per week approximation

    const routine: RoutinePattern = {
      id: `${userId}_${activityType}_${Date.now()}`,
      userId,
      name: activityType,
      description: `${activityType} routine`,
      category: category as RoutinePattern['category'],
      pattern: {
        daysOfWeek: days,
        startTime: sortedHours[0] || '09:00',
        endTime: sortedHours[2] || '18:00',
        frequency,
        confidence: Math.min(1, consistency + frequency * 0.1),
      },
      activities: [activityType],
      locations: activityEvents
        .filter(e => e.location?.name)
        .map(e => e.location.name),
      triggers: [],
      outcomes: [],
      detectedAt: new Date(),
      lastActive: new Date(Math.max(...activityEvents.map((e: any) => new Date(e.timestamp).getTime()))),
    };

    if (routine.pattern.confidence > 0.3) {
      routines.push(routine);
    }
  }

  return routines;
}

// ============================================
// TIME PATTERN ANALYSIS
// ============================================

export function analyzeTimePattern(events: any[]): TimePattern {
  const hourScores: Record<number, number[]> = {};
  const dayScores: Record<number, number[]> = {};
  const seasonScores: Record<number, number[]> = {};
  const durations: number[] = [];

  for (const event of events) {
    const timestamp = new Date(event.timestamp);
    const hour = getHours(timestamp);
    const day = getDay(timestamp);
    const season = getMonth(timestamp);

    if (!hourScores[hour]) hourScores[hour] = [];
    hourScores[hour].push(1);

    if (!dayScores[day]) dayScores[day] = [];
    dayScores[day].push(1);

    if (!seasonScores[season]) seasonScores[season] = [];
    seasonScores[season].push(1);

    if (event.duration) durations.push(event.duration);
  }

  // Convert to normalized scores
  const maxHour = Math.max(...Object.values(hourScores).map(a => a.length));
  const maxDay = Math.max(...Object.values(dayScores).map(a => a.length));
  const maxSeason = Math.max(...Object.values(seasonScores).map(a => a.length));

  const timeOfDay: Record<TimeOfDay, number> = {
    early_morning: 0, morning: 0, midday: 0, afternoon: 0,
    evening: 0, night: 0, late_night: 0,
  };

  for (const [hour, count] of Object.entries(hourScores)) {
    const tod = TIME_MAPPINGS[parseInt(hour)];
    timeOfDay[tod] = Math.max(timeOfDay[tod], Math.round((count.length / maxHour) * 100));
  }

  const dayOfWeek: Record<DayOfWeek, number> = {
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0,
    friday: 0, saturday: 0, sunday: 0,
  };

  for (const [day, count] of Object.entries(dayScores)) {
    const dow = DAY_MAPPINGS[parseInt(day)];
    dayOfWeek[dow] = Math.round((count.length / maxDay) * 100);
  }

  const season: Record<Season, number> = {
    spring: 0, summer: 0, monsoon: 0, autumn: 0, winter: 0,
  };

  for (const [mon, count] of Object.entries(seasonScores)) {
    const s = SEASON_MAPPINGS[parseInt(mon)];
    season[s] = Math.round((count.length / maxSeason) * 100);
  }

  // Peak hours
  const peakHours = Object.entries(hourScores)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([h]) => `${h.padStart(2, '0')}:00`);

  return {
    timeOfDay,
    dayOfWeek,
    season,
    peakHours,
    averageSessionDuration: durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 30,
  };
}

// ============================================
// LIFESTYLE PROFILE
// ============================================

export function analyzeLifestyleProfile(events: any[]): LifestyleProfile {
  if (events.length === 0) {
    return {
      chronotype: 'intermediate',
      activityLevel: 'moderate',
      socialPattern: 'balanced',
      routineLevel: 'moderate_routine',
      workLifeBalance: 50,
    };
  }

  // Analyze sleep patterns from event timing
  const hourDistribution: Record<number, number> = {};
  for (const event of events) {
    const hour = getHours(new Date(event.timestamp));
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  }

  // Early morning activity (5-7am)
  const earlyMorning = (hourDistribution[5] || 0) + (hourDistribution[6] || 0) + (hourDistribution[7] || 0);
  // Late night activity (11pm-3am)
  const lateNight = (hourDistribution[23] || 0) + (hourDistribution[0] || 0) +
    (hourDistribution[1] || 0) + (hourDistribution[2] || 0) + (hourDistribution[3] || 0);

  let chronotype: LifestyleProfile['chronotype'] = 'intermediate';
  if (earlyMorning > lateNight * 2) chronotype = 'early_bird';
  else if (lateNight > earlyMorning * 2) chronotype = 'night_owl';

  // Activity level from event frequency
  const activityLevel = events.length < 10 ? 'sedentary' :
    events.length < 30 ? 'moderate' :
      events.length < 60 ? 'active' : 'very_active';

  // Social pattern (group events vs solo)
  const socialEvents = events.filter(e => e.metadata?.social === true).length;
  const socialRatio = socialEvents / events.length;
  const socialPattern = socialRatio > 0.6 ? 'extroverted' :
    socialRatio < 0.2 ? 'introverted' : 'balanced';

  // Routine level from consistency
  const routineLevel = 'moderate_routine'; // simplified

  // Work-life balance
  const workEvents = events.filter(e =>
    e.activity?.toLowerCase().includes('work') ||
    e.type?.toLowerCase().includes('work')
  ).length;
  const workRatio = workEvents / events.length;
  const workLifeBalance = Math.round((1 - workRatio) * 100);

  return {
    chronotype,
    activityLevel,
    socialPattern,
    routineLevel,
    workLifeBalance,
  };
}

// ============================================
// CONSUMPTION PATTERN
// ============================================

export function analyzeConsumptionPattern(events: any[]): ConsumptionPattern {
  const cuisinePrefs: Record<string, number> = {};
  const diningTimes: Record<TimeOfDay, number> = {
    early_morning: 0,
    morning: 0,
    midday: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
    late_night: 0,
  };
  const diningLocations: Record<string, number> = {};

  for (const event of events) {
    // Cuisine from activity name or metadata
    if (event.activity || event.type) {
      const activity = (event.activity || event.type).toLowerCase();
      cuisinePrefs[activity] = (cuisinePrefs[activity] || 0) + 1;
    }

    // Dining time
    const tod = getTimeOfDay(new Date(event.timestamp));
    diningTimes[tod] = (diningTimes[tod] || 0) + 1;

    // Location type
    if (event.location?.name) {
      const name = event.location.name.toLowerCase();
      if (name.includes('home')) diningLocations.home = (diningLocations.home || 0) + 1;
      else if (name.includes('restaurant') || name.includes('cafe')) diningLocations.restaurant = (diningLocations.restaurant || 0) + 1;
      else if (name.includes('delivery')) diningLocations.delivery = (diningLocations.delivery || 0) + 1;
      else if (name.includes('office') || name.includes('work')) diningLocations.work = (diningLocations.work || 0) + 1;
    }
  }

  // Budget tier from average values
  const budgetTier: ConsumptionPattern['budgetTier'] = 'moderate';

  return {
    cuisinePreferences: cuisinePrefs,
    diningTimes,
    diningLocation: diningLocations as Record<'home' | 'restaurant' | 'delivery' | 'work', number>,
    budgetTier,
    shoppingFrequency: 'regular',
    spendingCategories: cuisinePrefs,
  };
}

// ============================================
// LIFE RHYTHM ANALYSIS
// ============================================

export function analyzeRhythms(events: any[]): CyclicalPatterns {
  // Weekly rhythm
  const weeklyPattern = analyzeRhythm(events, 7, 'weekly');

  // Monthly rhythm (by week of month)
  const monthlyPattern = analyzeRhythm(events, 4, 'monthly');

  // Quarterly rhythm
  const quarterlyPattern = analyzeRhythm(events, 13, 'quarterly');

  // Yearly rhythm
  const yearlyPattern = analyzeRhythm(events, 52, 'yearly');

  return {
    weekly: weeklyPattern,
    monthly: monthlyPattern,
    quarterly: quarterlyPattern,
    yearly: yearlyPattern,
  };
}

function analyzeRhythm(events: any[], units: number, type: LifeRhythm['type']): LifeRhythm {
  const scores: number[] = new Array(units).fill(0);
  const counts: number[] = new Array(units).fill(0);

  for (const event of events) {
    const timestamp = new Date(event.timestamp);
    let unitIndex: number;

    if (type === 'weekly') {
      const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
      unitIndex = Math.floor(differenceInDays(timestamp, startOfCurrentWeek) / 7);
    } else if (type === 'monthly') {
      unitIndex = Math.floor(getDay(timestamp) / 7);
    } else if (type === 'quarterly') {
      unitIndex = Math.floor(getDay(timestamp) / 7);
    } else {
      // Yearly
      const weekOfYear = Math.floor(differenceInDays(timestamp, new Date(timestamp.getFullYear(), 0, 1)) / 7);
      unitIndex = weekOfYear;
    }

    if (unitIndex >= 0 && unitIndex < units) {
      scores[unitIndex] += 1;
      counts[unitIndex]++;
    }
  }

  // Normalize
  const normalized = scores.map(s => s);
  const max = Math.max(...normalized, 1);

  const peak = normalized.indexOf(Math.max(...normalized));
  const trough = normalized.indexOf(Math.min(...normalized));
  const amplitude = (normalized[peak] - normalized[trough]) / max;

  // Stability (inverse of variance)
  const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
  const variance = normalized.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / normalized.length;
  const stability = Math.max(0, 1 - Math.sqrt(variance) / (mean || 1));

  return {
    type,
    pattern: normalized.map(v => Math.round((v / max) * 100)),
    peak,
    trough,
    amplitude: Math.round(amplitude * 100),
    stability: Math.round(stability * 100) / 100,
  };
}

// ============================================
// LIFE STAGE DETECTION
// ============================================

export function detectLifeStage(events: any[]): LifeStageAnalysis {
  if (events.length === 0) {
    return {
      current: 'early_career',
      confidence: 0.5,
      indicators: { career: [], relationship: [], financial: [], lifestyle: [] },
    };
  }

  const indicators: LifeStageAnalysis['indicators'] = {
    career: [],
    relationship: [],
    financial: [],
    lifestyle: [],
  };

  // Analyze activity types for indicators
  for (const event of events) {
    const activity = (event.activity || event.type || '').toLowerCase();

    // Career indicators
    if (activity.includes('work') || activity.includes('office')) {
      indicators.career.push('regular_work');
    }
    if (activity.includes('interview')) {
      indicators.career.push('job_search');
    }
    if (activity.includes('training') || activity.includes('course')) {
      indicators.career.push('education');
    }

    // Relationship indicators
    if (activity.includes('date') || activity.includes('dating')) {
      indicators.relationship.push('dating_activity');
    }
    if (activity.includes('family') || activity.includes('parent')) {
      indicators.relationship.push('family_focus');
    }

    // Financial indicators
    if (event.metadata?.amount > 50000) {
      indicators.financial.push('high_value_purchase');
    }
    if (activity.includes('investment') || activity.includes('stock')) {
      indicators.financial.push('investment_activity');
    }

    // Lifestyle indicators
    if (activity.includes('gym') || activity.includes('fitness') || activity.includes('yoga')) {
      indicators.lifestyle.push('fitness_routine');
    }
    if (activity.includes('travel') || activity.includes('vacation')) {
      indicators.lifestyle.push('travel');
    }
  }

  // Determine life stage
  let stage: LifeStage = 'early_career';
  let confidence = 0.5;

  if (indicators.relationship.includes('family_focus')) {
    stage = 'parenting';
    confidence = 0.8;
  } else if (indicators.relationship.includes('dating_activity')) {
    stage = 'dating';
    confidence = 0.7;
  } else if (indicators.career.includes('education')) {
    stage = 'student';
    confidence = 0.8;
  } else if (indicators.career.includes('regular_work') && indicators.career.length > 10) {
    stage = 'career_growth';
    confidence = 0.7;
  }

  return {
    current: stage,
    confidence,
    indicators,
  };
}

// ============================================
// ROUTINE PREDICTION
// ============================================

export function predictNext24hRoutines(
  userId: string,
  timePattern: TimePattern,
  routines: RoutinePattern[]
): PredictedRoutine[] {
  const predictions: PredictedRoutine[] = [];
  const now = new Date();
  const currentHour = getHours(now);
  const currentDay = getDay(now);

  // From routines
  for (const routine of routines) {
    const daysMatch = routine.pattern.daysOfWeek.includes(DAY_MAPPINGS[currentDay]);

    if (daysMatch) {
      // Check if routine should happen today
      const routineHour = parseInt(routine.pattern.startTime.split(':')[0]);
      if (routineHour >= currentHour) {
        predictions.push({
          activity: routine.name,
          time: routine.pattern.startTime,
          location: routine.locations[0] || 'unknown',
          confidence: routine.pattern.confidence,
          basedOn: 'established_routine',
        });
      }
    }
  }

  // From time patterns
  for (const [tod, score] of Object.entries(timePattern.timeOfDay)) {
    if (score > 70) {
      const todHour = Object.entries(TIME_MAPPINGS).find(([, v]) => v === tod)?.[0];
      if (todHour && parseInt(todHour) >= currentHour) {
        predictions.push({
          activity: `typical_${tod}_activity`,
          time: `${todHour}:00`,
          location: 'usual_location',
          confidence: score / 100,
          basedOn: 'historical_pattern',
        });
      }
    }
  }

  return predictions.sort((a, b) => a.time.localeCompare(b.time));
}

// ============================================
// LIFE EVENT DETECTION
// ============================================

export function detectLifeEvents(signals: any[]): Partial<LifeEvent>[] {
  const detected: Partial<LifeEvent>[] = [];

  // Group signals by type
  const typeGroups: Record<string, any[]> = {};
  for (const signal of signals) {
    const type = signal.type;
    if (!typeGroups[type]) typeGroups[type] = [];
    typeGroups[type].push(signal);
  }

  // Detect patterns that suggest life events
  for (const [type, typeSignals] of Object.entries(typeGroups)) {
    if (typeSignals.length >= 5) {
      // Check for sudden changes
      const timestamps = typeSignals.map((s: any) => new Date(s.timestamp).getTime());
      const sorted = timestamps.sort((a: number, b: number) => a - b);

      // Cluster by time (within 1 week)
      let clusterStart = sorted[0];
      let clusterCount = 1;

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - clusterStart < 7 * 24 * 60 * 60 * 1000) {
          clusterCount++;
        } else {
          if (clusterCount >= 3) {
            // Potential life event
            const eventType = mapActivityToLifeEvent(type);
            if (eventType) {
              detected.push({
                type: eventType,
                title: `${type} activity change`,
                description: `Detected ${clusterCount} ${type} activities within one week`,
                startDate: new Date(clusterStart),
                impact: { emotional: 30, financial: 20, social: 30, routine: 40 },
                detectedFrom: [type],
                confidence: clusterCount / typeSignals.length,
                status: 'detected',
              });
            }
          }
          clusterStart = sorted[i];
          clusterCount = 1;
        }
      }
    }
  }

  return detected;
}

function mapActivityToLifeEvent(activity: string): LifeEvent['type'] | null {
  const lower = activity.toLowerCase();

  if (lower.includes('work') && lower.includes('new')) return 'new_job';
  if (lower.includes('travel') || lower.includes('vacation')) return 'travel';
  if (lower.includes('home') || lower.includes('apartment')) return 'relocation';
  if (lower.includes('date') || lower.includes('relationship')) return 'relationship_start';
  if (lower.includes('fitness') || lower.includes('gym')) return 'health_change';

  return null;
}

// ============================================
// FULL CONTEXT GENERATION
// ============================================

export async function generateLifePatternContext(
  userId: string,
  events: any[],
  includePredictions = true
) {
  // Get stored routines
  const routines = await RoutineModel.find({ userId }) as unknown as RoutinePattern[];

  // Get stored life events
  const lifeEvents = await LifeEventModel.find({
    userId,
    startDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  });

  // Analyze patterns
  const timePattern = analyzeTimePattern(events);
  const lifestyle = analyzeLifestyleProfile(events);
  const consumption = analyzeConsumptionPattern(events);
  const rhythms = analyzeRhythms(events);
  const lifeStage = detectLifeStage(events);

  // Generate predictions
  let next24h: PredictedRoutine[] = [];
  let upcomingPredictions: any[] = [];

  if (includePredictions) {
    next24h = predictNext24hRoutines(userId, timePattern, routines);
    // Detect potential life events
    const potentialEvents = detectLifeEvents(events.slice(0, 50));
    upcomingPredictions = potentialEvents.map(e => ({
      ...e,
      likelihood: e.confidence || 0.5,
      timeframe: 'detected',
      signals: e.detectedFrom || [],
    }));
  }

  // Calculate routine consistency
  const today = getDay(new Date());
  const todayRoutines = routines.filter(r =>
    r.pattern.daysOfWeek.includes(DAY_MAPPINGS[today])
  );
  const routineConsistency = todayRoutines.length > 0
    ? Math.round(todayRoutines.reduce((sum, r) => sum + r.pattern.confidence, 0) / todayRoutines.length * 100)
    : 50;

  // Generate insights
  const insights = {
    routineGaps: findRoutineGaps(timePattern, routines),
    optimizationSuggestions: generateSuggestions(timePattern, lifestyle, rhythms),
    upcomingChanges: predictUpcomingChanges(lifeStage, rhythms),
  };

  return {
    userId,
    timestamp: new Date(),
    currentRoutine: routines,
    lifestyle,
    consumption,
    timePattern,
    rhythms,
    lifeStage,
    recentEvents: lifeEvents,
    upcomingPredictions,
    next24h,
    routineConsistency,
    insights,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function findRoutineGaps(timePattern: TimePattern, routines: RoutinePattern[]): string[] {
  const gaps: string[] = [];

  // Check for missing routine categories
  const categories = new Set(routines.map(r => r.category));

  if (!categories.has('morning') && timePattern.timeOfDay.morning < 30) {
    gaps.push('Morning routine could be established');
  }
  if (!categories.has('fitness') && lifestyle?.activityLevel === 'sedentary') {
    gaps.push('Physical activity routine may benefit wellbeing');
  }

  return gaps;
}

function generateSuggestions(
  timePattern: TimePattern,
  lifestyle: LifestyleProfile,
  rhythms: CyclicalPatterns
): string[] {
  const suggestions: string[] = [];

  // From chronotype
  if (lifestyle.chronotype === 'night_owl') {
    suggestions.push('Your energy peaks later - consider scheduling important tasks in the evening');
  } else if (lifestyle.chronotype === 'early_bird') {
    suggestions.push('Your morning energy is valuable - protect it for high-priority tasks');
  }

  // From rhythms
  if (rhythms.weekly.amplitude > 50) {
    suggestions.push('Your week has strong variation - consistent routines may help stabilize energy');
  }

  // From work-life balance
  if (lifestyle.workLifeBalance < 30) {
    suggestions.push('Work-life balance could be improved - consider boundaries for personal time');
  }

  return suggestions;
}

function predictUpcomingChanges(lifeStage: LifeStageAnalysis, rhythms: CyclicalPatterns): string[] {
  const changes: string[] = [];

  // Seasonal transitions
  const month = getMonth(new Date());
  if (month === 2 || month === 8) {
    changes.push('Seasonal transition may bring renewed energy and new opportunities');
  }

  // Quarterly patterns
  if (rhythms.quarterly.peak === Math.floor(getDay(new Date()) / 7) % 13) {
    changes.push('Quarter cycle suggests this period may bring significant momentum');
  }

  return changes;
}

let lifestyle: LifestyleProfile | null = null;

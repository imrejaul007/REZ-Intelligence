/**
 * REZ Temporal Intelligence - Core Service
 *
 * Sequence learning, habit detection, behavioral transitions, lifecycle prediction
 */

import { v4 as uuidv4 } from 'uuid';
import { calculateTemporalFeatures } from './types';
import type {
  Sequence,
  SequenceEvent,
  Habit,
  HabitContext,
  BehavioralTransition,
  TransitionFactor,
  LifecycleState,
  LifecycleStageType,
  TemporalPattern,
  TemporalPrediction,
  TimeSeriesPoint,
  AnalyzeSequenceRequest,
  AnalyzeSequenceResponse,
  DetectHabitsRequest,
  DetectHabitsResponse,
  PredictTransitionRequest,
  PredictTransitionResponse,
  GetLifecycleRequest,
  GetLifecycleResponse,
  PredictedTransition,
} from './types';
import logger from './utils/logger';

// In-memory stores (would be Redis/MongoDB in production)
const sequences = new Map<string, Sequence>();
const habits = new Map<string, Habit>();
const transitions = new Map<string, BehavioralTransition>();
const lifecycleStates = new Map<string, LifecycleState>();

// ============================================
// SEQUENCE ANALYSIS
// ============================================

export async function analyzeSequence(
  request: AnalyzeSequenceRequest
): Promise<AnalyzeSequenceResponse> {
  try {
    const { entityId, entityType, events, options } = request;

    if (!events || events.length === 0) {
      return { success: false, error: 'No events provided for analysis' };
    }

    // Create sequence
    const sequence: Sequence = {
      id: uuidv4(),
      entityId,
      entityType,
      events: events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      length: events.length,
      startTime: events[0].timestamp,
      endTime: events[events.length - 1].timestamp,
    };

    // Generate embedding if requested
    if (options?.generateEmbedding) {
      sequence.embedding = generateSequenceEmbedding(events);
    }

    // Detect patterns if requested
    let patterns: TemporalPattern[] = [];
    if (options?.detectPattern) {
      patterns = detectPatterns(sequence);
      sequence.pattern = patterns.length > 0 ? patterns[0].type : undefined;
    }

    // Store sequence
    sequences.set(sequence.id, sequence);

    // Predict next event if requested
    let predictions: TemporalPrediction[] = [];
    if (options?.predictNext) {
      predictions = predictNextEvents(sequence);
    }

    logger.info('Sequence analyzed', { sequenceId: sequence.id, entityId, patternCount: patterns.length });

    return {
      success: true,
      sequence,
      patterns,
      predictions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Sequence analysis failed', { error: message });
    return { success: false, error: message };
  }
}

function generateSequenceEmbedding(events: SequenceEvent[]): number[] {
  // Generate a simple embedding based on event characteristics
  const eventTypes = new Set(events.map(e => e.eventType));
  const embedding = new Array(64).fill(0);

  // Encode time patterns
  const hourCounts = new Array(24).fill(0);
  const dowCounts = new Array(7).fill(0);

  events.forEach(e => {
    hourCounts[e.timestamp.getHours()]++;
    dowCounts[e.timestamp.getDay()]++;
  });

  // Normalize and place in embedding
  for (let i = 0; i < 24; i++) {
    embedding[i] = hourCounts[i] / events.length;
  }
  for (let i = 0; i < 7; i++) {
    embedding[24 + i] = dowCounts[i] / events.length;
  }

  // Encode event type diversity
  embedding[31] = eventTypes.size / 10; // Normalize to 0-1
  embedding[32] = events.length / 100; // Sequence length

  // Time span encoding
  const span = events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime();
  const spanDays = span / (1000 * 60 * 60 * 24);
  embedding[33] = Math.min(1, spanDays / 365);

  return embedding;
}

function detectPatterns(sequence: Sequence): TemporalPattern[] {
  const patterns: TemporalPattern[] = [];

  // Check for daily patterns
  const dailyPattern = detectDailyPattern(sequence);
  if (dailyPattern) patterns.push(dailyPattern);

  // Check for weekly patterns
  const weeklyPattern = detectWeeklyPattern(sequence);
  if (weeklyPattern) patterns.push(weeklyPattern);

  // Check for trend
  const trendPattern = detectTrendPattern(sequence);
  if (trendPattern) patterns.push(trendPattern);

  // Check for cyclical patterns
  const cyclicalPattern = detectCyclicalPattern(sequence);
  if (cyclicalPattern) patterns.push(cyclicalPattern);

  return patterns;
}

function detectDailyPattern(sequence: Sequence): TemporalPattern | null {
  const hourCounts = new Array(24).fill(0);
  sequence.events.forEach(e => {
    hourCounts[e.timestamp.getHours()]++;
  });

  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const concentration = Math.max(...hourCounts) / sequence.events.length;

  if (concentration > 0.3) {
    return {
      id: uuidv4(),
      name: `Daily peak at ${peakHour}:00`,
      type: 'recurring',
      description: `Events tend to occur around ${peakHour}:00 hours`,
      confidence: concentration,
      frequency: 'daily',
      occurrences: sequence.events.length,
      lastOccurrence: sequence.events[sequence.events.length - 1].timestamp,
      nextExpected: calculateNextOccurrence(sequence.events[sequence.events.length - 1].timestamp, 'daily', peakHour),
    };
  }
  return null;
}

function detectWeeklyPattern(sequence: Sequence): TemporalPattern | null {
  const dowCounts = new Array(7).fill(0);
  sequence.events.forEach(e => {
    dowCounts[e.timestamp.getDay()]++;
  });

  const peakDay = dowCounts.indexOf(Math.max(...dowCounts));
  const concentration = Math.max(...dowCounts) / sequence.events.length;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (concentration > 0.25 && Math.max(...dowCounts) > 2) {
    return {
      id: uuidv4(),
      name: `Weekly peak on ${dayNames[peakDay]}s`,
      type: 'recurring',
      description: `Events tend to occur on ${dayNames[peakDay]}s`,
      confidence: concentration,
      frequency: 'weekly',
      occurrences: sequence.events.length,
      lastOccurrence: sequence.events[sequence.events.length - 1].timestamp,
      nextExpected: calculateNextWeeklyOccurrence(sequence.events[sequence.events.length - 1].timestamp, peakDay),
    };
  }
  return null;
}

function detectTrendPattern(sequence: Sequence): TemporalPattern | null {
  if (sequence.events.length < 3) return null;

  // Simple linear regression
  const n = sequence.events.length;
  const xValues = sequence.events.map((_, i) => i);
  const yValues = sequence.events.map(e => e.timestamp.getTime());

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize slope to events per day
  const avgInterval = (yValues[n - 1] - yValues[0]) / (n - 1);
  const slopePerDay = slope / avgInterval;

  if (Math.abs(slopePerDay) > 0.1) {
    const type = slopePerDay > 0 ? 'Increasing' : 'Decreasing';
    return {
      id: uuidv4(),
      name: `${type} activity trend`,
      type: 'trend',
      description: `${type.toLowerCase()} frequency of events over time`,
      confidence: Math.min(1, Math.abs(slopePerDay)),
      frequency: 'daily',
      occurrences: sequence.events.length,
      lastOccurrence: sequence.events[sequence.events.length - 1].timestamp,
    };
  }
  return null;
}

function detectCyclicalPattern(sequence: Sequence): TemporalPattern | null {
  // Detect 7-day cycles
  if (sequence.events.length < 14) return null;

  const dayCounts = new Array(7).fill(0);
  sequence.events.forEach(e => {
    dayCounts[e.timestamp.getDay()]++;
  });

  // Check if pattern repeats every 7 days
  const avgCount = sequence.events.length / 7;
  let variance = 0;
  dayCounts.forEach(c => {
    variance += Math.pow(c - avgCount, 2);
  });
  variance /= 7;

  const cv = Math.sqrt(variance) / avgCount; // Coefficient of variation

  if (cv < 0.3) {
    return {
      id: uuidv4(),
      name: 'Weekly cycle detected',
      type: 'cyclical',
      description: 'Events follow a 7-day repeating cycle',
      confidence: 1 - cv,
      frequency: 'weekly',
      occurrences: sequence.events.length,
      lastOccurrence: sequence.events[sequence.events.length - 1].timestamp,
    };
  }
  return null;
}

function calculateNextOccurrence(lastTime: Date, frequency: string, targetHour?: number): Date {
  const next = new Date(lastTime);
  if (frequency === 'daily' && targetHour !== undefined) {
    next.setHours(targetHour, 0, 0, 0);
    if (next <= lastTime) {
      next.setDate(next.getDate() + 1);
    }
  }
  return next;
}

function calculateNextWeeklyOccurrence(lastTime: Date, targetDay: number): Date {
  const next = new Date(lastTime);
  const currentDay = next.getDay();
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) daysUntilTarget += 7;
  next.setDate(next.getDate() + daysUntilTarget);
  next.setHours(0, 0, 0, 0);
  return next;
}

function predictNextEvents(sequence: Sequence): TemporalPrediction[] {
  const predictions: TemporalPrediction[] = [];

  // Predict next event type based on sequence
  const eventTypeCounts: Record<string, number> = {};
  sequence.events.forEach(e => {
    eventTypeCounts[e.eventType] = (eventTypeCounts[e.eventType] || 0) + 1;
  });

  const lastEvent = sequence.events[sequence.events.length - 1];

  // Calculate average interval
  if (sequence.events.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < sequence.events.length; i++) {
      intervals.push(sequence.events[i].timestamp.getTime() - sequence.events[i - 1].timestamp.getTime());
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const expectedNextTime = new Date(lastEvent.timestamp.getTime() + avgInterval);
    const confidence = 1 - (Math.sqrt(intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length) / avgInterval);

    predictions.push({
      id: uuidv4(),
      entityId: sequence.entityId,
      predictionType: 'next_action',
      prediction: `Next event expected around ${expectedNextTime.toISOString()}`,
      confidence: Math.max(0, Math.min(1, confidence)),
      timeframe: {
        start: new Date(expectedNextTime.getTime() - avgInterval * 0.5),
        end: new Date(expectedNextTime.getTime() + avgInterval * 0.5),
      },
      factors: [{
        name: 'Average interval',
        importance: 0.5,
        description: 'Based on historical average time between events',
      }],
      reasoning: `From ${sequence.events.length} events, average interval is ${(avgInterval / (1000 * 60)).toFixed(1)} minutes`,
      generatedAt: new Date(),
    });
  }

  return predictions;
}

// ============================================
// HABIT DETECTION
// ============================================

export async function detectHabits(request: DetectHabitsRequest): Promise<DetectHabitsResponse> {
  try {
    const { entityId, entityType, events, options } = request;

    if (!events || events.length === 0) {
      return { success: false, error: 'No events provided for habit detection' };
    }

    const minConfidence = options?.minConfidence ?? 0.6;
    const minFrequency = options?.minFrequency ?? 2;

    // Analyze temporal features
    const features = calculateTemporalFeatures(events);
    const existingHabits = findExistingHabits(entityId, entityType);

    // Detect new habits
    const detectedHabits = detectNewHabits(entityId, entityType, events, features);
    const newHabits = detectedHabits.filter(h => h.confidence >= minConfidence);
    const disruptedHabits = findDisruptedHabits(existingHabits, events);

    // Store new habits
    newHabits.forEach(h => habits.set(h.id, h));

    logger.info('Habits detected', {
      entityId,
      totalHabits: newHabits.length,
      disruptedHabits: disruptedHabits.length,
    });

    return {
      success: true,
      habits: [...existingHabits, ...newHabits],
      newHabits,
      disruptedHabits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Habit detection failed', { error: message });
    return { success: false, error: message };
  }
}

function findExistingHabits(entityId: string, entityType: 'user' | 'merchant'): Habit[] {
  return Array.from(habits.values()).filter(
    h => h.entityId === entityId && h.entityType === entityType
  );
}

function detectNewHabits(
  entityId: string,
  entityType: 'user' | 'merchant',
  events: SequenceEvent[],
  features: ReturnType<typeof calculateTemporalFeatures>
): Habit[] {
  const detectedHabits: Habit[] = [];

  // High consistency suggests a habit
  if (features.consistencyScore > 0.7) {
    const habit: Habit = {
      id: uuidv4(),
      entityId,
      entityType,
      name: `${entityType === 'user' ? 'User' : 'Merchant'} habit pattern`,
      description: `Detected consistent behavior pattern with ${(features.consistencyScore * 100).toFixed(0)}% consistency`,
      type: inferHabitType(events),
      confidence: features.consistencyScore,
      frequency: inferHabitFrequency(events),
      regularity: features.consistencyScore,
      strength: features.habitStrength,
      triggers: detectTriggers(events),
      contexts: detectContexts(events),
      firstObserved: events[0].timestamp,
      lastObserved: events[events.length - 1].timestamp,
      nextExpected: predictNextHabitTime(events),
      streak: calculateStreak(events),
      maxStreak: calculateMaxStreak(events),
    };
    detectedHabits.push(habit);
  }

  // Detect time-based habits
  if (features.seasonalityScore > 0.5) {
    const timeHabit: Habit = {
      id: uuidv4(),
      entityId,
      entityType,
      name: 'Time-based activity habit',
      description: `Activity tends to occur at similar times (${features.hourOfDay}:00)`,
      type: 'time',
      confidence: features.seasonalityScore,
      frequency: inferHabitFrequency(events),
      regularity: features.seasonalityScore,
      strength: features.seasonalityScore,
      triggers: [],
      contexts: [{
        time: {
          hourOfDay: [features.hourOfDay],
          dayOfWeek: [features.dayOfWeek],
        },
      }],
      firstObserved: events[0].timestamp,
      lastObserved: events[events.length - 1].timestamp,
      nextExpected: predictNextHabitTime(events),
      streak: calculateStreak(events),
      maxStreak: calculateMaxStreak(events),
    };
    detectedHabits.push(timeHabit);
  }

  return detectedHabits;
}

function inferHabitType(events: SequenceEvent[]): Habit['type'] {
  const eventTypes = new Set(events.map(e => e.eventType));

  if (eventTypes.has('purchase') || eventTypes.has('order')) return 'purchase';
  if (eventTypes.has('browse') || eventTypes.has('view')) return 'browsing';
  if (eventTypes.has('message') || eventTypes.has('chat')) return 'communication';
  if (eventTypes.has('location') || eventTypes.has('visit')) return 'location';
  if (eventTypes.has('content') || eventTypes.has('post')) return 'content';
  if (eventTypes.has('social') || eventTypes.has('share')) return 'social';

  return 'engagement';
}

function inferHabitFrequency(events: SequenceEvent[]): Habit['frequency'] {
  if (events.length < 2) return 'event_based';

  const span = events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime();
  const spanDays = span / (1000 * 60 * 60 * 24);
  const spanWeeks = spanDays / 7;
  const frequency = events.length / (spanDays || 1);

  if (frequency >= 0.8) return 'daily';
  if (frequency >= 0.15) return 'weekly';
  if (frequency >= 0.07) return 'biweekly';
  if (frequency >= 0.03) return 'monthly';
  if (frequency >= 0.01) return 'quarterly';
  return 'yearly';
}

function detectTriggers(events: SequenceEvent[]): string[] {
  const triggers: string[] = [];

  // Check for time-based triggers
  const hourCounts = new Array(24).fill(0);
  events.forEach(e => hourCounts[e.timestamp.getHours()]++);
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  if (hourCounts[peakHour] / events.length > 0.3) {
    triggers.push(`Time: ${peakHour}:00`);
  }

  // Check for day-based triggers
  const dowCounts = new Array(7).fill(0);
  events.forEach(e => dowCounts[e.timestamp.getDay()]++);
  const peakDay = dowCounts.indexOf(Math.max(...dowCounts));
  if (dowCounts[peakDay] / events.length > 0.25) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    triggers.push(`Day: ${dayNames[peakDay]}`);
  }

  return triggers;
}

function detectContexts(events: SequenceEvent[]): HabitContext[] {
  const contexts: HabitContext[] = [];

  // Time context
  const hours = new Set(events.map(e => e.timestamp.getHours()));
  const days = new Set(events.map(e => e.timestamp.getDay()));

  if (hours.size <= 6) {
    contexts.push({
      time: {
        hourOfDay: Array.from(hours).sort((a, b) => a - b),
      },
    });
  }

  if (days.size <= 3) {
    contexts.push({
      time: {
        dayOfWeek: Array.from(days).sort((a, b) => a - b),
      },
    });
  }

  return contexts;
}

function predictNextHabitTime(events: SequenceEvent[]): Date {
  if (events.length < 2) {
    return new Date();
  }

  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].timestamp.getTime() - events[i - 1].timestamp.getTime());
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return new Date(events[events.length - 1].timestamp.getTime() + avgInterval);
}

function calculateStreak(events: SequenceEvent[]): number {
  if (events.length < 2) return 1;

  const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const interval = sorted[i - 1].timestamp.getTime() - sorted[i].timestamp.getTime();
    const avgExpectedInterval = 24 * 60 * 60 * 1000; // Assume daily

    if (interval <= avgExpectedInterval * 1.5) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateMaxStreak(events: SequenceEvent[]): number {
  if (events.length < 2) return 1;

  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let maxStreak = 1;
  let currentStreak = 1;
  let lastDate = sorted[0].timestamp.toDateString();

  for (let i = 1; i < sorted.length; i++) {
    const currentDate = sorted[i].timestamp.toDateString();
    const dayDiff = (sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()) / (1000 * 60 * 60 * 24);

    if (currentDate === lastDate || dayDiff <= 1.5) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
    lastDate = currentDate;
  }

  return maxStreak;
}

function findDisruptedHabits(existingHabits: Habit[], events: SequenceEvent[]): Habit[] {
  const disrupted: Habit[] = [];

  for (const habit of existingHabits) {
    const expectedTime = habit.nextExpected;
    const lastEvent = events[events.length - 1];

    // Check if habit is significantly late
    if (expectedTime && lastEvent.timestamp.getTime() - expectedTime.getTime() > 3 * 24 * 60 * 60 * 1000) {
      const disruption: Habit['disruption'] = {
        detected: new Date(),
        cause: 'Missed expected occurrence',
        severity: habit.streak > 7 ? 'major' : 'minor',
        expectedDuration: 7,
        recoveryProbability: 0.7,
      };

      const updatedHabit = { ...habit, disruption };
      habits.set(habit.id, updatedHabit);
      disrupted.push(updatedHabit);
    }
  }

  return disrupted;
}

// ============================================
// BEHAVIORAL TRANSITIONS
// ============================================

export async function predictTransition(
  request: PredictTransitionRequest
): Promise<PredictTransitionResponse> {
  try {
    const { entityId, entityType, currentState, targetState } = request;

    // Get historical transitions
    const historicalTransitions = Array.from(transitions.values()).filter(
      t => t.entityId === entityId && t.entityType === entityType
    );

    // Calculate transition probabilities
    const transitionProbs = calculateTransitionProbabilities(historicalTransitions, currentState, targetState);

    logger.info('Transition predicted', { entityId, currentState, possibleTransitions: transitionProbs.length });

    return {
      success: true,
      currentState,
      predictedTransitions: transitionProbs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Transition prediction failed', { error: message });
    return { success: false, currentState: request.currentState, predictedTransitions: [], error: message };
  }
}

function calculateTransitionProbabilities(
  historicalTransitions: BehavioralTransition[],
  currentState: string,
  targetState?: string
): PredictedTransition[] {
  const predictions: PredictedTransition[] = [];

  // Define common state transitions
  const commonTransitions: Record<string, string[]> = {
    'acquisition': ['onboarding', 'dormancy'],
    'onboarding': ['activation', 'dormancy'],
    'activation': ['engagement', 'churn_risk'],
    'engagement': ['retention', 'churn_risk', 'advocacy'],
    'retention': ['advocacy', 'churn_risk'],
    'churn_risk': ['churned', 'reactivation', 'retention'],
    'churned': ['reactivation', 'dormancy'],
    'reactivation': ['engagement', 'churn_risk'],
    'dormancy': ['reactivation', 'churned'],
    'advocacy': ['retention', 'engagement'],
  };

  const possibleStates = targetState ? [targetState] : commonTransitions[currentState] || [];

  for (const state of possibleStates) {
    // Calculate probability based on historical data
    const transitionsToState = historicalTransitions.filter(t => t.toState === state);
    const probability = historicalTransitions.length > 0
      ? transitionsToState.length / historicalTransitions.length
      : 0.5; // Default probability if no history

    // Estimate transition date based on typical durations
    const estimatedDate = estimateTransitionDate(currentState, state, historicalTransitions);

    // Calculate factors
    const factors = calculateTransitionFactors(currentState, state, historicalTransitions);

    predictions.push({
      state,
      probability: Math.min(0.95, Math.max(0.05, probability + 0.3)), // Add base probability
      estimatedDate,
      factors,
    });
  }

  // Sort by probability
  predictions.sort((a, b) => b.probability - a.probability);

  return predictions;
}

function estimateTransitionDate(
  fromState: string,
  toState: string,
  historicalTransitions: BehavioralTransition[]
): Date | undefined {
  const transitions = historicalTransitions.filter(
    t => t.fromState === fromState && t.toState === toState
  );

  if (transitions.length > 0) {
    const avgDuration = transitions.reduce((sum, t) => {
      return sum + (t.completedAt?.getTime() || Date.now()) - t.startedAt.getTime();
    }, 0) / transitions.length;

    const lastTransition = transitions[transitions.length - 1];
    return new Date(lastTransition.startedAt.getTime() + avgDuration);
  }

  // Default estimates based on typical lifecycle durations
  const defaultDurations: Record<string, number> = {
    'acquisition': 7 * 24 * 60 * 60 * 1000,
    'onboarding': 3 * 24 * 60 * 60 * 1000,
    'activation': 14 * 24 * 60 * 60 * 1000,
    'engagement': 30 * 24 * 60 * 60 * 1000,
    'retention': 60 * 24 * 60 * 60 * 1000,
    'churn_risk': 14 * 24 * 60 * 60 * 1000,
  };

  const duration = defaultDurations[fromState] || 30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + duration);
}

function calculateTransitionFactors(
  fromState: string,
  toState: string,
  historicalTransitions: BehavioralTransition[]
): TransitionFactor[] {
  const factors: TransitionFactor[] = [];

  // Analyze historical patterns
  const sameTransition = historicalTransitions.filter(
    t => t.fromState === fromState && t.toState === toState
  );

  if (sameTransition.length > 0) {
    factors.push({
      name: 'Historical precedent',
      contribution: 0.3,
      direction: 'positive',
      description: `${sameTransition.length} similar transitions observed in history`,
    });
  }

  // State-specific factors
  const stateFactors: Record<string, { name: string; contribution: number; direction: 'positive' | 'negative' | 'neutral'; description: string }> = {
    'churned': {
      name: 'Churn risk factors',
      contribution: 0.2,
      direction: 'negative',
      description: 'Multiple negative engagement signals detected',
    },
    'advocacy': {
      name: 'Advocacy signals',
      contribution: 0.25,
      direction: 'positive',
      description: 'Positive engagement and referral activity',
    },
    'reactivation': {
      name: 'Re-engagement potential',
      contribution: 0.15,
      direction: 'positive',
      description: 'Recent return to platform detected',
    },
  };

  const factor = stateFactors[toState];
  if (factor) {
    factors.push(factor);
  }

  // Default factor
  if (factors.length === 0) {
    factors.push({
      name: 'Default probability',
      contribution: 0.1,
      direction: 'neutral',
      description: 'Based on typical transition patterns',
    });
  }

  return factors;
}

// ============================================
// LIFECYCLE MANAGEMENT
// ============================================

export async function getLifecycle(request: GetLifecycleRequest): Promise<GetLifecycleResponse> {
  try {
    const { entityId, entityType } = request;

    // Find or create lifecycle state
    const key = `${entityType}:${entityId}`;
    let lifecycle = lifecycleStates.get(key);

    if (!lifecycle) {
      lifecycle = createInitialLifecycleState(entityId, entityType);
      lifecycleStates.set(key, lifecycle);
    }

    // Update lifecycle based on recent activity
    lifecycle = updateLifecycleState(lifecycle);

    // Generate recommendations
    const recommendations = generateLifecycleRecommendations(lifecycle);

    logger.info('Lifecycle retrieved', { entityId, currentStage: lifecycle.currentStage });

    return {
      success: true,
      lifecycle,
      recommendations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Lifecycle retrieval failed', { error: message });
    return { success: false, error: message };
  }
}

function createInitialLifecycleState(entityId: string, entityType: 'user' | 'merchant'): LifecycleState {
  return {
    entityId,
    entityType,
    currentStage: 'acquisition',
    stageEnteredAt: new Date(),
    timeInStage: 0,
    history: [],
    progression: 0,
    health: {
      score: 50,
      trend: 'stable',
      riskFactors: [],
    },
  };
}

function updateLifecycleState(lifecycle: LifecycleState): LifecycleState {
  const now = new Date();
  const timeInStage = (now.getTime() - lifecycle.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate progression based on typical stage duration
  const stageDurations: Record<LifecycleStageType, number> = {
    'acquisition': 7,
    'onboarding': 3,
    'activation': 14,
    'engagement': 30,
    'retention': 60,
    'churn_risk': 14,
    'churned': Infinity,
    'reactivation': 7,
    'advocacy': 30,
    'dormancy': 14,
  };

  const typicalDuration = stageDurations[lifecycle.currentStage] || 30;
  const progression = Math.min(1, timeInStage / typicalDuration);

  // Update health score based on progression
  let health = lifecycle.health;
  if (progression >= 0.8) {
    health = {
      ...health,
      trend: 'improving',
      riskFactors: health.riskFactors.filter(f => f !== 'Low engagement'),
    };
  }

  return {
    ...lifecycle,
    timeInStage,
    progression,
    health,
  };
}

function generateLifecycleRecommendations(lifecycle: LifecycleState): string[] {
  const recommendations: string[] = [];

  switch (lifecycle.currentStage) {
    case 'acquisition':
      recommendations.push('Complete onboarding to move to activation stage');
      recommendations.push('Make first purchase within 7 days');
      break;
    case 'onboarding':
      recommendations.push('Set up profile completely');
      recommendations.push('Complete tutorial or first meaningful action');
      break;
    case 'activation':
      recommendations.push('Engage with core features daily');
      recommendations.push('Establish first habit within 14 days');
      break;
    case 'engagement':
      recommendations.push('Increase session frequency');
      recommendations.push('Try new features to deepen engagement');
      break;
    case 'retention':
      recommendations.push('Maintain consistent engagement');
      recommendations.push('Consider premium upgrades');
      break;
    case 'churn_risk':
      recommendations.push('Re-engagement campaign needed');
      recommendations.push('Personalized offers to retain');
      break;
    case 'reactivation':
      recommendations.push('Welcome back with special offers');
      recommendations.push('Remind of unused features');
      break;
    case 'advocacy':
      recommendations.push('Request reviews and referrals');
      recommendations.push('Incentivize word-of-mouth');
      break;
    default:
      recommendations.push('Continue current engagement patterns');
  }

  return recommendations;
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus(): { status: 'healthy' | 'degraded' | 'unhealthy'; uptime: number; sequences: number; habits: number; predictions: number; lastProcessed: Date } {
  return {
    status: 'healthy',
    uptime: Date.now(),
    sequences: sequences.size,
    habits: habits.size,
    predictions: 0,
    lastProcessed: new Date(),
  };
}

export function getStats(): { totalSequences: number; totalHabits: number; totalTransitions: number; totalPredictions: number; avgSequenceLength: number; avgHabitConfidence: number; byType: Record<string, number> } {
  const habitConfidences = Array.from(habits.values()).map(h => h.confidence);
  const avgHabitConfidence = habitConfidences.length > 0
    ? habitConfidences.reduce((a, b) => a + b, 0) / habitConfidences.length
    : 0;

  const sequenceLengths = Array.from(sequences.values()).map(s => s.length);
  const avgSequenceLength = sequenceLengths.length > 0
    ? sequenceLengths.reduce((a, b) => a + b, 0) / sequenceLengths.length
    : 0;

  // Count by type
  const byType: Record<string, number> = {};
  habits.forEach(h => {
    byType[h.type] = (byType[h.type] || 0) + 1;
  });

  return {
    totalSequences: sequences.size,
    totalHabits: habits.size,
    totalTransitions: transitions.size,
    totalPredictions: 0,
    avgSequenceLength,
    avgHabitConfidence,
    byType,
  };
}

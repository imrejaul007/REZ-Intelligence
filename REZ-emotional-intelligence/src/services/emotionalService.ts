/**
 * REZ Emotional Intelligence - Core Service
 *
 * Handles mood tracking, sentiment analysis, wellness scoring
 */

import mongoose, { Schema, Document } from 'mongoose';
import type {
  MoodEntry,
  MoodState,
  EmotionType,
  MoodTrend,
  MoodPattern,
  WellnessScore,
  WellnessDimensions,
  SentimentAnalysis,
  EmotionalSignals,
  EmotionalContext,
  CosmicMoodOutput,
  EmotionScore,
} from '../types/index.js';

// ============================================
// MONGODB MODELS
// ============================================

export interface MoodEntryDocument extends Document {
  userId: string;
  timestamp: Date;
  mood: MoodState;
  primaryEmotion: EmotionType;
  secondaryEmotions: EmotionType[];
  intensity: number;
  energy: number;
  arousal: number;
  triggers: string[];
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
    timeOfDay?: string;
  };
}

const moodEntrySchema = new Schema<MoodEntryDocument>({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  mood: { type: String, required: true },
  primaryEmotion: { type: String, required: true },
  secondaryEmotions: [String],
  intensity: { type: Number, default: 50 },
  energy: { type: Number, default: 50 },
  arousal: { type: Number, default: 50 },
  triggers: [String],
  notes: String,
  location: {
    lat: Number,
    lng: Number,
    place: String,
  },
  context: {
    activity: String,
    weather: String,
    social: Boolean,
    timeOfDay: String,
  },
});

export const MoodEntryModel = mongoose.model<MoodEntryDocument>('MoodEntry', moodEntrySchema);

export interface WellnessDocument extends Document {
  userId: string;
  date: Date;
  scores: WellnessScore;
  dimensions: WellnessDimensions;
  riskFactors: string[];
  protectiveFactors: string[];
  lastUpdated: Date;
}

const wellnessSchema = new Schema<WellnessDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  date: { type: Date, default: Date.now },
  scores: {
    overall: { type: Number, default: 70 },
    mental: { type: Number, default: 70 },
    emotional: { type: Number, default: 70 },
    social: { type: Number, default: 70 },
    purpose: { type: Number, default: 70 },
    growth: { type: Number, default: 70 },
  },
  dimensions: {
    stress: { type: Number, default: 50 },
    resilience: { type: Number, default: 50 },
    mindfulness: { type: Number, default: 50 },
    gratitude: { type: Number, default: 50 },
    socialConnection: { type: Number, default: 50 },
    lifeSatisfaction: { type: Number, default: 50 },
  },
  riskFactors: [String],
  protectiveFactors: [String],
  lastUpdated: { type: Date, default: Date.now },
});

export const WellnessModel = mongoose.model<WellnessDocument>('Wellness', wellnessSchema);

export interface EmotionalSignalDocument extends Document {
  userId: string;
  timestamp: Date;
  signals: EmotionalSignals;
}

const emotionalSignalSchema = new Schema<EmotionalSignalDocument>({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  signals: {
    messageTone: String,
    responseTime: String,
    emojiUsage: Number,
    capsUsage: Number,
    typoRate: Number,
    engagementLevel: Number,
    socialActivity: Number,
    purchaseBehavior: String,
    browsingPattern: String,
    activeTimeOfDay: String,
    peakHours: [String],
    sleepQuality: Number,
    contentTypes: [String],
    sentimentTrend: String,
  },
});

export const EmotionalSignalModel = mongoose.model<EmotionalSignalDocument>('EmotionalSignal', emotionalSignalSchema);

// ============================================
// SENTIMENT ANALYSIS ENGINE
// ============================================

const POSITIVE_WORDS = [
  'happy', 'joy', 'love', 'great', 'amazing', 'wonderful', 'excellent',
  'fantastic', 'brilliant', 'awesome', 'beautiful', 'delightful', 'grateful',
  'thankful', 'blessed', 'excited', 'thrilled', 'pleased', 'satisfied',
  'content', 'peaceful', 'calm', 'relaxed', 'hopeful', 'optimistic',
];

const NEGATIVE_WORDS = [
  'sad', 'angry', 'frustrated', 'disappointed', 'upset', 'terrible',
  'horrible', 'awful', 'dreadful', 'miserable', 'depressed', 'anxious',
  'worried', 'stressed', 'overwhelmed', 'lonely', 'hurt', 'annoyed',
  'irritated', 'furious', 'enraged', 'hopeless', 'desperate',
];

const EMOTION_KEYWORDS: Record<string, string[]> = {
  joy: ['happy', 'joy', 'excited', 'delighted', 'thrilled', 'ecstatic'],
  sadness: ['sad', 'down', 'depressed', 'melancholy', 'blue', 'gloomy'],
  anger: ['angry', 'furious', 'mad', 'annoyed', 'irritated', 'frustrated'],
  fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified'],
  calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'soothing'],
  anxious: ['anxious', 'worried', 'nervous', 'uneasy', 'restless', 'tense'],
  grateful: ['grateful', 'thankful', 'appreciative', 'blessed', 'fortunate'],
  frustrated: ['frustrated', 'annoyed', 'irritated', 'stuck', 'blocked'],
};

export function analyzeSentiment(text: string): SentimentAnalysis {
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  const foundEmotions: EmotionScore[] = [];

  for (const word of words) {
    if (POSITIVE_WORDS.includes(word)) positiveCount++;
    if (NEGATIVE_WORDS.includes(word)) negativeCount++;
  }

  // Calculate polarity
  const total = positiveCount + negativeCount;
  let polarity: 'positive' | 'negative' | 'neutral' = 'neutral';
  let score = 0;

  if (total > 0) {
    const ratio = positiveCount / total;
    score = Math.round((ratio - 0.5) * 200); // -100 to 100
    polarity = score > 10 ? 'positive' : score < -10 ? 'negative' : 'neutral';
  }

  // Detect emotions
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    const matches = keywords.filter(k => words.includes(k));
    if (matches.length > 0) {
      foundEmotions.push({
        emotion: emotion as EmotionType,
        score: Math.min(100, matches.length * 30),
        confidence: Math.min(1, matches.length * 0.3 + 0.3),
      });
    }
  }

  // Intensity based on word count and emotion matches
  const intensity = Math.min(100, Math.round((total / Math.max(words.length, 1)) * 500));

  // Extract keywords
  const keywords = words.filter(w =>
    POSITIVE_WORDS.includes(w) || NEGATIVE_WORDS.includes(w)
  );

  return {
    polarity,
    score,
    emotions: foundEmotions,
    intensity,
    keywords,
  };
}

// ============================================
// MOOD SCORING ENGINE
// ============================================

const MOOD_SCORES: Record<MoodState, number> = {
  very_positive: 100,
  positive: 75,
  neutral: 50,
  negative: 25,
  very_negative: 5,
  anxious: 30,
  calm: 80,
  energetic: 85,
  tired: 40,
  stressed: 20,
  peaceful: 90,
};

// Type for mood entry data - accepts both MoodEntry and Mongoose Documents
type MoodEntryData = MoodEntryDocument | MoodEntry;

export function calculateMoodScore(mood: MoodState): number {
  return MOOD_SCORES[mood] ?? 50;
}

export function detectMoodFromSignals(signals: EmotionalSignals): MoodState {
  const { messageTone, engagementLevel, socialActivity, purchaseBehavior } = signals;

  let score = 50;

  // Adjust based on sentiment
  if (messageTone === 'positive') score += 15;
  else if (messageTone === 'negative') score -= 15;

  // Engagement level
  score += (engagementLevel - 50) * 0.3;

  // Social activity
  score += (socialActivity - 50) * 0.2;

  // Purchase behavior
  if (purchaseBehavior === 'positive') score += 10;
  else if (purchaseBehavior === 'negative') score -= 10;

  // Map to mood state
  if (score >= 85) return 'very_positive';
  if (score >= 65) return 'positive';
  if (score >= 55) return 'neutral';
  if (score >= 45) return 'neutral';
  if (score >= 25) return 'negative';
  return 'very_negative';
}

// ============================================
// WELLNESS SCORING ENGINE
// ============================================

export function calculateWellnessScore(
  moodHistory: MoodEntryData[],
  signals: EmotionalSignals
): WellnessScore {
  if (moodHistory.length === 0) {
    return {
      overall: 70,
      mental: 70,
      emotional: 70,
      social: 70,
      purpose: 70,
      growth: 70,
    };
  }

  // Average mood from history
  const avgMoodScore = moodHistory.reduce(
    (sum, m) => sum + calculateMoodScore(m.mood),
    0
  ) / moodHistory.length;

  // Calculate volatility (emotional stability)
  const scores = moodHistory.map(m => calculateMoodScore(m.mood));
  const variance = calculateVariance(scores);
  const stability = Math.max(0, 100 - variance);

  // Mental health from stress signals
  const mental = Math.round((stability + avgMoodScore) / 2);

  // Emotional from mood history
  const emotional = Math.round(avgMoodScore);

  // Social from signals
  const social = Math.round(signals.socialActivity);

  // Purpose (placeholder - would need deeper analysis)
  const purpose = Math.round((mental + emotional) / 2 + 10);

  // Growth (placeholder)
  const growth = Math.round(emotional * 0.8 + 15);

  // Overall
  const overall = Math.round((mental + emotional + social + purpose + growth) / 5);

  return { overall, mental, emotional, social, purpose, growth };
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

// ============================================
// TREND ANALYSIS
// ============================================

export function calculateMoodTrend(
  recentEntries: MoodEntryData[],
  olderEntries: MoodEntryData[]
): MoodTrend {
  if (recentEntries.length === 0) {
    return {
      direction: 'stable',
      delta: 0,
      volatility: 0,
      forecast: 50,
    };
  }

  const recentAvg = recentEntries.reduce(
    (sum, e) => sum + calculateMoodScore(e.mood),
    0
  ) / recentEntries.length;

  const olderAvg = olderEntries.length > 0
    ? olderEntries.reduce((sum, e) => sum + calculateMoodScore(e.mood), 0) / olderEntries.length
    : recentAvg;

  const delta = recentAvg - olderAvg;

  // Calculate volatility
  const scores = recentEntries.map(e => calculateMoodScore(e.mood));
  const variance = calculateVariance(scores);
  const volatility = Math.min(100, Math.round(variance * 0.5));

  // Determine direction
  let direction: 'improving' | 'declining' | 'stable' | 'volatile';
  if (delta > 5) direction = 'improving';
  else if (delta < -5) direction = 'declining';
  else if (volatility > 30) direction = 'volatile';
  else direction = 'stable';

  // Simple forecast (moving average with slight momentum)
  const forecast = Math.max(0, Math.min(100, recentAvg + delta * 0.2));

  return { direction, delta: Math.round(delta * 10) / 10, volatility, forecast };
}

// ============================================
// COSMIC INTERPRETATION ENGINE
// ============================================

export function generateCosmicInterpretation(
  mood: MoodState,
  energy: number,
  trend: MoodTrend
): CosmicMoodOutput {
  const energyLevel = energy > 70 ? 'high' : energy > 40 ? 'medium' : 'low';

  // Emotional tone mapping
  const emotionalTones: Record<MoodState, string> = {
    very_positive: 'Radiant and expansive',
    positive: 'Warm and hopeful',
    neutral: 'Balanced and steady',
    negative: 'Heavy and contracted',
    very_negative: 'Diminished and withdrawn',
    anxious: 'Restless and uncertain',
    calm: 'Serene and centered',
    energetic: 'Dynamic and vibrant',
    tired: 'Quiet and introspective',
    stressed: 'Tense and pressured',
    peaceful: 'Tranquil and content',
  };

  // Relationship energy based on mood
  const relationshipEnergies: Record<MoodState, string> = {
    very_positive: 'Good day for meaningful connections',
    positive: 'Favorable for social engagements',
    neutral: 'Moderate social energy',
    negative: 'Introspection may feel more appealing',
    very_negative: 'Solitude may provide restoration',
    anxious: 'Patient communication helps',
    calm: 'Excellent for deep conversations',
    energetic: 'Social interactions energize',
    tired: 'Quality over quantity in relationships',
    stressed: 'Set healthy boundaries',
    peaceful: 'Harmonious connections available',
  };

  // Financial flow based on mood
  const financialFlows: Record<string, string> = {
    high: 'Abundance mindset supports wise investments',
    medium: 'Balanced approach to financial decisions',
    low: 'Restraint in spending may feel wiser',
  };

  // Growth insights
  const growthInsights: Record<MoodState, string[]> = {
    very_positive: [
      'Share your energy with others',
      'This momentum is ideal for new beginnings',
    ],
    positive: [
      'Build on this positive momentum',
      'New environments may bring inspiration',
    ],
    neutral: [
      'Steady progress continues',
      'A good time for planning and reflection',
    ],
    negative: [
      'This phase will pass - be gentle with yourself',
      'Rest and recovery are valid priorities',
    ],
    very_negative: [
      'Seek support if needed - it\'s strength, not weakness',
      'Small steps forward are still progress',
    ],
    anxious: [
      'Focus on what you can control',
      'Grounding activities may help',
    ],
    calm: [
      'This equilibrium supports clear thinking',
      'Ideal for important decisions',
    ],
    energetic: [
      'Channel this energy into productive pursuits',
      'Physical activity amplifies this state',
    ],
    tired: [
      'Your body is asking for rest',
      'Recovery enables future achievements',
    ],
    stressed: [
      'Stress management is a form of self-care',
      'Consider delegating or postponing non-essentials',
    ],
    peaceful: [
      'This inner peace is a valuable resource',
      'Share this calm energy with those around you',
    ],
  };

  // Suggested actions
  const suggestedActions: Record<MoodState, string[]> = {
    very_positive: ['celebrate achievements', 'initiate projects', 'connect with loved ones'],
    positive: ['advance goals', 'express gratitude', 'plan next steps'],
    neutral: ['maintain routines', 'reflect on progress', 'prepare for opportunities'],
    negative: ['practice self-care', 'seek comfort', 'avoid major decisions'],
    very_negative: ['reach out for support', 'prioritize rest', 'be patient with yourself'],
    anxious: ['practice deep breathing', 'break tasks into smaller steps', 'limit stressors'],
    calm: ['meditate or reflect', 'enjoy simple pleasures', 'connect mindfully'],
    energetic: ['exercise or create', 'tackle challenging tasks', 'socialize actively'],
    tired: ['rest adequately', 'eat nourishing food', 'gentle movement only'],
    stressed: ['identify stressors', 'practice relaxation', 'consider boundaries'],
    peaceful: ['savor the moment', 'help others find peace', 'enjoy hobbies'],
  };

  // Timing advice based on trend
  const trendAdvice: Record<string, string> = {
    improving: 'Your energy is building - momentum is favorable for action',
    declining: 'Pace yourself - consider conservation over expansion',
    stable: 'Sustain the equilibrium - this is a foundation for growth',
    volatile: 'Flexibility serves you well - adapt rather than force',
  };

  return {
    cosmicState: {
      energyLevel,
      emotionalTone: emotionalTones[mood] || 'Variable and nuanced',
      socialEnergy: Math.round(energy * 0.8),
      focusScore: Math.round(energy * 0.9),
      relationshipEnergy: relationshipEnergies[mood] || 'Variable',
      financialFlow: financialFlows[energyLevel] || 'Variable',
      growthInsight: growthInsights[mood]?.[0] || 'Growth comes in many forms',
    },
    suggestedActions: suggestedActions[mood] || ['Be present'],
    timingAdvice: trendAdvice[trend.direction] || 'Trust your timing',
    interpretation: {
      symbolic: `The ${mood.replace('_', ' ')} state represents a natural rhythm in your personal journey.`,
      practical: `With ${energyLevel} energy and ${trend.direction} momentum, ${trendAdvice[trend.direction].toLowerCase()}.`,
    },
  };
}

// ============================================
// MOOD PATTERN ANALYSIS
// ============================================

export function analyzeMoodPatterns(entries: MoodEntryDocument[]): MoodPattern {
  const pattern: MoodPattern = {
    timeOfDay: {},
    dayOfWeek: {},
    locationCorrelations: {},
    activityCorrelations: {},
    weatherCorrelations: {},
    socialCorrelations: {},
  };

  // Group by time of day
  const byHour: Record<number, number[]> = {};
  const byWeekday: Record<number, number[]> = {};
  const byPlace: Record<string, number[]> = {};
  const byActivity: Record<string, number[]> = {};
  const byWeather: Record<string, number[]> = {};
  const bySocial: Record<string, number[]> = { 'true': [], 'false': [] };

  for (const entry of entries) {
    const hour = entry.timestamp.getHours();
    const weekday = entry.timestamp.getDay();
    const score = calculateMoodScore(entry.mood);

    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(score);

    if (!byWeekday[weekday]) byWeekday[weekday] = [];
    byWeekday[weekday].push(score);

    if (entry.location?.place) {
      if (!byPlace[entry.location.place]) byPlace[entry.location.place] = [];
      byPlace[entry.location.place].push(score);
    }

    if (entry.context?.activity) {
      if (!byActivity[entry.context.activity]) byActivity[entry.context.activity] = [];
      byActivity[entry.context.activity].push(score);
    }

    if (entry.context?.weather) {
      if (!byWeather[entry.context.weather]) byWeather[entry.context.weather] = [];
      byWeather[entry.context.weather].push(score);
    }

    if (entry.context?.social !== undefined) {
      bySocial[String(entry.context.social)].push(score);
    }
  }

  // Calculate averages
  pattern.timeOfDay = Object.fromEntries(
    Object.entries(byHour).map(([hour, scores]) => [hour, average(scores)])
  );

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  pattern.dayOfWeek = Object.fromEntries(
    Object.entries(byWeekday).map(([day, scores]) => [weekdays[parseInt(day)], average(scores)])
  );

  pattern.locationCorrelations = Object.fromEntries(
    Object.entries(byPlace).map(([place, scores]) => [place, average(scores)])
  );

  pattern.activityCorrelations = Object.fromEntries(
    Object.entries(byActivity).map(([activity, scores]) => [activity, average(scores)])
  );

  pattern.weatherCorrelations = Object.fromEntries(
    Object.entries(byWeather).map(([weather, scores]) => [weather, average(scores)])
  );

  pattern.socialCorrelations = {
    withOthers: average(bySocial['true']),
    alone: average(bySocial['false']),
  };

  return pattern;
}

function average(values: number[]): number {
  if (values.length === 0) return 50;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ============================================
// CONTEXT AGGREGATION
// ============================================

export async function getEmotionalContext(
  userId: string,
  includeCosmic = false
): Promise<{ context: EmotionalContext; cosmicOutput?: CosmicMoodOutput }> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Fetch mood entries
  const last24h = await MoodEntryModel.find({
    userId,
    timestamp: { $gte: oneDayAgo },
  }).sort({ timestamp: -1 });

  const last7d = await MoodEntryModel.find({
    userId,
    timestamp: { $gte: sevenDaysAgo },
  }).sort({ timestamp: -1 });

  const last14d = await MoodEntryModel.find({
    userId,
    timestamp: { $gte: fourteenDaysAgo },
  }).sort({ timestamp: -1 });

  // Fetch latest wellness
  const wellness = await WellnessModel.findOne({ userId });

  // Fetch latest signals
  const signals = await EmotionalSignalModel.findOne({ userId })
    .sort({ timestamp: -1 });

  // Current mood
  const currentMood = last24h[0]?.mood || 'neutral';
  const currentEnergy = last24h[0]?.energy || 50;

  // Calculate trends
  const recentEntries = last7d;
  const recentIds = new Set(last7d.map((e: unknown) => String((e as { _id: { toString: () => string } })._id.toString())));
  const olderEntries = last14d.filter((e: unknown) => !recentIds.has(String((e as { _id: { toString: () => string } })._id.toString())));
  const trend = calculateMoodTrend(recentEntries, olderEntries);

  // Calculate wellness
  const wellnessScore = wellness?.scores || calculateWellnessScore(last7d, signals?.signals || {
    messageTone: 'neutral',
    responseTime: 'normal',
    emojiUsage: 50,
    capsUsage: 10,
    typoRate: 10,
    engagementLevel: 50,
    socialActivity: 50,
    purchaseBehavior: 'neutral',
    browsingPattern: 'exploring',
    activeTimeOfDay: 'afternoon',
    peakHours: ['14:00', '18:00'],
    sleepQuality: 70,
    contentTypes: [],
    sentimentTrend: 'neutral',
  });

  // Calculate 24h aggregates
  const last24hScores = last24h.map((e: MoodEntryData) => calculateMoodScore(e.mood));
  const avgMood24h = average(last24hScores);
  const moodSwings = Math.round(calculateVariance(last24hScores) / 10);

  // Find dominant emotion
  const emotionCounts: Record<string, number> = {};
  for (const entry of last24h) {
    emotionCounts[entry.primaryEmotion] = (emotionCounts[entry.primaryEmotion] || 0) + 1;
  }
  const dominantEmotion = Object.entries(emotionCounts)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || 'calm';

  // 7d aggregates
  const avgMood7d = average(last7d.map((e: MoodEntryData) => calculateMoodScore(e.mood)));

  // Find peak/low days
  const dayScores: Record<string, number[]> = {};
  for (const entry of last7d) {
    const day = entry.timestamp.toLocaleDateString('en-US', { weekday: 'short' });
    if (!dayScores[day]) dayScores[day] = [];
    dayScores[day].push(calculateMoodScore(entry.mood));
  }
  const peakDay = Object.entries(dayScores)
    .map(([day, scores]) => ({ day, avg: average(scores) }))
    .sort((a: { avg: number }, b: { avg: number }) => b.avg - a.avg)[0]?.day || '';
  const lowDay = Object.entries(dayScores)
    .map(([day, scores]) => ({ day, avg: average(scores) }))
    .sort((a: { avg: number }, b: { avg: number }) => a.avg - b.avg)[0]?.day || '';

  // Risk flags
  const riskFlags: string[] = [];
  if (trend.direction === 'declining' && trend.delta < -10) {
    riskFlags.push('mood_decline');
  }
  if (trend.volatility > 40) {
    riskFlags.push('emotional_volatility');
  }
  if (last7d.length < 3) {
    riskFlags.push('insufficient_data');
  }

  const context: EmotionalContext = {
    userId,
    timestamp: now,
    currentMood,
    currentEmotions: last24h[0]?.secondaryEmotions.map(e => ({
      emotion: e as EmotionType,
      score: 50,
      confidence: 0.5,
    })) || [],
    currentEnergy,
    moodTrend: trend,
    wellnessScore,
    emotionalSignals: signals?.signals || {
      messageTone: 'neutral',
      responseTime: 'normal',
      emojiUsage: 50,
      capsUsage: 10,
      typoRate: 10,
      engagementLevel: 50,
      socialActivity: 50,
      purchaseBehavior: 'neutral',
      browsingPattern: 'exploring',
      activeTimeOfDay: 'afternoon',
      peakHours: ['14:00', '18:00'],
      sleepQuality: 70,
      contentTypes: [],
      sentimentTrend: 'neutral',
    },
    last24h: {
      averageMood: avgMood24h,
      moodSwings,
      dominantEmotion: dominantEmotion as EmotionType,
    },
    last7d: {
      averageMood: avgMood7d,
      trend: trend.direction,
      peakDay,
      lowDay,
    },
    predictedMoodTomorrow: trend.forecast > 60 ? 'positive' : trend.forecast > 40 ? 'neutral' : 'negative',
    riskFlags,
  };

  // Generate cosmic interpretation if requested
  let cosmicOutput: CosmicMoodOutput | undefined;
  if (includeCosmic) {
    cosmicOutput = generateCosmicInterpretation(currentMood, currentEnergy, trend);
  }

  return { context, cosmicOutput };
}

/**
 * REZ Human Context Graph - Core Service
 *
 * Unified context aggregation from all 15 life layers
 */

import mongoose, { Schema, Document } from 'mongoose';
import axios from 'axios';
import type {
  LifeLayer,
  LayerSignal,
  LayerContext,
  HumanContext,
  CosmicContext,
  CrossLayerInsight,
  RiskFactor,
  Opportunity,
  LifeStageAssessment,
  ALL_LIFE_LAYERS,
  HealthContext,
  CommerceContext,
  RelationshipContext,
  KarmaContext,
  CareerContext,
  BusinessContext,
  MobilityContext,
  SpiritualContext,
  FinancialContext,
  RealEstateContext,
  HospitalityContext,
  DailyLivingContext,
  HyperlocalContext,
  EventsContext,
  StudentContext,
} from '../types/index.js';

// ============================================
// SERVICE URLS
// ============================================

const SERVICE_URLS: Record<string, string> = {
  emotional: process.env.EMOTIONAL_SERVICE_URL || 'http://localhost:4160',
  lifePattern: process.env.LIFE_PATTERN_SERVICE_URL || 'http://localhost:4161',
  risacare: process.env.RISACARE_SERVICE_URL || 'http://localhost:4700',
  intent: process.env.INTENT_SERVICE_URL || 'http://localhost:3001',
  signalAggregator: process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4142',
  predictive: process.env.PREDICTIVE_SERVICE_URL || 'http://localhost:4141',
  memory: process.env.MEMORY_SERVICE_URL || 'http://localhost:4201',
};

// ============================================
// MONGODB MODELS
// ============================================

export interface HumanContextDocument extends Document {
  userId: string;
  universalId: string;
  layers: Record<LifeLayer, LayerContext>;
  crossLayerInsights: CrossLayerInsight[];
  lifeStage: LifeStageAssessment;
  lastUpdated: Date;
}

const humanContextSchema = new Schema<HumanContextDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  universalId: String,
  layers: {
    type: Map,
    of: new Schema({
      layer: String,
      status: String,
      lastUpdated: Date,
      signals: Array,
      summary: String,
      dataPoints: Number,
    }),
  },
  crossLayerInsights: Array,
  lifeStage: {
    current: String,
    confidence: Number,
    indicators: [String],
    transitionSignals: {
      to: String,
      confidence: Number,
      timeline: String,
    },
  },
  lastUpdated: { type: Date, default: Date.now },
});

export const HumanContextModel = mongoose.model<HumanContextDocument>('HumanContext', humanContextSchema);

// ============================================
// LAYER SIGNAL STORAGE
// ============================================

export interface SignalDocument extends Document {
  userId: string;
  layer: LifeLayer;
  signal: string;
  value: unknown;
  source: string;
  confidence: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

const signalSchema = new Schema<SignalDocument>({
  userId: { type: String, required: true, index: true },
  layer: { type: String, required: true, index: true },
  signal: { type: String, required: true },
  value: Schema.Types.Mixed,
  source: { type: String, required: true },
  confidence: { type: Number, default: 0.5 },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: Schema.Types.Mixed,
});

export const SignalModel = mongoose.model<SignalDocument>('LayerSignal', signalSchema);

// ============================================
// SIGNAL COLLECTION
// ============================================

export async function collectLayerSignal(
  userId: string,
  layer: LifeLayer,
  signal: string,
  value: unknown,
  source: string,
  confidence = 0.5,
  metadata?: Record<string, unknown>
): Promise<void> {
  const layerSignal: LayerSignal = {
    layer,
    source,
    signal,
    value,
    confidence,
    timestamp: new Date(),
    metadata,
  };

  // Store signal
  const signalDoc = new SignalModel({
    userId,
    layer,
    signal,
    value,
    source,
    confidence,
    timestamp: new Date(),
    metadata,
  });

  await signalDoc.save();

  // Update aggregated context
  await updateLayerContext(userId, layerSignal);
}

async function updateLayerContext(userId: string, signal: LayerSignal): Promise<void> {
  let context = await HumanContextModel.findOne({ userId });

  if (!context) {
    context = new HumanContextModel({
      userId,
      universalId: `HUMAN_${userId}`,
      layers: {} as Record<LifeLayer, LayerContext>,
      crossLayerInsights: [],
      lifeStage: { current: 'unknown', confidence: 0, indicators: [] },
    });
  }

  // Get existing layer context or create new
  const layerMap = context.layers as unknown as Record<LifeLayer, LayerContext>;
  if (!layerMap[signal.layer]) {
    layerMap[signal.layer] = {
      layer: signal.layer,
      status: 'active',
      lastUpdated: new Date(),
      signals: [],
      dataPoints: 0,
    };
  }

  // Add signal to layer
  const existingSignals = layerMap[signal.layer].signals || [];
  existingSignals.push(signal);

  // Keep only last 100 signals per layer
  if (existingSignals.length > 100) {
    existingSignals.shift();
  }

  layerMap[signal.layer] = {
    layer: signal.layer,
    status: 'active',
    lastUpdated: new Date(),
    signals: existingSignals,
    summary: generateLayerSummary(signal.layer, existingSignals),
    dataPoints: existingSignals.length,
  };

  context.layers = layerMap as unknown as typeof context.layers;
  context.lastUpdated = new Date();

  await context.save();
}

// ============================================
// CONTEXT AGGREGATION
// ============================================

export async function aggregateHumanContext(
  userId: string,
  requestedLayers?: LifeLayer[]
): Promise<HumanContext> {
  // Get existing context
  let context = await HumanContextModel.findOne({ userId });

  // Fetch from upstream services
  const upstreamContexts = await Promise.allSettled([
    fetchEmotionalContext(userId),
    fetchLifePatternContext(userId),
    fetchCommerceContext(userId),
    fetchCareerContext(userId),
    fetchMobilityContext(userId),
    fetchWellnessContext(userId),
  ]);

  // Build context from all sources
  const humanContext: HumanContext = {
    userId,
    timestamp: new Date(),
    universalId: context?.universalId || `HUMAN_${userId}`,
    crossLayerInsights: [],
    lifeStage: { current: 'unknown', confidence: 0, indicators: [] },
    riskFactors: [],
    opportunities: [],
    dataCompleteness: {} as Record<LifeLayer, number>,
  };

  // Process emotional (spiritual layer)
  const emotionalResult = upstreamContexts[0];
  if (emotionalResult.status === 'fulfilled' && emotionalResult.value) {
    humanContext.spiritual = emotionalResult.value as SpiritualContext;
    humanContext.dataCompleteness.spiritual = 70;
  } else {
    humanContext.dataCompleteness.spiritual = 0;
  }

  // Process life patterns (daily layer)
  const lifePatternResult = upstreamContexts[1];
  if (lifePatternResult.status === 'fulfilled' && lifePatternResult.value) {
    humanContext.daily = lifePatternResult.value as DailyLivingContext;
    humanContext.dataCompleteness.daily = 60;
  } else {
    humanContext.dataCompleteness.daily = 0;
  }

  // Process commerce context
  const commerceResult = upstreamContexts[2];
  if (commerceResult.status === 'fulfilled' && commerceResult.value) {
    humanContext.commerce = commerceResult.value as CommerceContext;
    humanContext.dataCompleteness.commerce = 80;
  } else {
    humanContext.dataCompleteness.commerce = 0;
  }

  // Process career context
  const careerResult = upstreamContexts[3];
  if (careerResult.status === 'fulfilled' && careerResult.value) {
    humanContext.career = careerResult.value as CareerContext;
    humanContext.dataCompleteness.career = 50;
  } else {
    humanContext.dataCompleteness.career = 0;
  }

  // Process mobility context
  const mobilityResult = upstreamContexts[4];
  if (mobilityResult.status === 'fulfilled' && mobilityResult.value) {
    humanContext.mobility = mobilityResult.value as MobilityContext;
    humanContext.dataCompleteness.mobility = 70;
  } else {
    humanContext.dataCompleteness.mobility = 0;
  }

  // Process wellness (health layer)
  const wellnessResult = upstreamContexts[5];
  if (wellnessResult.status === 'fulfilled' && wellnessResult.value) {
    humanContext.health = wellnessResult.value as HealthContext;
    humanContext.dataCompleteness.health = 75;
  } else {
    humanContext.dataCompleteness.health = 0;
  }

  // Generate cross-layer insights
  humanContext.crossLayerInsights = generateCrossLayerInsights(humanContext);

  // Assess life stage
  humanContext.lifeStage = assessLifeStage(humanContext);

  // Identify risk factors
  humanContext.riskFactors = identifyRiskFactors(humanContext);

  // Identify opportunities
  humanContext.opportunities = identifyOpportunities(humanContext);

  // Fill in defaults for missing layers
  const allLayers: LifeLayer[] = [
    'health', 'commerce', 'relationship', 'karma', 'career', 'business',
    'mobility', 'spiritual', 'financial', 'realestate', 'hospitality',
    'daily', 'hyperlocal', 'events', 'student'
  ];

  for (const layer of allLayers) {
    if (humanContext.dataCompleteness[layer] === undefined) {
      humanContext.dataCompleteness[layer] = 0;
    }
  }

  return humanContext;
}

// ============================================
// UPSTREAM SERVICE FETCHERS
// ============================================

async function fetchEmotionalContext(userId: string): Promise<SpiritualContext | null> {
  try {
    const response = await axios.get(
      `${SERVICE_URLS.emotional}/api/context`,
      { data: { userId }, timeout: 5000 }
    );
    const data = response.data;

    return {
      layer: 'spiritual',
      emotionalState: data.context?.currentMood || 'neutral',
      stressLevel: 100 - (data.context?.currentEnergy || 50),
      mindfulnessPractice: data.context?.wellnessScore?.mental || 50,
      meaningClarity: data.context?.wellnessScore?.purpose || 50,
      innerPeace: data.context?.wellnessScore?.emotional || 50,
      gratitudeLevel: data.context?.wellnessScore?.social || 50,
    };
  } catch {
    // Return partial from stored signals
    const signals = await SignalModel.find({
      userId,
      layer: 'spiritual',
    }).sort({ timestamp: -1 }).limit(10);

    if (signals.length > 0) {
      return {
        layer: 'spiritual',
        emotionalState: signals[0].signal as string || 'neutral',
        stressLevel: 50,
        mindfulnessPractice: 50,
        meaningClarity: 50,
        innerPeace: 50,
        gratitudeLevel: 50,
      };
    }
    return null;
  }
}

async function fetchLifePatternContext(userId: string): Promise<DailyLivingContext | null> {
  try {
    const response = await axios.post(
      `${SERVICE_URLS.lifePattern}/api/context`,
      { userId },
      { timeout: 5000 }
    );
    const data = response.data;

    return {
      layer: 'daily',
      routineConsistency: data.context?.routineConsistency || 50,
      homeBehavior: 'relaxed',
      sleepSchedule: 'consistent',
      productivityCycles: data.context?.lifestyle?.activityLevel === 'active' ? 80 : 50,
    };
  } catch {
    return null;
  }
}

async function fetchCommerceContext(userId: string): Promise<CommerceContext | null> {
  try {
    // Get psychology profile
    const response = await axios.get(
      `${process.env.BEHAVIORAL_PSYCHOLOGY_URL || 'http://localhost:4110'}/api/psychology/${userId}/scores`,
      { timeout: 5000 }
    );
    const data = response.data;

    return {
      layer: 'commerce',
      spendingLevel: 50,
      purchaseFrequency: 5,
      categoryAffinities: {},
      diningPreferences: [],
      brandPreferences: [],
      priceSensitivity: data.scores?.priceSensitivity || 50,
      impulseScore: data.scores?.impulseScore || 50,
    };
  } catch {
    return null;
  }
}

async function fetchCareerContext(userId: string): Promise<CareerContext | null> {
  // Get signals from career-related activities
  const signals = await SignalModel.find({
    userId,
    layer: 'career',
    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  if (signals.length === 0) {
    return null;
  }

  return {
    layer: 'career',
    burnoutRisk: 50,
    ambitionLevel: 50,
    productivityScore: 50,
    workSatisfaction: 50,
    careerStage: 'growth',
    workLifeBalance: 50,
  };
}

async function fetchMobilityContext(userId: string): Promise<MobilityContext | null> {
  try {
    const signals = await SignalModel.find({
      userId,
      layer: 'mobility',
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const travelSignals = signals.filter((s: SignalDocument) => s.signal.includes('travel'));
    const commuteSignals = signals.filter((s: SignalDocument) => s.signal.includes('commute'));

    return {
      layer: 'mobility',
      travelFrequency: travelSignals.length,
      commutePattern: commuteSignals.length > 10 ? 'daily' : 'occasional',
      explorationLevel: 50,
      mobilityStress: 30,
      preferredTransport: ['car', 'public'],
      frequentDestinations: [],
    };
  } catch {
    return null;
  }
}

async function fetchWellnessContext(userId: string): Promise<HealthContext | null> {
  try {
    const response = await axios.get(
      `${SERVICE_URLS.emotional}/api/wellness/${userId}`,
      { timeout: 5000 }
    );
    const data = response.data;

    return {
      layer: 'health',
      wellnessScore: data.wellness?.scores?.overall || 70,
      sleepQuality: data.wellness?.dimensions?.mindfulness || 70,
      stressLevel: data.wellness?.dimensions?.stress || 50,
      recoveryStatus: 'stable',
      fitnessLevel: 70,
      healthGoals: [],
      recentHealthEvents: [],
    };
  } catch {
    return null;
  }
}

// ============================================
// CROSS-LAYER ANALYSIS
// ============================================

function generateCrossLayerInsights(context: HumanContext): CrossLayerInsight[] {
  const insights: CrossLayerInsight[] = [];

  // Health-Productivity correlation
  if (context.health && context.career) {
    if (context.health.wellnessScore > 70 && context.career.productivityScore > 70) {
      insights.push({
        type: 'correlation',
        description: 'Strong wellness supports high productivity',
        layers: ['health', 'career'],
        confidence: 0.8,
        action: 'Maintain current health routines to sustain productivity',
      });
    }
    if (context.health.stressLevel > 70 && context.career.burnoutRisk > 70) {
      insights.push({
        type: 'causation',
        description: 'High stress may be contributing to burnout risk',
        layers: ['health', 'career'],
        confidence: 0.75,
        action: 'Consider stress management interventions',
      });
    }
  }

  // Financial-Spiritual correlation
  if (context.financial && context.spiritual) {
    if (context.financial.financialStress > 70) {
      insights.push({
        type: 'correlation',
        description: 'Financial stress may be affecting emotional wellbeing',
        layers: ['financial', 'spiritual'],
        confidence: 0.7,
        action: 'Mindfulness practices may help manage financial anxiety',
      });
    }
  }

  // Mobility-Social correlation
  if (context.mobility && context.relationship) {
    if (context.mobility.travelFrequency > 5 && context.relationship.socialEnergy > 70) {
      insights.push({
        type: 'correlation',
        description: 'Active lifestyle correlates with high social energy',
        layers: ['mobility', 'relationship'],
        confidence: 0.65,
      });
    }
  }

  return insights;
}

function assessLifeStage(context: HumanContext): LifeStageAssessment {
  let stage = 'early_career';
  let confidence = 0.5;
  const indicators: string[] = [];

  // Based on career context
  if (context.career) {
    indicators.push(`Career stage: ${context.career.careerStage}`);
    indicators.push(`Burnout risk: ${context.career.burnoutRisk}%`);

    if (context.career.careerStage === 'early') {
      stage = 'early_career';
      confidence = 0.8;
    } else if (context.career.careerStage === 'growth') {
      stage = 'career_growth';
      confidence = 0.75;
    }
  }

  // Based on mobility patterns
  if (context.mobility) {
    if (context.mobility.commutePattern === 'daily') {
      indicators.push('Regular commuting suggests established work life');
    }
    if (context.mobility.travelFrequency > 4) {
      indicators.push('Frequent travel indicates established resources');
    }
  }

  // Based on financial context
  if (context.financial) {
    if (context.financial.savingsRate > 30) {
      indicators.push('Healthy savings rate suggests established phase');
    }
  }

  return {
    current: stage,
    confidence,
    indicators,
  };
}

function identifyRiskFactors(context: HumanContext): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Health risks
  if (context.health) {
    if (context.health.stressLevel > 80) {
      risks.push({
        category: 'Health',
        level: 'high',
        description: 'Very high stress levels detected',
        layers: ['health', 'career'],
        recommendation: 'Prioritize stress management and recovery activities',
      });
    }
    if (context.health.recoveryStatus === 'depleted') {
      risks.push({
        category: 'Health',
        level: 'critical',
        description: 'Recovery status depleted - immediate rest needed',
        layers: ['health'],
        recommendation: 'Take immediate rest and reduce activity load',
      });
    }
  }

  // Career risks
  if (context.career) {
    if (context.career.burnoutRisk > 80) {
      risks.push({
        category: 'Career',
        level: 'high',
        description: 'Critical burnout risk detected',
        layers: ['career', 'health'],
        recommendation: 'Consider workload reduction and recovery time',
      });
    }
    if (context.career.workLifeBalance < 30) {
      risks.push({
        category: 'Work-Life Balance',
        level: 'medium',
        description: 'Poor work-life balance may affect wellbeing',
        layers: ['career', 'daily'],
        recommendation: 'Set boundaries for personal time',
      });
    }
  }

  // Financial risks
  if (context.financial) {
    if (context.financial.financialStress > 70) {
      risks.push({
        category: 'Financial',
        level: 'medium',
        description: 'High financial stress may impact mental health',
        layers: ['financial', 'spiritual'],
        recommendation: 'Consider financial planning or counseling',
      });
    }
  }

  return risks;
}

function identifyOpportunities(context: HumanContext): Opportunity[] {
  const opportunities: Opportunity[] = [];

  // Health opportunity
  if (context.health && context.health.wellnessScore > 70) {
    opportunities.push({
      category: 'Health',
      description: 'Good wellness foundation - expand healthy habits',
      layers: ['health', 'daily'],
      potential: 80,
      recommendation: 'Consider adding mindfulness or fitness routines',
    });
  }

  // Career opportunity
  if (context.career && context.career.ambitionLevel > 70) {
    opportunities.push({
      category: 'Career',
      description: 'High ambition - good time for growth initiatives',
      layers: ['career', 'student'],
      potential: 90,
      recommendation: 'Consider skill development or networking opportunities',
    });
  }

  // Social opportunity
  if (context.relationship && context.relationship.socialEnergy > 70) {
    opportunities.push({
      category: 'Social',
      description: 'High social energy - ideal for networking',
      layers: ['relationship', 'events'],
      potential: 75,
      recommendation: 'Good time for social events and relationship building',
    });
  }

  return opportunities;
}

// ============================================
// LAYER SUMMARY GENERATION
// ============================================

function generateLayerSummary(layer: LifeLayer, signals: LayerSignal[]): string {
  if (signals.length === 0) return 'No signals available';

  const latest = signals[signals.length - 1];
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

  const summaries: Record<LifeLayer, string> = {
    health: `Wellness tracking active. Latest: ${latest.signal}`,
    commerce: `Commerce signals collected. Confidence: ${Math.round(avgConfidence * 100)}%`,
    relationship: `Social patterns tracked. Recent: ${latest.signal}`,
    karma: `Impact actions recorded. ${signals.length} activities`,
    career: `Career signals active. Stage: ${latest.value || 'unknown'}`,
    business: `Business health monitored. Latest: ${latest.signal}`,
    mobility: `Mobility patterns tracked. Recent: ${latest.signal}`,
    spiritual: `Emotional wellbeing monitored. State: ${latest.signal}`,
    financial: `Financial health tracked. Status: ${latest.signal}`,
    realestate: `Housing signals collected. ${signals.length} data points`,
    hospitality: `Travel preferences tracked. ${signals.length} signals`,
    daily: `Daily patterns analyzed. Confidence: ${Math.round(avgConfidence * 100)}%`,
    hyperlocal: `Neighborhood activity tracked. ${signals.length} data points`,
    events: `Event interests mapped. ${signals.length} signals`,
    student: `Academic patterns tracked. ${signals.length} activities`,
  };

  return summaries[layer] || `${layer} context tracked with ${signals.length} signals`;
}

// ============================================
// COSMIC CONTEXT GENERATION
// ============================================

export async function generateCosmicContext(
  humanContext: HumanContext
): Promise<CosmicContext> {
  // Calculate energy level
  let energyScore = 50;
  const factors: number[] = [];

  if (humanContext.health) {
    factors.push(humanContext.health.wellnessScore);
  }
  if (humanContext.spiritual) {
    factors.push(100 - humanContext.spiritual.stressLevel);
  }
  if (humanContext.daily) {
    factors.push(humanContext.daily.routineConsistency);
  }

  if (factors.length > 0) {
    energyScore = factors.reduce((a, b) => a + b, 0) / factors.length;
  }

  const energyLevel = energyScore > 70 ? 'high' : energyScore > 40 ? 'medium' : 'low';

  // Determine emotional tone
  let emotionalTone = 'Balanced and steady';
  if (humanContext.spiritual) {
    const state = humanContext.spiritual.emotionalState;
    const toneMap: Record<string, string> = {
      positive: 'Warm and hopeful',
      very_positive: 'Radiant and expansive',
      neutral: 'Balanced and steady',
      negative: 'Reflective and cautious',
      very_negative: 'Quiet and introspective',
      calm: 'Serene and centered',
      anxious: 'Restless and uncertain',
      stressed: 'Tense and pressured',
    };
    emotionalTone = toneMap[state] || 'Variable and nuanced';
  }

  // Calculate focus score
  const focusScore = humanContext.daily
    ? Math.round((humanContext.daily.productivityCycles + energyScore) / 2)
    : Math.round(energyScore);

  // Calculate social energy
  const socialEnergy = humanContext.relationship
    ? humanContext.relationship.socialEnergy
    : 50;

  // Determine growth momentum
  let growthMomentum: 'accelerating' | 'steady' | 'challenging' = 'steady';
  if (humanContext.riskFactors.some(r => r.level === 'critical' || r.level === 'high')) {
    growthMomentum = 'challenging';
  } else if (humanContext.opportunities.length > 2) {
    growthMomentum = 'accelerating';
  }

  // Generate symbolic interpretations (abstracted, not surveillance)
  const interpretations = {
    healthSymbol: generateSymbolicInterpretation('health', humanContext.health?.wellnessScore || 50),
    careerSymbol: generateSymbolicInterpretation('career', humanContext.career?.productivityScore || 50),
    relationshipSymbol: generateSymbolicInterpretation('relationship', socialEnergy),
    financialSymbol: generateSymbolicInterpretation('financial', 100 - (humanContext.financial?.financialStress || 50)),
    spiritualSymbol: generateSymbolicInterpretation('spiritual', humanContext.spiritual?.innerPeace || 50),
  };

  // Generate suggested actions based on context
  const suggestedActions = generateSuggestedActions(humanContext);

  // Generate timing advice
  const timingAdvice = generateTimingAdvice(humanContext);

  // Generate avoided actions
  const avoidedActions = generateAvoidedActions(humanContext);

  // Generate abstract insights
  const abstractInsights = generateAbstractInsights(humanContext);

  return {
    userId: humanContext.userId,
    timestamp: new Date(),
    cosmicState: {
      energyLevel,
      emotionalTone,
      socialEnergy: Math.round(socialEnergy),
      focusScore: Math.round(focusScore),
      growthMomentum,
    },
    interpretations,
    suggestedActions,
    timingAdvice,
    avoidedActions,
    abstractInsights,
  };
}

// ============================================
// COSMIC HELPERS
// ============================================

function generateSymbolicInterpretation(domain: string, score: number): string {
  const interpretations: Record<string, Record<string, string>> = {
    health: {
      high: 'Your body is finding its rhythm - this is a foundation for growth',
      medium: 'Balance is within reach - small adjustments may bring harmony',
      low: 'Rest and recovery may be calling - this too shall pass',
    },
    career: {
      high: 'Momentum is building - your efforts are finding their purpose',
      medium: 'Steady progress continues - consistency is its own reward',
      low: 'A quieter phase may serve reflection and recalibration',
    },
    relationship: {
      high: 'Connections are flowing naturally - share this energy wisely',
      medium: 'Quality connections matter more than quantity right now',
      low: 'Solitude can be its own form of connection with self',
    },
    financial: {
      high: 'Abundance mindset opens doors to wise decisions',
      medium: 'Conservation and expansion both have their place',
      low: 'Restraint in this moment may prevent future constraint',
    },
    spiritual: {
      high: 'Inner peace is a rare gift - savor and share it',
      medium: 'Clarity comes in quiet moments',
      low: 'The storm passes - inner calm awaits on the other side',
    },
  };

  const level = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';
  return interpretations[domain]?.[level] || 'Life is a series of cycles';
}

function generateSuggestedActions(context: HumanContext): string[] {
  const actions: string[] = [];

  // Based on energy level
  const energy = context.cosmicState?.energyLevel || 'medium';

  if (energy === 'high') {
    actions.push('Channel this energy into meaningful pursuits');
    actions.push('Start that project you\'ve been contemplating');
  } else if (energy === 'low') {
    actions.push('Rest is productive - honor your body\'s signals');
    actions.push('Light activities over ambitious projects today');
  } else {
    actions.push('Maintain your current pace');
    actions.push('Small consistent actions compound over time');
  }

  // Based on opportunities
  if (context.opportunities.length > 0) {
    actions.push(`Consider: ${context.opportunities[0].recommendation || context.opportunities[0].description}`);
  }

  // Based on life stage
  if (context.lifeStage.current === 'early_career') {
    actions.push('Invest in relationships and skills');
  } else if (context.lifeStage.current === 'career_growth') {
    actions.push('Seek opportunities for visibility and impact');
  }

  return actions.slice(0, 5); // Limit to 5 actions
}

function generateTimingAdvice(context: HumanContext): string {
  const momentum = context.cosmicState?.growthMomentum || 'steady';

  if (momentum === 'accelerating') {
    return 'This is a favorable time for new beginnings and taking decisive action';
  } else if (momentum === 'challenging') {
    return 'Patience and persistence may serve better than rapid action';
  } else {
    return 'Steady, consistent effort will yield results over time';
  }
}

function generateAvoidedActions(context: HumanContext): string[] {
  const avoided: string[] = [];

  // Based on risk factors
  for (const risk of context.riskFactors) {
    if (risk.level === 'high' || risk.level === 'critical') {
      if (risk.category === 'Health' && risk.layers.includes('career')) {
        avoided.push('Avoid taking on additional high-stress commitments');
      }
      if (risk.category === 'Financial') {
        avoided.push('Avoid impulsive financial decisions during stress');
      }
    }
  }

  // Based on energy level
  if (context.cosmicState?.energyLevel === 'low') {
    avoided.push('Avoid major decisions when energy is depleted');
    avoided.push('Postpone high-stakes conversations');
  }

  return [...new Set(avoided)].slice(0, 3); // Dedupe and limit
}

function generateAbstractInsights(context: HumanContext): string[] {
  const insights: string[] = [];

  // Based on cross-layer insights
  for (const insight of context.crossLayerInsights.slice(0, 2)) {
    insights.push(insight.description);
  }

  // Based on life stage
  insights.push(context.lifeStage.indicators[0] || 'Life is a journey of continuous growth');

  // Based on opportunities
  if (context.opportunities.length > 0) {
    insights.push(`Potential: ${context.opportunities[0].category} growth`);
  }

  return insights.slice(0, 3); // Limit to 3 insights
}

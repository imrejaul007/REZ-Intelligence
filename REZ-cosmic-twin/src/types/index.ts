/**
 * REZ Cosmic Twin - Type Definitions
 *
 * AI Digital Self Model - Your personalized AI representation
 * Port: 4168
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// PERSONALITY VECTORS
// ============================================

export interface PersonalityVector {
  dimension: string;
  value: number; // -100 to 100
  confidence: number;
  stability: number;
  evolution: number; // Rate of change
}

export interface PersonalityModel {
  userId: string;
  vectors: PersonalityVector[];
  baseline: {
    date: Date;
    vectors: PersonalityVector[];
  };
  archetype?: string;
  temperament?: string;
  coreTraits: string[];
  shadowTraits: string[];
  integrationLevel: number; // 0-100
}

// ============================================
// BEHAVIORAL RHYTHMS
// ============================================

export interface BehavioralRhythm {
  type: 'circadian' | 'weekly' | 'monthly' | 'seasonal' | 'life_cycle';
  pattern: string;
  peakTime?: string;
  lowTime?: string;
  consistency: number;
  variation: number;
}

export interface EnergyCycle {
  type: 'high' | 'medium' | 'low' | 'recovery';
  duration: number; // Hours or days
  frequency: string;
  triggers: string[];
  indicators: string[];
}

export interface DecisionRhythm {
  context: string;
  typicalResponse: string;
  hesitationPattern: number;
  confidenceRange: { min: number; max: number };
  growthEdge: string;
}

// ============================================
// EMOTIONAL TENDENCIES
// ============================================

export interface EmotionalTendency {
  emotion: string;
  defaultResponse: 'express' | 'suppress' | 'process' | 'avoid';
  regulationStrategy: string;
  triggers: string[];
  healthyRange: { min: number; max: number };
  currentState: number;
  growth: number;
}

export interface EmotionalPattern {
  pattern: 'reactive' | 'proactive' | 'reflective' | 'bypass';
  description: string;
  strength: number;
  flexibility: number;
}

export interface EmotionalIntelligence {
  selfAwareness: number;
  selfRegulation: number;
  empathy: number;
  socialRegulation: number;
  emotionalRange: number;
}

// ============================================
// COGNITIVE PATTERNS
// ============================================

export interface CognitivePattern {
  thinkingStyle: 'analytical' | 'intuitive' | 'practical' | 'creative' | 'systematic';
  decisionMaking: 'rational' | 'emotional' | 'balanced';
  riskTolerance: number; // 0-100
  adaptability: number;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'mixed';
}

export interface CognitiveStrength {
  type: string;
  description: string;
  application: string[];
}

export interface CognitiveBias {
  bias: string;
  awareness: number;
  mitigation: string[];
}

// ============================================
// RELATIONSHIP PATTERNS
// ============================================

export interface RelationshipPattern {
  attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
  intimacyCapacity: number;
  conflictStyle: 'assertive' | 'passive' | 'aggressive' | 'passive_aggressive' | 'collaborative';
  trustBuilding: number;
  boundarySetting: number;
}

export interface SocialEnergy {
  rechargeStyle: 'alone' | 'with_others' | 'balanced';
  extroversion: number; // 0-100
  socialNeeds: string[];
  isolationRisk: number;
}

export interface ConnectionPattern {
  type: 'deep' | 'broad' | 'selective' | 'casual';
  quality: number;
  maintenance: number;
  reciprocity: number;
}

// ============================================
// VALUE SYSTEM
// ============================================

export interface ValueSystem {
  coreValues: Array<{ value: string; strength: number }>;
  heldValues: Array<{ value: string; practiced: number; gap: number }>;
  aspirationalValues: string[];
  conflictPoints: Array<{ value1: string; value2: string; tension: number }>;
  valueEvolution: string[];
}

export interface LifePriority {
  area: string;
  weight: number;
  attention: number;
  satisfaction: number;
}

export interface MoralFramework {
  type: 'consequentialist' | 'deontological' | 'virtue' | 'care' | 'mixed';
  primaryPrinciples: string[];
  flexibility: number;
}

// ============================================
// COPING MECHANISMS
// ============================================

export interface CopingMechanism {
  type: 'adaptive' | 'maladaptive' | 'neutral';
  strategy: string;
  effectiveness: number;
  context: string[];
  triggers: string[];
  alternative?: string;
}

export interface StressResponse {
  threshold: number;
  pattern: 'fight' | 'flight' | 'freeze' | 'fawn';
  recoveryTime: number;
  resilience: number;
}

export interface ResilienceFactors {
  supportSystem: number;
  copingToolkit: number;
  meaningMaking: number;
  adaptability: number;
  selfEfficacy: number;
}

// ============================================
// PURPOSE & MEANING
// ============================================

export interface LifePurpose {
  articulated: boolean;
  statement?: string;
  components: string[];
  alignment: number; // How aligned with actions
  evolution: string[];
}

export interface MeaningSystem {
  sources: string[];
  coherence: number;
  stability: number;
  growth: number;
}

export interface LifeMission {
  contribution: string;
  legacy: string;
  impactAreas: string[];
}

// ============================================
// GROWTH TRAJECTORY
// ============================================

export interface GrowthTrajectory {
  direction: 'ascending' | 'stable' | 'declining' | 'transforming';
  rate: number;
  consistency: number;
  milestones: Array<{
    date: Date;
    type: string;
    description: string;
    impact: number;
  }>;
  nextMilestones: Array<{
    area: string;
    timeline: string;
    likelihood: number;
  }>;
}

// ============================================
// SIMULATION ENGINE
// ============================================

export interface SimulationScenario {
  id: string;
  type: 'career' | 'relationship' | 'health' | 'location' | 'major_life';
  description: string;
  variables: Record<string, unknown>;
  duration: string;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  emotionalImpact: {
    immediate: number;
    shortTerm: number;
    longTerm: number;
  };
  probability: number;
  alternativePaths: Array<{
    description: string;
    probability: number;
    emotionalOutcome: string;
  }>;
  recommendations: string[];
  risks: string[];
  growthOpportunities: string[];
}

export interface LifeProjection {
  timeframes: {
    shortTerm: string; // 1-3 months
    mediumTerm: string; // 6-12 months
    longTerm: string; // 2-5 years
  };
  burnoutTrajectory: {
    probability: number;
    timeline: string;
    warningSigns: string[];
    prevention: string[];
  };
  fulfillmentProjection: {
    current: number;
    projected: number;
    factors: string[];
  };
  relationshipOutlook: {
    closeness: 'increasing' | 'stable' | 'decreasing';
    compatibility: number;
    challenges: string[];
  };
  wellnessOutlook: {
    trajectory: 'improving' | 'stable' | 'declining';
    keyFactors: string[];
    interventions: string[];
  };
}

// ============================================
// TWIN STATE
// ============================================

export interface TwinState {
  userId: string;
  personality: PersonalityModel;
  behavioralRhythms: BehavioralRhythm[];
  emotionalTendencies: EmotionalTendency[];
  cognitivePatterns: CognitivePattern;
  relationshipPatterns: RelationshipPattern;
  socialEnergy: SocialEnergy;
  valueSystem: ValueSystem;
  copingMechanisms: CopingMechanism[];
  stressResponse: StressResponse;
  resilienceFactors: ResilienceFactors;
  lifePurpose: LifePurpose;
  meaningSystem: MeaningSystem;
  growthTrajectory: GrowthTrajectory;
  emotionalIntelligence: EmotionalIntelligence;
  decisionRhythms: DecisionRhythm[];
  lastUpdated: Date;
  confidence: number; // Overall confidence in the model
}

export interface TwinInsight {
  type: 'self_understanding' | 'growth_opportunity' | 'blind_spot' | 'strength' | 'pattern';
  statement: string;
  evidence: string[];
  confidence: number;
  actionability: number;
}

export interface TwinComparison {
  before: Partial<TwinState>;
  after: Partial<TwinState>;
  changes: Array<{
    dimension: string;
    change: number;
    significance: string;
  }>;
}

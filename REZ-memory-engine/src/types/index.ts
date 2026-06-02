/**
 * REZ Memory Engine - Type Definitions
 *
 * Persistent Human Memory System - Remembers the journey, not just data
 * Port: 4165
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// EMOTIONAL PHASE TYPES
// ============================================

export type EmotionalPhase =
  | 'stability'
  | 'growth'
  | 'transition'
  | 'healing'
  | 'expansion'
  | 'contraction'
  | 'crisis'
  | 'breakthrough';

export interface EmotionalPhaseRecord {
  phase: EmotionalPhase;
  startDate: Date;
  endDate?: Date;
  duration?: number;
  intensity: number;
  context: string;
  triggers: string[];
  resolutions: string[];
  keyInsights: string[];
}

// ============================================
// LIFE EVENT TYPES
// ============================================

export type LifeEventType =
  | 'career'
  | 'relationship'
  | 'health'
  | 'financial'
  | 'spiritual'
  | 'family'
  | 'personal'
  | 'breakthrough'
  | 'setback';

export interface LifeEvent {
  id: string;
  userId: string;
  type: LifeEventType;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  significance: number;
  emotionalImpact: {
    positive: number;
    negative: number;
    neutral: number;
  };
  themes: string[];
  lessons: string[];
  connectedEvents: string[];
  memoryFragments: MemoryFragment[];
  growth?: {
    before: string;
    after: string;
  };
}

export interface MemoryFragment {
  id: string;
  timestamp: Date;
  content: string;
  emotional: {
    tone: string;
    intensity: number;
  };
  context: {
    location?: string;
    activity?: string;
    people?: string[];
  };
  importance: number;
  type: 'note' | 'insight' | 'pattern' | 'achievement' | 'struggle' | 'connection';
}

// ============================================
// BEHAVIORAL PATTERN MEMORY
// ============================================

export interface BehavioralPattern {
  id: string;
  userId: string;
  pattern: {
    type: 'cyclical' | 'progressive' | 'reactive' | 'seasonal';
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    regularity: number;
  };
  triggers: string[];
  manifestations: string[];
  emotionalTone: string;
  firstObserved: Date;
  lastObserved: Date;
  occurrenceCount: number;
  contextFactors: string[];
  evolution: {
    trend: 'intensifying' | 'stable' | 'diminishing' | 'transforming';
    rate: number;
  };
}

// ============================================
// TRANSITION MEMORY
// ============================================

export interface TransitionMemory {
  id: string;
  userId: string;
  transition: {
    from: string;
    to: string;
    type: 'gradual' | 'sudden' | 'chosen' | 'imposed';
  };
  timeline: {
    recognition: Date;
    decision: Date;
    action: Date;
    stabilization: Date;
  };
  emotionalJourney: {
    anticipation: number;
    anxiety: number;
    excitement: number;
    uncertainty: number;
    adaptation: number;
    integration: number;
  };
  supportFactors: string[];
  resistancePoints: string[];
  keyMoments: string[];
  lessons: string[];
  wisdom: string;
}

// ============================================
// HEALING JOURNEY
// ============================================

export interface HealingJourney {
  id: string;
  userId: string;
  wound?: {
    type: string;
    origin: string;
    duration: string;
    severity: number;
  };
  journey: {
    denial?: Date;
    recognition?: Date;
    acceptance?: Date;
    processing?: Date;
    integration?: Date;
    release?: Date;
  };
  progress: {
    current: number;
    trend: 'improving' | 'stable' | 'regressing';
    milestones: Array<{
      date: Date;
      title: string;
      description: string;
      emotionalShift: string;
    }>;
  };
  insights: string[];
  closure?: {
    achieved: boolean;
    date?: Date;
    statement: string;
  };
}

// ============================================
// GROWTH MOMENT
// ============================================

export interface GrowthMoment {
  id: string;
  userId: string;
  moment: {
    type: 'realization' | 'breakthrough' | 'achievement' | 'connection' | 'perspective_shift';
    trigger: string;
    context: string;
  };
  before: {
    belief: string;
    behavior: string;
    emotional: string;
  };
  after: {
    belief: string;
    behavior: string;
    emotional: string;
  };
  integration: {
    date: Date;
    difficulty: number;
    supportNeeded: string[];
    reinforcement: string[];
  };
  rippleEffects: string[];
}

// ============================================
// PERSONALITY EVOLUTION
// ============================================

export interface PersonalityVector {
  dimension: string;
  before: number;
  after: number;
  change: number;
  confidence: number;
  triggers: string[];
}

export interface PersonalityEvolution {
  id: string;
  userId: string;
  baseline: {
    date: Date;
    vectors: Array<{
      dimension: string;
      value: number;
    }>;
  };
  evolution: {
    date: Date;
    vectors: PersonalityVector[];
    overallShift: number;
    drivers: string[];
    blockers: string[];
  }[];
  trajectory: {
    direction: string;
    consistency: number;
    milestones: Array<{
      date: Date;
      change: string;
      impact: number;
    }>;
  };
}

// ============================================
// WISDOM ACCUMULATION
// ============================================

export interface WisdomEntry {
  id: string;
  userId: string;
  origin: {
    type: 'experience' | 'lesson' | 'failure' | 'success' | 'relationship' | 'observation';
    context: string;
  };
  statement: string;
  abstraction: string;
  application: {
    when: string[];
    how: string[];
    barriers: string[];
  };
  integration: {
    level: 'aware' | 'understood' | 'practiced' | 'embodied';
    since: Date;
    applicationCount: number;
    successRate: number;
  };
}

// ============================================
// CONVERSATION MEMORY
// ============================================

export interface ConversationMemory {
  id: string;
  userId: string;
  conversation: {
    type: 'check_in' | 'guidance' | 'reflection' | 'crisis' | 'celebration';
    date: Date;
    summary: string;
    emotionalTone: string;
  };
  exchanges: Array<{
    role: 'user' | 'cosmic';
    content: string;
    timestamp: Date;
    context?: string;
  }>;
  resolution?: {
    achieved: boolean;
    summary: string;
    followUpNeeded: boolean;
  };
  followUps: string[];
}

// ============================================
// UNIFICATION RESPONSE
// ============================================

export interface MemoryContext {
  userId: string;
  currentPhase: EmotionalPhase;
  recentPhases: EmotionalPhaseRecord[];
  activePatterns: BehavioralPattern[];
  currentTransitions: TransitionMemory[];
  healingJourneys: HealingJourney[];
  recentGrowth: GrowthMoment[];
  keyLifeEvents: LifeEvent[];
  accumulatedWisdom: WisdomEntry[];
  personalityEvolution: PersonalityEvolution;
  significantMemories: MemoryFragment[];
  conversationHistory: ConversationMemory[];
}

export interface MemoryInsight {
  type: 'pattern' | 'correlation' | 'wisdom' | 'transition' | 'growth';
  statement: string;
  reasoning: string;
  memoryReferences: string[];
  confidence: number;
  tone: 'reflective' | 'encouraging' | 'cautionary' | 'neutral';
}

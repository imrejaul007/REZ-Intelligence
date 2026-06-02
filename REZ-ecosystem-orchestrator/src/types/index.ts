/**
 * REZ Ecosystem Orchestrator - Type Definitions
 *
 * Living Ecosystem Intelligence - Connecting all services intelligently
 * Port: 4169
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// ORCHESTRATION EVENTS
// ============================================

export type EventType =
  | 'burnout_detected'
  | 'emotional_fatigue'
  | 'social_isolation'
  | 'wellness_decline'
  | 'growth_moment'
  | 'life_transition'
  | 'opportunity_detected'
  | 'crisis_warning'
  | 'celebration'
  | 'milestone_reached';

export interface EcosystemEvent {
  id: string;
  userId: string;
  type: EventType;
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  signals: Array<{
    source: string;
    signal: string;
    value: number;
    confidence: number;
  }>;
  detectedAt: Date;
  context: Record<string, unknown>;
}

// ============================================
// ORCHESTRATION ACTIONS
// ============================================

export type ActionType =
  | 'wellness_recommendation'
  | 'social_suggestion'
  | 'commerce_offer'
  | 'career_guidance'
  | 'health_alert'
  | 'karma_action'
  | 'mobility_suggestion'
  | 'mindfulness_prompt'
  | 'connection_invitation'
  | 'content_delivery';

export interface OrchestrationAction {
  id: string;
  eventId: string;
  userId: string;
  actionType: ActionType;
  service: string;
  priority: 'low' | 'medium' | 'high';
  payload: Record<string, unknown>;
  timing: {
    trigger: 'immediate' | 'delayed' | 'scheduled';
    delayMinutes?: number;
    scheduledFor?: Date;
  };
  status: 'pending' | 'sent' | 'seen' | 'engaged' | 'dismissed';
  sentAt?: Date;
  seenAt?: Date;
  engagementAt?: Date;
  result?: {
    success: boolean;
    engagement?: string;
  };
}

// ============================================
// ECOSYSTEM SERVICES
// ============================================

export interface ServiceConfig {
  name: string;
  url: string;
  capabilities: string[];
  responseTypes: Array<{
    action: ActionType;
    payloadTemplate: Record<string, unknown>;
  }>;
  health: {
    status: 'healthy' | 'degraded' | 'unavailable';
    lastCheck: Date;
    latency: number;
  };
}

export interface ServiceRegistry {
  services: Record<string, ServiceConfig>;
  lastUpdated: Date;
}

// ============================================
// CONTEXT AGGREGATION
// ============================================

export interface UnifiedContext {
  userId: string;
  timestamp: Date;
  layers: {
    health?: {
      wellnessScore: number;
      stress: number;
      sleep: number;
      recovery: string;
    };
    emotional?: {
      currentMood: string;
      energy: number;
      socialEnergy: number;
      emotionalTone: string;
    };
    commerce?: {
      spending: number;
      categoryAffinities: Record<string, number>;
      purchaseFrequency: number;
    };
    career?: {
      burnoutRisk: number;
      satisfaction: number;
      productivity: number;
    };
    social?: {
      connectionCount: number;
      interactionFrequency: number;
      isolationRisk: number;
    };
    karma?: {
      generosityScore: number;
      communityEngagement: number;
    };
    mobility?: {
      travelFrequency: number;
      explorationLevel: number;
    };
  };
  detectedEvents: EventType[];
  riskFactors: Array<{
    type: string;
    severity: number;
    sources: string[];
  }>;
  opportunities: Array<{
    type: string;
    confidence: number;
    sources: string[];
  }>;
}

// ============================================
// INTELLIGENCE ROUTING
// ============================================

export interface IntelligenceRoute {
  eventType: EventType;
  serviceResponses: Array<{
    service: string;
    actionType: ActionType;
    priority: 'low' | 'medium' | 'high';
    conditions?: Record<string, unknown>;
  }>;
  aggregation: 'first' | 'all' | 'highest_priority' | 'weighted';
}

export interface RouteConfig {
  routes: IntelligenceRoute[];
  fallbacks: Record<string, string>;
  rateLimits: Record<string, { maxPerHour: number; currentCount: number }>;
}

// ============================================
// COORDINATION PROTOCOLS
// ============================================

export interface CoordinationProtocol {
  id: string;
  name: string;
  trigger: EventType[];
  sequence: Array<{
    service: string;
    action: ActionType;
    delay: number; // ms
    dependsOn?: string[];
  }>;
  successCriteria: Record<string, unknown>;
}

export interface CoordinationExecution {
  id: string;
  protocolId: string;
  userId: string;
  triggeredBy: EventType;
  steps: Array<{
    service: string;
    action: ActionType;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    result?: unknown;
    error?: string;
  }>;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// RESPONSE ORCHESTRATION
// ============================================

export interface ResponseOrchestration {
  userId: string;
  event: EcosystemEvent;
  selectedActions: OrchestrationAction[];
  timing: {
    immediate: OrchestrationAction[];
    delayed: OrchestrationAction[];
    scheduled: OrchestrationAction[];
  };
  personalization: {
    preferredChannel: 'push' | 'whatsapp' | 'sms' | 'in_app';
    quietHours: { start: string; end: string };
    frequencyCap: number;
  };
  suppression: {
    suppressed: string[];
    reasons: Record<string, string>;
  };
}

// ============================================
// FEEDBACK LOOPS
// ============================================

export interface ActionFeedback {
  actionId: string;
  userId: string;
  event: 'shown' | 'engaged' | 'completed' | 'dismissed' | 'feedback';
  feedback?: {
    helpful: boolean;
    rating?: number;
    comment?: string;
  };
  timestamp: Date;
  context: Record<string, unknown>;
}

export interface LearningData {
  actionType: ActionType;
  totalShown: number;
  engagementRate: number;
  completionRate: number;
  helpfulnessScore: number;
  optimalTiming: {
    hourOfDay: number;
    dayOfWeek: number;
    delayAfterEvent: number;
  };
}

// ============================================
// CROSS-SERVICE INTELLIGENCE
// ============================================

export interface CrossServiceInsight {
  id: string;
  userId: string;
  insight: string;
  correlation: {
    fromService: string;
    toService: string;
    correlation: number;
    significance: string;
  };
  actionable: boolean;
  recommendations: string[];
}

export interface ServiceDependency {
  source: string;
  target: string;
  type: 'triggers' | 'enhances' | 'conflicts';
  weight: number;
}

// ============================================
// ECOSYSTEM DASHBOARD
// ============================================

export interface EcosystemMetrics {
  userId: string;
  period: { start: Date; end: Date };
  services: Record<string, {
    interactions: number;
    engagement: number;
    value: number;
  }>;
  orchestrations: {
    total: number;
    successRate: number;
    avgResponseTime: number;
  };
  userSatisfaction: {
    overall: number;
    helpfulness: number;
    relevance: number;
    timing: number;
  };
}

// ============================================
// QUERY CONTEXT FOR ROUTING
// ============================================

export interface QueryContext {
  userId: string;
  layer?: string;
  timeframe?: 'realtime' | 'daily' | 'weekly';
  priority?: 'low' | 'medium' | 'high';
}

// ============================================
// ACTION TEMPLATES
// ============================================

export interface ActionTemplate {
  type: ActionType;
  service: string;
  template: string;
  variables: string[];
  conditions?: {
    minConfidence?: number;
    maxFrequency?: number;
    requiredLayers?: string[];
    excludedStates?: Record<string, unknown>;
  };
  timing: {
    delay?: number;
    quietHoursRespect?: boolean;
    batchingAllowed?: boolean;
  };
}

export const DEFAULT_ACTION_TEMPLATES: ActionTemplate[] = [
  // Burnout response orchestration
  {
    type: 'wellness_recommendation',
    service: 'risacare',
    template: 'Time for a wellness check-in. Take a moment to breathe.',
    variables: ['userName', 'stressLevel'],
    conditions: { minConfidence: 0.7 },
    timing: { delay: 30, quietHoursRespect: true },
  },
  {
    type: 'karma_action',
    service: 'karma-foundation',
    template: 'Giving back can restore perspective. Consider a small act of kindness today.',
    variables: ['suggestedAction'],
    conditions: { minConfidence: 0.6 },
    timing: { delay: 60, quietHoursRespect: true },
  },
  {
    type: 'mindfulness_prompt',
    service: 'cosmic-os',
    template: 'A moment of mindfulness might serve you well.',
    variables: [],
    conditions: { minConfidence: 0.5 },
    timing: { delay: 15, quietHoursRespect: true },
  },

  // Social isolation response
  {
    type: 'social_suggestion',
    service: 'buzzlocal',
    template: 'Community awaits. Here are some nearby events.',
    variables: ['nearbyEvents'],
    conditions: { requiredLayers: ['social'] },
    timing: { delay: 120, quietHoursRespect: true },
  },
  {
    type: 'connection_invitation',
    service: 'rez-consumer',
    template: 'Share a meal or experience with someone you care about.',
    variables: [],
    conditions: { minConfidence: 0.6 },
    timing: { delay: 60, quietHoursRespect: true },
  },

  // Growth celebration
  {
    type: 'celebration',
    service: 'cosmic-os',
    template: 'This is a moment of growth. Acknowledge your progress.',
    variables: ['growthType'],
    conditions: { minConfidence: 0.8 },
    timing: { delay: 0, quietHoursRespect: false },
  },
  {
    type: 'karma_action',
    service: 'rez-media',
    template: 'Share your success to inspire others.',
    variables: ['achievementType'],
    conditions: { minConfidence: 0.7 },
    timing: { delay: 60, quietHoursRespect: true },
  },

  // Commerce recommendations based on state
  {
    type: 'commerce_offer',
    service: 'rez-consumer',
    template: 'Comfort awaits. Here\'s something for your current mood.',
    variables: ['recommendedProducts'],
    conditions: {
      minConfidence: 0.5,
      excludedStates: { mood: 'stress' }
    },
    timing: { delay: 180, quietHoursRespect: true },
  },

  // Career guidance
  {
    type: 'career_guidance',
    service: 'corpperks',
    template: 'Your career journey continues. Here\'s some guidance.',
    variables: ['careerAdvice'],
    conditions: { requiredLayers: ['career'] },
    timing: { delay: 60, quietHoursRespect: true },
  },

  // Mobility suggestions
  {
    type: 'mobility_suggestion',
    service: 'rez-ride',
    template: 'A change of scenery might serve you well.',
    variables: ['nearbyDestinations'],
    conditions: { minConfidence: 0.6 },
    timing: { delay: 120, quietHoursRespect: true },
  },
];

// ============================================
// COORDINATION PROTOCOLS
// ============================================

export const DEFAULT_COORDINATION_PROTOCOLS: CoordinationProtocol[] = [
  {
    id: 'burnout_response',
    name: 'Burnout Response Protocol',
    trigger: ['burnout_detected', 'emotional_fatigue'],
    sequence: [
      { service: 'cosmic-os', action: 'mindfulness_prompt', delay: 0 },
      { service: 'risacare', action: 'wellness_recommendation', delay: 15 * 60 * 1000, dependsOn: ['cosmic-os'] },
      { service: 'karma-foundation', action: 'karma_action', delay: 60 * 60 * 1000, dependsOn: ['risacare'] },
    ],
    successCriteria: { engagement: 'any' },
  },
  {
    id: 'isolation_response',
    name: 'Social Isolation Response',
    trigger: ['social_isolation'],
    sequence: [
      { service: 'buzzlocal', action: 'social_suggestion', delay: 0 },
      { service: 'rez-consumer', action: 'connection_invitation', delay: 30 * 60 * 1000, dependsOn: ['buzzlocal'] },
    ],
    successCriteria: { engagement: 'any' },
  },
  {
    id: 'growth_celebration',
    name: 'Growth Celebration',
    trigger: ['growth_moment', 'milestone_reached', 'celebration'],
    sequence: [
      { service: 'cosmic-os', action: 'celebration', delay: 0 },
      { service: 'rez-media', action: 'karma_action', delay: 60 * 60 * 1000, dependsOn: ['cosmic-os'] },
      { service: 'rez-consumer', action: 'commerce_offer', delay: 24 * 60 * 60 * 1000, dependsOn: ['rez-media'] },
    ],
    successCriteria: { engagement: 'any' },
  },
  {
    id: 'wellness_decline',
    name: 'Wellness Decline Response',
    trigger: ['wellness_decline'],
    sequence: [
      { service: 'risacare', action: 'health_alert', delay: 0 },
      { service: 'cosmic-os', action: 'wellness_recommendation', delay: 30 * 60 * 1000, dependsOn: ['risacare'] },
      { service: 'rez-ride', action: 'mobility_suggestion', delay: 2 * 60 * 60 * 1000, dependsOn: ['cosmic-os'] },
    ],
    successCriteria: { engagement: 'any' },
  },
];

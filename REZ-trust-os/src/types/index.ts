/**
 * REZ Trust OS - Type Definitions
 *
 * Ethical AI Governance System - Trust, Consent, and Safety
 * Port: 4166
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// CONSENT TYPES
// ============================================

export type SignalCategory =
  | 'health'
  | 'commerce'
  | 'financial'
  | 'relationship'
  | 'career'
  | 'location'
  | 'social'
  | 'emotional'
  | 'behavioral'
  | 'identity';

export type ConsentLevel =
  | 'full'      // All signals
  | 'partial'    // Some signals
  | 'minimal'    // Essential only
  | 'none';      // No tracking

export interface ConsentGrant {
  category: SignalCategory;
  level: ConsentLevel;
  grantedAt: Date;
  lastUpdated: Date;
  sources: string[];  // Which apps/services
  specificSignals?: string[];  // Granular control
}

export interface UserConsent {
  userId: string;
  overallConsent: boolean;
  consentVersion: string;
  granted: ConsentGrant[];
  denied: SignalCategory[];
  pendingRequests: ConsentRequest[];
  consentHistory: ConsentChange[];
}

export interface ConsentRequest {
  id: string;
  category: SignalCategory;
  signals: string[];
  reason: string;
  benefit: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  response?: {
    granted: boolean;
    reason?: string;
    at: Date;
  };
}

// ============================================
// PRIVACY TYPES
// ============================================

export interface PrivacySettings {
  userId: string;
  dataRetention: {
    raw: number;       // Days
    aggregated: number; // Days
    insights: number;   // Days (forever if 0)
  };
  sharing: {
    internalEcosystem: boolean;
    thirdParties: boolean;
    research: boolean;
    anonymized: boolean;
  };
  visibility: {
    showInsightsToOthers: boolean;
    allowApiAccess: boolean;
  };
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    keysManagedBy: 'user' | 'platform';
  };
}

export interface DataSubjectRights {
  userId: string;
  rights: {
    access: { exercisedAt?: Date; dataProvided?: boolean };
    rectification: { exercisedAt?: Date; corrections?: number };
    erasure: { exercisedAt?: Date; scope: 'partial' | 'full' };
    portability: { exercisedAt?: Date; format?: string };
    restriction: { exercisedAt?: Date; processing?: string[] };
    objection: { exercisedAt?: Date; categories?: string[] };
  };
  requests: DataSubjectRequest[];
}

export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'denied';
  requestedAt: Date;
  completedAt?: Date;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ============================================
// EMOTIONAL SAFETY TYPES
// ============================================

export type SafetyPolicyType =
  | 'exploitation_prevention'
  | 'fear_manipulation_prevention'
  | 'dependency_prevention'
  | 'isolation_detection'
  | 'crisis_detection'
  | 'coercion_prevention';

export interface SafetyPolicy {
  type: SafetyPolicyType;
  enabled: boolean;
  threshold?: number;
  action: 'warn' | 'block' | 'escalate' | 'intervene';
  description: string;
}

export interface EmotionalSafetyConfig {
  userId: string;
  policies: SafetyPolicy[];
  crisisResources: CrisisResource[];
  trustedContacts: TrustedContact[];
  customBoundaries: CustomBoundary[];
}

export interface CrisisResource {
  type: 'hotline' | 'chat' | 'emergency' | 'professional';
  name: string;
  contact: string;
  available: string;  // "24/7" or hours
  forUseIn: string[];  // ["crisis", "safety"]
}

export interface TrustedContact {
  id: string;
  name: string;
  relationship: string;
  contact: string;
  notifyIn: SafetyPolicyType[];
  addedAt: Date;
}

export interface CustomBoundary {
  id: string;
  category: string;
  boundary: string;
  enforced: boolean;
  createdAt: Date;
}

// ============================================
// EXPLOITATION PREVENTION
// ============================================

export type ExploitationPattern =
  | 'urgency_manipulation'
  | 'scarcity_pressure'
  | 'fear_based_recommendation'
  | 'isolation_recommendation'
  | 'dependency_creation'
  | 'confidence_erosion'
  | 'impulse_exploitation';

export interface ExploitationDetection {
  id: string;
  userId: string;
  pattern: ExploitationPattern;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: {
    trigger: string;
    recommendation: string;
    context: Record<string, unknown>;
    score: number;
  };
  detectedAt: Date;
  action: {
    taken: 'warned' | 'blocked' | 'modified' | 'reported';
    explanation: string;
  };
}

// ============================================
// AUDIT & GOVERNANCE
// ============================================

export interface AuditEntry {
  id: string;
  userId: string;
  action: 'consent_change' | 'data_access' | 'data_deletion' | 'insight_generation' | 'recommendation_shown' | 'safety_intervention';
  details: {
    category?: string;
    dataTypes?: string[];
    purpose?: string;
    outcome?: string;
  };
  metadata: {
    timestamp: Date;
    service: string;
    ip?: string;
    device?: string;
  };
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  category: 'privacy' | 'safety' | 'transparency' | 'fairness' | 'accountability';
  version: string;
  effectiveDate: Date;
  rules: GovernanceRule[];
  compliance: {
    gdpr: boolean;
    ccpa: boolean;
    dpdp: boolean;
  };
}

export interface GovernanceRule {
  id: string;
  rule: string;
  enforcement: 'hard' | 'soft' | 'advisory';
  penalty?: string;
}

// ============================================
// TRANSPARENCY TYPES
// ============================================

export interface TransparencyReport {
  userId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  dataInsights: {
    totalSignals: number;
    categories: Record<SignalCategory, number>;
    inferences: number;
  };
  consentSummary: {
    activeCategories: SignalCategory[];
    deniedCategories: SignalCategory[];
    changesThisPeriod: number;
  };
  safetyMetrics: {
    interventions: number;
    warnings: number;
    blockedRecommendations: number;
  };
  privacyMetrics: {
    dataRetention: number;
    sharingEnabled: boolean;
    thirdPartyAccess: number;
  };
}

export interface InsightExplanation {
  insight: string;
  basedOn: {
    signals: Array<{
      category: SignalCategory;
      type: string;
      age: string;
    }>;
    patterns: string[];
    inferences: string[];
  };
  confidence: number;
  alternativeInterpretations?: string[];
  userCanCorrect: boolean;
}

// ============================================
// TRUST SCORE
// ============================================

export interface TrustScore {
  userId: string;
  overall: number;  // 0-100
  dimensions: {
    privacy: number;
    safety: number;
    transparency: number;
    fairness: number;
    accountability: number;
  };
  factors: Array<{
    dimension: string;
    positive: string[];
    negative: string[];
    score: number;
  }>;
  recommendations: string[];
  lastUpdated: Date;
}

// ============================================
// USER TRUST PROFILE
// ============================================

export interface TrustProfile {
  userId: string;
  consent: UserConsent;
  privacy: PrivacySettings;
  safety: EmotionalSafetyConfig;
  trustScore: TrustScore;
  auditLog: AuditEntry[];
  lastActivity: Date;
}

/**
 * TypeScript type definitions for REZ Identity Graph
 */

import { Types } from 'mongoose';

// ============================================
// CONSTANTS
// ============================================

/**
 * REZ Apps in the ecosystem
 */
export const APP_SOURCES = {
  REZ: 'rez',
  WASIL: 'wasil',
  HABIXO: 'habixo',
  KARMA: 'karma',
  RTMN_FINANCE: 'rtmn_finance',
  MERCHANT_OS: 'merchant_os',
  QR_SYSTEM: 'qr_system'
} as const;

export type AppSource = typeof APP_SOURCES[keyof typeof APP_SOURCES];

/**
 * Identity types for matching
 */
export const IDENTITY_TYPES = {
  PHONE: 'phone',
  EMAIL: 'email',
  DEVICE_FP: 'device_fingerprint',
  DEVICE_ID: 'device_id',
  WALLET_ID: 'wallet_id',
  USER_ID: 'user_id',
  BANK_ACCOUNT: 'bank_account',
  UPI: 'upi'
} as const;

export type IdentityType = typeof IDENTITY_TYPES[keyof typeof IDENTITY_TYPES];

/**
 * Confidence levels
 */
export const CONFIDENCE_LEVELS = {
  EXACT: 1.0,
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.4,
  INFERRED: 0.2
} as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[keyof typeof CONFIDENCE_LEVELS];

// ============================================
// INTERFACES
// ============================================

/**
 * Identity record
 */
export interface IdentityRecord {
  source: AppSource;
  type: IdentityType;
  value: string;
  confidence: number;
  verified: boolean;
  linkedAt: Date;
  lastSeen: Date;
}

/**
 * Linked identity
 */
export interface LinkedIdentity {
  unifiedId: string;
  confidence: number;
  reason?: string;
  linkedAt: Date;
}

/**
 * User profile
 */
export interface UserProfile {
  primarySource?: string;
  name?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Location weight
 */
export interface LocationWeight {
  lat: number;
  lng: number;
  weight: number;
}

/**
 * Behavior fingerprint
 */
export interface BehaviorFingerprint {
  ipPatterns: string[];
  userAgents: string[];
  typicalHours: number[];
  avgSessionDuration?: number;
  preferredLocations: LocationWeight[];
}

/**
 * User stats
 */
export interface IdentityStats {
  totalSources: number;
  firstActivity?: Date;
  lastActivity?: Date;
  totalTransactions: number;
  totalSpend: number;
  avgOrderValue: number;
}

/**
 * Identity flags
 */
export interface IdentityFlags {
  isTestUser: boolean;
  isBot: boolean;
  isFamilyAccount: boolean;
  mergedInto?: string;
}

/**
 * Identity document
 */
export interface IIdentity {
  _id: Types.ObjectId;
  unifiedId: string;
  identities: IdentityRecord[];
  linkedTo: LinkedIdentity[];
  profile: UserProfile;
  behaviorFingerprint: BehaviorFingerprint;
  stats: IdentityStats;
  flags: IdentityFlags;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Identity resolution response
 */
export interface IdentityResolveResponse {
  unifiedId: string;
  isNew: boolean;
  linkedTo?: string;
}

/**
 * Identity detail response
 */
export interface IdentityDetailResponse {
  unifiedId: string;
  identities: Array<{
    source: AppSource;
    type: IdentityType;
    value: string;
    verified: boolean;
    lastSeen: Date;
  }>;
  profile: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    kycStatus: UserProfile['kycStatus'];
    riskLevel: UserProfile['riskLevel'];
  };
  stats: IdentityStats;
  linkedTo?: LinkedIdentity[];
}

/**
 * Identity graph node
 */
export interface GraphNode {
  unifiedId: string;
  type: 'self' | 'linked_to' | 'links_to_me';
  identities?: number;
  confidence?: number;
  reason?: string;
}

/**
 * Identity graph response
 */
export interface IdentityGraphResponse {
  unifiedId: string;
  totalLinked: number;
  linkedToMe: number;
  nodes: GraphNode[];
}

/**
 * Stats by source
 */
export interface StatsBySource {
  _id: AppSource;
  count: number;
}

/**
 * Platform stats
 */
export interface PlatformStats {
  totalIdentities: number;
  avgSourcesPerIdentity: number;
  totalLinked: number;
  kycVerified: number;
}

/**
 * Express request extension
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

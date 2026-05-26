/**
 * TypeScript type definitions for REZ Taste Profile
 */

import mongoose, { Types } from 'mongoose';

/**
 * Commerce categories
 */
export const COMMERCE_CATEGORIES = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  RETAIL: 'retail',
  BOOKING: 'booking',
  SERVICES: 'services',
  FINTECH: 'fintech',
  TRAVEL: 'travel',
  GROCERY: 'grocery',
  HEALTH: 'health'
} as const;

export type CommerceCategory = typeof COMMERCE_CATEGORIES[keyof typeof COMMERCE_CATEGORIES];

/**
 * Preference score entry
 */
export interface PreferenceScore {
  key: string;
  score: number;
  count: number;
  lastInteraction: Date | null;
}

/**
 * Behavior scores
 */
export interface BehaviorScores {
  adventurousness: number;
  brandLoyalty: number;
  valueConsciousness: number;
  qualityOverPrice: number;
  spontaneity: number;
  socialInfluence: number;
}

/**
 * Time pattern entry
 */
export interface TimePattern {
  hour: number;
  dayOfWeek: number;
  score: number;
  count: number;
}

/**
 * Location preference
 */
export interface LocationPreference {
  type: 'home' | 'work' | 'travel' | 'other';
  latitude?: number;
  longitude?: number;
  radius?: number;
  score: number;
}

/**
 * Interaction record
 */
export interface Interaction {
  merchantId?: string;
  itemId?: string;
  itemName?: string;
  category?: string;
  subcategory?: string;
  value?: number;
  quantity?: number;
  rating?: number;
  timestamp: Date;
}

/**
 * Source tracking
 */
export interface SourceLink {
  source: string;
  userId: string;
  linkedAt: Date;
}

/**
 * Top preferences summary
 */
export interface TopPreferences {
  categories: string[];
  priceTier: string;
  topOccasions: string[];
  signatureItems: string[];
}

/**
 * User stats
 */
export interface UserStats {
  totalTransactions: number;
  totalSpend: number;
  avgOrderValue: number;
  favoriteMerchantId?: string;
  lastActive?: Date;
  accountAge?: number;
}

/**
 * All preferences
 */
export interface AllPreferences {
  categories: PreferenceScore[];
  subcategories: PreferenceScore[];
  brands: PreferenceScore[];
  priceTiers: PreferenceScore[];
  features: PreferenceScore[];
  amenities: PreferenceScore[];
  diets: PreferenceScore[];
  occasions: PreferenceScore[];
}

/**
 * Taste profile document interface
 */
export interface ITasteProfile {
  _id: Types.ObjectId;
  userId: string;
  preferences: AllPreferences;
  behaviors: BehaviorScores;
  timePatterns: TimePattern[];
  locations: LocationPreference[];
  recentInteractions: Interaction[];
  topPreferences: TopPreferences;
  stats: UserStats;
  sources: SourceLink[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

/**
 * Profile response
 */
export interface ProfileResponse {
  userId: string;
  topCategories: string[];
  priceTier: string;
  behaviors: BehaviorScores;
  signatureItems: string[];
  stats: {
    totalTransactions: number;
    avgOrderValue: number;
    totalSpend: number;
  };
  sources: SourceLink[];
}

/**
 * Personalization context
 */
export interface PersonalizationContext {
  isNewUser: boolean;
  preferences: {
    categories: string[];
    priceTier?: string;
    diets: string[];
    features: string[];
  };
  behaviors: BehaviorScores;
  stats: {
    avgOrderValue: number;
    totalTransactions: number;
  };
}

/**
 * Aggregate preferences response
 */
export interface AggregateResponse {
  sampleSize: number;
  topCategories: Array<{ category: string; avgScore: number }>;
  priceTierDistribution: Record<string, number>;
  avgBehaviors: {
    adventurousness: number;
    brandLoyalty: number;
    valueConsciousness: number;
  };
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

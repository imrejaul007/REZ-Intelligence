/**
 * TypeScript type definitions for REZ Price Predictor
 */

import { Types } from 'mongoose';

/**
 * Pricing strategy
 */
export type PricingStrategy = 'fixed' | 'dynamic' | 'competitive' | 'value';

/**
 * Price position
 */
export type PricePosition = 'budget' | 'mid' | 'premium';

/**
 * Price factors
 */
export interface PriceFactors {
  dayOfWeek?: number;
  hour?: number;
  weather?: number;
  events?: number;
  competition?: number;
}

/**
 * Price history document
 */
export interface IPricePrediction {
  _id: Types.ObjectId;
  merchantId: string;
  itemId: string;
  date: Date;
  price: number;
  demand: number;
  elasticity: number;
  factors: PriceFactors;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Merchant pricing document
 */
export interface IMerchantPricing {
  _id: Types.ObjectId;
  merchantId: string;
  name?: string;
  strategy: PricingStrategy;
  baseMargin: number;
  minMargin: number;
  maxMargin: number;
  peakMultiplier: number;
  offPeakMultiplier: number;
  weekendMultiplier: number;
  pricePosition: PricePosition;
  maxDiscountPercent: number;
  competitorIds: string[];
  avgCompetitorPrice?: number;
  avgOrderValue: number;
  conversionRate: number;
  lastUpdated?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Price optimization result
 */
export interface PriceOptimization {
  price: number;
  discount: number;
  recommended: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Price prediction response
 */
export interface PricePredictionResponse {
  merchantId: string;
  itemId: string;
  currentPrice: number;
  recommendedPrice: number;
  discount: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    timeMultiplier: number;
    elasticity: number | 'unknown';
    demandLevel: number | undefined;
  };
  alternatives: {
    rushHour: PriceOptimization;
    offPeak: PriceOptimization;
    weekend: PriceOptimization;
  } | null;
}

/**
 * Slot price item
 */
export interface SlotPriceItem {
  itemId: string;
  name: string;
  originalPrice: number;
  optimizedPrice: number;
  discount: number;
}

/**
 * Slot totals
 */
export interface SlotTotals {
  original: number;
  optimized: number;
  savings: number;
}

/**
 * Slot price response
 */
export interface SlotPriceResponse {
  merchantId: string;
  slot: { hour: number; dayOfWeek: number };
  multiplier: number;
  items: SlotPriceItem[];
  totals: SlotTotals;
}

/**
 * Pricing recommendation
 */
export interface PricingRecommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  potential: string;
}

/**
 * Price range
 */
export interface PriceRange {
  min: number;
  max: number;
  avg: number;
}

/**
 * Pricing analytics
 */
export interface PricingAnalytics {
  strategy: PricingStrategy;
  baseMargin: string;
  priceRange: PriceRange;
  conversionRate: string;
  avgOrderValue: number;
  recommendations: PricingRecommendation[];
}

/**
 * Competitor price
 */
export interface CompetitorPrice {
  merchantId: string;
  avgPrice: number;
  latestPrice: number;
  recordCount: number;
}

/**
 * Competitor pricing response
 */
export interface CompetitorPricingResponse {
  merchantId: string;
  competitors: CompetitorPrice[];
  avgCompetitorPrice: number;
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

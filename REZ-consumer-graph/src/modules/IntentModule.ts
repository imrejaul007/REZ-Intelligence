/**
 * IntentModule - Consumer Intent and Affinity Tracking
 * Analyzes and predicts consumer purchasing intent
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import {
  IntentProfile,
  IntentSignal,
  AffinityScore,
  CategoryAffinity,
  BrandAffinity,
  PriceRange,
} from '../types';

export interface IntentPrediction {
  intent_type: 'browse' | 'cart' | 'wishlist' | 'purchase';
  confidence: number;
  time_horizon: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  triggers: string[];
}

export interface CategoryInsights {
  category_id: string;
  category_name: string;
  affinity_score: number;
  trend: 'rising' | 'stable' | 'declining';
  avg_price: number;
  purchase_frequency: number;
  last_purchase?: string;
}

export class IntentModule {
  private consumerGraph: ConsumerGraph;
  private httpClient: AxiosInstance;
  private logger: winston.Logger;

  // Local storage
  private signals: Map<string, IntentSignal[]>;
  private affinities: Map<string, AffinityScore[]>;
  private priceRanges: Map<string, PriceRange>;

  constructor(consumerGraph: ConsumerGraph, baseUrl: string) {
    this.consumerGraph = consumerGraph;
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
    this.signals = new Map();
    this.affinities = new Map();
    this.priceRanges = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('IntentModule initialized');
  }

  // ============================================
  // SIGNAL PROCESSING
  // ============================================

  /**
   * Record intent signal
   */
  async recordSignal(signal: Omit<IntentSignal, 'signal_id'>): Promise<void> {
    const fullSignal: IntentSignal = {
      ...signal,
      signal_id: `${crypto.randomUUID()}`,
    };

    if (!this.signals.has(signal.user_id)) {
      this.signals.set(signal.user_id, []);
    }
    this.signals.get(signal.user_id)!.push(fullSignal);

    // Update affinities based on signal
    await this.updateAffinity(fullSignal);

    // Sync with intent service
    try {
      await this.httpClient.post('/signals', fullSignal);
    } catch (error) {
      this.logger.warn('Failed to sync intent signal to service', { error });
    }

    this.logger.debug('Intent signal recorded', {
      userId: signal.user_id,
      type: signal.signal_type,
      category: signal.category,
    });
  }

  /**
   * Record multiple signals
   */
  async recordSignals(signals: Omit<IntentSignal, 'signal_id'>[]): Promise<void> {
    for (const signal of signals) {
      await this.recordSignal(signal);
    }
  }

  private async updateAffinity(signal: IntentSignal): Promise<void> {
    if (!this.affinities.has(signal.user_id)) {
      this.affinities.set(signal.user_id, []);
    }

    const userAffinities = this.affinities.get(signal.user_id)!;
    const existing = userAffinities.find((a) => a.category === signal.category);

    if (existing) {
      // Update existing affinity
      existing.score = Math.min(1, existing.score + signal.weight * 0.1);
    } else {
      // Create new affinity
      userAffinities.push({
        category: signal.category,
        score: signal.weight,
        trend: 'rising',
      });
    }
  }

  // ============================================
  // INTENT PROFILE
  // ============================================

  /**
   * Get intent profile for consumer
   */
  async getIntentProfile(userId: string): Promise<IntentProfile | null> {
    try {
      // Try to get from intent service
      const response = await this.httpClient.get(`/intent/profile/${userId}`);
      return response.data;
    } catch (error) {
      // Fall back to local data
      return this.getLocalIntentProfile(userId);
    }
  }

  private async getLocalIntentProfile(userId: string): Promise<IntentProfile | null> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    const consumerData = profile.toJSON();
    return consumerData.intent;
  }

  /**
   * Update intent profile
   */
  async updateIntentProfile(
    userId: string,
    updates: Partial<IntentProfile>
  ): Promise<void> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return;

    profile.updateIntentProfile(updates);
    this.logger.info('Intent profile updated', { userId });
  }

  // ============================================
  // CATEGORY AFFINITIES
  // ============================================

  /**
   * Get category affinities
   */
  async getCategoryAffinities(userId: string): Promise<CategoryAffinity[]> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return [];

    const consumerData = profile.toJSON();
    return consumerData.intent.categories;
  }

  /**
   * Add or update category affinity
   */
  async setCategoryAffinity(
    userId: string,
    category: CategoryAffinity
  ): Promise<void> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return;

    const consumerData = profile.toJSON();
    const existingIndex = consumerData.intent.categories.findIndex(
      (c) => c.category_id === category.category_id
    );

    if (existingIndex >= 0) {
      consumerData.intent.categories[existingIndex] = category;
    } else {
      consumerData.intent.categories.push(category);
    }

    profile.updateIntentProfile({ categories: consumerData.intent.categories });
  }

  // ============================================
  // BRAND AFFINITIES
  // ============================================

  /**
   * Get brand affinities
   */
  async getBrandAffinities(userId: string): Promise<BrandAffinity[]> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return [];

    const consumerData = profile.toJSON();
    return consumerData.intent.preferred_brands;
  }

  /**
   * Add or update brand affinity
   */
  async setBrandAffinity(
    userId: string,
    brand: BrandAffinity
  ): Promise<void> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return;

    const consumerData = profile.toJSON();
    const existingIndex = consumerData.intent.preferred_brands.findIndex(
      (b) => b.brand_id === brand.brand_id
    );

    if (existingIndex >= 0) {
      consumerData.intent.preferred_brands[existingIndex] = brand;
    } else {
      consumerData.intent.preferred_brands.push(brand);
    }

    profile.updateIntentProfile({ preferred_brands: consumerData.intent.preferred_brands });
  }

  // ============================================
  // PRICE RANGE
  // ============================================

  /**
   * Get price range
   */
  async getPriceRange(userId: string): Promise<PriceRange | null> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    const consumerData = profile.toJSON();
    return consumerData.intent.price_range;
  }

  /**
   * Update price range
   */
  async setPriceRange(userId: string, priceRange: PriceRange): Promise<void> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return;

    profile.setPriceRange(priceRange.min, priceRange.max, priceRange.currency);
  }

  /**
   * Calculate price range from transactions
   */
  async calculatePriceRangeFromHistory(userId: string): Promise<PriceRange> {
    const signals = this.signals.get(userId) || [];
    const prices = signals.filter((s) => s.price !== undefined).map((s) => s.price!);

    if (prices.length === 0) {
      return { min: 0, max: 1000, currency: 'USD', preferred: 50 };
    }

    prices.sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const preferred = prices[Math.floor(prices.length / 2)];

    const priceRange = { min, max, currency: 'USD', preferred };
    this.priceRanges.set(userId, priceRange);

    return priceRange;
  }

  // ============================================
  // PREDICTIONS
  // ============================================

  /**
   * Predict purchase intent
   */
  async predictIntent(userId: string): Promise<IntentPrediction[]> {
    const signals = this.signals.get(userId) || [];
    const predictions: IntentPrediction[] = [];

    // Analyze browse signals
    const browseSignals = signals.filter((s) => s.signal_type === 'browse');
    if (browseSignals.length > 0) {
      predictions.push({
        intent_type: 'browse',
        confidence: Math.min(1, browseSignals.length / 10),
        time_horizon: 'immediate',
        triggers: ['Recent browsing activity'],
      });
    }

    // Analyze wishlist signals
    const wishlistSignals = signals.filter((s) => s.signal_type === 'wishlist');
    if (wishlistSignals.length > 0) {
      predictions.push({
        intent_type: 'wishlist',
        confidence: Math.min(1, wishlistSignals.length / 5),
        time_horizon: 'short_term',
        triggers: ['Items in wishlist'],
      });
    }

    // Analyze cart signals
    const cartSignals = signals.filter((s) => s.signal_type === 'cart');
    if (cartSignals.length > 0) {
      predictions.push({
        intent_type: 'cart',
        confidence: Math.min(1, cartSignals.length / 3),
        time_horizon: 'immediate',
        triggers: ['Items in cart'],
      });
    }

    // Analyze purchase signals
    const purchaseSignals = signals.filter((s) => s.signal_type === 'purchase');
    if (purchaseSignals.length > 0) {
      predictions.push({
        intent_type: 'purchase',
        confidence: 0.8,
        time_horizon: 'immediate',
        triggers: ['Recent purchases'],
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get predicted interests
   */
  async getPredictedInterests(
    userId: string,
    limit: number = 10
  ): Promise<string[]> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return [];

    const consumerData = profile.toJSON();
    return consumerData.intent.predicted_interests.slice(0, limit);
  }

  /**
   * Update predicted interests based on signals
   */
  async updatePredictedInterests(userId: string): Promise<string[]> {
    const signals = this.signals.get(userId) || [];
    const categoryScores: Record<string, number> = {};

    for (const signal of signals) {
      if (!categoryScores[signal.category]) {
        categoryScores[signal.category] = 0;
      }

      // Weight by signal type
      const weights: Record<string, number> = {
        browse: 0.2,
        search: 0.3,
        purchase: 0.5,
        wishlist: 0.4,
        cart: 0.6,
        abandon: -0.3,
      };

      categoryScores[signal.category] +=
        (weights[signal.signal_type] || 0.3) * signal.weight;
    }

    const predictedInterests = Object.entries(categoryScores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([category]) => category);

    // Update profile
    await this.updateIntentProfile(userId, { predicted_interests: predictedInterests });

    return predictedInterests;
  }

  // ============================================
  // SEASONAL PATTERNS
  // ============================================

  /**
   * Detect seasonal patterns
   */
  async detectSeasonalPatterns(userId: string): Promise<Record<string, unknown>> {
    const signals = this.signals.get(userId) || [];
    const seasonalPatterns: Record<string, { month: number; spend: number; count: number }> = {};

    for (const signal of signals) {
      if (signal.timestamp) {
        const date = new Date(signal.timestamp);
        const month = date.getMonth();
        const season = this.getSeason(month);

        if (!seasonalPatterns[season]) {
          seasonalPatterns[season] = { month, spend: 0, count: 0 };
        }

        seasonalPatterns[season].count++;
        if (signal.price) {
          seasonalPatterns[season].spend += signal.price;
        }
      }
    }

    return seasonalPatterns;
  }

  private getSeason(month: number): string {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get category insights
   */
  async getCategoryInsights(userId: string): Promise<CategoryInsights[]> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return [];

    const consumerData = profile.toJSON();
    const signals = this.signals.get(userId) || [];

    return consumerData.intent.categories.map((category) => {
      const categorySignals = signals.filter((s) => s.category === category.category_id);
      const prices = categorySignals.filter((s) => s.price !== undefined).map((s) => s.price!);

      return {
        category_id: category.category_id,
        category_name: category.category_name,
        affinity_score: categorySignals.reduce((sum, s) => sum + s.weight, 0) / Math.max(1, categorySignals.length),
        trend: this.calculateTrend(categorySignals),
        avg_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
        purchase_frequency: categorySignals.filter((s) => s.signal_type === 'purchase').length,
        last_purchase: categorySignals
          .filter((s) => s.signal_type === 'purchase')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
          ?.timestamp,
      };
    });
  }

  private calculateTrend(signals: IntentSignal[]): 'rising' | 'stable' | 'declining' {
    if (signals.length < 3) return 'stable';

    const sorted = signals.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const midpoint = Math.floor(sorted.length / 2);

    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.weight, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.weight, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.2) return 'rising';
    if (secondAvg < firstAvg * 0.8) return 'declining';
    return 'stable';
  }

  /**
   * Get engagement score
   */
  async getEngagementScore(userId: string): Promise<number> {
    const signals = this.signals.get(userId) || [];
    if (signals.length === 0) return 0;

    const weights: Record<string, number> = {
      browse: 1,
      search: 2,
      purchase: 5,
      wishlist: 3,
      cart: 4,
      abandon: -1,
    };

    const totalScore = signals.reduce(
      (sum, s) => sum + (weights[s.signal_type] || 1) * s.weight,
      0
    );

    return Math.min(1, totalScore / 100);
  }
}

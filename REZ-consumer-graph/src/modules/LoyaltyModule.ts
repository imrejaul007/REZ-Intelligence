/**
 * LoyaltyModule - Loyalty Program Management
 * Manages loyalty points, tiers, and rewards
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import { LoyaltyEvent, LoyaltyTier, LoyaltyProfile } from '../types';

export interface TierBenefits {
  tier: LoyaltyTier;
  benefits: string[];
  points_multiplier: number;
  anniversary_bonus?: number;
}

export interface PointsRule {
  action: string;
  points: number;
  multiplier_tiers: Record<LoyaltyTier, number>;
}

export class LoyaltyModule {
  private consumerGraph: ConsumerGraph;
  private httpClient: AxiosInstance;
  private logger: winston.Logger;

  // Local storage
  private pointsRules: Map<string, PointsRule>;
  private tierBenefits: Map<LoyaltyTier, TierBenefits>;
  private localEvents: Map<string, LoyaltyEvent[]>;

  constructor(consumerGraph: ConsumerGraph, baseUrl: string) {
    this.consumerGraph = consumerGraph;
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
    this.pointsRules = new Map();
    this.tierBenefits = new Map();
    this.localEvents = new Map();

    this.initializeTierBenefits();
    this.initializePointsRules();

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

    this.logger.info('LoyaltyModule initialized');
  }

  private initializeTierBenefits(): void {
    this.tierBenefits.set('bronze', {
      tier: 'bronze',
      benefits: ['Basic rewards', 'Birthday bonus (2x points)'],
      points_multiplier: 1.0,
    });
    this.tierBenefits.set('silver', {
      tier: 'silver',
      benefits: ['Basic rewards', 'Birthday bonus (3x points)', 'Free shipping on orders over $50'],
      points_multiplier: 1.25,
    });
    this.tierBenefits.set('gold', {
      tier: 'gold',
      benefits: ['Silver benefits', 'Priority customer support', 'Early access to sales', 'Free shipping on all orders'],
      points_multiplier: 1.5,
    });
    this.tierBenefits.set('platinum', {
      tier: 'platinum',
      benefits: ['Gold benefits', 'Exclusive platinum-only products', 'Personal concierge', 'Free returns'],
      points_multiplier: 2.0,
    });
    this.tierBenefits.set('vip', {
      tier: 'vip',
      benefits: ['Platinum benefits', 'VIP-only experiences', 'Custom rewards', 'Dedicated account manager'],
      points_multiplier: 3.0,
      anniversary_bonus: 5000,
    });
  }

  private initializePointsRules(): void {
    // Base earning rules
    this.pointsRules.set('purchase', {
      action: 'purchase',
      points: 1, // 1 point per dollar
      multiplier_tiers: {
        bronze: 1.0,
        silver: 1.25,
        gold: 1.5,
        platinum: 2.0,
        vip: 3.0,
      },
    });

    this.pointsRules.set('review', {
      action: 'review',
      points: 50,
      multiplier_tiers: {
        bronze: 1.0,
        silver: 1.0,
        gold: 1.0,
        platinum: 1.0,
        vip: 1.0,
      },
    });

    this.pointsRules.set('referral_signup', {
      action: 'referral_signup',
      points: 200,
      multiplier_tiers: {
        bronze: 1.0,
        silver: 1.0,
        gold: 1.0,
        platinum: 1.0,
        vip: 1.0,
      },
    });

    this.pointsRules.set('referral_purchase', {
      action: 'referral_purchase',
      points: 500,
      multiplier_tiers: {
        bronze: 1.0,
        silver: 1.0,
        gold: 1.0,
        platinum: 1.0,
        vip: 1.0,
      },
    });

    this.pointsRules.set('social_share', {
      action: 'social_share',
      points: 25,
      multiplier_tiers: {
        bronze: 1.0,
        silver: 1.0,
        gold: 1.0,
        platinum: 1.0,
        vip: 1.0,
      },
    });
  }

  // ============================================
  // POINTS EARNING
  // ============================================

  /**
   * Get loyalty summary for consumer
   */
  async getLoyaltySummary(userId: string): Promise<LoyaltyProfile | null> {
    try {
      // Try to get from loyalty service
      const response = await this.httpClient.get(`/loyalty/summary/${userId}`);
      return response.data;
    } catch (error) {
      // Fall back to local data
      return this.getLocalLoyaltySummary(userId);
    }
  }

  private async getLocalLoyaltySummary(userId: string): Promise<LoyaltyProfile | null> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    return profile.toJSON().loyalty;
  }

  /**
   * Earn points
   */
  async earnPoints(
    userId: string,
    action: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; points_earned: number; new_balance: number }> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { success: false, points_earned: 0, new_balance: 0 };
    }

    const rule = this.pointsRules.get(action);
    if (!rule) {
      this.logger.warn('Unknown points action', { action });
      return { success: false, points_earned: 0, new_balance: 0 };
    }

    const consumerData = profile.toJSON();
    const tier = consumerData.loyalty.tier;

    // Calculate points with multipliers
    let basePoints = rule.points;
    if (action === 'purchase') {
      basePoints = amount; // 1 point per dollar
    }

    const multiplier = rule.multiplier_tiers[tier];
    const pointsEarned = Math.floor(basePoints * multiplier);

    // Create loyalty event
    const event: LoyaltyEvent = {
      event_id: `${crypto.randomUUID()}`,
      user_id: userId,
      event_type: 'earn',
      points: pointsEarned,
      description,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Update profile
    profile.addPoints(pointsEarned);
    this.storeEvent(userId, event);

    // Sync with service
    try {
      await this.httpClient.post('/loyalty/earn', {
        user_id: userId,
        action,
        base_points: basePoints,
        multiplier,
        points_earned: pointsEarned,
        description,
        event_id: event.event_id,
      });
    } catch (error) {
      this.logger.warn('Failed to sync points to service', { error });
    }

    this.logger.info('Points earned', { userId, action, pointsEarned, new_balance: profile.toJSON().loyalty.points_balance });
    return {
      success: true,
      points_earned: pointsEarned,
      new_balance: profile.toJSON().loyalty.points_balance,
    };
  }

  /**
   * Redeem points
   */
  async redeemPoints(
    userId: string,
    points: number,
    reward_id: string,
    description: string
  ): Promise<{ success: boolean; points_redeemed: number; new_balance: number }> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { success: false, points_redeemed: 0, new_balance: 0 };
    }

    const success = profile.redeemPoints(points);

    if (!success) {
      return { success: false, points_redeemed: 0, new_balance: 0 };
    }

    // Create loyalty event
    const event: LoyaltyEvent = {
      event_id: `${crypto.randomUUID()}`,
      user_id: userId,
      event_type: 'redeem',
      points: -points,
      description,
      timestamp: new Date().toISOString(),
      metadata: { reward_id },
    };

    this.storeEvent(userId, event);

    // Sync with service
    try {
      await this.httpClient.post('/loyalty/redeem', {
        user_id: userId,
        points,
        reward_id,
        description,
        event_id: event.event_id,
      });
    } catch (error) {
      this.logger.warn('Failed to sync redemption to service', { error });
    }

    this.logger.info('Points redeemed', { userId, points, new_balance: profile.toJSON().loyalty.points_balance });
    return {
      success: true,
      points_redeemed: points,
      new_balance: profile.toJSON().loyalty.points_balance,
    };
  }

  // ============================================
  // TIER MANAGEMENT
  // ============================================

  /**
   * Check and update tier
   */
  async checkTierUpgrade(userId: string): Promise<{ upgraded: boolean; new_tier?: LoyaltyTier }> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { upgraded: false };
    }

    const consumerData = profile.toJSON();
    const currentTier = consumerData.loyalty.tier;
    const lifetimePoints = consumerData.loyalty.lifetime_points;

    // Tier thresholds
    const thresholds = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 15000,
      vip: 50000,
    };

    // Find appropriate tier
    let newTier: LoyaltyTier = 'bronze';
    if (lifetimePoints >= thresholds.vip) newTier = 'vip';
    else if (lifetimePoints >= thresholds.platinum) newTier = 'platinum';
    else if (lifetimePoints >= thresholds.gold) newTier = 'gold';
    else if (lifetimePoints >= thresholds.silver) newTier = 'silver';

    if (newTier !== currentTier) {
      profile.updateLoyaltyTier(newTier);

      // Create tier change event
      const event: LoyaltyEvent = {
        event_id: `${crypto.randomUUID()}`,
        user_id: userId,
        event_type: 'tier_change',
        points: 0,
        description: `Tier changed from ${currentTier} to ${newTier}`,
        timestamp: new Date().toISOString(),
        metadata: { from_tier: currentTier, to_tier: newTier },
      };

      this.storeEvent(userId, event);

      this.logger.info('Tier upgraded', { userId, from: currentTier, to: newTier });
      return { upgraded: true, new_tier: newTier };
    }

    return { upgraded: false };
  }

  /**
   * Get tier benefits
   */
  getTierBenefits(tier: LoyaltyTier): TierBenefits | undefined {
    return this.tierBenefits.get(tier);
  }

  /**
   * Get all tier benefits
   */
  getAllTierBenefits(): TierBenefits[] {
    return Array.from(this.tierBenefits.values());
  }

  // ============================================
  // REFERRALS
  // ============================================

  /**
   * Process referral signup
   */
  async processReferralSignup(referrerId: string, referredId: string): Promise<void> {
    await this.earnPoints(
      referrerId,
      'referral_signup',
      0,
      `Referral signup bonus`,
      { referred_id: referredId }
    );

    await this.earnPoints(
      referredId,
      'referral_signup',
      0,
      `Welcome bonus from referral`,
      { referrer_id: referrerId }
    );
  }

  /**
   * Process referral purchase
   */
  async processReferralPurchase(
    referrerId: string,
    referredId: string,
    purchaseAmount: number
  ): Promise<void> {
    await this.earnPoints(
      referrerId,
      'referral_purchase',
      purchaseAmount,
      `Referral purchase bonus`,
      { referred_id: referredId, purchase_amount: purchaseAmount }
    );
  }

  // ============================================
  // EVENTS
  // ============================================

  private storeEvent(userId: string, event: LoyaltyEvent): void {
    if (!this.localEvents.has(userId)) {
      this.localEvents.set(userId, []);
    }
    this.localEvents.get(userId)!.push(event);
  }

  /**
   * Get loyalty event history
   */
  async getEventHistory(
    userId: string,
    eventType?: 'earn' | 'redeem' | 'tier_change' | 'expire',
    limit: number = 50
  ): Promise<LoyaltyEvent[]> {
    const events = this.localEvents.get(userId) || [];

    let filtered = events;
    if (eventType) {
      filtered = events.filter((e) => e.event_type === eventType);
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  // ============================================
  // CALCULATIONS
  // ============================================

  /**
   * Calculate points value
   */
  calculatePointsValue(points: number, rate: number = 0.01): number {
    return points * rate;
  }

  /**
   * Calculate tier progress
   */
  calculateTierProgress(lifetimePoints: number): { currentTier: LoyaltyTier; nextTier: LoyaltyTier | null; progress: number; pointsNeeded: number } {
    const thresholds = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 15000,
      vip: 50000,
    };

    let currentTier: LoyaltyTier = 'bronze';
    let nextTier: LoyaltyTier | null = 'silver';
    let nextThreshold = thresholds.silver;

    if (lifetimePoints >= thresholds.vip) {
      currentTier = 'vip';
      nextTier = null;
      nextThreshold = Infinity;
    } else if (lifetimePoints >= thresholds.platinum) {
      currentTier = 'platinum';
      nextTier = 'vip';
      nextThreshold = thresholds.vip;
    } else if (lifetimePoints >= thresholds.gold) {
      currentTier = 'gold';
      nextTier = 'platinum';
      nextThreshold = thresholds.platinum;
    } else if (lifetimePoints >= thresholds.silver) {
      currentTier = 'silver';
      nextTier = 'gold';
      nextThreshold = thresholds.gold;
    }

    const currentThreshold = thresholds[currentTier];
    const range = nextThreshold - currentThreshold;
    const progress = Math.min(100, ((lifetimePoints - currentThreshold) / range) * 100);

    return {
      currentTier,
      nextTier,
      progress,
      pointsNeeded: Math.max(0, nextThreshold - lifetimePoints),
    };
  }
}

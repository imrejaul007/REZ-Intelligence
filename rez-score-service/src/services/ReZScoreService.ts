/**
 * ReZ Score Engine
 */

import axios from 'axios';
import { ScoreProfile, IScoreProfile } from '../models/ScoreProfile';
import { getLeaderboardKey } from '../config/redis';

const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'http://localhost:4014';
const LOYALTY_SERVICE = process.env.LOYALTY_SERVICE_URL || 'http://localhost:4005';
const KARMA_SERVICE = process.env.KARMA_SERVICE_URL || 'http://localhost:4002';

// Tier thresholds
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 200,
  gold: 400,
  platinum: 600,
  diamond: 800,
  rez_elite: 900,
};

export class ReZScoreService {

  async initialize(): Promise<void> {
    console.log('ReZ Score Service initialized');
  }

  async getScore(userId: string): Promise<IScoreProfile | null> {
    return ScoreProfile.findOne({ userId });
  }

  async calculateScore(userId: string, data: {
    totalOrders?: number;
    visitFrequency?: number;
    daysActive?: number;
    featureAdoption?: number;
    averageOrderValue?: number;
    monthlySpend?: number;
    lifetimeSpend?: number;
    redemptionRate?: number;
    karmaScore?: number;
    karmaLevel?: number;
    volunteerHours?: number;
    impactScore?: number;
    karmaEventsCompleted?: number;
    referralCount?: number;
    socialShares?: number;
    currentStreak?: number;
    categoriesVisited?: number;
    crossMerchantBadges?: number;
  }): Promise<IScoreProfile> {
    // Engagement score (25%)
    const engagementScore = Math.min(
      ((data.totalOrders || 0) / 50) * 25 +
      ((data.visitFrequency || 0) / 30) * 25 +
      ((data.daysActive || 0) / 365) * 25 +
      ((data.featureAdoption || 0) / 100) * 25,
      100
    );

    // Spending score (30%)
    const spendingScore = Math.min(
      Math.min((data.lifetimeSpend || 0) / 100000 * 40, 40) +
      Math.min((data.monthlySpend || 0) / 10000 * 30, 30) +
      Math.min((data.averageOrderValue || 0) / 1000 * 15, 15) +
      Math.min((data.redemptionRate || 0) * 15, 15),
      100
    );

    // Karma score (25%)
    const karmaScore = Math.min(
      Math.min((data.karmaScore || 0) / 1000 * 35, 35) +
      Math.min((data.karmaLevel || 1) / 4 * 25, 25) +
      Math.min((data.volunteerHours || 0) / 100 * 20, 20) +
      Math.min((data.karmaEventsCompleted || 0) / 50 * 20, 20),
      100
    );

    // Social score (20%)
    const socialScore = Math.min(
      Math.min((data.referralCount || 0) / 10 * 50, 50) +
      Math.min((data.socialShares || 0) / 20 * 30, 30) +
      20, // Base social score
      100
    );

    // Streak bonus (additive)
    const streakBonus = Math.min((data.currentStreak || 0) * 5, 50);

    // Cross-merchant bonus
    const crossMerchantBonus =
      Math.min((data.categoriesVisited || 0) / 10 * 10, 10) +
      ((data.crossMerchantBadges || 0) * 5);

    // Calculate composite
    const composite = Math.round(
      (engagementScore * 0.25) +
      (spendingScore * 0.30) +
      (karmaScore * 0.25) +
      (socialScore * 0.20) +
      streakBonus +
      crossMerchantBonus
    );

    // Determine tier
    const tier = this.getTier(composite);

    // Save or update
    let profile = await ScoreProfile.findOne({ userId });
    if (profile) {
      profile.composite = composite;
      profile.engagement = Math.round(engagementScore);
      profile.spending = Math.round(spendingScore);
      profile.karma = Math.round(karmaScore);
      profile.social = Math.round(socialScore);
      profile.streak = streakBonus;
      profile.crossMerchant = crossMerchantBonus;
      profile.tier = tier;
      profile.lastUpdated = new Date();
    } else {
      profile = await ScoreProfile.create({
        userId,
        composite,
        engagement: Math.round(engagementScore),
        spending: Math.round(spendingScore),
        karma: Math.round(karmaScore),
        social: Math.round(socialScore),
        streak: streakBonus,
        crossMerchant: crossMerchantBonus,
        tier,
        lastUpdated: new Date(),
      });
    }

    await profile.save();
    return profile;
  }

  getTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'rez_elite' {
    if (score >= TIER_THRESHOLDS.rez_elite) return 'rez_elite';
    if (score >= TIER_THRESHOLDS.diamond) return 'diamond';
    if (score >= TIER_THRESHOLDS.platinum) return 'platinum';
    if (score >= TIER_THRESHOLDS.gold) return 'gold';
    if (score >= TIER_THRESHOLDS.silver) return 'silver';
    return 'bronze';
  }

  getNextTier(currentTier: string): { tier: string; threshold: number } | null {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'rez_elite'];
    const currentIndex = tierOrder.indexOf(currentTier);

    if (currentIndex >= tierOrder.length - 1) return null;

    const nextTier = tierOrder[currentIndex + 1];
    return {
      tier: nextTier,
      threshold: TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS],
    };
  }

  calculateProgress(currentScore: number, tier: string): number {
    const thresholds = Object.entries(TIER_THRESHOLDS).sort((a, b) => a[1] - b[1]);
    const currentIndex = thresholds.findIndex(([t]) => t === tier);

    if (currentIndex >= thresholds.length - 1) return 100;

    const currentThreshold = thresholds[currentIndex][1];
    const nextThreshold = thresholds[currentIndex + 1][1];

    const progress = ((currentScore - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }
}

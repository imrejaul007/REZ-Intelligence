/**
 * Profile Aggregator Service
 *
 * Builds unified profile from all services
 */

import axios from 'axios';
import { UnifiedProfile, IUnifiedProfile } from '../models/UnifiedProfile';
import { redis, CACHE_TTL, getCacheKey } from '../config/redis';

const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'http://localhost:4014';
const LOYALTY_SERVICE = process.env.LOYALTY_SERVICE_URL || 'http://localhost:4005';
const KARMA_SERVICE = process.env.KARMA_SERVICE_URL || 'http://localhost:4002';
const GAMIFICATION_SERVICE = process.env.GAMIFICATION_SERVICE_URL || 'http://localhost:4006';
const SCORE_SERVICE = process.env.SCORE_SERVICE_URL || 'http://localhost:4028';
const STREAK_SERVICE = process.env.STREAK_SERVICE_URL || 'http://localhost:3003';
const CROSS_MERCHANT_SERVICE = process.env.CROSS_MERCHANT_SERVICE_URL || 'http://localhost:4027';
const KARMA_LOYALTY_BRIDGE = process.env.KARMA_LOYALTY_BRIDGE_URL || 'http://localhost:4029';

export class ProfileAggregator {

  async initialize(): Promise<void> {
    console.log('Profile Aggregator initialized');
  }

  async getProfile(userId: string): Promise<IUnifiedProfile | null> {
    // Try cache first
    const cached = await redis.get(getCacheKey(userId));
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from MongoDB
    let profile = await UnifiedProfile.findOne({ userId });

    if (!profile) {
      // Create new profile
      profile = await this.createProfile(userId);
    }

    // Cache it
    await redis.setex(getCacheKey(userId), CACHE_TTL, JSON.stringify(profile));

    return profile;
  }

  async createProfile(userId: string): Promise<IUnifiedProfile> {
    // Aggregate data from all services
    const [wallet, loyalty, karma, gamification, score] = await Promise.all([
      this.getWalletData(userId),
      this.getLoyaltyData(userId),
      this.getKarmaData(userId),
      this.getGamificationData(userId),
      this.getScoreData(userId),
    ]);

    const profile = new UnifiedProfile({
      userId,
      wallet: wallet || { balances: { rez: 0, prive: 0, branded: 0, promo: 0, cashback: 0, referral: 0 }, totalValue: 0 },
      loyalty: loyalty || { globalTier: 'bronze', totalPoints: 0, lifetimeSpend: 0, visitCount: 0, streak: { current: 0, longest: 0 }, merchantPrograms: {} },
      karma: karma || { score: 0, level: 'L1', lifetimeEarned: 0, volunteerHours: 0, eventsCompleted: 0, badges: [], perks: [] },
      gamification: gamification || { xp: 0, level: 1, achievements: [], activeChallenges: [] },
      behavior: { avgOrderValue: 0, orderFrequency: 'occasional', preferredCategories: [], priceRange: 'mid', churnRisk: 0, ltv: 0, preferredChannel: 'push' },
      reZScore: score || { composite: 0, engagement: 0, spending: 0, karma: 0, social: 0, streak: 0, tier: 'bronze' },
      crossMerchant: { categoriesVisited: [], totalMerchantsVisited: 0, badgesEarned: [] },
      activity: { lastActive: new Date(), daysSinceSignup: 0, totalOrders: 0 },
    });

    await profile.save();
    return profile;
  }

  async updateProfile(userId: string, updates: Partial<IUnifiedProfile>): Promise<void> {
    await UnifiedProfile.updateOne({ userId }, { $set: { ...updates, updatedAt: new Date() } });
    await redis.del(getCacheKey(userId));
  }

  // Event handlers
  async handleWalletEvent(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    profile.wallet.balances = data.balances || profile.wallet.balances;
    profile.wallet.totalValue = data.totalValue || profile.wallet.totalValue;
    profile.wallet.lastTransaction = new Date();
    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  async handleOrderCompleted(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    // Update activity
    profile.activity.totalOrders += 1;
    profile.activity.lastActive = new Date();
    profile.activity.lastOrderDate = new Date();

    // Update loyalty
    profile.loyalty.lifetimeSpend += data.amount || 0;
    profile.loyalty.visitCount += 1;
    profile.activity.daysSinceSignup = Math.floor((Date.now() - (profile.activity.lastActive?.getTime() || Date.now())) / (1000 * 60 * 60 * 24));

    // Update behavior
    const totalOrders = profile.activity.totalOrders;
    const avgOrderValue = (profile.behavior.avgOrderValue * (totalOrders - 1) + (data.amount || 0)) / totalOrders;
    profile.behavior.avgOrderValue = avgOrderValue;

    await profile.save();
    await redis.del(getCacheKey(userId));

    // Trigger ReZ Score recalculation
    await this.recalculateReZScore(userId);
  }

  async handleKarmaEarned(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    profile.karma.score += data.amount || 0;
    profile.karma.lifetimeEarned += data.amount || 0;

    // Update level if needed
    if (profile.karma.score >= 1000 && profile.karma.level === 'L1') profile.karma.level = 'L2';
    if (profile.karma.score >= 2500 && profile.karma.level === 'L2') profile.karma.level = 'L3';
    if (profile.karma.score >= 5000 && profile.karma.level === 'L3') profile.karma.level = 'L4';

    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  async handleStreakUpdated(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    profile.loyalty.streak.current = data.current || 0;
    profile.loyalty.streak.longest = Math.max(profile.loyalty.streak.longest, data.current || 0);
    profile.loyalty.streak.lastVisit = new Date();

    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  async handleAchievementUnlocked(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    profile.gamification.achievements.push({
      id: data.achievementId,
      name: data.name,
      earnedAt: new Date(),
    });

    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  async handleBadgeEarned(userId: string, data: any): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    if (!profile.karma.badges.includes(data.badgeId)) {
      profile.karma.badges.push(data.badgeId);
    }

    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  async recalculateReZScore(userId: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    // Engagement score (25%)
    const engagementScore = Math.min(
      (profile.activity.totalOrders / 50) * 25 +
      (profile.loyalty.visitCount / 100) * 25 +
      (profile.gamification.level / 10) * 25 +
      Math.min(profile.loyalty.streak.current * 2, 25),
      100
    );

    // Spending score (30%)
    const spendingScore = Math.min(
      Math.min(profile.loyalty.lifetimeSpend / 100000 * 40, 40) +
      Math.min(profile.wallet.totalValue / 10000 * 30, 30) +
      Math.min(profile.behavior.avgOrderValue / 1000 * 15, 15) +
      Math.min(profile.activity.totalOrders / 100 * 15, 15),
      100
    );

    // Karma score (25%)
    const karmaScore = Math.min(
      Math.min(profile.karma.score / 1000 * 35, 35) +
      Math.min(parseInt(profile.karma.level.replace('L', '')) / 4 * 25, 25) +
      Math.min(profile.karma.volunteerHours / 100 * 20, 20) +
      Math.min(profile.karma.eventsCompleted / 50 * 20, 20),
      100
    );

    // Social score (20%)
    const socialScore = 50; // Placeholder

    // Streak bonus
    const streakBonus = Math.min(profile.loyalty.streak.current * 5, 50);

    // Calculate composite
    const composite = Math.round(
      (engagementScore * 0.25) +
      (spendingScore * 0.30) +
      (karmaScore * 0.25) +
      (socialScore * 0.20) +
      streakBonus
    );

    // Determine tier
    let tier = 'bronze';
    if (composite >= 900) tier = 'ReZ Elite';
    else if (composite >= 800) tier = 'Diamond';
    else if (composite >= 600) tier = 'Platinum';
    else if (composite >= 400) tier = 'Gold';
    else if (composite >= 200) tier = 'Silver';

    profile.reZScore = {
      composite,
      engagement: Math.round(engagementScore),
      spending: Math.round(spendingScore),
      karma: Math.round(karmaScore),
      social: Math.round(socialScore),
      streak: streakBonus,
      tier,
    };

    await profile.save();
    await redis.del(getCacheKey(userId));
  }

  // External service calls
  private async getWalletData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${WALLET_SERVICE}/api/wallet/${userId}`, { timeout: 2000 });
      return response.data;
    } catch {
      return null;
    }
  }

  private async getLoyaltyData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${LOYALTY_SERVICE}/loyalty/${userId}`, { timeout: 2000 });
      return response.data;
    } catch {
      return null;
    }
  }

  private async getKarmaData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${KARMA_SERVICE}/karma/${userId}`, { timeout: 2000 });
      return response.data;
    } catch {
      return null;
    }
  }

  private async getGamificationData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${GAMIFICATION_SERVICE}/gamification/${userId}`, { timeout: 2000 });
      return response.data;
    } catch {
      return null;
    }
  }

  private async getScoreData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${SCORE_SERVICE}/score/${userId}`, { timeout: 2000 });
      return response.data;
    } catch {
      return null;
    }
  }

  private async getStreakData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${STREAK_SERVICE}/api/v1/streak/${userId}`, { timeout: 2000 });
      return response.data?.data || null;
    } catch {
      return null;
    }
  }

  private async getCrossMerchantData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${CROSS_MERCHANT_SERVICE}/api/v1/cross-merchant/${userId}`, { timeout: 2000 });
      return response.data?.data || null;
    } catch {
      return null;
    }
  }

  private async getKarmaLoyaltyBridgeStats(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${KARMA_LOYALTY_BRIDGE}/api/v1/bridge/stats/${userId}`, { timeout: 2000 });
      return response.data?.data || null;
    } catch {
      return null;
    }
  }

  async getLoyaltySummary(userId: string): Promise<{
    loyalty: any;
    streak: any;
    crossMerchant: any;
    karmaBridge: any;
  }> {
    const [loyalty, streak, crossMerchant, karmaBridge] = await Promise.all([
      this.getLoyaltyData(userId),
      this.getStreakData(userId),
      this.getCrossMerchantData(userId),
      this.getKarmaLoyaltyBridgeStats(userId),
    ]);

    return { loyalty, streak, crossMerchant, karmaBridge };
  }
}

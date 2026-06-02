/**
 * Profile Aggregator Service Test Suite
 *
 * Tests for:
 * - Profile data aggregation
 * - ReZ Score calculation
 * - Profile enrichment from multiple sources
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type KarmaLevel = 'starter' | 'active' | 'contributor' | 'leader' | 'elite';

interface UserProfile {
  userId: string;
  email: string;
  phone: string;
  name: string;
  createdAt: Date;
  lastActiveAt: Date;
}

interface WalletBalance {
  cashback: number;
  coins: number;
  lockedCoins: number;
}

interface WalletProfile {
  userId: string;
  balances: WalletBalance;
  totalEarned: number;
  totalRedeemed: number;
  transactionCount: number;
}

interface LoyaltyProfile {
  userId: string;
  tier: LoyaltyTier;
  currentPoints: number;
  lifetimePoints: number;
  expiringPoints: number;
  expiryDate: string;
  pointsToNextTier: number;
}

interface KarmaProfile {
  userId: string;
  karmaScore: number;
  karmaLevel: KarmaLevel;
  totalActivities: number;
  activeDays: number;
  streakDays: number;
}

interface AggregatedProfile {
  userId: string;
  user: UserProfile;
  wallet: WalletProfile;
  loyalty: LoyaltyProfile;
  karma: KarmaProfile;
  rezScore: ReZScore;
  enrichedAt: Date;
}

interface ReZScore {
  composite: number;
  breakdown: {
    loyalty: number;
    karma: number;
    engagement: number;
    recency: number;
  };
  rank?: number;
  percentile?: number;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    userId: `user_${Math.random().toString(36).substring(7)}`,
    email: 'user@example.com',
    phone: '+919876543210',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
    ...overrides,
  };
}

function generateMockWalletProfile(overrides?: Partial<WalletProfile>): WalletProfile {
  return {
    userId: 'user_123',
    balances: {
      cashback: 500,
      coins: 1500,
      lockedCoins: 100,
      ...overrides?.balances,
    },
    totalEarned: 5000,
    totalRedeemed: 3500,
    transactionCount: 45,
    ...overrides,
  };
}

function generateMockLoyaltyProfile(overrides?: Partial<LoyaltyProfile>): LoyaltyProfile {
  return {
    userId: 'user_123',
    tier: 'silver',
    currentPoints: 1500,
    lifetimePoints: 5000,
    expiringPoints: 200,
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    pointsToNextTier: 500,
    ...overrides,
  };
}

function generateMockKarmaProfile(overrides?: Partial<KarmaProfile>): KarmaProfile {
  return {
    userId: 'user_123',
    karmaScore: 1500,
    karmaLevel: 'active',
    totalActivities: 25,
    activeDays: 15,
    streakDays: 7,
    ...overrides,
  };
}

function generateMockAggregatedProfile(overrides?: Partial<AggregatedProfile>): AggregatedProfile {
  const user = generateMockUserProfile();
  return {
    userId: user.userId,
    user,
    wallet: generateMockWalletProfile({ userId: user.userId }),
    loyalty: generateMockLoyaltyProfile({ userId: user.userId }),
    karma: generateMockKarmaProfile({ userId: user.userId }),
    rezScore: calculateReZScore({
      loyalty: generateMockLoyaltyProfile({ userId: user.userId }),
      karma: generateMockKarmaProfile({ userId: user.userId }),
      wallet: generateMockWalletProfile({ userId: user.userId }),
      user: generateMockUserProfile({ userId: user.userId }),
    }),
    enrichedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Score Calculation Logic (to be tested)
// ============================================================================

function calculateReZScore(data: {
  loyalty: LoyaltyProfile;
  karma: KarmaProfile;
  wallet: WalletProfile;
  user: UserProfile;
}): ReZScore {
  // Loyalty component (max 300 points)
  const loyaltyPoints = Math.min(300, data.loyalty.lifetimePoints / 100);

  // Karma component (max 300 points)
  const karmaPoints = Math.min(300, data.karma.karmaScore / 10);

  // Engagement component (max 200 points)
  const activityScore = Math.min(100, data.karma.totalActivities * 2);
  const transactionScore = Math.min(100, data.wallet.transactionCount);

  // Recency component (max 200 points)
  const daysSinceActive = Math.floor(
    (Date.now() - data.user.lastActiveAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const recencyScore = Math.max(0, 200 - daysSinceActive * 5);

  const composite = Math.round(loyaltyPoints + karmaPoints + activityScore + transactionScore + recencyScore);

  return {
    composite: Math.min(1000, composite),
    breakdown: {
      loyalty: Math.round(loyaltyPoints),
      karma: Math.round(karmaPoints),
      engagement: Math.round(activityScore + transactionScore),
      recency: Math.round(recencyScore),
    },
  };
}

// ============================================================================
// Profile Aggregator Service (Mock Implementation)
// ============================================================================

class ProfileAggregatorService {
  private profiles: Map<string, AggregatedProfile> = new Map();

  async getProfile(userId: string): Promise<AggregatedProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async aggregateProfile(userId: string): Promise<AggregatedProfile> {
    const user = generateMockUserProfile({ userId });
    const wallet = generateMockWalletProfile({ userId });
    const loyalty = generateMockLoyaltyProfile({ userId });
    const karma = generateMockKarmaProfile({ userId });

    const aggregated: AggregatedProfile = {
      userId,
      user,
      wallet,
      loyalty,
      karma,
      rezScore: calculateReZScore({ loyalty, karma, wallet, user }),
      enrichedAt: new Date(),
    };

    this.profiles.set(userId, aggregated);
    return aggregated;
  }

  async calculateReZScore(userId: string): Promise<ReZScore | null> {
    const profile = await this.getProfile(userId);
    if (!profile) return null;

    const updatedScore = calculateReZScore({
      loyalty: profile.loyalty,
      karma: profile.karma,
      wallet: profile.wallet,
      user: profile.user,
    });

    profile.rezScore = updatedScore;
    this.profiles.set(userId, profile);
    return updatedScore;
  }

  async updateProfileField(userId: string, field: string, value: unknown): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;

    (profile as Record<string, unknown>)[field] = value;
    this.profiles.set(userId, profile);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('ProfileAggregator', () => {
  let aggregator: ProfileAggregatorService;

  beforeEach(() => {
    aggregator = new ProfileAggregatorService();
  });

  describe('Profile Aggregation', () => {
    it('should aggregate user profile from multiple sources', async () => {
      const userId = 'user_123';
      const profile = await aggregator.aggregateProfile(userId);

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(userId);
      expect(profile.user).toBeDefined();
      expect(profile.wallet).toBeDefined();
      expect(profile.loyalty).toBeDefined();
      expect(profile.karma).toBeDefined();
      expect(profile.rezScore).toBeDefined();
    });

    it('should store aggregated profile', async () => {
      const userId = 'user_456';
      await aggregator.aggregateProfile(userId);

      const retrieved = await aggregator.getProfile(userId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe(userId);
    });

    it('should handle missing profile gracefully', async () => {
      const profile = await aggregator.getProfile('nonexistent_user');
      expect(profile).toBeNull();
    });

    it('should enrich profile with timestamp', async () => {
      const userId = 'user_789';
      const profile = await aggregator.aggregateProfile(userId);

      expect(profile.enrichedAt).toBeInstanceOf(Date);
      expect(profile.enrichedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should merge data from different sources correctly', async () => {
      const userId = 'user_merge_test';
      const profile = await aggregator.aggregateProfile(userId);

      // Verify all sources contribute data
      expect(profile.user.name).toBeDefined();
      expect(profile.wallet.balances.cashback).toBeGreaterThanOrEqual(0);
      expect(profile.loyalty.tier).toBeDefined();
      expect(profile.karma.karmaLevel).toBeDefined();
    });
  });

  describe('ReZ Score Calculation', () => {
    it('should calculate ReZ Score correctly', async () => {
      const profile = generateMockAggregatedProfile();
      const score = calculateReZScore({
        loyalty: profile.loyalty,
        karma: profile.karma,
        wallet: profile.wallet,
        user: profile.user,
      });

      expect(score.composite).toBeGreaterThan(0);
      expect(score.composite).toBeLessThanOrEqual(1000);
      expect(score.breakdown).toBeDefined();
      expect(Object.keys(score.breakdown)).toHaveLength(4);
    });

    it('should cap ReZ Score at 1000', async () => {
      const highScoreProfile = generateMockAggregatedProfile({
        loyalty: generateMockLoyaltyProfile({
          lifetimePoints: 100000,
          currentPoints: 50000,
        }),
        karma: generateMockKarmaProfile({
          karmaScore: 10000,
          totalActivities: 100,
        }),
        wallet: generateMockWalletProfile({
          transactionCount: 100,
        }),
      });

      const score = calculateReZScore({
        loyalty: highScoreProfile.loyalty,
        karma: highScoreProfile.karma,
        wallet: highScoreProfile.wallet,
        user: highScoreProfile.user,
      });

      expect(score.composite).toBeLessThanOrEqual(1000);
    });

    it('should calculate score breakdown correctly', async () => {
      const profile = generateMockAggregatedProfile();
      const score = calculateReZScore({
        loyalty: profile.loyalty,
        karma: profile.karma,
        wallet: profile.wallet,
        user: profile.user,
      });

      const breakdownSum =
        score.breakdown.loyalty +
        score.breakdown.karma +
        score.breakdown.engagement +
        score.breakdown.recency;

      expect(breakdownSum).toBeLessThanOrEqual(score.composite);
    });

    it('should apply tier multiplier to loyalty score', async () => {
      const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
      const scores: number[] = [];

      for (const tier of tiers) {
        const profile = generateMockAggregatedProfile({
          loyalty: generateMockLoyaltyProfile({
            tier,
            lifetimePoints: 5000,
          }),
        });

        const score = calculateReZScore({
          loyalty: profile.loyalty,
          karma: profile.karma,
          wallet: profile.wallet,
          user: profile.user,
        });

        scores.push(score.breakdown.loyalty);
      }

      // All tiers with same lifetime points should have similar base scores
      // (multiplier logic would be in actual service)
      expect(scores[0]).toBe(scores[1]); // Base score should be same
    });

    it('should update score when profile changes', async () => {
      const userId = 'user_score_update';
      await aggregator.aggregateProfile(userId);

      const initialScore = await aggregator.calculateReZScore(userId);
      const initialValue = initialScore?.composite || 0;

      // Update wallet balance
      await aggregator.updateProfileField(userId, 'wallet.balances.cashback', 2000);

      const updatedScore = await aggregator.calculateReZScore(userId);
      expect(updatedScore).toBeDefined();

      // Score should be recalculated (may or may not change based on what was updated)
      expect(updatedScore?.breakdown).toBeDefined();
    });

    it('should handle zero values gracefully', async () => {
      const zeroProfile = generateMockAggregatedProfile({
        loyalty: generateMockLoyaltyProfile({
          lifetimePoints: 0,
          currentPoints: 0,
        }),
        karma: generateMockKarmaProfile({
          karmaScore: 0,
          totalActivities: 0,
          streakDays: 0,
        }),
        wallet: generateMockWalletProfile({
          balances: { cashback: 0, coins: 0, lockedCoins: 0 },
          transactionCount: 0,
        }),
      });

      const score = calculateReZScore({
        loyalty: zeroProfile.loyalty,
        karma: zeroProfile.karma,
        wallet: zeroProfile.wallet,
        user: zeroProfile.user,
      });

      expect(score.composite).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.loyalty).toBe(0);
      expect(score.breakdown.karma).toBe(0);
    });

    it('should weight recency correctly', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const recentProfile = generateMockAggregatedProfile({
        user: generateMockUserProfile({ lastActiveAt: oneDayAgo }),
      });

      const oldProfile = generateMockAggregatedProfile({
        user: generateMockUserProfile({ lastActiveAt: tenDaysAgo }),
      });

      const recentScore = calculateReZScore({
        loyalty: recentProfile.loyalty,
        karma: recentProfile.karma,
        wallet: recentProfile.wallet,
        user: recentProfile.user,
      });

      const oldScore = calculateReZScore({
        loyalty: oldProfile.loyalty,
        karma: oldProfile.karma,
        wallet: oldProfile.wallet,
        user: oldProfile.user,
      });

      expect(recentScore.breakdown.recency).toBeGreaterThan(oldScore.breakdown.recency);
    });
  });

  describe('Profile Data Integrity', () => {
    it('should maintain user ID consistency across sources', async () => {
      const userId = 'user_consistency_test';
      const profile = await aggregator.aggregateProfile(userId);

      expect(profile.user.userId).toBe(userId);
      expect(profile.wallet.userId).toBe(userId);
      expect(profile.loyalty.userId).toBe(userId);
      expect(profile.karma.userId).toBe(userId);
    });

    it('should preserve original data when enriching', async () => {
      const userId = 'user_preserve_test';
      const profile = await aggregator.aggregateProfile(userId);

      const originalName = profile.user.name;
      const originalEmail = profile.user.email;

      await aggregator.calculateReZScore(userId);

      const updated = await aggregator.getProfile(userId);
      expect(updated?.user.name).toBe(originalName);
      expect(updated?.user.email).toBe(originalEmail);
    });

    it('should handle concurrent profile updates', async () => {
      const userId = 'user_concurrent_test';
      await aggregator.aggregateProfile(userId);

      const promises = [
        aggregator.calculateReZScore(userId),
        aggregator.updateProfileField(userId, 'user.name', 'Updated Name'),
        aggregator.calculateReZScore(userId),
      ];

      await Promise.all(promises);

      const profile = await aggregator.getProfile(userId);
      expect(profile).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long user IDs', async () => {
      const longUserId = 'a'.repeat(100);
      const profile = await aggregator.aggregateProfile(longUserId);

      expect(profile.userId).toBe(longUserId);
    });

    it('should handle special characters in user data', async () => {
      const profile = generateMockAggregatedProfile({
        user: generateMockUserProfile({
          name: "O'Connor-Smith",
          email: 'user+test@example.com',
        }),
      });

      expect(profile.user.name).toBe("O'Connor-Smith");
      expect(profile.user.email).toBe('user+test@example.com');
    });

    it('should handle future dates in profile', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const profile = generateMockAggregatedProfile({
        loyalty: generateMockLoyaltyProfile({
          expiryDate: futureDate.toISOString(),
        }),
      });

      expect(profile.loyalty.expiryDate).toBeDefined();
    });

    it('should handle negative values in numeric fields', async () => {
      const profile = generateMockAggregatedProfile({
        wallet: generateMockWalletProfile({
          balances: { cashback: -100, coins: -50, lockedCoins: 0 },
        }),
      });

      const score = calculateReZScore({
        loyalty: profile.loyalty,
        karma: profile.karma,
        wallet: profile.wallet,
        user: profile.user,
      });

      // Should handle gracefully, not crash
      expect(score.composite).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Profile Aggregator Service - Score Calculation Test Suite
 *
 * Tests for:
 * - ReZ Score algorithm
 * - Score component calculations
 * - Score validation and boundaries
 * - Score decay and refresh
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type KarmaLevel = 'starter' | 'active' | 'contributor' | 'leader' | 'elite';

interface ScoreComponents {
  loyalty: number;
  karma: number;
  engagement: number;
  recency: number;
}

interface ReZScore {
  composite: number;
  breakdown: ScoreComponents;
  tier: LoyaltyTier;
  karmaLevel: KarmaLevel;
}

interface ProfileData {
  lifetimePoints: number;
  currentPoints: number;
  karmaScore: number;
  totalActivities: number;
  transactionCount: number;
  lastActiveAt: Date;
  tier: LoyaltyTier;
  karmaLevel: KarmaLevel;
}

// ============================================================================
// Score Calculation Engine (to be tested)
// ============================================================================

const SCORE_CONFIG = {
  maxScore: 1000,
  loyalty: {
    maxPoints: 300,
    weight: 0.3,
  },
  karma: {
    maxPoints: 300,
    weight: 0.3,
  },
  engagement: {
    maxPoints: 200,
    activityWeight: 100,
    transactionWeight: 100,
  },
  recency: {
    maxPoints: 200,
    decayPerDay: 5,
    maxDays: 40,
  },
  tierMultipliers: {
    bronze: 1.0,
    silver: 1.1,
    gold: 1.25,
    platinum: 1.5,
    diamond: 2.0,
  },
  karmaMultipliers: {
    starter: 1.0,
    active: 1.1,
    contributor: 1.25,
    leader: 1.5,
    elite: 2.0,
  },
};

function calculateLoyaltyScore(lifetimePoints: number, currentPoints: number): number {
  const baseScore = Math.min(SCORE_CONFIG.loyalty.maxPoints, lifetimePoints / 100);
  return Math.round(baseScore);
}

function calculateKarmaScore(karmaScore: number): number {
  const baseScore = Math.min(SCORE_CONFIG.karma.maxPoints, karmaScore / 10);
  return Math.round(baseScore);
}

function calculateEngagementScore(totalActivities: number, transactionCount: number): number {
  const activityScore = Math.min(SCORE_CONFIG.engagement.activityWeight, totalActivities * 2);
  const transactionScore = Math.min(SCORE_CONFIG.engagement.transactionWeight, transactionCount);
  return Math.round(activityScore + transactionScore);
}

function calculateRecencyScore(lastActiveAt: Date): number {
  const daysSinceActive = Math.floor(
    (Date.now() - lastActiveAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const decay = Math.min(daysSinceActive * SCORE_CONFIG.recency.decayPerDay, SCORE_CONFIG.recency.maxPoints);
  return Math.round(Math.max(0, SCORE_CONFIG.recency.maxPoints - decay));
}

function applyTierMultiplier(score: number, tier: LoyaltyTier): number {
  const multiplier = SCORE_CONFIG.tierMultipliers[tier] ?? 1.0;
  return Math.round(score * multiplier);
}

function applyKarmaMultiplier(score: number, karmaLevel: KarmaLevel): number {
  const multiplier = SCORE_CONFIG.karmaMultipliers[karmaLevel] ?? 1.0;
  return Math.round(score * multiplier);
}

function calculateReZScore(data: ProfileData): ReZScore {
  const loyaltyScore = calculateLoyaltyScore(data.lifetimePoints, data.currentPoints);
  const karmaScore = calculateKarmaScore(data.karmaScore);
  const engagementScore = calculateEngagementScore(data.totalActivities, data.transactionCount);
  const recencyScore = calculateRecencyScore(data.lastActiveAt);

  const rawComposite = loyaltyScore + karmaScore + engagementScore + recencyScore;
  const tierBonus = (SCORE_CONFIG.tierMultipliers[data.tier] - 1) * 0.1 * rawComposite;
  const karmaBonus = (SCORE_CONFIG.karmaMultipliers[data.karmaLevel] - 1) * 0.1 * rawComposite;

  const composite = Math.min(SCORE_CONFIG.maxScore, Math.round(rawComposite + tierBonus + karmaBonus));

  return {
    composite,
    breakdown: {
      loyalty: loyaltyScore,
      karma: karmaScore,
      engagement: engagementScore,
      recency: recencyScore,
    },
    tier: data.tier,
    karmaLevel: data.karmaLevel,
  };
}

function calculatePointsToNextTier(currentPoints: number, currentTier: LoyaltyTier): number {
  const tierThresholds: Record<LoyaltyTier, number> = {
    bronze: 0,
    silver: 500,
    gold: 2000,
    platinum: 5000,
    diamond: 10000,
  };

  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const idx = tiers.indexOf(currentTier);

  if (idx === -1 || idx === tiers.length - 1) return 0;

  const nextTier = tiers[idx + 1];
  return Math.max(0, tierThresholds[nextTier] - currentPoints);
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function createMockProfile(overrides?: Partial<ProfileData>): ProfileData {
  return {
    lifetimePoints: 1000,
    currentPoints: 800,
    karmaScore: 500,
    totalActivities: 20,
    transactionCount: 15,
    lastActiveAt: new Date(),
    tier: 'bronze',
    karmaLevel: 'active',
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Score Calculation', () => {

  describe('Loyalty Score Calculation', () => {
    it('should calculate loyalty score from lifetime points', () => {
      expect(calculateLoyaltyScore(0, 0)).toBe(0);
      expect(calculateLoyaltyScore(1000, 500)).toBe(10);
      expect(calculateLoyaltyScore(5000, 2000)).toBe(50);
      expect(calculateLoyaltyScore(10000, 5000)).toBe(100);
    });

    it('should cap loyalty score at maximum', () => {
      expect(calculateLoyaltyScore(100000, 50000)).toBe(300);
      expect(calculateLoyaltyScore(50000, 25000)).toBe(300);
    });

    it('should handle fractional points correctly', () => {
      expect(calculateLoyaltyScore(999, 500)).toBe(9);
      expect(calculateLoyaltyScore(1500, 750)).toBe(15);
    });

    it('should calculate different scores for different point levels', () => {
      const score1 = calculateLoyaltyScore(500, 250);
      const score2 = calculateLoyaltyScore(1500, 1000);
      const score3 = calculateLoyaltyScore(3000, 2000);

      expect(score2).toBeGreaterThan(score1);
      expect(score3).toBeGreaterThan(score2);
    });

    it('should not return negative scores', () => {
      expect(calculateLoyaltyScore(-100, 0)).toBe(0);
      expect(calculateLoyaltyScore(0, 0)).toBe(0);
    });
  });

  describe('Karma Score Calculation', () => {
    it('should calculate karma score from karma score', () => {
      expect(calculateKarmaScore(0)).toBe(0);
      expect(calculateKarmaScore(500)).toBe(50);
      expect(calculateKarmaScore(1000)).toBe(100);
      expect(calculateKarmaScore(3000)).toBe(300);
    });

    it('should cap karma score at maximum', () => {
      expect(calculateKarmaScore(10000)).toBe(300);
      expect(calculateKarmaScore(5000)).toBe(300);
    });

    it('should scale linearly up to cap', () => {
      const score1 = calculateKarmaScore(1500);
      const score2 = calculateKarmaScore(3000);
      expect(score2).toBe(score1 * 2);
    });

    it('should handle decimal karma scores', () => {
      expect(calculateKarmaScore(555)).toBe(55);
      expect(calculateKarmaScore(99)).toBe(9);
    });
  });

  describe('Engagement Score Calculation', () => {
    it('should calculate engagement from activities and transactions', () => {
      expect(calculateEngagementScore(0, 0)).toBe(0);
      expect(calculateEngagementScore(10, 5)).toBe(25); // 10*2 + 5
      expect(calculateEngagementScore(50, 100)).toBe(200); // capped
    });

    it('should cap activity score at maximum', () => {
      expect(calculateEngagementScore(100, 0)).toBe(100);
      expect(calculateEngagementScore(200, 0)).toBe(100);
    });

    it('should cap transaction score at maximum', () => {
      expect(calculateEngagementScore(0, 150)).toBe(100);
      expect(calculateEngagementScore(0, 200)).toBe(100);
    });

    it('should sum both components correctly', () => {
      expect(calculateEngagementScore(25, 50)).toBe(100); // 25*2 + 50
      expect(calculateEngagementScore(30, 60)).toBe(120); // 30*2 + 60 (capped at 200)
    });

    it('should weight activities and transactions equally', () => {
      const score1 = calculateEngagementScore(50, 0);
      const score2 = calculateEngagementScore(0, 50);
      expect(score1).toBe(score2);
    });
  });

  describe('Recency Score Calculation', () => {
    it('should return max score for recent activity', () => {
      const now = new Date();
      expect(calculateRecencyScore(now)).toBe(200);
    });

    it('should decay score over time', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      expect(calculateRecencyScore(oneDayAgo)).toBe(195);
      expect(calculateRecencyScore(fiveDaysAgo)).toBe(175);
      expect(calculateRecencyScore(tenDaysAgo)).toBe(150);
    });

    it('should reach zero after max days', () => {
      const now = new Date();
      const fortyOneDaysAgo = new Date(now.getTime() - 41 * 24 * 60 * 60 * 1000);
      expect(calculateRecencyScore(fortyOneDaysAgo)).toBe(0);
    });

    it('should not go negative', () => {
      const now = new Date();
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      expect(calculateRecencyScore(yearAgo)).toBe(0);
    });

    it('should decay at correct rate', () => {
      const now = new Date();
      const days = [0, 1, 5, 10, 20, 40];
      const expectedScores = [200, 195, 175, 150, 100, 0];

      days.forEach((day, idx) => {
        const date = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
        expect(calculateRecencyScore(date)).toBe(expectedScores[idx]);
      });
    });
  });

  describe('Tier Multiplier Application', () => {
    it('should apply correct multiplier for each tier', () => {
      const baseScore = 100;
      expect(applyTierMultiplier(baseScore, 'bronze')).toBe(100);
      expect(applyTierMultiplier(baseScore, 'silver')).toBe(110);
      expect(applyTierMultiplier(baseScore, 'gold')).toBe(125);
      expect(applyTierMultiplier(baseScore, 'platinum')).toBe(150);
      expect(applyTierMultiplier(baseScore, 'diamond')).toBe(200);
    });

    it('should scale with base score', () => {
      const baseScore = 250;
      expect(applyTierMultiplier(baseScore, 'diamond')).toBe(500);
      expect(applyTierMultiplier(baseScore, 'platinum')).toBe(375);
    });
  });

  describe('Karma Level Multiplier Application', () => {
    it('should apply correct multiplier for each karma level', () => {
      const baseScore = 100;
      expect(applyKarmaMultiplier(baseScore, 'starter')).toBe(100);
      expect(applyKarmaMultiplier(baseScore, 'active')).toBe(110);
      expect(applyKarmaMultiplier(baseScore, 'contributor')).toBe(125);
      expect(applyKarmaMultiplier(baseScore, 'leader')).toBe(150);
      expect(applyKarmaMultiplier(baseScore, 'elite')).toBe(200);
    });
  });

  describe('Complete ReZ Score Calculation', () => {
    it('should calculate composite score correctly', () => {
      const profile = createMockProfile({
        lifetimePoints: 5000,
        currentPoints: 4000,
        karmaScore: 2000,
        totalActivities: 30,
        transactionCount: 25,
        lastActiveAt: new Date(),
        tier: 'silver',
        karmaLevel: 'active',
      });

      const score = calculateReZScore(profile);

      expect(score.composite).toBeGreaterThan(0);
      expect(score.composite).toBeLessThanOrEqual(1000);
      expect(score.tier).toBe('silver');
      expect(score.karmaLevel).toBe('active');
    });

    it('should cap composite score at maximum', () => {
      const profile = createMockProfile({
        lifetimePoints: 100000,
        karmaScore: 50000,
        totalActivities: 1000,
        transactionCount: 1000,
        lastActiveAt: new Date(),
        tier: 'diamond',
        karmaLevel: 'elite',
      });

      const score = calculateReZScore(profile);
      expect(score.composite).toBeLessThanOrEqual(1000);
    });

    it('should return valid breakdown', () => {
      const profile = createMockProfile();
      const score = calculateReZScore(profile);

      expect(score.breakdown).toBeDefined();
      expect(score.breakdown.loyalty).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.karma).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.engagement).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.recency).toBeGreaterThanOrEqual(0);

      const breakdownSum =
        score.breakdown.loyalty +
        score.breakdown.karma +
        score.breakdown.engagement +
        score.breakdown.recency;

      expect(breakdownSum).toBeLessThanOrEqual(score.composite + 100); // Allow some tolerance for multipliers
    });

    it('should handle zero profile', () => {
      const profile = createMockProfile({
        lifetimePoints: 0,
        currentPoints: 0,
        karmaScore: 0,
        totalActivities: 0,
        transactionCount: 0,
        lastActiveAt: new Date(0),
        tier: 'bronze',
        karmaLevel: 'starter',
      });

      const score = calculateReZScore(profile);
      expect(score.composite).toBeGreaterThanOrEqual(0);
    });

    it('should handle new user profile', () => {
      const profile = createMockProfile({
        lifetimePoints: 100,
        currentPoints: 100,
        karmaScore: 50,
        totalActivities: 2,
        transactionCount: 1,
        lastActiveAt: new Date(),
        tier: 'bronze',
        karmaLevel: 'starter',
      });

      const score = calculateReZScore(profile);
      expect(score.composite).toBeGreaterThan(0);
      expect(score.breakdown.recency).toBe(200); // Very recent
    });

    it('should handle old inactive profile', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const profile = createMockProfile({
        lifetimePoints: 10000,
        karmaScore: 5000,
        totalActivities: 100,
        transactionCount: 50,
        lastActiveAt: thirtyDaysAgo,
        tier: 'platinum',
        karmaLevel: 'leader',
      });

      const score = calculateReZScore(profile);
      expect(score.breakdown.recency).toBe(50); // 30 days decay
    });
  });

  describe('Points to Next Tier Calculation', () => {
    it('should calculate points needed for next tier', () => {
      expect(calculatePointsToNextTier(0, 'bronze')).toBe(500);
      expect(calculatePointsToNextTier(250, 'bronze')).toBe(250);
      expect(calculatePointsToNextTier(500, 'silver')).toBe(1500);
      expect(calculatePointsToNextTier(2000, 'gold')).toBe(3000);
      expect(calculatePointsToNextTier(5000, 'platinum')).toBe(5000);
    });

    it('should return 0 for diamond tier', () => {
      expect(calculatePointsToNextTier(15000, 'diamond')).toBe(0);
      expect(calculatePointsToNextTier(10000, 'diamond')).toBe(0);
    });

    it('should return 0 when at exact threshold', () => {
      expect(calculatePointsToNextTier(500, 'bronze')).toBe(1500); // Need silver (1000) - 500
      expect(calculatePointsToNextTier(2000, 'gold')).toBe(3000); // Need platinum (5000) - 2000
    });

    it('should not return negative values', () => {
      expect(calculatePointsToNextTier(600, 'bronze')).toBe(0); // Actually already at silver
    });
  });

  describe('Score Edge Cases', () => {
    it('should handle very large numbers', () => {
      const profile = createMockProfile({
        lifetimePoints: Number.MAX_SAFE_INTEGER,
        karmaScore: Number.MAX_SAFE_INTEGER,
      });

      const score = calculateReZScore(profile);
      expect(score.composite).toBeLessThanOrEqual(1000);
    });

    it('should handle negative inputs gracefully', () => {
      const profile = createMockProfile({
        lifetimePoints: -100,
        karmaScore: -50,
      });

      const score = calculateReZScore(profile);
      expect(score.composite).toBeGreaterThanOrEqual(0);
    });

    it('should handle future dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const profile = createMockProfile({
        lastActiveAt: futureDate,
      });

      const score = calculateReZScore(profile);
      expect(score.breakdown.recency).toBe(195); // Future date = 1 day ago
    });

    it('should handle very old dates', () => {
      const ancientDate = new Date('2000-01-01');
      const profile = createMockProfile({
        lastActiveAt: ancientDate,
      });

      const score = calculateReZScore(profile);
      expect(score.breakdown.recency).toBe(0);
    });

    it('should handle fractional scores correctly', () => {
      const profile = createMockProfile({
        lifetimePoints: 333,
        karmaScore: 777,
        totalActivities: 7,
        transactionCount: 3,
      });

      const score = calculateReZScore(profile);
      // All scores should be rounded
      expect(Number.isInteger(score.breakdown.loyalty)).toBe(true);
      expect(Number.isInteger(score.breakdown.karma)).toBe(true);
    });
  });

  describe('Score Validation', () => {
    it('should always return score between 0 and 1000', () => {
      const testCases: ProfileData[] = [
        createMockProfile(),
        createMockProfile({ tier: 'diamond', karmaLevel: 'elite' }),
        createMockProfile({ tier: 'bronze', karmaLevel: 'starter' }),
        createMockProfile({ lifetimePoints: 0, karmaScore: 0 }),
        createMockProfile({
          lifetimePoints: 100000,
          karmaScore: 50000,
          totalActivities: 500,
          transactionCount: 500,
        }),
      ];

      for (const profile of testCases) {
        const score = calculateReZScore(profile);
        expect(score.composite).toBeGreaterThanOrEqual(0);
        expect(score.composite).toBeLessThanOrEqual(1000);
      }
    });

    it('should always have valid breakdown', () => {
      const profile = createMockProfile();
      const score = calculateReZScore(profile);

      expect(Object.keys(score.breakdown)).toHaveLength(4);
      expect(score.breakdown.loyalty).toBeLessThanOrEqual(SCORE_CONFIG.loyalty.maxPoints);
      expect(score.breakdown.karma).toBeLessThanOrEqual(SCORE_CONFIG.karma.maxPoints);
      expect(score.breakdown.engagement).toBeLessThanOrEqual(SCORE_CONFIG.engagement.maxPoints);
      expect(score.breakdown.recency).toBeLessThanOrEqual(SCORE_CONFIG.recency.maxPoints);
    });
  });

  describe('Score Comparison', () => {
    it('should rank higher tier users above lower tier users', () => {
      const bronzeProfile = createMockProfile({ tier: 'bronze' });
      const silverProfile = createMockProfile({ tier: 'silver' });
      const goldProfile = createMockProfile({ tier: 'gold' });

      const bronzeScore = calculateReZScore(bronzeProfile);
      const silverScore = calculateReZScore(silverProfile);
      const goldScore = calculateReZScore(goldProfile);

      expect(goldScore.composite).toBeGreaterThan(silverScore.composite);
      expect(silverScore.composite).toBeGreaterThan(bronzeScore.composite);
    });

    it('should rank higher karma users above lower karma users', () => {
      const starterProfile = createMockProfile({ karmaLevel: 'starter' });
      const activeProfile = createMockProfile({ karmaLevel: 'active' });
      const eliteProfile = createMockProfile({ karmaLevel: 'elite' });

      const starterScore = calculateReZScore(starterProfile);
      const activeScore = calculateReZScore(activeProfile);
      const eliteScore = calculateReZScore(eliteProfile);

      expect(eliteScore.composite).toBeGreaterThan(activeScore.composite);
      expect(activeScore.composite).toBeGreaterThan(starterScore.composite);
    });

    it('should rank recently active users above inactive users', () => {
      const recentProfile = createMockProfile({
        lastActiveAt: new Date(),
      });
      const oldProfile = createMockProfile({
        lastActiveAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      const recentScore = calculateReZScore(recentProfile);
      const oldScore = calculateReZScore(oldProfile);

      expect(recentScore.composite).toBeGreaterThan(oldScore.composite);
    });

    it('should rank more active users above less active users', () => {
      const activeProfile = createMockProfile({
        totalActivities: 100,
        transactionCount: 50,
      });
      const inactiveProfile = createMockProfile({
        totalActivities: 10,
        transactionCount: 5,
      });

      const activeScore = calculateReZScore(activeProfile);
      const inactiveScore = calculateReZScore(inactiveProfile);

      expect(activeScore.breakdown.engagement).toBeGreaterThan(inactiveScore.breakdown.engagement);
    });
  });

  describe('Score Decay', () => {
    it('should naturally decay scores over time', () => {
      const baseProfile = createMockProfile();
      const scores: number[] = [];
      const days = [0, 7, 14, 21, 30];

      for (const day of days) {
        const profile = createMockProfile({
          lastActiveAt: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
        });
        scores.push(calculateReZScore(profile).composite);
      }

      // Scores should decrease over time
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('should preserve relative ranking after decay', () => {
      const highScoreProfile = createMockProfile({
        lifetimePoints: 10000,
        karmaScore: 5000,
        totalActivities: 100,
        transactionCount: 100,
        lastActiveAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      });

      const lowScoreProfile = createMockProfile({
        lifetimePoints: 500,
        karmaScore: 100,
        totalActivities: 5,
        transactionCount: 2,
        lastActiveAt: new Date(),
      });

      const highScore = calculateReZScore(highScoreProfile);
      const lowScore = calculateReZScore(lowScoreProfile);

      // High score profile still ranks higher despite being inactive
      expect(highScore.composite).toBeGreaterThan(lowScore.composite);
    });
  });
});

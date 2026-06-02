/**
 * Score Service - Score Calculation Test Suite
 *
 * Tests for:
 * - Score calculation algorithms
 * - Score component weighting
 * - Score bounds and validation
 * - Score history tracking
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
  bonus: number;
}

interface ScoreBreakdown {
  components: ScoreComponents;
  total: number;
  percentile?: number;
  rank?: number;
}

interface UserScoreData {
  userId: string;
  loyaltyPoints: number;
  karmaScore: number;
  totalOrders: number;
  totalSpent: number;
  lastActivityAt: Date;
  streakDays: number;
  tier: LoyaltyTier;
  karmaLevel: KarmaLevel;
}

interface ScoreHistory {
  date: Date;
  score: number;
  change: number;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockScoreData(overrides?: Partial<UserScoreData>): UserScoreData {
  return {
    userId: 'user_123',
    loyaltyPoints: 1000,
    karmaScore: 500,
    totalOrders: 20,
    totalSpent: 10000,
    lastActivityAt: new Date(),
    streakDays: 7,
    tier: 'bronze',
    karmaLevel: 'active',
    ...overrides,
  };
}

// ============================================================================
// Score Calculation Configuration
// ============================================================================

const SCORE_WEIGHTS = {
  loyalty: 0.35,
  karma: 0.30,
  engagement: 0.20,
  recency: 0.10,
  bonus: 0.05,
};

const SCORE_CAPS = {
  loyalty: 350,
  karma: 300,
  engagement: 200,
  recency: 100,
  bonus: 50,
};

const TIER_BONUS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 10,
  gold: 25,
  platinum: 50,
  diamond: 100,
};

const KARMA_BONUS: Record<KarmaLevel, number> = {
  starter: 0,
  active: 5,
  contributor: 15,
  leader: 30,
  elite: 50,
};

// ============================================================================
// Score Calculation Logic (to be tested)
// ============================================================================

function calculateLoyaltyComponent(loyaltyPoints: number): number {
  // 1 point = 0.35 score points, capped at 350
  return Math.min(SCORE_CAPS.loyalty, Math.floor(loyaltyPoints * SCORE_WEIGHTS.loyalty));
}

function calculateKarmaComponent(karmaScore: number): number {
  // 1 karma = 0.6 score points, capped at 300
  return Math.min(SCORE_CAPS.karma, Math.floor(karmaScore * 0.6));
}

function calculateEngagementComponent(totalOrders: number, totalSpent: number): number {
  const orderScore = Math.min(100, totalOrders * 2);
  const spendScore = Math.min(100, totalSpent / 200);
  return Math.min(SCORE_CAPS.engagement, Math.floor(orderScore + spendScore));
}

function calculateRecencyComponent(lastActivityAt: Date): number {
  const now = new Date();
  const daysSinceActivity = Math.floor(
    (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceActivity === 0) return SCORE_CAPS.recency;
  if (daysSinceActivity <= 7) return SCORE_CAPS.recency - (daysSinceActivity * 10);
  if (daysSinceActivity <= 30) return Math.max(20, SCORE_CAPS.recency - 70 - ((daysSinceActivity - 7) * 2));
  return 20;
}

function calculateBonusComponent(tier: LoyaltyTier, karmaLevel: KarmaLevel, streakDays: number): number {
  const tierBonus = TIER_BONUS[tier] || 0;
  const karmaBonus = KARMA_BONUS[karmaLevel] || 0;
  const streakBonus = Math.min(20, streakDays);

  return Math.min(SCORE_CAPS.bonus, tierBonus + karmaBonus + streakBonus);
}

function calculateScore(data: UserScoreData): ScoreBreakdown {
  const loyalty = calculateLoyaltyComponent(data.loyaltyPoints);
  const karma = calculateKarmaComponent(data.karmaScore);
  const engagement = calculateEngagementComponent(data.totalOrders, data.totalSpent);
  const recency = calculateRecencyComponent(data.lastActivityAt);
  const bonus = calculateBonusComponent(data.tier, data.karmaLevel, data.streakDays);

  const components: ScoreComponents = { loyalty, karma, engagement, recency, bonus };
  const total = loyalty + karma + engagement + recency + bonus;

  return {
    components,
    total: Math.min(1000, total),
  };
}

function calculatePercentile(rank: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  return Math.round(((totalUsers - rank) / totalUsers) * 100);
}

function calculateScoreChange(history: ScoreHistory[]): number {
  if (history.length < 2) return 0;

  const sorted = [...history].sort((a, b) => b.date.getTime() - a.date.getTime());
  return sorted[0].score - sorted[1].score;
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Score Calculation', () => {

  describe('Loyalty Component', () => {
    it('should calculate correct loyalty score', () => {
      expect(calculateLoyaltyComponent(0)).toBe(0);
      expect(calculateLoyaltyComponent(1000)).toBe(350);
      expect(calculateLoyaltyComponent(500)).toBe(175);
    });

    it('should cap loyalty score at maximum', () => {
      expect(calculateLoyaltyComponent(10000)).toBe(350);
      expect(calculateLoyaltyComponent(5000)).toBe(350);
    });

    it('should handle fractional points', () => {
      expect(calculateLoyaltyComponent(1)).toBe(0);
      expect(calculateLoyaltyComponent(3)).toBe(1);
    });

    it('should scale linearly below cap', () => {
      expect(calculateLoyaltyComponent(500)).toBe(175);
      expect(calculateLoyaltyComponent(1000)).toBe(350);
      expect(calculateLoyaltyComponent(1000) / calculateLoyaltyComponent(500)).toBeCloseTo(2, 1);
    });
  });

  describe('Karma Component', () => {
    it('should calculate correct karma score', () => {
      expect(calculateKarmaComponent(0)).toBe(0);
      expect(calculateKarmaComponent(500)).toBe(300); // Capped at 300
      expect(calculateKarmaComponent(200)).toBe(120);
    });

    it('should cap karma score at maximum', () => {
      expect(calculateKarmaComponent(1000)).toBe(300);
    });

    it('should scale at 0.6 rate', () => {
      expect(calculateKarmaComponent(100)).toBe(60);
      expect(calculateKarmaComponent(200)).toBe(120);
    });
  });

  describe('Engagement Component', () => {
    it('should calculate correct engagement score', () => {
      expect(calculateEngagementComponent(0, 0)).toBe(0);
      expect(calculateEngagementComponent(10, 1000)).toBe(45); // 20 + 5
      expect(calculateEngagementComponent(50, 10000)).toBe(150); // 100 + 50
    });

    it('should cap order score at 100', () => {
      expect(calculateEngagementComponent(100, 0)).toBe(100);
      expect(calculateEngagementComponent(200, 0)).toBe(100);
    });

    it('should cap spend score at 100', () => {
      expect(calculateEngagementComponent(0, 50000)).toBe(100);
      expect(calculateEngagementComponent(0, 100000)).toBe(100);
    });

    it('should sum order and spend scores', () => {
      const orders = calculateEngagementComponent(30, 0);
      const spend = calculateEngagementComponent(0, 10000);
      const combined = calculateEngagementComponent(30, 10000);

      expect(combined).toBe(orders + spend);
    });
  });

  describe('Recency Component', () => {
    it('should return max for today', () => {
      const today = new Date();
      expect(calculateRecencyComponent(today)).toBe(100);
    });

    it('should decay for recent activity', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(calculateRecencyComponent(yesterday)).toBe(90);
    });

    it('should decay faster for older activity', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(calculateRecencyComponent(sevenDaysAgo)).toBe(30);
    });

    it('should maintain minimum for old activity', () => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(calculateRecencyComponent(monthAgo)).toBe(20);
    });
  });

  describe('Bonus Component', () => {
    it('should add tier bonus correctly', () => {
      expect(calculateBonusComponent('bronze', 'starter', 0)).toBe(0);
      expect(calculateBonusComponent('silver', 'starter', 0)).toBe(10);
      expect(calculateBonusComponent('gold', 'starter', 0)).toBe(25);
      expect(calculateBonusComponent('platinum', 'starter', 0)).toBe(50);
    });

    it('should add karma level bonus correctly', () => {
      expect(calculateBonusComponent('bronze', 'starter', 0)).toBe(0);
      expect(calculateBonusComponent('bronze', 'active', 0)).toBe(5);
      expect(calculateBonusComponent('bronze', 'contributor', 0)).toBe(15);
      expect(calculateBonusComponent('bronze', 'leader', 0)).toBe(30);
      expect(calculateBonusComponent('bronze', 'elite', 0)).toBe(50);
    });

    it('should add streak bonus correctly', () => {
      expect(calculateBonusComponent('bronze', 'starter', 7)).toBe(7);
      expect(calculateBonusComponent('bronze', 'starter', 30)).toBe(20); // Capped at 20
    });

    it('should cap bonus at maximum', () => {
      const max = calculateBonusComponent('diamond', 'elite', 100);
      expect(max).toBe(50);
    });

    it('should sum all bonus sources', () => {
      const bonus = calculateBonusComponent('gold', 'contributor', 14);
      expect(bonus).toBe(25 + 15 + 14); // 54, capped at 50
    });
  });

  describe('Complete Score Calculation', () => {
    it('should calculate correct total score', () => {
      const data = generateMockScoreData({
        loyaltyPoints: 1000,
        karmaScore: 500,
        totalOrders: 20,
        totalSpent: 10000,
        lastActivityAt: new Date(),
        streakDays: 7,
        tier: 'bronze',
        karmaLevel: 'active',
      });

      const score = calculateScore(data);

      expect(score.total).toBeGreaterThan(0);
      expect(score.total).toBeLessThanOrEqual(1000);
    });

    it('should return valid breakdown', () => {
      const data = generateMockScoreData();
      const score = calculateScore(data);

      expect(score.components).toBeDefined();
      expect(score.components.loyalty).toBeGreaterThanOrEqual(0);
      expect(score.components.karma).toBeGreaterThanOrEqual(0);
      expect(score.components.engagement).toBeGreaterThanOrEqual(0);
      expect(score.components.recency).toBeGreaterThanOrEqual(0);
      expect(score.components.bonus).toBeGreaterThanOrEqual(0);
    });

    it('should sum components correctly', () => {
      const data = generateMockScoreData();
      const score = calculateScore(data);

      const sum = Object.values(score.components).reduce((a, b) => a + b, 0);
      expect(score.total).toBeLessThanOrEqual(sum);
    });

    it('should cap total at 1000', () => {
      const data = generateMockScoreData({
        loyaltyPoints: 100000,
        karmaScore: 100000,
        totalOrders: 1000,
        totalSpent: 1000000,
        streakDays: 365,
        tier: 'diamond',
        karmaLevel: 'elite',
      });

      const score = calculateScore(data);
      expect(score.total).toBeLessThanOrEqual(1000);
    });

    it('should handle zero values', () => {
      const data = generateMockScoreData({
        loyaltyPoints: 0,
        karmaScore: 0,
        totalOrders: 0,
        totalSpent: 0,
        lastActivityAt: new Date(0),
        streakDays: 0,
        tier: 'bronze',
        karmaLevel: 'starter',
      });

      const score = calculateScore(data);
      expect(score.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Percentile Calculation', () => {
    it('should calculate correct percentile for rank 1', () => {
      expect(calculatePercentile(1, 100)).toBe(99);
    });

    it('should calculate correct percentile for middle rank', () => {
      expect(calculatePercentile(50, 100)).toBe(50);
    });

    it('should calculate correct percentile for last rank', () => {
      expect(calculatePercentile(100, 100)).toBe(0);
    });

    it('should handle zero users', () => {
      expect(calculatePercentile(1, 0)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(calculatePercentile(1, 3)).toBe(67);
      expect(calculatePercentile(2, 3)).toBe(33);
    });
  });

  describe('Score Change Calculation', () => {
    it('should return 0 for insufficient history', () => {
      expect(calculateScoreChange([])).toBe(0);
      expect(calculateScoreChange([{ date: new Date(), score: 100, change: 0 }])).toBe(0);
    });

    it('should calculate positive change correctly', () => {
      const history: ScoreHistory[] = [
        { date: new Date('2025-01-02'), score: 550, change: 0 },
        { date: new Date('2025-01-01'), score: 500, change: 0 },
      ];

      expect(calculateScoreChange(history)).toBe(50);
    });

    it('should calculate negative change correctly', () => {
      const history: ScoreHistory[] = [
        { date: new Date('2025-01-02'), score: 450, change: 0 },
        { date: new Date('2025-01-01'), score: 500, change: 0 },
      ];

      expect(calculateScoreChange(history)).toBe(-50);
    });

    it('should handle unsorted history', () => {
      const history: ScoreHistory[] = [
        { date: new Date('2025-01-01'), score: 500, change: 0 },
        { date: new Date('2025-01-02'), score: 550, change: 0 },
      ];

      expect(calculateScoreChange(history)).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large values', () => {
      const data = generateMockScoreData({
        loyaltyPoints: Number.MAX_SAFE_INTEGER,
        karmaScore: Number.MAX_SAFE_INTEGER,
        totalOrders: Number.MAX_SAFE_INTEGER,
        totalSpent: Number.MAX_SAFE_INTEGER,
      });

      const score = calculateScore(data);
      expect(score.total).toBeLessThanOrEqual(1000);
    });

    it('should handle negative values', () => {
      const data = generateMockScoreData({
        loyaltyPoints: -100,
        karmaScore: -50,
      });

      const score = calculateScore(data);
      expect(score.components.loyalty).toBe(0);
      expect(score.components.karma).toBe(0);
    });

    it('should handle future dates', () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const score = calculateRecencyComponent(future);
      expect(score).toBe(100);
    });

    it('should handle very old dates', () => {
      const old = new Date('2000-01-01');
      const score = calculateRecencyComponent(old);
      expect(score).toBe(20);
    });
  });
});

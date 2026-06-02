/**
 * Score Service - Tier Calculation Test Suite
 *
 * Tests for:
 * - Tier determination from score
 * - Tier progression and thresholds
 * - Tier benefits and multipliers
 * - Tier downgrade logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface TierConfig {
  name: LoyaltyTier;
  minScore: number;
  maxScore: number | null;
  multiplier: number;
  cashbackPercent: number;
  perks: string[];
  color: string;
  icon: string;
}

interface TierProgress {
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  currentScore: number;
  scoreForNextTier: number;
  pointsToNextTier: number;
  progressPercent: number;
}

interface TierUpgrade {
  previousTier: LoyaltyTier;
  newTier: LoyaltyTier;
  score: number;
  timestamp: Date;
  trigger: 'score_threshold' | 'manual' | 'promotion';
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockTierProgress(overrides?: Partial<TierProgress>): TierProgress {
  return {
    currentTier: 'bronze',
    nextTier: 'silver',
    currentScore: 150,
    scoreForNextTier: 500,
    pointsToNextTier: 350,
    progressPercent: 30,
    ...overrides,
  };
}

// ============================================================================
// Tier Configuration
// ============================================================================

const TIER_CONFIGS: TierConfig[] = [
  {
    name: 'bronze',
    minScore: 0,
    maxScore: 499,
    multiplier: 1.0,
    cashbackPercent: 1,
    perks: ['Basic rewards'],
    color: '#CD7F32',
    icon: 'bronze_medal',
  },
  {
    name: 'silver',
    minScore: 500,
    maxScore: 1499,
    multiplier: 1.1,
    cashbackPercent: 2,
    perks: ['Basic rewards', 'Birthday bonus'],
    color: '#C0C0C0',
    icon: 'silver_medal',
  },
  {
    name: 'gold',
    minScore: 1500,
    maxScore: 3499,
    multiplier: 1.25,
    cashbackPercent: 3,
    perks: ['Basic rewards', 'Birthday bonus', 'Priority support'],
    color: '#FFD700',
    icon: 'gold_medal',
  },
  {
    name: 'platinum',
    minScore: 3500,
    maxScore: 7499,
    multiplier: 1.5,
    cashbackPercent: 5,
    perks: ['Basic rewards', 'Birthday bonus', 'Priority support', 'Free delivery'],
    color: '#E5E4E2',
    icon: 'platinum_medal',
  },
  {
    name: 'diamond',
    minScore: 7500,
    maxScore: null,
    multiplier: 2.0,
    cashbackPercent: 8,
    perks: ['Basic rewards', 'Birthday bonus', 'Priority support', 'Free delivery', 'VIP events', 'Personal concierge'],
    color: '#B9F2FF',
    icon: 'diamond_medal',
  },
];

// ============================================================================
// Tier Calculation Logic (to be tested)
// ============================================================================

function getTierFromScore(score: number): LoyaltyTier {
  if (score >= 7500) return 'diamond';
  if (score >= 3500) return 'platinum';
  if (score >= 1500) return 'gold';
  if (score >= 500) return 'silver';
  return 'bronze';
}

function getTierConfig(tier: LoyaltyTier): TierConfig | undefined {
  return TIER_CONFIGS.find(t => t.name === tier);
}

function getTierProgress(score: number): TierProgress {
  const currentTier = getTierFromScore(score);
  const config = getTierConfig(currentTier);

  if (!config) {
    return {
      currentTier: 'bronze',
      nextTier: 'silver',
      currentScore: score,
      scoreForNextTier: 500,
      pointsToNextTier: Math.max(0, 500 - score),
      progressPercent: Math.round((score / 500) * 100),
    };
  }

  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(currentTier);

  let nextTier: LoyaltyTier | null = null;
  let scoreForNextTier = config.maxScore || config.minScore + 500;
  let pointsToNextTier = 0;
  let progressPercent = 0;

  if (currentIndex < tiers.length - 1) {
    nextTier = tiers[currentIndex + 1];
    const nextConfig = getTierConfig(nextTier);
    if (nextConfig) {
      scoreForNextTier = nextConfig.minScore;
      pointsToNextTier = Math.max(0, nextConfig.minScore - score);
      const tierRange = scoreForNextTier - config.minScore;
      progressPercent = Math.min(100, Math.round(((score - config.minScore) / tierRange) * 100));
    }
  }

  return {
    currentTier,
    nextTier,
    currentScore: score,
    scoreForNextTier,
    pointsToNextTier,
    progressPercent: Math.max(0, progressPercent),
  };
}

function shouldUpgradeTier(previousScore: number, newScore: number): TierUpgrade | null {
  const previousTier = getTierFromScore(previousScore);
  const newTier = getTierFromScore(newScore);

  if (previousTier !== newTier) {
    return {
      previousTier,
      newTier,
      score: newScore,
      timestamp: new Date(),
      trigger: 'score_threshold',
    };
  }

  return null;
}

function shouldDowngradeTier(score: number, inactivityDays: number, gracePeriodDays: number = 60): TierUpgrade | null {
  const currentTier = getTierFromScore(score);

  if (inactivityDays <= gracePeriodDays) {
    return null;
  }

  // Determine downgrade amount based on inactivity
  let downgradeBy = 0;
  if (inactivityDays <= 90) downgradeBy = 1;
  else if (inactivityDays <= 180) downgradeBy = 2;
  else downgradeBy = 3;

  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(currentTier);
  const newIndex = Math.max(0, currentIndex - downgradeBy);
  const newTier = tiers[newIndex];

  if (currentTier !== newTier) {
    return {
      previousTier: currentTier,
      newTier,
      score,
      timestamp: new Date(),
      trigger: 'inactivity',
    };
  }

  return null;
}

function calculateTierMultiplier(tier: LoyaltyTier): number {
  const config = getTierConfig(tier);
  return config?.multiplier || 1.0;
}

function calculateTierCashback(tier: LoyaltyTier, orderAmount: number): number {
  const config = getTierConfig(tier);
  if (!config) return 0;

  const cashback = (orderAmount * config.cashbackPercent) / 100;
  return Math.floor(cashback * 100) / 100;
}

function getNextTier(tier: LoyaltyTier): LoyaltyTier | null {
  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(tier);

  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }

  return tiers[currentIndex + 1];
}

function getPreviousTier(tier: LoyaltyTier): LoyaltyTier | null {
  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(tier);

  if (currentIndex <= 0) {
    return null;
  }

  return tiers[currentIndex - 1];
}

function getTierPerks(tier: LoyaltyTier): string[] {
  const config = getTierConfig(tier);
  return config?.perks || [];
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Tier Calculation', () => {

  describe('Tier Determination', () => {
    it('should determine bronze tier for low scores', () => {
      expect(getTierFromScore(0)).toBe('bronze');
      expect(getTierFromScore(100)).toBe('bronze');
      expect(getTierFromScore(499)).toBe('bronze');
    });

    it('should determine silver tier for medium scores', () => {
      expect(getTierFromScore(500)).toBe('silver');
      expect(getTierFromScore(1000)).toBe('silver');
      expect(getTierFromScore(1499)).toBe('silver');
    });

    it('should determine gold tier for high scores', () => {
      expect(getTierFromScore(1500)).toBe('gold');
      expect(getTierFromScore(2500)).toBe('gold');
      expect(getTierFromScore(3499)).toBe('gold');
    });

    it('should determine platinum tier for very high scores', () => {
      expect(getTierFromScore(3500)).toBe('platinum');
      expect(getTierFromScore(5000)).toBe('platinum');
      expect(getTierFromScore(7499)).toBe('platinum');
    });

    it('should determine diamond tier for elite scores', () => {
      expect(getTierFromScore(7500)).toBe('diamond');
      expect(getTierFromScore(10000)).toBe('diamond');
      expect(getTierFromScore(100000)).toBe('diamond');
    });

    it('should handle boundary values correctly', () => {
      expect(getTierFromScore(499)).toBe('bronze');
      expect(getTierFromScore(500)).toBe('silver');
      expect(getTierFromScore(1499)).toBe('silver');
      expect(getTierFromScore(1500)).toBe('gold');
    });
  });

  describe('Tier Configuration', () => {
    it('should return correct config for bronze tier', () => {
      const config = getTierConfig('bronze');

      expect(config?.multiplier).toBe(1.0);
      expect(config?.cashbackPercent).toBe(1);
      expect(config?.perks).toHaveLength(1);
    });

    it('should return correct config for silver tier', () => {
      const config = getTierConfig('silver');

      expect(config?.multiplier).toBe(1.1);
      expect(config?.cashbackPercent).toBe(2);
      expect(config?.perks).toHaveLength(2);
    });

    it('should return correct config for gold tier', () => {
      const config = getTierConfig('gold');

      expect(config?.multiplier).toBe(1.25);
      expect(config?.cashbackPercent).toBe(3);
      expect(config?.perks).toHaveLength(3);
    });

    it('should return correct config for platinum tier', () => {
      const config = getTierConfig('platinum');

      expect(config?.multiplier).toBe(1.5);
      expect(config?.cashbackPercent).toBe(5);
      expect(config?.perks).toHaveLength(4);
    });

    it('should return correct config for diamond tier', () => {
      const config = getTierConfig('diamond');

      expect(config?.multiplier).toBe(2.0);
      expect(config?.cashbackPercent).toBe(8);
      expect(config?.perks).toHaveLength(6);
    });

    it('should return correct colors', () => {
      expect(getTierConfig('bronze')?.color).toBe('#CD7F32');
      expect(getTierConfig('diamond')?.color).toBe('#B9F2FF');
    });
  });

  describe('Tier Progress', () => {
    it('should calculate correct progress for bronze tier', () => {
      const progress = getTierProgress(250);

      expect(progress.currentTier).toBe('bronze');
      expect(progress.nextTier).toBe('silver');
      expect(progress.pointsToNextTier).toBe(250);
      expect(progress.progressPercent).toBe(50);
    });

    it('should calculate correct progress for silver tier', () => {
      const progress = getTierProgress(1000);

      expect(progress.currentTier).toBe('silver');
      expect(progress.nextTier).toBe('gold');
      expect(progress.pointsToNextTier).toBe(500);
    });

    it('should return 0 points for diamond tier', () => {
      const progress = getTierProgress(10000);

      expect(progress.currentTier).toBe('diamond');
      expect(progress.nextTier).toBeNull();
      expect(progress.pointsToNextTier).toBe(0);
    });

    it('should handle progress at tier boundary', () => {
      const progress = getTierProgress(500);

      expect(progress.currentTier).toBe('silver');
      expect(progress.progressPercent).toBe(0);
    });

    it('should cap progress at 100%', () => {
      const progress = getTierProgress(7000);

      expect(progress.progressPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Tier Upgrades', () => {
    it('should detect tier upgrade', () => {
      const upgrade = shouldUpgradeTier(400, 600);

      expect(upgrade).not.toBeNull();
      expect(upgrade?.previousTier).toBe('bronze');
      expect(upgrade?.newTier).toBe('silver');
    });

    it('should detect multi-tier upgrade', () => {
      const upgrade = shouldUpgradeTier(100, 6000);

      expect(upgrade).not.toBeNull();
      expect(upgrade?.previousTier).toBe('bronze');
      expect(upgrade?.newTier).toBe('platinum');
    });

    it('should return null for no upgrade', () => {
      const upgrade = shouldUpgradeTier(500, 800);

      expect(upgrade).toBeNull();
    });

    it('should include correct trigger', () => {
      const upgrade = shouldUpgradeTier(400, 600);

      expect(upgrade?.trigger).toBe('score_threshold');
    });

    it('should not upgrade at exact threshold', () => {
      const upgrade = shouldUpgradeTier(499, 500);

      expect(upgrade?.newTier).toBe('silver');
    });
  });

  describe('Tier Downgrades', () => {
    it('should not downgrade within grace period', () => {
      const downgrade = shouldDowngradeTier(1000, 30, 60);

      expect(downgrade).toBeNull();
    });

    it('should downgrade after grace period', () => {
      const downgrade = shouldDowngradeTier(1000, 90, 60);

      expect(downgrade).not.toBeNull();
      expect(downgrade?.previousTier).toBe('silver');
      expect(downgrade?.newTier).toBe('bronze');
    });

    it('should downgrade multiple tiers for long inactivity', () => {
      const downgrade = shouldDowngradeTier(5000, 200, 60);

      expect(downgrade).not.toBeNull();
      expect(downgrade?.newTier).toBe('silver'); // Platinum -> Gold -> Silver
    });

    it('should not downgrade below bronze', () => {
      const downgrade = shouldDowngradeTier(100, 500, 60);

      expect(downgrade?.newTier).toBe('bronze');
    });

    it('should use inactivity trigger', () => {
      const downgrade = shouldDowngradeTier(1000, 90, 60);

      expect(downgrade?.trigger).toBe('inactivity');
    });
  });

  describe('Tier Multiplier', () => {
    it('should return correct multiplier for each tier', () => {
      expect(calculateTierMultiplier('bronze')).toBe(1.0);
      expect(calculateTierMultiplier('silver')).toBe(1.1);
      expect(calculateTierMultiplier('gold')).toBe(1.25);
      expect(calculateTierMultiplier('platinum')).toBe(1.5);
      expect(calculateTierMultiplier('diamond')).toBe(2.0);
    });

    it('should multiply rewards correctly', () => {
      const baseReward = 100;
      const bronzeReward = baseReward * calculateTierMultiplier('bronze');
      const diamondReward = baseReward * calculateTierMultiplier('diamond');

      expect(bronzeReward).toBe(100);
      expect(diamondReward).toBe(200);
    });
  });

  describe('Tier Cashback', () => {
    it('should calculate correct cashback for bronze', () => {
      expect(calculateTierCashback('bronze', 1000)).toBe(10);
      expect(calculateTierCashback('bronze', 500)).toBe(5);
    });

    it('should calculate correct cashback for silver', () => {
      expect(calculateTierCashback('silver', 1000)).toBe(20);
      expect(calculateTierCashback('silver', 500)).toBe(10);
    });

    it('should calculate correct cashback for gold', () => {
      expect(calculateTierCashback('gold', 1000)).toBe(30);
    });

    it('should calculate correct cashback for platinum', () => {
      expect(calculateTierCashback('platinum', 1000)).toBe(50);
    });

    it('should calculate correct cashback for diamond', () => {
      expect(calculateTierCashback('diamond', 1000)).toBe(80);
    });

    it('should round down correctly', () => {
      expect(calculateTierCashback('bronze', 333)).toBe(3);
      expect(calculateTierCashback('silver', 777)).toBe(15);
    });
  });

  describe('Tier Navigation', () => {
    it('should get correct next tier', () => {
      expect(getNextTier('bronze')).toBe('silver');
      expect(getNextTier('silver')).toBe('gold');
      expect(getNextTier('gold')).toBe('platinum');
      expect(getNextTier('platinum')).toBe('diamond');
      expect(getNextTier('diamond')).toBeNull();
    });

    it('should get correct previous tier', () => {
      expect(getPreviousTier('diamond')).toBe('platinum');
      expect(getPreviousTier('platinum')).toBe('gold');
      expect(getPreviousTier('gold')).toBe('silver');
      expect(getPreviousTier('silver')).toBe('bronze');
      expect(getPreviousTier('bronze')).toBeNull();
    });
  });

  describe('Tier Perks', () => {
    it('should return correct perks for bronze', () => {
      const perks = getTierPerks('bronze');

      expect(perks).toHaveLength(1);
      expect(perks).toContain('Basic rewards');
    });

    it('should return correct perks for silver', () => {
      const perks = getTierPerks('silver');

      expect(perks).toHaveLength(2);
      expect(perks).toContain('Birthday bonus');
    });

    it('should return correct perks for gold', () => {
      const perks = getTierPerks('gold');

      expect(perks).toHaveLength(3);
      expect(perks).toContain('Priority support');
    });

    it('should return correct perks for platinum', () => {
      const perks = getTierPerks('platinum');

      expect(perks).toHaveLength(4);
      expect(perks).toContain('Free delivery');
    });

    it('should return correct perks for diamond', () => {
      const perks = getTierPerks('diamond');

      expect(perks).toHaveLength(6);
      expect(perks).toContain('Personal concierge');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero score', () => {
      const tier = getTierFromScore(0);
      const progress = getTierProgress(0);

      expect(tier).toBe('bronze');
      expect(progress.progressPercent).toBe(0);
    });

    it('should handle negative score', () => {
      const tier = getTierFromScore(-100);
      expect(tier).toBe('bronze');
    });

    it('should handle very large score', () => {
      const tier = getTierFromScore(1000000);
      expect(tier).toBe('diamond');
    });

    it('should handle exact boundary scores', () => {
      expect(getTierFromScore(500)).toBe('silver');
      expect(getTierFromScore(1500)).toBe('gold');
      expect(getTierFromScore(3500)).toBe('platinum');
      expect(getTierFromScore(7500)).toBe('diamond');
    });
  });
});

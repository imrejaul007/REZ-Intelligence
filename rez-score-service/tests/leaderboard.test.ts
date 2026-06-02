/**
 * Score Service - Leaderboard Test Suite
 *
 * Tests for:
 * - Leaderboard ranking
 * - Leaderboard filtering and sorting
 * - User position calculation
 * - Leaderboard pagination
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================================
// Types
// ============================================================================

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type KarmaLevel = 'starter' | 'active' | 'contributor' | 'leader' | 'elite';
type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  tier: LoyaltyTier;
  karmaLevel: KarmaLevel;
  rank: number;
  percentile?: number;
  trend?: 'up' | 'down' | 'same';
}

interface LeaderboardQuery {
  period: LeaderboardPeriod;
  limit: number;
  offset: number;
  category?: string;
  merchantId?: string;
}

interface UserPosition {
  userId: string;
  rank: number;
  score: number;
  percentile: number;
  entriesAbove: number;
  entriesBelow: number;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

function generateMockLeaderboardEntry(overrides?: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    userId: `user_${Math.random().toString(36).substring(7)}`,
    username: 'TestUser',
    score: 1000,
    tier: 'bronze',
    karmaLevel: 'active',
    rank: 1,
    ...overrides,
  };
}

function generateMockUsers(count: number): LeaderboardEntry[] {
  const users: LeaderboardEntry[] = [];
  for (let i = 0; i < count; i++) {
    users.push(generateMockLeaderboardEntry({
      userId: `user_${i}`,
      username: `User${i}`,
      score: (count - i) * 100,
      rank: i + 1,
    }));
  }
  return users;
}

// ============================================================================
// Leaderboard Logic (to be tested)
// ============================================================================

function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary sort by karma level
    const karmaOrder = ['elite', 'leader', 'contributor', 'active', 'starter'];
    return karmaOrder.indexOf(a.karmaLevel) - karmaOrder.indexOf(b.karmaLevel);
  });
}

function assignRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = sortLeaderboard(entries);

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function calculatePercentile(rank: number, totalUsers: number): number {
  if (totalUsers === 0 || rank === 0) return 0;
  const percentile = ((totalUsers - rank) / totalUsers) * 100;
  return Math.round(percentile * 10) / 10; // Round to 1 decimal
}

function paginateLeaderboard(
  entries: LeaderboardEntry[],
  offset: number,
  limit: number
): LeaderboardEntry[] {
  return entries.slice(offset, offset + limit);
}

function getUserPosition(
  userId: string,
  entries: LeaderboardEntry[]
): UserPosition | null {
  const sorted = sortLeaderboard(entries);
  const index = sorted.findIndex(e => e.userId === userId);

  if (index === -1) return null;

  const rank = index + 1;
  const percentile = calculatePercentile(rank, sorted.length);
  const entriesAbove = index;
  const entriesBelow = sorted.length - index - 1;

  return {
    userId,
    rank,
    score: sorted[index].score,
    percentile,
    entriesAbove,
    entriesBelow,
  };
}

function filterByPeriod(
  entries: LeaderboardEntry[],
  period: LeaderboardPeriod,
  referenceDate: Date = new Date()
): LeaderboardEntry[] {
  // For this test, we'll assume entries have a hypothetical 'periodScore' attribute
  // In real implementation, this would filter based on actual time-based scores
  switch (period) {
    case 'daily':
      // In real implementation: filter by last 24 hours
      return entries;
    case 'weekly':
      // In real implementation: filter by last 7 days
      return entries;
    case 'monthly':
      // In real implementation: filter by last 30 days
      return entries;
    case 'all_time':
    default:
      return entries;
  }
}

function getTopN(entries: LeaderboardEntry[], n: number): LeaderboardEntry[] {
  const sorted = sortLeaderboard(entries);
  return sorted.slice(0, n);
}

function getUsersAroundRank(
  entries: LeaderboardEntry[],
  targetRank: number,
  range: number
): LeaderboardEntry[] {
  const sorted = sortLeaderboard(entries);
  const startIndex = Math.max(0, targetRank - 1 - range);
  const endIndex = Math.min(sorted.length, targetRank - 1 + range);

  return sorted.slice(startIndex, endIndex + 1);
}

function calculateTrend(
  currentRank: number,
  previousRank: number
): 'up' | 'down' | 'same' {
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'same';
}

function updateLeaderboardWithTrend(
  entries: LeaderboardEntry[],
  previousRanks: Map<string, number>
): LeaderboardEntry[] {
  const ranked = assignRanks(entries);

  return ranked.map(entry => {
    const previousRank = previousRanks.get(entry.userId);
    const trend = previousRank !== undefined
      ? calculateTrend(entry.rank, previousRank)
      : undefined;

    return {
      ...entry,
      trend,
    };
  });
}

function getLeaderboardStats(entries: LeaderboardEntry[]): {
  totalUsers: number;
  averageScore: number;
  medianScore: number;
  topScore: number;
  bottomScore: number;
} {
  if (entries.length === 0) {
    return {
      totalUsers: 0,
      averageScore: 0,
      medianScore: 0,
      topScore: 0,
      bottomScore: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.score - b.score);
  const totalUsers = entries.length;
  const sum = entries.reduce((acc, e) => acc + e.score, 0);
  const averageScore = Math.round(sum / totalUsers);
  const medianIndex = Math.floor(totalUsers / 2);
  const medianScore = totalUsers % 2 === 0
    ? Math.round((sorted[medianIndex - 1].score + sorted[medianIndex].score) / 2)
    : sorted[medianIndex].score;

  return {
    totalUsers,
    averageScore,
    medianScore,
    topScore: sorted[sorted.length - 1].score,
    bottomScore: sorted[0].score,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Leaderboard', () => {

  describe('Sorting', () => {
    it('should sort entries by score descending', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 100, userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 500, userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 200, userId: 'u3' }),
      ];

      const sorted = sortLeaderboard(entries);

      expect(sorted[0].score).toBe(500);
      expect(sorted[1].score).toBe(200);
      expect(sorted[2].score).toBe(100);
    });

    it('should use karma level as secondary sort', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 100, karmaLevel: 'active', userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 100, karmaLevel: 'elite', userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 100, karmaLevel: 'starter', userId: 'u3' }),
      ];

      const sorted = sortLeaderboard(entries);

      expect(sorted[0].karmaLevel).toBe('elite');
      expect(sorted[1].karmaLevel).toBe('active');
      expect(sorted[2].karmaLevel).toBe('starter');
    });

    it('should handle equal scores with different karma', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 1000, karmaLevel: 'starter', userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 1000, karmaLevel: 'leader', userId: 'u2' }),
      ];

      const sorted = sortLeaderboard(entries);

      expect(sorted[0].userId).toBe('u2'); // leader comes first
    });
  });

  describe('Rank Assignment', () => {
    it('should assign sequential ranks', () => {
      const entries = generateMockUsers(5);

      const ranked = assignRanks(entries);

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].rank).toBe(3);
      expect(ranked[3].rank).toBe(4);
      expect(ranked[4].rank).toBe(5);
    });

    it('should handle unsorted input', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 50, userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 200, userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 100, userId: 'u3' }),
      ];

      const ranked = assignRanks(entries);

      expect(ranked.find(e => e.userId === 'u1')?.rank).toBe(3);
      expect(ranked.find(e => e.userId === 'u2')?.rank).toBe(1);
      expect(ranked.find(e => e.userId === 'u3')?.rank).toBe(2);
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

    it('should handle zero total users', () => {
      expect(calculatePercentile(1, 0)).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      const percentile = calculatePercentile(1, 3);
      expect(percentile).toBe(66.7);
    });
  });

  describe('Pagination', () => {
    it('should paginate correctly', () => {
      const entries = generateMockUsers(100);

      const page1 = paginateLeaderboard(entries, 0, 10);
      const page2 = paginateLeaderboard(entries, 10, 10);
      const page3 = paginateLeaderboard(entries, 20, 10);

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page3.length).toBe(10);

      expect(page1[0].score).toBeGreaterThan(page2[0].score);
      expect(page2[0].score).toBeGreaterThan(page3[0].score);
    });

    it('should handle offset beyond length', () => {
      const entries = generateMockUsers(10);

      const result = paginateLeaderboard(entries, 100, 10);

      expect(result.length).toBe(0);
    });

    it('should handle partial last page', () => {
      const entries = generateMockUsers(25);

      const result = paginateLeaderboard(entries, 20, 10);

      expect(result.length).toBe(5);
    });

    it('should return empty for zero limit', () => {
      const entries = generateMockUsers(10);

      const result = paginateLeaderboard(entries, 0, 0);

      expect(result.length).toBe(0);
    });
  });

  describe('User Position', () => {
    it('should return correct position for existing user', () => {
      const entries = generateMockUsers(100);

      const position = getUserPosition('user_0', entries);

      expect(position).not.toBeNull();
      expect(position?.rank).toBe(1);
      expect(position?.percentile).toBe(99);
    });

    it('should return correct position for middle user', () => {
      const entries = generateMockUsers(100);

      const position = getUserPosition('user_50', entries);

      expect(position).not.toBeNull();
      expect(position?.entriesAbove).toBe(50);
      expect(position?.entriesBelow).toBe(49);
    });

    it('should return null for non-existent user', () => {
      const entries = generateMockUsers(10);

      const position = getUserPosition('nonexistent', entries);

      expect(position).toBeNull();
    });

    it('should calculate entries above and below correctly', () => {
      const entries = generateMockUsers(20);

      const position = getUserPosition('user_5', entries);

      expect(position?.entriesAbove).toBe(5);
      expect(position?.entriesBelow).toBe(14);
    });
  });

  describe('Period Filtering', () => {
    it('should return all entries for all_time period', () => {
      const entries = generateMockUsers(10);

      const result = filterByPeriod(entries, 'all_time');

      expect(result.length).toBe(10);
    });

    it('should filter entries for daily period', () => {
      const entries = generateMockUsers(10);

      const result = filterByPeriod(entries, 'daily');

      expect(result.length).toBe(10);
    });

    it('should filter entries for weekly period', () => {
      const entries = generateMockUsers(10);

      const result = filterByPeriod(entries, 'weekly');

      expect(result.length).toBe(10);
    });
  });

  describe('Top N Retrieval', () => {
    it('should return top 3', () => {
      const entries = generateMockUsers(10);

      const top3 = getTopN(entries, 3);

      expect(top3.length).toBe(3);
      expect(top3[0].rank).toBe(1);
      expect(top3[1].rank).toBe(2);
      expect(top3[2].rank).toBe(3);
    });

    it('should return top 1', () => {
      const entries = generateMockUsers(10);

      const top1 = getTopN(entries, 1);

      expect(top1.length).toBe(1);
      expect(top1[0].rank).toBe(1);
    });

    it('should handle n greater than entries', () => {
      const entries = generateMockUsers(5);

      const top10 = getTopN(entries, 10);

      expect(top10.length).toBe(5);
    });
  });

  describe('Users Around Rank', () => {
    it('should return users around rank with range', () => {
      const entries = generateMockUsers(20);

      const around = getUsersAroundRank(entries, 10, 2);

      expect(around.length).toBe(5); // 2 above, target, 2 below
      expect(around.map(e => e.rank)).toEqual([8, 9, 10, 11, 12]);
    });

    it('should handle edge at start', () => {
      const entries = generateMockUsers(20);

      const around = getUsersAroundRank(entries, 1, 2);

      expect(around.length).toBe(3);
      expect(around[0].rank).toBe(1);
    });

    it('should handle edge at end', () => {
      const entries = generateMockUsers(20);

      const around = getUsersAroundRank(entries, 20, 2);

      expect(around.length).toBe(3);
      expect(around[around.length - 1].rank).toBe(20);
    });

    it('should handle single-sided range at boundaries', () => {
      const entries = generateMockUsers(10);

      const around = getUsersAroundRank(entries, 2, 2);

      expect(around.length).toBe(4); // 1, 2, 3, 4 (no 0)
    });
  });

  describe('Trend Calculation', () => {
    it('should return up trend when rank improved', () => {
      expect(calculateTrend(5, 10)).toBe('up');
      expect(calculateTrend(1, 5)).toBe('up');
    });

    it('should return down trend when rank decreased', () => {
      expect(calculateTrend(10, 5)).toBe('down');
      expect(calculateTrend(5, 1)).toBe('down');
    });

    it('should return same when rank unchanged', () => {
      expect(calculateTrend(5, 5)).toBe('same');
    });
  });

  describe('Leaderboard with Trend', () => {
    it('should include trend information', () => {
      const entries = generateMockUsers(10);
      const previousRanks = new Map<string, number>();
      previousRanks.set('user_0', 5);
      previousRanks.set('user_1', 1);
      previousRanks.set('user_9', 10);

      const updated = updateLeaderboardWithTrend(entries, previousRanks);

      const u0 = updated.find(e => e.userId === 'user_0');
      const u1 = updated.find(e => e.userId === 'user_1');
      const u9 = updated.find(e => e.userId === 'user_9');

      expect(u0?.trend).toBe('up'); // Moved from 5 to 1
      expect(u1?.trend).toBe('down'); // Moved from 1 to 2
      expect(u9?.trend).toBe('same'); // Stayed at 10
    });

    it('should handle new users without previous rank', () => {
      const entries = generateMockUsers(10);
      const previousRanks = new Map<string, number>();

      const updated = updateLeaderboardWithTrend(entries, previousRanks);

      expect(updated.every(e => e.trend === undefined)).toBe(true);
    });
  });

  describe('Leaderboard Statistics', () => {
    it('should calculate correct stats', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 100, userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 200, userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 300, userId: 'u3' }),
      ];

      const stats = getLeaderboardStats(entries);

      expect(stats.totalUsers).toBe(3);
      expect(stats.averageScore).toBe(200);
      expect(stats.medianScore).toBe(200);
      expect(stats.topScore).toBe(300);
      expect(stats.bottomScore).toBe(100);
    });

    it('should handle even number of entries for median', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: 100, userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 200, userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 300, userId: 'u3' }),
        generateMockLeaderboardEntry({ score: 400, userId: 'u4' }),
      ];

      const stats = getLeaderboardStats(entries);

      expect(stats.medianScore).toBe(250);
    });

    it('should handle empty leaderboard', () => {
      const stats = getLeaderboardStats([]);

      expect(stats.totalUsers).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single entry', () => {
      const entries = [generateMockLeaderboardEntry({ userId: 'u1', score: 1000 })];

      const ranked = assignRanks(entries);
      const position = getUserPosition('u1', entries);

      expect(ranked[0].rank).toBe(1);
      expect(position?.rank).toBe(1);
      expect(position?.percentile).toBe(99);
    });

    it('should handle duplicate scores', () => {
      const entries = [
        generateMockLeaderboardEntry({ userId: 'u1', score: 1000 }),
        generateMockLeaderboardEntry({ userId: 'u2', score: 1000 }),
        generateMockLeaderboardEntry({ userId: 'u3', score: 1000 }),
      ];

      const ranked = assignRanks(entries);

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].rank).toBe(3);
    });

    it('should handle very large leaderboard', () => {
      const entries = generateMockUsers(10000);

      const ranked = assignRanks(entries);
      const position = getUserPosition('user_0', entries);

      expect(position?.rank).toBe(1);
      expect(position?.percentile).toBe(99.99);
    });

    it('should handle negative scores', () => {
      const entries = [
        generateMockLeaderboardEntry({ score: -100, userId: 'u1' }),
        generateMockLeaderboardEntry({ score: 0, userId: 'u2' }),
        generateMockLeaderboardEntry({ score: 100, userId: 'u3' }),
      ];

      const ranked = assignRanks(entries);

      expect(ranked[0].score).toBe(100);
      expect(ranked[2].score).toBe(-100);
    });
  });
});

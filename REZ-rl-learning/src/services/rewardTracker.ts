/**
 * REZ RL Learning Service - Reward Tracker
 * Track and compute rewards from user interactions
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  RewardRecord,
  RewardType,
  RewardRequest,
} from '../types/index.js';
import { getBanditModel } from '../models/banditModel.js';

// Reward type weights for normalization
const REWARD_WEIGHTS: Record<RewardType, number> = {
  click: 0.1,
  conversion: 0.5,
  purchase: 1.0,
  engagement: 0.3,
  rating: 0.4,
  custom: 0.5,
};

export class RewardTracker {
  private redis: Redis;
  private banditModel: ReturnType<typeof getBanditModel>;

  constructor(redisClient?: Redis) {
    this.redis = redisClient || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.banditModel = getBanditModel(this.redis);
  }

  /**
   * Record a reward from user feedback
   */
  async recordReward(request: RewardRequest): Promise<RewardRecord> {
    const {
      banditId,
      armId,
      userId,
      reward,
      rewardType = 'custom',
      metadata,
    } = request;

    // Validate reward range
    const normalizedReward = this.normalizeReward(reward, rewardType);

    // Create reward record
    const record: RewardRecord = {
      recordId: uuidv4(),
      banditId,
      armId,
      userId,
      reward: normalizedReward,
      rewardType,
      metadata,
      timestamp: Date.now(),
    };

    // Store reward in Redis list (for history)
    const historyKey = `rl:arm:${armId}:rewards`;
    await this.redis.lpush(historyKey, JSON.stringify(record));

    // Trim to max rewards per arm
    const maxRewards = parseInt(process.env.MAX_REWARDS_PER_ARM || '1000', 10);
    await this.redis.ltrim(historyKey, 0, maxRewards - 1);

    // Update bandit arm statistics
    await this.banditModel.recordReward(banditId, armId, normalizedReward);

    // Update bandit totals
    const bandit = await this.banditModel.getBandit(banditId);
    if (bandit) {
      await this.banditModel.updateBandit(banditId, {
        totalRewards: bandit.totalRewards + normalizedReward,
      });
    }

    return record;
  }

  /**
   * Normalize reward to 0-1 range based on type
   */
  normalizeReward(reward: number, rewardType: RewardType): number {
    // If reward is already in 0-1 range, return as-is
    if (reward >= 0 && reward <= 1) {
      return reward;
    }

    // Apply type-specific normalization
    const weight = REWARD_WEIGHTS[rewardType] || 0.5;

    // Normalize based on common ranges:
    // - Ratings: 1-5 → 0-1
    // - Purchases: 0-∞ → 0-1 with decay
    // - Engagement time: 0-∞ → 0-1 with decay

    if (rewardType === 'rating') {
      // 1-5 rating scale
      return Math.max(0, Math.min(1, (reward - 1) / 4));
    }

    // For other types, apply sigmoid-like normalization
    // This prevents extreme values from dominating
    const normalized = 1 / (1 + Math.exp(-(reward - 1)));

    return Math.max(0, Math.min(1, normalized * weight * 2));
  }

  /**
   * Get reward history for an arm
   */
  async getRewardHistory(
    armId: string,
    limit: number = 100
  ): Promise<RewardRecord[]> {
    const historyKey = `rl:arm:${armId}:rewards`;
    const rawHistory = await this.redis.lrange(historyKey, 0, limit - 1);

    return rawHistory
      .map((item) => {
        try {
          return JSON.parse(item) as RewardRecord;
        } catch {
          return null;
        }
      })
      .filter((item): item is RewardRecord => item !== null);
  }

  /**
   * Get reward statistics for an arm
   */
  async getArmRewardStats(armId: string): Promise<{
    count: number;
    average: number;
    total: number;
    min: number;
    max: number;
    recentTrend: 'improving' | 'stable' | 'declining';
  }> {
    const history = await this.getRewardHistory(armId, 100);

    if (history.length === 0) {
      return {
        count: 0,
        average: 0,
        total: 0,
        min: 0,
        max: 0,
        recentTrend: 'stable',
      };
    }

    const rewards = history.map((r) => r.reward);
    const sum = rewards.reduce((a, b) => a + b, 0);
    const average = sum / rewards.length;
    const min = Math.min(...rewards);
    const max = Math.max(...rewards);

    // Calculate trend from last 20% vs first 20%
    const windowSize = Math.max(1, Math.floor(history.length * 0.2));
    const recentRewards = rewards.slice(0, windowSize);
    const oldRewards = rewards.slice(-windowSize);

    const recentAvg = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
    const oldAvg = oldRewards.reduce((a, b) => a + b, 0) / oldRewards.length;

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    const threshold = 0.1; // 10% change threshold

    if (recentAvg > oldAvg * (1 + threshold)) {
      recentTrend = 'improving';
    } else if (recentAvg < oldAvg * (1 - threshold)) {
      recentTrend = 'declining';
    }

    return {
      count: history.length,
      average,
      total: sum,
      min,
      max,
      recentTrend,
    };
  }

  /**
   * Compute cumulative reward over time
   */
  async getCumulativeReward(banditId: string): Promise<Array<{ timestamp: number; cumulative: number }>> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit || bandit.arms.length === 0) {
      return [];
    }

    // Get history from first arm as baseline
    const firstArmId = bandit.arms[0].armId;
    const history = await this.getRewardHistory(firstArmId, 1000);

    // Build cumulative reward array
    const cumulative: Array<{ timestamp: number; cumulative: number }> = [];
    let runningTotal = 0;

    for (const record of history.reverse()) {
      runningTotal += record.reward;
      cumulative.push({
        timestamp: record.timestamp,
        cumulative: runningTotal,
      });
    }

    return cumulative;
  }

  /**
   * Get reward distribution for an arm
   */
  async getRewardDistribution(
    armId: string,
    buckets: number = 10
  ): Promise<Array<{ range: string; count: number; percentage: number }>> {
    const history = await this.getRewardHistory(armId, 1000);

    if (history.length === 0) {
      return [];
    }

    // Create buckets
    const bucketSize = 1 / buckets;
    const distribution: Array<{ range: string; count: number; percentage: number }> = [];

    for (let i = 0; i < buckets; i++) {
      const min = i * bucketSize;
      const max = (i + 1) * bucketSize;
      const range = `${min.toFixed(2)}-${max.toFixed(2)}`;

      distribution.push({ range, count: 0, percentage: 0 });
    }

    // Count rewards in each bucket
    for (const record of history) {
      const bucketIndex = Math.min(
        buckets - 1,
        Math.floor(record.reward / bucketSize)
      );
      distribution[bucketIndex].count++;
    }

    // Calculate percentages
    const total = history.length;
    for (const bucket of distribution) {
      bucket.percentage = (bucket.count / total) * 100;
    }

    return distribution;
  }

  /**
   * Get reward by type breakdown
   */
  async getRewardsByType(banditId: string): Promise<Record<RewardType, { count: number; average: number }>> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) {
      return this.getEmptyRewardsByType();
    }

    const byType: Record<RewardType, { count: number; total: number }> = {
      click: { count: 0, total: 0 },
      conversion: { count: 0, total: 0 },
      purchase: { count: 0, total: 0 },
      engagement: { count: 0, total: 0 },
      rating: { count: 0, total: 0 },
      custom: { count: 0, total: 0 },
    };

    for (const arm of bandit.arms) {
      const history = await this.getRewardHistory(arm.armId, 500);

      for (const record of history) {
        const type = record.rewardType;
        if (byType[type]) {
          byType[type].count++;
          byType[type].total += record.reward;
        }
      }
    }

    // Calculate averages
    const result: Record<RewardType, { count: number; average: number }> = {} as Record<RewardType, { count: number; average: number }>;

    for (const [type, data] of Object.entries(byType)) {
      result[type as RewardType] = {
        count: data.count,
        average: data.count > 0 ? data.total / data.count : 0,
      };
    }

    return result;
  }

  private getEmptyRewardsByType(): Record<RewardType, { count: number; average: number }> {
    return {
      click: { count: 0, average: 0 },
      conversion: { count: 0, average: 0 },
      purchase: { count: 0, average: 0 },
      engagement: { count: 0, average: 0 },
      rating: { count: 0, average: 0 },
      custom: { count: 0, average: 0 },
    };
  }

  /**
   * Get time-weighted reward (recent rewards weighted more)
   */
  async getTimeWeightedReward(armId: string, halfLife: number = 86400000): Promise<number> {
    // halfLife: time for reward weight to decay by 50% (default 24 hours)
    const history = await this.getRewardHistory(armId, 1000);

    if (history.length === 0) return 0;

    const now = Date.now();
    let weightedSum = 0;
    let weightSum = 0;

    for (const record of history) {
      const age = now - record.timestamp;
      const decayFactor = Math.pow(0.5, age / halfLife);
      const weight = decayFactor;

      weightedSum += record.reward * weight;
      weightSum += weight;
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  /**
   * Compare two arms statistically
   */
  async compareArms(armId1: string, armId2: string): Promise<{
    arm1Better: boolean;
    confidence: number;
    sampleSize1: number;
    sampleSize2: number;
  }> {
    const stats1 = await this.getArmRewardStats(armId1);
    const stats2 = await this.getArmRewardStats(armId2);

    const n1 = stats1.count;
    const n2 = stats2.count;
    const avg1 = stats1.average;
    const avg2 = stats2.average;

    // Simple comparison without full statistical test
    const difference = Math.abs(avg1 - avg2);

    // Calculate confidence based on sample size and difference
    const minSamples = Math.min(n1, n2);
    const sampleConfidence = Math.min(1, minSamples / 100); // Need ~100 samples for high confidence

    // Confidence increases with difference
    const differenceConfidence = Math.min(1, difference * 5);

    const confidence = sampleConfidence * 0.7 + differenceConfidence * 0.3;

    return {
      arm1Better: avg1 > avg2,
      confidence,
      sampleSize1: n1,
      sampleSize2: n2,
    };
  }

  /**
   * Batch record rewards
   */
  async batchRecordRewards(requests: RewardRequest[]): Promise<RewardRecord[]> {
    const records: RewardRecord[] = [];

    for (const request of requests) {
      try {
        const record = await this.recordReward(request);
        records.push(record);
      } catch (error) {
        console.error(`Failed to record reward for arm ${request.armId}:`, error);
      }
    }

    return records;
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Singleton instance
let rewardTrackerInstance: RewardTracker | null = null;

export function getRewardTracker(redisClient?: Redis): RewardTracker {
  if (!rewardTrackerInstance) {
    rewardTrackerInstance = new RewardTracker(redisClient);
  }
  return rewardTrackerInstance;
}

export function resetRewardTracker(): void {
  rewardTrackerInstance = null;
}

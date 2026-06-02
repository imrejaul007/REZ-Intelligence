/**
 * REZ RL Learning Service - Exploration Engine
 * Balances exploration vs exploitation with adaptive strategies
 */

import Redis from 'ioredis';
import {
  ExplorationConfig,
  ExplorationStats,
  SelectionResult,
  PolicyType,
} from '../types/index.js';
import { getBanditModel } from '../models/banditModel.js';

// Default exploration configuration
const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
  forceExploration: false,
  minExplorationRate: 0.05,     // At least 5% exploration
  maxExplorationRate: 0.5,      // At most 50% exploration
  adaptationRate: 0.1,           // 10% adaptation per update
  explorationWindow: 100,       // Last 100 selections for adaptation
};

export class ExplorationEngine {
  private redis: Redis;
  private banditModel: ReturnType<typeof getBanditModel>;
  private config: ExplorationConfig;

  constructor(redisClient?: Redis, config?: Partial<ExplorationConfig>) {
    this.redis = redisClient || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.banditModel = getBanditModel(this.redis);
    this.config = { ...DEFAULT_EXPLORATION_CONFIG, ...config };
  }

  /**
   * Get current exploration statistics for a user
   */
  async getExplorationStats(userId: string): Promise<ExplorationStats> {
    const key = `rl:user:${userId}:exploration`;
    const data = await this.redis.get(key);

    if (!data) {
      return this.getDefaultExplorationStats();
    }

    try {
      const parsed = JSON.parse(data);
      return {
        totalExplorations: parsed.totalExplorations || 0,
        totalExploitations: parsed.totalExploitations || 0,
        explorationRate: parsed.explorationRate || this.config.minExplorationRate,
        recentExplorationRate: parsed.recentExplorationRate || this.config.minExplorationRate,
        adaptationStatus: parsed.adaptationStatus || 'stable',
      };
    } catch {
      return this.getDefaultExplorationStats();
    }
  }

  /**
   * Record a selection (exploration or exploitation)
   */
  async recordSelection(
    userId: string,
    armId: string,
    reward: number,
    isExploration: boolean
  ): Promise<void> {
    const key = `rl:user:${userId}:exploration`;
    const historyKey = `rl:user:${userId}:selection_history`;

    // Get current stats
    const stats = await this.getExplorationStats(userId);

    // Update totals
    if (isExploration) {
      stats.totalExplorations++;
    } else {
      stats.totalExploitations++;
    }

    // Calculate overall exploration rate
    const total = stats.totalExplorations + stats.totalExploitations;
    stats.explorationRate = total > 0 ? stats.totalExplorations / total : this.config.minExplorationRate;

    // Add to selection history (for recent rate calculation)
    const selection = {
      isExploration,
      reward,
      timestamp: Date.now(),
    };

    await this.redis.lpush(historyKey, JSON.stringify(selection));
    await this.redis.ltrim(historyKey, 0, this.config.explorationWindow - 1);

    // Calculate recent exploration rate
    const historyRaw = await this.redis.lrange(historyKey, 0, this.config.explorationWindow - 1);
    const recentSelections = historyRaw
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter((item): item is { isExploration: boolean; reward: number; timestamp: number } => item !== null);

    const recentExplorations = recentSelections.filter((s) => s.isExploration).length;
    stats.recentExplorationRate = recentSelections.length > 0
      ? recentExplorations / recentSelections.length
      : this.config.minExplorationRate;

    // Determine adaptation status
    stats.adaptationStatus = this.calculateAdaptationStatus(stats);

    // Save updated stats
    await this.redis.setex(key, 86400, JSON.stringify(stats));
  }

  /**
   * Calculate adaptation status based on recent performance
   */
  private calculateAdaptationStatus(stats: ExplorationStats): 'stable' | 'adapting' | 'converging' {
    // If recent exploration rate is significantly different from target, we're adapting
    const targetRate = (this.config.minExplorationRate + this.config.maxExplorationRate) / 2;
    const deviation = Math.abs(stats.recentExplorationRate - targetRate);

    if (deviation > 0.2) {
      return 'adapting';
    }

    // If we're in a stable state with good exploration, we're converged
    if (stats.explorationRate >= this.config.minExplorationRate &&
        stats.explorationRate <= this.config.maxExplorationRate) {
      return 'converging';
    }

    return 'stable';
  }

  /**
   * Adapt exploration rate based on recent performance
   * Higher variance in rewards = more exploration needed
   */
  async adaptExplorationRate(
    userId: string,
    recentRewards: number[]
  ): Promise<number> {
    if (recentRewards.length < 10) {
      return this.config.minExplorationRate;
    }

    // Calculate reward variance
    const mean = recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length;
    const variance = recentRewards.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentRewards.length;

    // High variance = high exploration rate
    // Map variance to exploration rate
    // Variance of 0.1 (high for 0-1 rewards) → max exploration
    // Variance of 0.01 (low) → min exploration
    const normalizedVariance = Math.min(1, variance / 0.1);

    let newRate = this.config.minExplorationRate +
      (this.config.maxExplorationRate - this.config.minExplorationRate) * normalizedVariance;

    // Apply adaptation rate (gradual change)
    const stats = await this.getExplorationStats(userId);
    newRate = stats.explorationRate + (newRate - stats.explorationRate) * this.config.adaptationRate;

    // Clamp to bounds
    newRate = Math.max(this.config.minExplorationRate,
               Math.min(this.config.maxExplorationRate, newRate));

    // Update stats
    const key = `rl:user:${userId}:exploration`;
    const data = await this.redis.get(key);
    const currentStats = data ? JSON.parse(data) : this.getDefaultExplorationStats();

    currentStats.explorationRate = newRate;
    await this.redis.setex(key, 86400, JSON.stringify(currentStats));

    return newRate;
  }

  /**
   * Get recommended epsilon for epsilon-greedy based on exploration stats
   */
  async getAdaptiveEpsilon(userId: string): Promise<number> {
    const stats = await this.getExplorationStats(userId);

    // Start with higher epsilon if not converged
    if (stats.adaptationStatus === 'adapting') {
      return 0.2;
    }

    if (stats.adaptationStatus === 'converging') {
      return this.config.minExplorationRate;
    }

    // Use recent exploration rate as epsilon
    return Math.max(this.config.minExplorationRate, stats.recentExplorationRate);
  }

  /**
   * Force exploration for a specific user
   * Used for debugging, testing, or when user explicitly wants variety
   */
  async forceExploration(
    banditId: string,
    excludeArms: string[] = []
  ): Promise<string | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit || bandit.arms.length === 0) {
      return null;
    }

    // Get arms that haven't been tried recently
    const availableArms = bandit.arms.filter((arm) => !excludeArms.includes(arm.armId));

    if (availableArms.length === 0) {
      // If all arms excluded, pick random
      const randomIndex = Math.floor(Math.random() * bandit.arms.length);
      return bandit.arms[randomIndex].armId;
    }

    // Prefer arms with lower pull count
    const sortedByPulls = [...availableArms].sort((a, b) => a.pullCount - b.pullCount);

    // Pick from bottom 50% by pull count
    const candidates = sortedByPulls.slice(0, Math.ceil(sortedByPulls.length / 2));
    const randomIndex = Math.floor(Math.random() * candidates.length);

    return candidates[randomIndex].armId;
  }

  /**
   * Check if exploration should continue for a bandit
   */
  async shouldContinueExploring(banditId: string): Promise<boolean> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return true;

    // Continue if any arm has very few pulls
    const minPulls = Math.min(...bandit.arms.map((arm) => arm.pullCount));

    if (minPulls < 10) {
      return true;
    }

    // Continue if convergence score is low
    const convergenceScore = this.calculateSimpleConvergence(bandit.arms);
    if (convergenceScore < 0.7) {
      return true;
    }

    return false;
  }

  /**
   * Calculate simple convergence score
   */
  private calculateSimpleConvergence(arms: Array<{ pullCount: number; averageReward: number }>): number {
    if (arms.length === 0) return 0;

    // Need minimum samples
    const totalPulls = arms.reduce((sum, arm) => sum + arm.pullCount, 0);
    if (totalPulls < 50) {
      return totalPulls / 50 * 0.5;
    }

    // Check if one arm clearly dominates
    const sortedRewards = [...arms].sort((a, b) => b.averageReward - a.averageReward);
    const topReward = sortedRewards[0].averageReward;
    const secondReward = sortedRewards[1]?.averageReward || 0;

    // If top arm is significantly better, we're converged
    const dominance = topReward - secondReward;

    if (dominance > 0.2) {
      return 0.9;
    }

    if (dominance > 0.1) {
      return 0.7;
    }

    return 0.3;
  }

  /**
   * Get exploration summary for a user
   */
  async getExplorationSummary(userId: string): Promise<{
    stats: ExplorationStats;
    policy: PolicyType;
    recommendedEpsilon: number;
    shouldForceExplore: boolean;
  }> {
    const stats = await this.getExplorationStats(userId);
    const recommendedEpsilon = await this.getAdaptiveEpsilon(userId);

    // Check if any user bandits need exploration
    const shouldForceExplore = stats.adaptationStatus === 'adapting' ||
                               stats.recentExplorationRate < this.config.minExplorationRate;

    return {
      stats,
      policy: 'epsilon-greedy', // Would come from user policy in production
      recommendedEpsilon,
      shouldForceExplore,
    };
  }

  /**
   * Reset exploration stats for a user
   */
  async resetExplorationStats(userId: string): Promise<void> {
    const key = `rl:user:${userId}:exploration`;
    const historyKey = `rl:user:${userId}:selection_history`;

    await this.redis.del(key);
    await this.redis.del(historyKey);
  }

  /**
   * Get multi-armed bandit context
   * Returns data needed for context-aware exploration
   */
  async getExplorationContext(banditId: string): Promise<{
    totalPulls: number;
    armDistribution: Array<{ armId: string; pulls: number; avgReward: number }>;
    explorationRatio: number;
    convergenceProgress: number;
  } | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return null;

    return {
      totalPulls: bandit.totalPulls,
      armDistribution: bandit.arms.map((arm) => ({
        armId: arm.armId,
        pulls: arm.pullCount,
        avgReward: arm.averageReward,
      })),
      explorationRatio: bandit.totalPulls > 0
        ? bandit.arms.filter((arm) => arm.pullCount < 10).length / bandit.arms.length
        : 1,
      convergenceProgress: this.calculateSimpleConvergence(bandit.arms),
    };
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

  private getDefaultExplorationStats(): ExplorationStats {
    return {
      totalExplorations: 0,
      totalExploitations: 0,
      explorationRate: this.config.minExplorationRate,
      recentExplorationRate: this.config.minExplorationRate,
      adaptationStatus: 'stable',
    };
  }
}

// Singleton instance
let explorationEngineInstance: ExplorationEngine | null = null;

export function getExplorationEngine(redisClient?: Redis, config?: Partial<ExplorationConfig>): ExplorationEngine {
  if (!explorationEngineInstance) {
    explorationEngineInstance = new ExplorationEngine(redisClient, config);
  }
  return explorationEngineInstance;
}

export function resetExplorationEngine(): void {
  explorationEngineInstance = null;
}

/**
 * REZ RL Learning Service - Bandit Model Storage
 * Redis-based persistence for bandit state
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  BanditState,
  ArmStatistics,
  BanditConfig,
  PolicyConfig,
  RedisKeys,
} from '../types/index.js';

// Redis key generators
const REDIS_KEYS: RedisKeys = {
  bandit: (banditId: string) => `rl:bandit:${banditId}`,
  banditArms: (banditId: string, armId: string) => `rl:bandit:${banditId}:arm:${armId}`,
  userPolicy: (userId: string) => `rl:user:${userId}:policy`,
  explorationStats: (userId: string) => `rl:user:${userId}:exploration`,
  rewardHistory: (armId: string) => `rl:arm:${armId}:rewards`,
};

const DEFAULT_CACHE_TTL = 86400; // 24 hours
const ARM_STATS_TTL = 604800;    // 7 days

export class BanditModel {
  private redis: Redis;
  private readonly keys: RedisKeys;

  constructor(redisClient?: Redis) {
    this.redis = redisClient || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.keys = REDIS_KEYS;
  }

  /**
   * Initialize a new bandit for a user
   */
  async initializeBandit(config: BanditConfig): Promise<BanditState> {
    const now = Date.now();
    const banditId = config.banditId || uuidv4();

    // Initialize arm statistics
    const arms: ArmStatistics[] = config.arms.map((arm) => ({
      armId: arm.armId,
      pullCount: 0,
      totalReward: 0,
      averageReward: 0,
      lastPulledAt: 0,
      lastRewardAt: 0,
      successCount: 0,
      failureCount: 0,
      // For Thompson Sampling - Beta distribution prior
      alpha: 1,
      beta: 1,
    }));

    const banditState: BanditState = {
      banditId,
      userId: config.userId || '',
      arms,
      policy: config.policy,
      totalPulls: 0,
      totalRewards: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Store in Redis
    const key = this.keys.bandit(banditId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(banditState));

    return banditState;
  }

  /**
   * Get bandit state by ID
   */
  async getBandit(banditId: string): Promise<BanditState | null> {
    const key = this.keys.bandit(banditId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as BanditState;
    } catch {
      return null;
    }
  }

  /**
   * Get or create bandit for user
   */
  async getOrCreateBandit(config: BanditConfig): Promise<BanditState> {
    const existing = await this.getBandit(config.banditId);

    if (existing) {
      return existing;
    }

    return this.initializeBandit(config);
  }

  /**
   * Update bandit state
   */
  async updateBandit(banditId: string, updates: Partial<BanditState>): Promise<BanditState | null> {
    const current = await this.getBandit(banditId);

    if (!current) return null;

    const updated: BanditState = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };

    const key = this.keys.bandit(banditId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(updated));

    return updated;
  }

  /**
   * Get arm statistics
   */
  async getArmStats(banditId: string, armId: string): Promise<ArmStatistics | null> {
    const bandit = await this.getBandit(banditId);

    if (!bandit) return null;

    return bandit.arms.find((arm) => arm.armId === armId) || null;
  }

  /**
   * Update arm statistics after a pull
   */
  async updateArmStats(
    banditId: string,
    armId: string,
    updates: Partial<ArmStatistics>
  ): Promise<ArmStatistics | null> {
    const bandit = await this.getBandit(banditId);

    if (!bandit) return null;

    const armIndex = bandit.arms.findIndex((arm) => arm.armId === armId);

    if (armIndex === -1) return null;

    const updatedArm: ArmStatistics = {
      ...bandit.arms[armIndex],
      ...updates,
    };

    bandit.arms[armIndex] = updatedArm;
    bandit.updatedAt = Date.now();

    const key = this.keys.bandit(banditId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(bandit));

    return updatedArm;
  }

  /**
   * Record a pull (selection) for an arm
   */
  async recordPull(banditId: string, armId: string): Promise<ArmStatistics | null> {
    const now = Date.now();

    return this.updateArmStats(banditId, armId, {
      pullCount: (await this.getArmStats(banditId, armId))?.pullCount || 0,
      lastPulledAt: now,
    }).then((arm) => {
      if (!arm) return null;

      const updated: ArmStatistics = {
        ...arm,
        pullCount: arm.pullCount + 1,
      };

      return this.updateArmStats(banditId, armId, updated);
    });
  }

  /**
   * Record a reward for an arm
   */
  async recordReward(
    banditId: string,
    armId: string,
    reward: number
  ): Promise<ArmStatistics | null> {
    const now = Date.now();
    const arm = await this.getArmStats(banditId, armId);

    if (!arm) return null;

    // Calculate new average reward using incremental mean
    const newTotalReward = arm.totalReward + reward;
    const newPullCount = arm.pullCount > 0 ? arm.pullCount : 1;
    const newAverageReward = newTotalReward / newPullCount;

    // Update Thompson Sampling parameters (Beta distribution)
    // For binary rewards: alpha = successes + 1, beta = failures + 1
    const isSuccess = reward > 0;
    const newAlpha = arm.alpha + (isSuccess ? 1 : 0);
    const newBeta = arm.beta + (isSuccess ? 0 : 1);

    const updates: Partial<ArmStatistics> = {
      totalReward: newTotalReward,
      averageReward: newAverageReward,
      lastRewardAt: now,
      successCount: isSuccess ? arm.successCount + 1 : arm.successCount,
      failureCount: isSuccess ? arm.failureCount : arm.failureCount + 1,
      alpha: newAlpha,
      beta: newBeta,
    };

    return this.updateArmStats(banditId, armId, updates);
  }

  /**
   * Get all arms for a bandit
   */
  async getAllArms(banditId: string): Promise<ArmStatistics[]> {
    const bandit = await this.getBandit(banditId);
    return bandit?.arms || [];
  }

  /**
   * Get best performing arm
   */
  async getBestArm(banditId: string): Promise<ArmStatistics | null> {
    const arms = await this.getAllArms(banditId);

    if (arms.length === 0) return null;

    return arms.reduce((best, current) => {
      if (!best || current.averageReward > best.averageReward) {
        return current;
      }
      return best;
    }, arms[0]);
  }

  /**
   * Delete bandit
   */
  async deleteBandit(banditId: string): Promise<boolean> {
    const bandit = await this.getBandit(banditId);

    if (!bandit) return false;

    // Delete all arm stats
    const pipeline = this.redis.pipeline();

    const key = this.keys.bandit(banditId);
    pipeline.del(key);

    for (const arm of bandit.arms) {
      const armKey = this.keys.banditArms(banditId, arm.armId);
      pipeline.del(armKey);
    }

    await pipeline.exec();

    return true;
  }

  /**
   * Store user policy preference
   */
  async setUserPolicy(userId: string, policy: PolicyConfig): Promise<void> {
    const key = this.keys.userPolicy(userId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(policy));
  }

  /**
   * Get user policy preference
   */
  async getUserPolicy(userId: string): Promise<PolicyConfig | null> {
    const key = this.keys.userPolicy(userId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as PolicyConfig;
    } catch {
      return null;
    }
  }

  /**
   * Store exploration stats
   */
  async setExplorationStats(userId: string, stats: Record<string, unknown>): Promise<void> {
    const key = this.keys.explorationStats(userId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(stats));
  }

  /**
   * Get exploration stats
   */
  async getExplorationStats(userId: string): Promise<Record<string, unknown> | null> {
    const key = this.keys.explorationStats(userId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Add arm to existing bandit
   */
  async addArm(banditId: string, armId: string, metadata?: Record<string, unknown>): Promise<BanditState | null> {
    const bandit = await this.getBandit(banditId);

    if (!bandit) return null;

    // Check if arm already exists
    if (bandit.arms.some((arm) => arm.armId === armId)) {
      return bandit;
    }

    const newArm: ArmStatistics = {
      armId,
      pullCount: 0,
      totalReward: 0,
      averageReward: 0,
      lastPulledAt: 0,
      lastRewardAt: 0,
      successCount: 0,
      failureCount: 0,
      alpha: 1,
      beta: 1,
    };

    bandit.arms.push(newArm);
    bandit.updatedAt = Date.now();

    const key = this.keys.bandit(banditId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(bandit));

    return bandit;
  }

  /**
   * Remove arm from bandit
   */
  async removeArm(banditId: string, armId: string): Promise<BanditState | null> {
    const bandit = await this.getBandit(banditId);

    if (!bandit) return null;

    bandit.arms = bandit.arms.filter((arm) => arm.armId !== armId);
    bandit.updatedAt = Date.now();

    const key = this.keys.bandit(banditId);
    await this.redis.setex(key, DEFAULT_CACHE_TTL, JSON.stringify(bandit));

    // Also delete arm-specific cache
    const armKey = this.keys.banditArms(banditId, armId);
    await this.redis.del(armKey);

    return bandit;
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

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
let banditModelInstance: BanditModel | null = null;

export function getBanditModel(redisClient?: Redis): BanditModel {
  if (!banditModelInstance) {
    banditModelInstance = new BanditModel(redisClient);
  }
  return banditModelInstance;
}

export function resetBanditModel(): void {
  banditModelInstance = null;
}

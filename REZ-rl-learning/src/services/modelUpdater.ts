/**
 * REZ RL Learning Service - Model Updater
 * Online learning updates for bandit models
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  ModelUpdate,
  BatchUpdateResult,
  ArmStatistics,
  BanditState,
  RewardRecord,
} from '../types/index.js';
import { getBanditModel } from '../models/banditModel.js';
import { getRewardTracker } from './rewardTracker.js';

export interface UpdateStrategy {
  type: 'incremental' | 'batch' | 'exponential-smoothing' | 'discounted';
  discountFactor?: number;  // For discounted rewards
  smoothingFactor?: number; // For exponential smoothing
  batchSize?: number;       // For batch updates
  batchInterval?: number;    // ms between batch updates
}

const DEFAULT_UPDATE_STRATEGY: UpdateStrategy = {
  type: 'incremental',
  discountFactor: 0.9,
  smoothingFactor: 0.1,
};

export class ModelUpdater {
  private redis: Redis;
  private banditModel: ReturnType<typeof getBanditModel>;
  private rewardTracker: ReturnType<typeof getRewardTracker>;
  private pendingUpdates: Map<string, ModelUpdate[]>;
  private updateStrategy: UpdateStrategy;

  constructor(redisClient?: Redis, strategy?: Partial<UpdateStrategy>) {
    this.redis = redisClient || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.banditModel = getBanditModel(this.redis);
    this.rewardTracker = getRewardTracker(this.redis);
    this.pendingUpdates = new Map();
    this.updateStrategy = { ...DEFAULT_UPDATE_STRATEGY, ...strategy };
  }

  /**
   * Queue an incremental update
   */
  async queueUpdate(
    banditId: string,
    armId: string,
    reward: number
  ): Promise<ModelUpdate> {
    const update: ModelUpdate = {
      updateId: uuidv4(),
      banditId,
      armId,
      updateType: 'incremental',
      previousState: {},
      newState: {},
      timestamp: Date.now(),
    };

    // Get current state
    const currentStats = await this.banditModel.getArmStats(banditId, armId);
    if (currentStats) {
      update.previousState = { ...currentStats };
    }

    // Apply incremental update
    const newStats = await this.applyIncrementalUpdate(currentStats, reward);
    update.newState = { ...newStats };

    // Store in pending updates
    if (!this.pendingUpdates.has(banditId)) {
      this.pendingUpdates.set(banditId, []);
    }
    this.pendingUpdates.get(banditId)!.push(update);

    // Apply immediately for incremental updates
    await this.banditModel.updateArmStats(banditId, armId, newStats);

    // Publish update event
    await this.publishUpdateEvent(update);

    return update;
  }

  /**
   * Apply incremental update to arm statistics
   */
  private async applyIncrementalUpdate(
    currentStats: ArmStatistics | null,
    reward: number
  ): Promise<Partial<ArmStatistics>> {
    if (!currentStats) {
      // Initialize new arm
      return {
        pullCount: 1,
        totalReward: reward,
        averageReward: reward,
        lastRewardAt: Date.now(),
        successCount: reward > 0 ? 1 : 0,
        failureCount: reward > 0 ? 0 : 1,
        alpha: reward > 0 ? 2 : 1,
        beta: reward > 0 ? 1 : 2,
      };
    }

    // Incremental mean update
    const newPullCount = currentStats.pullCount + 1;
    const newTotalReward = currentStats.totalReward + reward;
    const newAverageReward = newTotalReward / newPullCount;

    // Beta distribution update for Thompson Sampling
    const isSuccess = reward > 0;
    const newAlpha = currentStats.alpha + (isSuccess ? 1 : 0);
    const newBeta = currentStats.beta + (isSuccess ? 0 : 1);

    return {
      pullCount: newPullCount,
      totalReward: newTotalReward,
      averageReward: newAverageReward,
      lastRewardAt: Date.now(),
      successCount: isSuccess ? currentStats.successCount + 1 : currentStats.successCount,
      failureCount: isSuccess ? currentStats.failureCount : currentStats.failureCount + 1,
      alpha: newAlpha,
      beta: newBeta,
    };
  }

  /**
   * Process batch updates
   */
  async processBatchUpdates(banditId: string): Promise<BatchUpdateResult> {
    const startTime = Date.now();
    const updates = this.pendingUpdates.get(banditId) || [];

    if (updates.length === 0) {
      return {
        batchId: uuidv4(),
        updates: [],
        successCount: 0,
        failureCount: 0,
        duration: 0,
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const processedUpdates: ModelUpdate[] = [];

    for (const update of updates) {
      try {
        await this.banditModel.updateArmStats(update.banditId, update.armId, update.newState);
        processedUpdates.push(update);
        successCount++;
      } catch (error) {
        console.error(`Failed to process update ${update.updateId}:`, error);
        failureCount++;
      }
    }

    // Clear pending updates
    this.pendingUpdates.delete(banditId);

    const result: BatchUpdateResult = {
      batchId: uuidv4(),
      updates: processedUpdates,
      successCount,
      failureCount,
      duration: Date.now() - startTime,
    };

    // Store batch result
    const batchKey = `rl:batch:${result.batchId}`;
    await this.redis.setex(batchKey, 86400, JSON.stringify(result));

    return result;
  }

  /**
   * Apply exponential smoothing update
   */
  async applyExponentialSmoothing(
    banditId: string,
    armId: string,
    reward: number
  ): Promise<ArmStatistics | null> {
    const currentStats = await this.banditModel.getArmStats(banditId, armId);
    const smoothingFactor = this.updateStrategy.smoothingFactor || 0.1;

    if (!currentStats) {
      // Initialize with reward
      const initialStats: Partial<ArmStatistics> = {
        pullCount: 1,
        totalReward: reward,
        averageReward: reward,
        lastRewardAt: Date.now(),
        alpha: reward > 0 ? 2 : 1,
        beta: reward > 0 ? 1 : 2,
      };

      return this.banditModel.updateArmStats(banditId, armId, initialStats);
    }

    // Exponential smoothing: new_avg = alpha * reward + (1 - alpha) * old_avg
    const newAverageReward = smoothingFactor * reward + (1 - smoothingFactor) * currentStats.averageReward;
    const newPullCount = currentStats.pullCount + 1;
    const newTotalReward = currentStats.totalReward + reward;

    return this.banditModel.updateArmStats(banditId, armId, {
      pullCount: newPullCount,
      totalReward: newTotalReward,
      averageReward: newAverageReward,
      lastRewardAt: Date.now(),
    });
  }

  /**
   * Apply discounted reward update
   */
  async applyDiscountedUpdate(
    banditId: string,
    armId: string,
    reward: number,
    timestep: number
  ): Promise<ArmStatistics | null> {
    const currentStats = await this.banditModel.getArmStats(banditId, armId);
    const discountFactor = this.updateStrategy.discountFactor || 0.9;

    // Apply discount based on timestep
    const discountedReward = reward * Math.pow(discountFactor, timestep);

    if (!currentStats) {
      const initialStats: Partial<ArmStatistics> = {
        pullCount: 1,
        totalReward: discountedReward,
        averageReward: discountedReward,
        lastRewardAt: Date.now(),
        alpha: discountedReward > 0 ? 2 : 1,
        beta: discountedReward > 0 ? 1 : 2,
      };

      return this.banditModel.updateArmStats(banditId, armId, initialStats);
    }

    // Blend discounted reward with current estimate
    const newTotalReward = currentStats.totalReward + discountedReward;
    const newPullCount = currentStats.pullCount + 1;
    const newAverageReward = newTotalReward / newPullCount;

    return this.banditModel.updateArmStats(banditId, armId, {
      pullCount: newPullCount,
      totalReward: newTotalReward,
      averageReward: newAverageReward,
      lastRewardAt: Date.now(),
    });
  }

  /**
   * Update using reward history
   */
  async updateFromHistory(
    banditId: string,
    armId: string,
    windowSize: number = 100
  ): Promise<ModelUpdate[]> {
    const history = await this.rewardTracker.getRewardHistory(armId, windowSize);

    if (history.length === 0) {
      return [];
    }

    const updates: ModelUpdate[] = [];
    let timestep = 0;

    for (const record of history.reverse()) {
      try {
        const update = await this.queueUpdate(banditId, armId, record.reward);
        updates.push(update);
        timestep++;
      } catch (error) {
        console.error(`Failed to update from history for arm ${armId}:`, error);
      }
    }

    return updates;
  }

  /**
   * Recompute arm statistics from scratch
   */
  async recomputeStats(banditId: string, armId: string): Promise<ArmStatistics | null> {
    const history = await this.rewardTracker.getRewardHistory(armId, 10000);

    if (history.length === 0) {
      return this.banditModel.getArmStats(banditId, armId);
    }

    // Compute statistics from scratch
    const totalReward = history.reduce((sum, r) => sum + r.reward, 0);
    const averageReward = totalReward / history.length;
    const successCount = history.filter((r) => r.reward > 0).length;
    const failureCount = history.length - successCount;

    const stats: Partial<ArmStatistics> = {
      pullCount: history.length,
      totalReward,
      averageReward,
      lastRewardAt: history[0]?.timestamp || 0,
      successCount,
      failureCount,
      alpha: successCount + 1,
      beta: failureCount + 1,
    };

    return this.banditModel.updateArmStats(banditId, armId, stats);
  }

  /**
   * Full bandit recomputation
   */
  async recomputeAllArms(banditId: string): Promise<BatchUpdateResult> {
    const startTime = Date.now();
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) {
      return {
        batchId: uuidv4(),
        updates: [],
        successCount: 0,
        failureCount: 0,
        duration: Date.now() - startTime,
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const updates: ModelUpdate[] = [];

    for (const arm of bandit.arms) {
      try {
        await this.recomputeStats(banditId, arm.armId);
        successCount++;

        updates.push({
          updateId: uuidv4(),
          banditId,
          armId: arm.armId,
          updateType: 'batch',
          previousState: arm,
          newState: {},
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`Failed to recompute stats for arm ${arm.armId}:`, error);
        failureCount++;
      }
    }

    return {
      batchId: uuidv4(),
      updates,
      successCount,
      failureCount,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Adaptive update based on reward variance
   */
  async adaptiveUpdate(
    banditId: string,
    armId: string,
    reward: number
  ): Promise<ModelUpdate> {
    const history = await this.rewardTracker.getRewardHistory(armId, 50);

    // Calculate recent variance
    const recentRewards = history.slice(0, 20).map((r) => r.reward);
    const mean = recentRewards.length > 0
      ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length
      : 0;
    const variance = recentRewards.length > 0
      ? recentRewards.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentRewards.length
      : 0;

    // High variance = use smaller learning rate
    // Low variance = use larger learning rate (more stable)
    const learningRate = Math.max(0.01, 0.2 - variance);

    const currentStats = await this.banditModel.getArmStats(banditId, armId);

    if (!currentStats) {
      return this.queueUpdate(banditId, armId, reward);
    }

    // Apply adaptive update
    const newAverageReward = currentStats.averageReward + learningRate * (reward - currentStats.averageReward);
    const newPullCount = currentStats.pullCount + 1;
    const newTotalReward = currentStats.totalReward + reward;

    const newStats: Partial<ArmStatistics> = {
      pullCount: newPullCount,
      totalReward: newTotalReward,
      averageReward: newAverageReward,
      lastRewardAt: Date.now(),
    };

    await this.banditModel.updateArmStats(banditId, armId, newStats);

    const update: ModelUpdate = {
      updateId: uuidv4(),
      banditId,
      armId,
      updateType: 'incremental',
      previousState: { ...currentStats },
      newState: newStats,
      timestamp: Date.now(),
    };

    await this.publishUpdateEvent(update);

    return update;
  }

  /**
   * Publish update event for external consumers
   */
  private async publishUpdateEvent(update: ModelUpdate): Promise<void> {
    const channel = `rl:updates:${update.banditId}`;
    await this.redis.publish(channel, JSON.stringify(update));
  }

  /**
   * Subscribe to update events
   */
  subscribeToUpdates(banditId: string, callback: (update: ModelUpdate) => void): Redis {
    const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const channel = `rl:updates:${banditId}`;

    subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const update = JSON.parse(message) as ModelUpdate;
          callback(update);
        } catch (error) {
          console.error('Failed to parse update event:', error);
        }
      }
    });

    return subscriber;
  }

  /**
   * Get pending updates count
   */
  getPendingUpdatesCount(banditId: string): number {
    return this.pendingUpdates.get(banditId)?.length || 0;
  }

  /**
   * Get update strategy
   */
  getUpdateStrategy(): UpdateStrategy {
    return { ...this.updateStrategy };
  }

  /**
   * Set update strategy
   */
  setUpdateStrategy(strategy: Partial<UpdateStrategy>): void {
    this.updateStrategy = { ...this.updateStrategy, ...strategy };
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
let modelUpdaterInstance: ModelUpdater | null = null;

export function getModelUpdater(redisClient?: Redis, strategy?: Partial<UpdateStrategy>): ModelUpdater {
  if (!modelUpdaterInstance) {
    modelUpdaterInstance = new ModelUpdater(redisClient, strategy);
  }
  return modelUpdaterInstance;
}

export function resetModelUpdater(): void {
  modelUpdaterInstance = null;
}

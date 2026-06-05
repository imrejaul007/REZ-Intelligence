/**
 * REZ RL Learning Service - Bandit Engine
 * Core multi-armed bandit logic for recommendations
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BanditConfig,
  BanditState,
  Arm,
  ArmStatistics,
  SelectionRequest,
  SelectionResult,
  RewardRequest,
  RewardRecord,
  PolicyType,
  PolicyConfig,
} from '../types/index.js';
import { getBanditModel } from '../models/banditModel.js';
import { getPolicyManager, PolicyManager } from './policyManager.js';
import { getRewardTracker, RewardTracker } from './rewardTracker.js';
import { getExplorationEngine } from './explorationEngine.js';

export class BanditEngine {
  private banditModel: ReturnType<typeof getBanditModel>;
  private policyManager: PolicyManager;
  private rewardTracker: RewardTracker;

  constructor() {
    this.banditModel = getBanditModel();
    this.policyManager = getPolicyManager();
    this.rewardTracker = getRewardTracker();
  }

  /**
   * Select an arm using the configured policy
   */
  async selectArm(request: SelectionRequest): Promise<SelectionResult> {
    const { banditId, userId, arms, policy, context } = request;

    // Get or create bandit
    const bandit = await this.banditModel.getOrCreateBandit({
      banditId,
      userId,
      arms,
      policy,
      context,
    });

    // Ensure all arms exist in bandit
    for (const arm of arms) {
      const existingArm = bandit.arms.find((a) => a.armId === arm.armId);
      if (!existingArm) {
        await this.banditModel.addArm(banditId, arm.armId, arm.metadata);
      }
    }

    // Select arm based on policy
    const selection = this.policyManager.select(bandit, false);

    // Record the pull
    await this.banditModel.recordPull(banditId, selection.selectedArm.armId);

    // Update bandit totals
    await this.banditModel.updateBandit(banditId, {
      totalPulls: bandit.totalPulls + 1,
    });

    // Get full arm data for response
    const fullArm = bandit.arms.find((a) => a.armId === selection.selectedArm.armId);

    return {
      ...selection,
      selectedArm: {
        armId: selection.selectedArm.armId,
        name: fullArm ? (arms.find((a) => a.armId === selection.selectedArm.armId)?.name || selection.selectedArm.armId) : selection.selectedArm.armId,
        metadata: fullArm,
      },
    };
  }

  /**
   * Record reward and update model
   */
  async recordReward(request: RewardRequest): Promise<RewardRecord> {
    const record = await this.rewardTracker.recordReward(request);

    // Update exploration statistics
    const explorationEngine = getExplorationEngine();
    await explorationEngine.recordSelection(request.userId, request.armId, record.reward);

    return record;
  }

  /**
   * Get bandit state
   */
  async getBanditState(banditId: string): Promise<BanditState | null> {
    return this.banditModel.getBandit(banditId);
  }

  /**
   * Create a new bandit
   */
  async createBandit(config: BanditConfig): Promise<BanditState> {
    return this.banditModel.initializeBandit(config);
  }

  /**
   * Get all bandits for a user
   */
  async getUserBandits(userId: string): Promise<BanditState[]> {
    // Get all bandits by pattern matching user prefix
    // In production, maintain a user -> bandits index
    const allBandits = await this.banditModel.getAllBandits();
    return allBandits.filter(b => b.userId === userId);
  }

  /**
   * Get recommendations for a user
   * Returns top N recommendations with scores
   */
  async getRecommendations(
    banditId: string,
    userId: string,
    count: number = 5
  ): Promise<Array<{ arm: Arm; score: number; confidence: number }>> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit || bandit.arms.length === 0) {
      return [];
    }

    // Sort arms by average reward
    const sortedArms = [...bandit.arms].sort((a, b) => b.averageReward - a.averageReward);

    // Get top N
    const topArms = sortedArms.slice(0, count);

    // Calculate confidence scores
    const totalPulls = bandit.totalPulls;

    return topArms.map((arm) => ({
      arm: {
        armId: arm.armId,
        name: arm.armId,
      },
      score: arm.averageReward,
      confidence: totalPulls > 0 ? arm.pullCount / totalPulls : 0,
    }));
  }

  /**
   * Get arm statistics
   */
  async getArmStats(banditId: string, armId: string): Promise<ArmStatistics | null> {
    return this.banditModel.getArmStats(banditId, armId);
  }

  /**
   * Compare two arms
   */
  async compareArms(armId1: string, armId2: string): Promise<{
    arm1Better: boolean;
    confidence: number;
    sampleSize1: number;
    sampleSize2: number;
    estimatedImprovement: number;
  }> {
    const comparison = await this.rewardTracker.compareArms(armId1, armId2);

    const stats1 = await this.rewardTracker.getArmRewardStats(armId1);
    const stats2 = await this.rewardTracker.getArmRewardStats(armId2);

    const estimatedImprovement = comparison.arm1Better
      ? stats1.average - stats2.average
      : stats2.average - stats1.average;

    return {
      ...comparison,
      estimatedImprovement,
    };
  }

  /**
   * A/B test two configurations
   */
  async runABTest(
    banditId: string,
    variantA: PolicyConfig,
    variantB: PolicyConfig,
    trafficSplit: number = 0.5
  ): Promise<{ variantA: ArmStatistics[]; variantB: ArmStatistics[] }> {
    // In a real implementation, this would:
    // 1. Split users into two groups
    // 2. Track which variant each user saw
    // 3. Compare outcomes

    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) {
      return { variantA: [], variantB: [] };
    }

    // For now, return the same arms (would need user-level tracking in production)
    return {
      variantA: bandit.arms,
      variantB: bandit.arms,
    };
  }

  /**
   * Reset bandit to initial state
   */
  async resetBandit(banditId: string): Promise<BanditState | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return null;

    // Reset all arm statistics
    for (const arm of bandit.arms) {
      await this.banditModel.updateArmStats(banditId, arm.armId, {
        pullCount: 0,
        totalReward: 0,
        averageReward: 0,
        lastPulledAt: 0,
        lastRewardAt: 0,
        successCount: 0,
        failureCount: 0,
        alpha: 1,
        beta: 1,
      });
    }

    return this.banditModel.updateBandit(banditId, {
      totalPulls: 0,
      totalRewards: 0,
      updatedAt: Date.now(),
    });
  }

  /**
   * Clone bandit with new ID (for experiments)
   */
  async cloneBandit(sourceBanditId: string, newBanditId: string): Promise<BanditState | null> {
    const source = await this.banditModel.getBandit(sourceBanditId);

    if (!source) return null;

    const clone: BanditConfig = {
      banditId: newBanditId,
      userId: source.userId,
      arms: source.arms.map((arm) => ({
        armId: arm.armId,
        name: arm.armId,
      })),
      policy: { ...source.policy },
      context: source.context,
    };

    return this.banditModel.initializeBandit(clone);
  }

  /**
   * Get bandit performance summary
   */
  async getPerformanceSummary(banditId: string): Promise<{
    banditId: string;
    totalPulls: number;
    totalRewards: number;
    averageReward: number;
    bestArm: string;
    convergenceScore: number;
    regret: number;
    policy: PolicyType;
  } | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return null;

    const bestArm = bandit.arms.reduce((best, current) =>
      current.averageReward > (best?.averageReward || 0) ? current : best
    , bandit.arms[0]);

    const convergenceScore = this.policyManager.calculateConvergenceScore(bandit);
    const regret = this.policyManager.calculateRegret(bandit);

    return {
      banditId,
      totalPulls: bandit.totalPulls,
      totalRewards: bandit.totalRewards,
      averageReward: bandit.totalPulls > 0 ? bandit.totalRewards / bandit.totalPulls : 0,
      bestArm: bestArm?.armId || 'none',
      convergenceScore,
      regret,
      policy: bandit.policy.type,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const modelHealthy = await this.banditModel.ping();
    const trackerHealthy = await this.rewardTracker.ping();

    return {
      status: modelHealthy && trackerHealthy ? 'healthy' : 'degraded',
      checks: {
        banditModel: modelHealthy,
        rewardTracker: trackerHealthy,
      },
    };
  }
}

// Singleton instance
let banditEngineInstance: BanditEngine | null = null;

export function getBanditEngine(): BanditEngine {
  if (!banditEngineInstance) {
    banditEngineInstance = new BanditEngine();
  }
  return banditEngineInstance;
}

export function resetBanditEngine(): void {
  banditEngineInstance = null;
}

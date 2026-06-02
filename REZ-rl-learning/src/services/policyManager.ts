/**
 * REZ RL Learning Service - Policy Manager
 * Manages exploration/exploitation policies: Epsilon-greedy, UCB1, Thompson Sampling
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PolicyType,
  PolicyConfig,
  ArmStatistics,
  BanditState,
  SelectionResult,
} from '../types/index.js';
import { getBanditModel } from '../models/banditModel.js';

// Policy configuration defaults
const DEFAULT_POLICY_CONFIGS: Record<PolicyType, PolicyConfig> = {
  'epsilon-greedy': {
    type: 'epsilon-greedy',
    epsilon: 0.1,
    decayRate: 0.99,
    minEpsilon: 0.01,
  },
  'ucb1': {
    type: 'ucb1',
    ucbConfidence: 2.0,
  },
  'thompson-sampling': {
    type: 'thompson-sampling',
    thompsonAlpha: 1,
    thompsonBeta: 1,
  },
};

export class PolicyManager {
  private banditModel: ReturnType<typeof getBanditModel>;

  constructor() {
    this.banditModel = getBanditModel();
  }

  /**
   * Get default policy configuration
   */
  getDefaultPolicy(type: PolicyType): PolicyConfig {
    return { ...DEFAULT_POLICY_CONFIGS[type] };
  }

  /**
   * Validate policy configuration
   */
  validatePolicy(policy: PolicyConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate epsilon-greedy
    if (policy.type === 'epsilon-greedy') {
      if (policy.epsilon !== undefined && (policy.epsilon < 0 || policy.epsilon > 1)) {
        errors.push('Epsilon must be between 0 and 1');
      }
      if (policy.decayRate !== undefined && (policy.decayRate <= 0 || policy.decayRate > 1)) {
        errors.push('Decay rate must be between 0 and 1');
      }
      if (policy.minEpsilon !== undefined && (policy.minEpsilon < 0 || policy.minEpsilon > 1)) {
        errors.push('Min epsilon must be between 0 and 1');
      }
    }

    // Validate UCB1
    if (policy.type === 'ucb1') {
      if (policy.ucbConfidence !== undefined && policy.ucbConfidence < 0) {
        errors.push('UCB confidence must be non-negative');
      }
    }

    // Validate Thompson Sampling
    if (policy.type === 'thompson-sampling') {
      if (policy.thompsonAlpha !== undefined && policy.thompsonAlpha <= 0) {
        errors.push('Thompson alpha must be positive');
      }
      if (policy.thompsonBeta !== undefined && policy.thompsonBeta <= 0) {
        errors.push('Thompson beta must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Epsilon-greedy selection
   * With probability epsilon, explore (random). With probability 1-epsilon, exploit (best).
   */
  selectEpsilonGreedy(
    arms: ArmStatistics[],
    epsilon: number
  ): { selectedArm: ArmStatistics; isExploration: boolean } {
    // Ensure epsilon is within bounds
    const effectiveEpsilon = Math.max(0, Math.min(1, epsilon));

    // Random exploration
    if (Math.random() < effectiveEpsilon) {
      const randomIndex = Math.floor(Math.random() * arms.length);
      return {
        selectedArm: arms[randomIndex],
        isExploration: true,
      };
    }

    // Exploitation: select arm with highest average reward
    // Break ties randomly
    const bestArms = this.getBestArms(arms);
    const randomBestIndex = Math.floor(Math.random() * bestArms.length);

    return {
      selectedArm: bestArms[randomBestIndex],
      isExploration: false,
    };
  }

  /**
   * UCB1 (Upper Confidence Bound) selection
   * Balances exploitation (high average reward) with exploration (uncertainty)
   * UCB = average_reward + confidence_bound
   */
  selectUCB1(arms: ArmStatistics[], confidence: number = 2.0): { selectedArm: ArmStatistics; ucbValues: Map<string, number> } {
    const totalPulls = arms.reduce((sum, arm) => sum + arm.pullCount, 0);
    const ucbValues = new Map<string, number>();

    // If any arm hasn't been pulled, prefer those
    const unpulledArms = arms.filter((arm) => arm.pullCount === 0);

    if (unpulledArms.length > 0) {
      const randomIndex = Math.floor(Math.random() * unpulledArms.length);
      const selectedArm = unpulledArms[randomIndex];

      // Calculate UCB for all arms (for logging)
      for (const arm of arms) {
        const ucb = arm.pullCount === 0 ? Infinity : this.calculateUCB(arm, totalPulls, confidence);
        ucbValues.set(arm.armId, ucb);
      }

      return { selectedArm, ucbValues };
    }

    // Calculate UCB for all arms
    for (const arm of arms) {
      const ucb = this.calculateUCB(arm, totalPulls, confidence);
      ucbValues.set(arm.armId, ucb);
    }

    // Select arm with highest UCB
    const sortedArms = [...arms].sort((a, b) => {
      const ucbA = ucbValues.get(a.armId) || 0;
      const ucbB = ucbValues.get(b.armId) || 0;
      return ucbB - ucbA;
    });

    return {
      selectedArm: sortedArms[0],
      ucbValues,
    };
  }

  /**
   * Calculate UCB value for an arm
   */
  private calculateUCB(arm: ArmStatistics, totalPulls: number, confidence: number): number {
    // If never pulled, return infinity
    if (arm.pullCount === 0) {
      return Infinity;
    }

    // Exploitation term: average reward
    const exploitation = arm.averageReward;

    // Exploration term: confidence bound
    // Formula: sqrt(2 * ln(total_pulls) / arm_pulls)
    const exploration = Math.sqrt((confidence * Math.log(totalPulls)) / arm.pullCount);

    return exploitation + exploration;
  }

  /**
   * Thompson Sampling selection
   * Samples from posterior Beta distribution and selects highest sample
   */
  selectThompsonSampling(arms: ArmStatistics[]): { selectedArm: ArmStatistics; sampledValues: Map<string, number> } {
    const sampledValues = new Map<string, number>();

    // Sample from Beta distribution for each arm
    for (const arm of arms) {
      // Beta distribution with alpha = successes + 1, beta = failures + 1
      // This uses Bayesian inference with conjugate prior
      const alpha = arm.alpha;
      const beta = arm.beta;

      // Sample from Beta distribution using gamma approximation
      const sampledValue = this.sampleBeta(alpha, beta);
      sampledValues.set(arm.armId, sampledValue);
    }

    // Select arm with highest sampled value
    let bestArm = arms[0];
    let bestValue = sampledValues.get(bestArm.armId) || 0;

    for (const arm of arms) {
      const value = sampledValues.get(arm.armId) || 0;
      if (value > bestValue) {
        bestArm = arm;
        bestValue = value;
      }
    }

    return { selectedArm: bestArm, sampledValues };
  }

  /**
   * Sample from Beta distribution using Marsaglia and Tsang's method
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Ensure positive parameters
    alpha = Math.max(0.001, alpha);
    beta = Math.max(0.001, beta);

    // Use gamma distribution to sample from Beta
    // Beta(alpha, beta) = Gamma(alpha) / (Gamma(alpha) + Gamma(beta))
    const gammaAlpha = this.sampleGamma(alpha);
    const gammaBeta = this.sampleGamma(beta);

    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  /**
   * Sample from Gamma distribution using Marsaglia and Tsang's method
   */
  private sampleGamma(shape: number): number {
    // For shape >= 1, use Marsaglia and Tsang's method
    if (shape >= 1) {
      const d = shape - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);

      while (true) {
        let x: number;
        let v: number;

        do {
          x = this.sampleNormal();
          v = 1 + c * x;
        } while (v <= 0);

        v = v * v * v;
        const u = Math.random();

        if (u < 1 - 0.0331 * (x * x) * (x * x)) {
          return d * v;
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }

    // For shape < 1, use shape + 1 and adjust
    const adjustedShape = shape + 1;
    const sample = this.sampleGamma(adjustedShape);
    return sample * Math.pow(Math.random(), 1 / shape);
  }

  /**
   * Sample from standard normal distribution (Box-Muller transform)
   */
  private sampleNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Get the best arm(s) by average reward
   */
  private getBestArms(arms: ArmStatistics[]): ArmStatistics[] {
    if (arms.length === 0) return [];

    const maxReward = Math.max(...arms.map((a) => a.averageReward));
    return arms.filter((arm) => arm.averageReward === maxReward);
  }

  /**
   * Decay epsilon over time
   */
  decayEpsilon(currentEpsilon: number, decayRate: number, minEpsilon: number): number {
    return Math.max(minEpsilon, currentEpsilon * decayRate);
  }

  /**
   * Select action based on policy type
   */
  select(
    banditState: BanditState,
    forceExploration: boolean = false
  ): SelectionResult {
    const { arms, policy } = banditState;
    const now = Date.now();

    let selectedArm: ArmStatistics;
    let isExploration = false;
    let confidence = 0;
    let ucbValue: number | undefined;
    let sampledValue: number | undefined;

    switch (policy.type) {
      case 'epsilon-greedy': {
        const epsilon = policy.epsilon || 0.1;
        const result = this.selectEpsilonGreedy(arms, epsilon);
        selectedArm = result.selectedArm;
        isExploration = result.isExploration;
        confidence = 1 - epsilon;
        break;
      }

      case 'ucb1': {
        const ucbConfidence = policy.ucbConfidence || 2.0;
        const result = this.selectUCB1(arms, ucbConfidence);
        selectedArm = result.selectedArm;
        ucbValue = result.ucbValues.get(selectedArm.armId);
        confidence = Math.min(1, selectedArm.pullCount / 100); // More pulls = more confidence
        isExploration = selectedArm.pullCount < 10; // Consider exploration if under-sampled
        break;
      }

      case 'thompson-sampling': {
        const result = this.selectThompsonSampling(arms);
        selectedArm = result.selectedArm;
        sampledValue = result.sampledValues.get(selectedArm.armId);
        confidence = Math.min(1, selectedArm.pullCount / 50); // Thompson converges faster
        isExploration = false; // Thompson naturally balances exploration/exploitation
        break;
      }

      default:
        throw new Error(`Unknown policy type: ${policy.type}`);
    }

    // Force exploration if requested
    if (forceExploration && arms.length > 1) {
      const otherArms = arms.filter((arm) => arm.armId !== selectedArm.armId);
      const randomIndex = Math.floor(Math.random() * otherArms.length);
      selectedArm = otherArms[randomIndex];
      isExploration = true;
      confidence = 0;
    }

    return {
      banditId: banditState.banditId,
      selectedArm: {
        armId: selectedArm.armId,
        name: selectedArm.armId, // Use armId as name if not provided
      },
      selectionPolicy: policy.type,
      isExploration,
      confidence,
      ucbValue,
      sampledValue,
      timestamp: now,
    };
  }

  /**
   * Calculate expected regret for current policy
   * Regret = (optimal_reward * pulls) - actual_reward
   */
  calculateRegret(banditState: BanditState): number {
    const { arms, totalPulls } = banditState;

    if (arms.length === 0 || totalPulls === 0) return 0;

    // Find optimal arm
    const optimalReward = Math.max(...arms.map((arm) => arm.averageReward));

    // Calculate expected optimal reward
    const expectedOptimalReward = optimalReward * totalPulls;

    // Calculate actual reward
    const actualReward = arms.reduce((sum, arm) => sum + arm.totalReward, 0);

    // Regret = expected - actual
    return expectedOptimalReward - actualReward;
  }

  /**
   * Calculate convergence score (0-1)
   * Higher score = more converged = less exploration needed
   */
  calculateConvergenceScore(banditState: BanditState): number {
    const { arms, totalPulls } = banditState;

    if (arms.length === 0 || totalPulls === 0) return 0;

    // Need minimum samples for convergence
    const minSamplesForConvergence = 50;
    if (totalPulls < minSamplesForConvergence) {
      return totalPulls / minSamplesForConvergence * 0.5; // Scale to 0-0.5
    }

    // Calculate variance in average rewards
    const avgRewards = arms.map((arm) => arm.averageReward);
    const mean = avgRewards.reduce((a, b) => a + b, 0) / avgRewards.length;
    const variance = avgRewards.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / avgRewards.length;

    // Low variance = high convergence
    // Scale variance to 0-1 convergence score
    const maxVariance = 0.25; // Max possible variance for 0-1 rewards
    const normalizedVariance = Math.min(1, variance / maxVariance);

    // Also factor in sample size
    const sampleSizeFactor = Math.min(1, totalPulls / 500);

    // Combine factors
    const convergenceScore = (1 - normalizedVariance) * 0.7 + sampleSizeFactor * 0.3;

    return Math.max(0, Math.min(1, convergenceScore));
  }

  /**
   * Get policy performance metrics
   */
  async getPolicyMetrics(banditId: string): Promise<{
    regret: number;
    convergenceScore: number;
    totalPulls: number;
    bestArmPulls: number;
    explorationRatio: number;
  }> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) {
      return {
        regret: 0,
        convergenceScore: 0,
        totalPulls: 0,
        bestArmPulls: 0,
        explorationRatio: 0,
      };
    }

    const regret = this.calculateRegret(bandit);
    const convergenceScore = this.calculateConvergenceScore(bandit);

    // Find best arm by pull count
    const sortedByPulls = [...bandit.arms].sort((a, b) => b.pullCount - a.pullCount);
    const bestArmPulls = sortedByPulls[0]?.pullCount || 0;

    // Estimate exploration ratio
    const explorationRatio = bandit.totalPulls > 0
      ? bandit.arms.filter((arm) => arm.pullCount < 10).length / bandit.arms.length
      : 1;

    return {
      regret,
      convergenceScore,
      totalPulls: bandit.totalPulls,
      bestArmPulls,
      explorationRatio,
    };
  }

  /**
   * Switch policy type
   */
  async switchPolicy(banditId: string, newPolicy: PolicyType): Promise<BanditState | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return null;

    const newConfig = this.getDefaultPolicy(newPolicy);

    return this.banditModel.updateBandit(banditId, {
      policy: { ...bandit.policy, ...newConfig },
    });
  }

  /**
   * Update policy parameters
   */
  async updatePolicyParams(
    banditId: string,
    params: Partial<PolicyConfig>
  ): Promise<BanditState | null> {
    const bandit = await this.banditModel.getBandit(banditId);

    if (!bandit) return null;

    // Validate new params
    const validation = this.validatePolicy({ ...bandit.policy, ...params });
    if (!validation.valid) {
      throw new Error(`Invalid policy params: ${validation.errors.join(', ')}`);
    }

    return this.banditModel.updateBandit(banditId, {
      policy: { ...bandit.policy, ...params },
    });
  }
}

// Singleton instance
let policyManagerInstance: PolicyManager | null = null;

export function getPolicyManager(): PolicyManager {
  if (!policyManagerInstance) {
    policyManagerInstance = new PolicyManager();
  }
  return policyManagerInstance;
}

export function resetPolicyManager(): void {
  policyManagerInstance = null;
}

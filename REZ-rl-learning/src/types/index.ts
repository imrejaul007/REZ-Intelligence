/**
 * REZ RL Learning Service - TypeScript Type Definitions
 * Reinforcement Learning for self-improving recommendations
 */

// ==================== POLICY TYPES ====================

export type PolicyType = 'epsilon-greedy' | 'ucb1' | 'thompson-sampling';

export interface PolicyConfig {
  type: PolicyType;
  epsilon?: number;           // For epsilon-greedy (0-1)
  ucbConfidence?: number;     // For UCB1 (typically 2)
  thompsonAlpha?: number;     // Beta distribution alpha
  thompsonBeta?: number;      // Beta distribution beta
  decayRate?: number;         // Epsilon decay over time
  minEpsilon?: number;        // Minimum epsilon floor
}

// ==================== ARM TYPES ====================

export interface Arm {
  armId: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface ArmStatistics {
  armId: string;
  pullCount: number;
  totalReward: number;
  averageReward: number;
  lastPulledAt: number;
  lastRewardAt: number;
  successCount: number;       // Positive feedback count
  failureCount: number;       // Negative feedback count
  // For Thompson Sampling
  alpha: number;              // Beta distribution success param
  beta: number;               // Beta distribution failure param
}

// ==================== BANDIT TYPES ====================

export interface BanditState {
  banditId: string;
  userId: string;
  context?: Record<string, unknown>;
  arms: ArmStatistics[];
  policy: PolicyConfig;
  totalPulls: number;
  totalRewards: number;
  createdAt: number;
  updatedAt: number;
}

export interface BanditConfig {
  banditId: string;
  userId?: string;
  arms: Arm[];
  policy: PolicyConfig;
  context?: Record<string, unknown>;
}

// ==================== ACTION SELECTION ====================

export interface SelectionResult {
  banditId: string;
  selectedArm: Arm;
  selectionPolicy: PolicyType;
  isExploration: boolean;
  confidence: number;
  ucbValue?: number;          // UCB score if using UCB1
  sampledValue?: number;      // Thompson sample if using Thompson
  timestamp: number;
}

export interface SelectionRequest {
  banditId: string;
  userId: string;
  arms: Arm[];
  policy: PolicyConfig;
  context?: Record<string, unknown>;
}

// ==================== REWARD TYPES ====================

export interface RewardRecord {
  recordId: string;
  banditId: string;
  armId: string;
  userId: string;
  reward: number;             // Typically 0-1 or binary
  rewardType: RewardType;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type RewardType = 'click' | 'conversion' | 'purchase' | 'engagement' | 'rating' | 'custom';

export interface RewardRequest {
  banditId: string;
  armId: string;
  userId: string;
  reward: number;
  rewardType?: RewardType;
  metadata?: Record<string, unknown>;
}

// ==================== EXPLORATION TYPES ====================

export interface ExplorationConfig {
  forceExploration: boolean;
  minExplorationRate: number;
  maxExplorationRate: number;
  adaptationRate: number;
  explorationWindow: number;  // Time window for adaptation
}

export interface ExplorationStats {
  totalExplorations: number;
  totalExploitations: number;
  explorationRate: number;
  recentExplorationRate: number;
  adaptationStatus: 'stable' | 'adapting' | 'converging';
}

// ==================== POLICY STATE ====================

export interface PolicyState {
  userId: string;
  activeBandits: string[];
  preferredPolicy: PolicyType;
  performanceMetrics: PerformanceMetrics;
  lastUpdated: number;
}

export interface PerformanceMetrics {
  totalRewards: number;
  totalSelections: number;
  averageReward: number;
  regret: number;             // Cumulative regret vs optimal
  convergenceScore: number;   // 0-1 how converged the policy is
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface BanditSelectResponse extends ApiResponse<SelectionResult> {}

export interface RewardRecordResponse extends ApiResponse<RewardRecord> {}

export interface PolicyStateResponse extends ApiResponse<PolicyState> {}

export interface ExplorationResponse extends ApiResponse<SelectionResult & ExplorationStats> {}

// ==================== MODEL UPDATE TYPES ====================

export interface ModelUpdate {
  updateId: string;
  banditId: string;
  armId: string;
  updateType: 'incremental' | 'batch';
  previousState: Partial<ArmStatistics>;
  newState: Partial<ArmStatistics>;
  timestamp: number;
}

export interface BatchUpdateResult {
  batchId: string;
  updates: ModelUpdate[];
  successCount: number;
  failureCount: number;
  duration: number;
}

// ==================== REDIS CACHE TYPES ====================

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface RedisKeys {
  bandit: (banditId: string) => string;
  banditArms: (banditId: string, armId: string) => string;
  userPolicy: (userId: string) => string;
  explorationStats: (userId: string) => string;
  rewardHistory: (armId: string) => string;
}

// ==================== SERVICE CONFIG ====================

export interface ServiceConfig {
  port: number;
  redisUrl: string;
  logLevel: string;
  enableMetrics: boolean;
  cacheTtl: number;
  maxRewardsPerArm: number;
}

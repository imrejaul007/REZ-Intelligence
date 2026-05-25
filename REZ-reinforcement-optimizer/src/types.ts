/**
 * REZ Reinforcement Optimizer - Types
 *
 * Reinforcement Learning Layer - Self-improving AI with reward-based optimization
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// CORE RL TYPES
// ============================================

export interface RLAgent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  stateSpace: StateSpace;
  actionSpace: ActionSpace;
  policy: Policy;
  valueFunction?: ValueFunction;
  hyperparameters: Hyperparameters;
  training: TrainingState;
  metrics: AgentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType =
  | 'q_learning'
  | 'dqn'
  | 'policy_gradient'
  | 'actor_critic'
  | 'ppo'
  | 'dqn_per'
  | 'td3'
  | 'sac';

export interface StateSpace {
  dimensions: string[];
  continuous?: string[];
  discrete?: string[];
  bounds?: Record<string, { min: number; max: number }>;
}

export interface ActionSpace {
  type: 'discrete' | 'continuous' | 'hybrid';
  actions: Action[];
  bounds?: Record<string, { min: number; max: number }>;
}

export interface Action {
  id: string;
  name: string;
  type: 'discrete' | 'continuous';
  parameters?: ActionParameter[];
  reward?: number;
}

export interface ActionParameter {
  name: string;
  type: 'float' | 'int' | 'categorical';
  min?: number;
  max?: number;
  options?: string[];
}

export interface Policy {
  type: PolicyType;
  architecture?: NeuralArchitecture;
  parameters: Record<string, number[]>;
  targetParameters?: Record<string, number[]>;
  updateFrequency: number;
}

export type PolicyType =
  | 'epsilon_greedy'
  | 'softmax'
  | 'ucb'
  | 'thompson_sampling'
  | 'gradient';

export interface NeuralArchitecture {
  layers: NeuralLayer[];
  activation?: string;
  optimizer?: string;
  learningRate?: number;
  lossFunction?: string;
}

export interface NeuralLayer {
  type: 'dense' | 'conv1d' | 'lstm' | 'gru' | 'attention';
  units: number;
  activation?: string;
  dropout?: number;
}

export interface ValueFunction {
  type: 'table' | 'approximation';
  table?: Record<string, number>;
  approximation?: NeuralArchitecture;
}

export interface Hyperparameters {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  batchSize: number;
  replayBufferSize: number;
  targetUpdateFrequency: number;
  gradientClipNorm?: number;
  entropyCoef?: number;
  valueCoef?: number;
}

export interface TrainingState {
  episode: number;
  totalSteps: number;
  currentEpisodeSteps: number;
  status: TrainingStatus;
  startedAt?: Date;
  lastTrainedAt?: Date;
  pausedAt?: Date;
}

export type TrainingStatus =
  | 'idle'
  | 'collecting'
  | 'training'
  | 'evaluating'
  | 'paused'
  | 'completed';

export interface AgentMetrics {
  totalEpisodes: number;
  avgReward: number;
  bestReward: number;
  recentRewards: number[];
  lossHistory: number[];
  explorationRate: number;
  evaluationScore?: number;
}

// ============================================
// EXPERIENCE REPLAY
// ============================================

export interface Experience {
  id: string;
  agentId: string;
  state: number[];
  action: number;
  reward: number;
  nextState: number[];
  done: boolean;
  priority?: number;
  timestamp: Date;
}

export interface ReplayBuffer {
  id: string;
  agentId: string;
  capacity: number;
  experiences: Experience[];
  priorities: Map<number, number>;
  beta: number;
  alpha: number;
  insertedAt: Date;
  updatedAt: Date;
}

// ============================================
// ENVIRONMENT
// ============================================

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  stateSpace: StateSpace;
  actionSpace: ActionSpace;
  rewardFunction: RewardFunction;
  terminationCondition?: TerminationCondition;
  maxSteps: number;
  metadata: Record<string, unknown>;
}

export type EnvironmentType =
  | 'user_engagement'
  | 'pricing'
  | 'recommendation'
  | 'inventory'
  | 'routing'
  | 'resource_allocation'
  | 'custom';

export interface RewardFunction {
  type: 'dense' | 'sparse';
  immediate: (state: number[], action: number, nextState: number[]) => number;
  delayed?: (trajectory: number[][], rewards: number[]) => number;
  shaping?: RewardShaping;
}

export interface RewardShaping {
  potential: (state: number[]) => number;
  gamma: number;
}

export interface TerminationCondition {
  type: 'steps' | 'convergence' | 'threshold' | 'custom';
  maxSteps?: number;
  targetValue?: number;
  tolerance?: number;
  checkFunction?: string;
}

export interface EnvironmentStep {
  state: number[];
  action: number;
  reward: number;
  nextState: number[];
  done: boolean;
  info: Record<string, unknown>;
}

export interface EpisodeResult {
  episode: number;
  totalReward: number;
  steps: number;
  duration: number;
  finalState: number[];
  trajectory: number[][];
  rewards: number[];
  completed: boolean;
}

// ============================================
// POLICIES
// ============================================

export interface PolicyUpdate {
  id: string;
  agentId: string;
  episode: number;
  policySnapshot: Record<string, number[]>;
  improvement: number;
  method: UpdateMethod;
  gradientNorm?: number;
  loss?: number;
  createdAt: Date;
}

export type UpdateMethod =
  | 'q_update'
  | 'gradient_descent'
  | 'policy_gradient'
  | 'actor_critic'
  | 'ppo_clip'
  | 'ddpg_update';

export interface ActionSelection {
  action: number;
  qValue: number;
  policy: 'exploitation' | 'exploration' | 'random';
  probabilities?: number[];
}

// ============================================
// OPTIMIZATION
// ============================================

export interface OptimizationConfig {
  agentId: string;
  environmentId: string;
  objective: OptimizationObjective;
  constraints?: OptimizationConstraint[];
  algorithms: OptimizationAlgorithm[];
  evaluationCriteria: EvaluationCriteria;
}

export type OptimizationObjective =
  | 'maximize_engagement'
  | 'maximize_conversion'
  | 'minimize_churn'
  | 'maximize_revenue'
  | 'balance_efficiency'
  | 'custom';

export interface OptimizationConstraint {
  type: 'budget' | 'time' | 'fairness' | 'safety';
  limit: number;
  scope: string;
}

export type OptimizationAlgorithm =
  | 'epsilon_greedy'
  | 'ucb'
  | 'thompson_sampling'
  | 'dqn'
  | 'ppo'
  | 'sac'
  | 'genetic';

export interface EvaluationCriteria {
  metric: string;
  target: number;
  window: number;
  aggregation: 'mean' | 'sum' | 'max' | 'min';
}

export interface OptimizationResult {
  id: string;
  configId: string;
  agentId: string;
  bestPolicy: Policy;
  bestReward: number;
  convergence: number[];
  finalMetrics: Record<string, number>;
  trainingDuration: number;
  recommendations: string[];
  completedAt: Date;
}

// ============================================
// MULTI-AGENT
// ============================================

export interface MultiAgentConfig {
  id: string;
  name: string;
  agents: string[];
  coordination: CoordinationType;
  communication?: CommunicationProtocol;
  sharedReward: boolean;
  competitive: boolean;
}

export type CoordinationType =
  | 'centralized'
  | 'decentralized'
  | 'hierarchical'
  | 'swarm';

export interface CommunicationProtocol {
  type: 'full' | 'partial' | 'broadcast' | 'directed';
  frequency: 'continuous' | 'episodic' | 'event';
  messageTypes: string[];
}

export interface AgentInteraction {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  action: string;
  observation?: number[];
  reward?: number;
  timestamp: Date;
}

// ============================================
// A/B TESTING & EXPERIMENTS
// ============================================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  controlPolicy?: Policy;
  variantPolicies: Policy[];
  trafficSplit: number[];
  status: ExperimentStatus;
  startedAt?: Date;
  completedAt?: Date;
  results?: ExperimentResults;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface ExperimentResults {
  control: VariantResults;
  variants: VariantResults[];
  winner: number;
  confidence: number;
  improvement: number;
  pValue?: number;
  recommendation: string;
}

export interface VariantResults {
  variantId: string;
  totalReward: number;
  avgReward: number;
  episodes: number;
  metrics: Record<string, number>;
}

// ============================================
// MONITORING & METRICS
// ============================================

export interface TrainingMonitor {
  agentId: string;
  episode: number;
  step: number;
  reward: number;
  cumulativeReward: number;
  loss: number;
  explorationRate: number;
  policyEntropy: number;
  valueEstimate: number;
  tdError: number;
  timestamp: Date;
}

export interface ConvergenceMetrics {
  agentId: string;
  windowSize: number;
  avgReward: number;
  stdReward: number;
  movingAvg: number;
  trend: 'improving' | 'stable' | 'degrading';
  converged: boolean;
  convergenceStep?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  activeAgents: number;
  totalEpisodes: number;
  totalExperiences: number;
  activeOptimizations: number;
  lastProcessed: Date;
}

export interface ServiceStats {
  totalAgents: number;
  totalEnvironments: number;
  totalExperiments: number;
  totalExperiences: number;
  avgTrainingTime: number;
  avgReward: number;
  byType: Record<string, number>;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface CreateAgentRequest {
  name: string;
  type: AgentType;
  description?: string;
  stateSpace: StateSpace;
  actionSpace: ActionSpace;
  hyperparameters?: Partial<Hyperparameters>;
}

export interface CreateAgentResponse {
  success: boolean;
  agent?: RLAgent;
  error?: string;
}

export interface TrainAgentRequest {
  agentId: string;
  environmentId: string;
  episodes: number;
  maxStepsPerEpisode?: number;
  evaluationFrequency?: number;
  saveFrequency?: number;
}

export interface TrainAgentResponse {
  success: boolean;
  trainingId?: string;
  error?: string;
}

export interface EvaluateAgentRequest {
  agentId: string;
  environmentId: string;
  episodes: number;
  render?: boolean;
}

export interface EvaluateAgentResponse {
  success: boolean;
  results?: EpisodeResult[];
  metrics?: Record<string, number>;
  error?: string;
}

export interface SelectActionRequest {
  agentId: string;
  state: number[];
  epsilon?: number;
}

export interface SelectActionResponse {
  success: boolean;
  action?: number;
  selection?: ActionSelection;
  error?: string;
}

export interface UpdatePolicyRequest {
  agentId: string;
  experiences: Omit<Experience, 'id' | 'agentId' | 'timestamp'>[];
}

export interface UpdatePolicyResponse {
  success: boolean;
  improvement?: number;
  loss?: number;
  error?: string;
}

export interface RunExperimentRequest {
  name: string;
  description?: string;
  agentIds: string[];
  variantPolicies?: Policy[];
  trafficSplit: number[];
  duration: number;
}

export interface RunExperimentResponse {
  success: boolean;
  experiment?: Experiment;
  error?: string;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IAgent extends Document {
  name: String;
  type: String;
  description: String;
  stateSpace: mongoose.Schema.Types.Mixed;
  actionSpace: mongoose.Schema.Types.Mixed;
  policy: mongoose.Schema.Types.Mixed;
  valueFunction: mongoose.Schema.Types.Mixed;
  hyperparameters: mongoose.Schema.Types.Mixed;
  training: mongoose.Schema.Types.Mixed;
  metrics: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEnvironment extends Document {
  name: String;
  type: String;
  stateSpace: mongoose.Schema.Types.Mixed;
  actionSpace: mongoose.Schema.Types.Mixed;
  rewardFunction: mongoose.Schema.Types.Mixed;
  terminationCondition: mongoose.Schema.Types.Mixed;
  maxSteps: Number;
  metadata: mongoose.Schema.Types.Mixed;
}

export interface IExperience extends Document {
  agentId: String;
  state: [Number];
  action: Number;
  reward: Number;
  nextState: [Number];
  done: Boolean;
  priority: Number;
  timestamp: Date;
}

export interface IExperiment extends Document {
  name: String;
  description: String;
  agentIds: [String];
  controlPolicy: mongoose.Schema.Types.Mixed;
  variantPolicies: [mongoose.Schema.Types.Mixed];
  trafficSplit: [Number];
  status: String;
  startedAt: Date;
  completedAt: Date;
  results: mongoose.Schema.Types.Mixed;
}

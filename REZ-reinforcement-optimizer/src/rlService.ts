/**
 * REZ Reinforcement Optimizer - Core Service
 *
 * Reinforcement Learning Layer - Self-improving AI with reward-based optimization
 */

import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import logger from './utils/logger';
import type {
  RLAgent,
  AgentType,
  StateSpace,
  ActionSpace,
  Policy,
  Hyperparameters,
  Experience,
  ReplayBuffer,
  Environment,
  EnvironmentStep,
  EpisodeResult,
  TrainingMonitor,
  ConvergenceMetrics,
  ActionSelection,
  PolicyUpdate,
  CreateAgentRequest,
  CreateAgentResponse,
  TrainAgentRequest,
  TrainAgentResponse,
  EvaluateAgentRequest,
  EvaluateAgentResponse,
  SelectActionRequest,
  SelectActionResponse,
  UpdatePolicyRequest,
  UpdatePolicyResponse,
  RunExperimentRequest,
  RunExperimentResponse,
  Experiment,
  HealthStatus,
  ServiceStats,
} from './types';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

// In-memory stores
const agents = new Map<string, RLAgent>();
const environments = new Map<string, Environment>();
const replayBuffers = new Map<string, ReplayBuffer>();
const trainingMonitors = new Map<string, TrainingMonitor[]>();
const policyUpdates = new Map<string, PolicyUpdate>();
const experiments = new Map<string, { id: string; status: string; results?: unknown }>();

// Default hyperparameters by agent type
const defaultHyperparameters: Record<AgentType, Hyperparameters> = {
  q_learning: {
    learningRate: 0.1,
    discountFactor: 0.95,
    epsilon: 1.0,
    epsilonDecay: 0.995,
    epsilonMin: 0.01,
    batchSize: 32,
    replayBufferSize: 10000,
    targetUpdateFrequency: 100,
  },
  dqn: {
    learningRate: 0.001,
    discountFactor: 0.99,
    epsilon: 1.0,
    epsilonDecay: 0.995,
    epsilonMin: 0.01,
    batchSize: 64,
    replayBufferSize: 100000,
    targetUpdateFrequency: 1000,
    gradientClipNorm: 1.0,
  },
  policy_gradient: {
    learningRate: 0.0003,
    discountFactor: 0.99,
    epsilon: 0,
    epsilonDecay: 1.0,
    epsilonMin: 0,
    batchSize: 1,
    replayBufferSize: 1,
    targetUpdateFrequency: 1,
    entropyCoef: 0.01,
  },
  actor_critic: {
    learningRate: 0.0003,
    discountFactor: 0.99,
    epsilon: 0,
    epsilonDecay: 1.0,
    epsilonMin: 0,
    batchSize: 1,
    replayBufferSize: 1,
    targetUpdateFrequency: 1,
    valueCoef: 0.5,
    entropyCoef: 0.01,
  },
  ppo: {
    learningRate: 0.0003,
    discountFactor: 0.995,
    epsilon: 0.2,
    epsilonDecay: 1.0,
    epsilonMin: 0,
    batchSize: 64,
    replayBufferSize: 2048,
    targetUpdateFrequency: 1,
    gradientClipNorm: 0.5,
    entropyCoef: 0.0,
    valueCoef: 0.5,
  },
  dqn_per: {
    learningRate: 0.001,
    discountFactor: 0.99,
    epsilon: 1.0,
    epsilonDecay: 0.995,
    epsilonMin: 0.01,
    batchSize: 64,
    replayBufferSize: 100000,
    targetUpdateFrequency: 1000,
    gradientClipNorm: 1.0,
  },
  td3: {
    learningRate: 0.001,
    discountFactor: 0.99,
    epsilon: 0,
    epsilonDecay: 1.0,
    epsilonMin: 0,
    batchSize: 256,
    replayBufferSize: 100000,
    targetUpdateFrequency: 2,
    gradientClipNorm: 1.0,
  },
  sac: {
    learningRate: 0.0003,
    discountFactor: 0.99,
    epsilon: 0,
    epsilonDecay: 1.0,
    epsilonMin: 0,
    batchSize: 256,
    replayBufferSize: 100000,
    targetUpdateFrequency: 1,
    entropyCoef: 0.2,
  },
};

// ============================================
// AGENT MANAGEMENT
// ============================================

export async function createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
  try {
    const hyperparameters = {
      ...defaultHyperparameters[request.type],
      ...request.hyperparameters,
    };

    const policy: Policy = {
      type: request.type === 'q_learning' ? 'epsilon_greedy' : 'gradient',
      parameters: initializePolicyParameters(request.stateSpace, request.actionSpace, request.type),
      updateFrequency: hyperparameters.targetUpdateFrequency,
    };

    const agent: RLAgent = {
      id: uuidv4(),
      name: request.name,
      type: request.type,
      description: request.description || '',
      stateSpace: request.stateSpace,
      actionSpace: request.actionSpace,
      policy,
      hyperparameters,
      training: {
        episode: 0,
        totalSteps: 0,
        currentEpisodeSteps: 0,
        status: 'idle',
      },
      metrics: {
        totalEpisodes: 0,
        avgReward: 0,
        bestReward: -Infinity,
        recentRewards: [],
        lossHistory: [],
        explorationRate: hyperparameters.epsilon,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    agents.set(agent.id, agent);

    // Initialize replay buffer
    const buffer: ReplayBuffer = {
      id: uuidv4(),
      agentId: agent.id,
      capacity: hyperparameters.replayBufferSize,
      experiences: [],
      priorities: new Map(),
      beta: 0.4,
      alpha: 0.6,
      insertedAt: new Date(),
      updatedAt: new Date(),
    };
    replayBuffers.set(agent.id, buffer);

    logger.info('Agent created', { agentId: agent.id, name: agent.name, type: agent.type });

    return { success: true, agent };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Agent creation failed', { error: message });
    return { success: false, error: message };
  }
}

function initializePolicyParameters(
  stateSpace: StateSpace,
  actionSpace: ActionSpace,
  agentType: AgentType
): Record<string, number[]> {
  const params: Record<string, number[]> = {};

  if (agentType === 'q_learning') {
    // Initialize Q-table
    const stateKey = 'q_table';
    params[stateKey] = [];
  } else {
    // Initialize neural network weights (simplified)
    const inputSize = stateSpace.dimensions.length;
    const hiddenSize = 64;
    const outputSize = actionSpace.actions.length;

    // Xavier initialization
    params['w1'] = Array(inputSize * hiddenSize).fill(0).map(() => (cryptoRandom() - 0.5) * Math.sqrt(2 / (inputSize + hiddenSize)));
    params['b1'] = Array(hiddenSize).fill(0);
    params['w2'] = Array(hiddenSize * outputSize).fill(0).map(() => (cryptoRandom() - 0.5) * Math.sqrt(2 / (hiddenSize + outputSize)));
    params['b2'] = Array(outputSize).fill(0);
  }

  return params;
}

export async function getAgent(agentId: string): Promise<RLAgent | null> {
  return agents.get(agentId) || null;
}

export async function listAgents(type?: AgentType): Promise<RLAgent[]> {
  const allAgents = Array.from(agents.values());
  if (type) {
    return allAgents.filter(a => a.type === type);
  }
  return allAgents;
}

export async function updateAgent(agentId: string, updates: Partial<RLAgent>): Promise<RLAgent | null> {
  const agent = agents.get(agentId);
  if (!agent) return null;

  const updatedAgent = {
    ...agent,
    ...updates,
    updatedAt: new Date(),
  };

  agents.set(agentId, updatedAgent);
  return updatedAgent;
}

// ============================================
// ACTION SELECTION
// ============================================

export async function selectAction(request: SelectActionRequest): Promise<SelectActionResponse> {
  try {
    const agent = agents.get(request.agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const epsilon = request.epsilon ?? agent.hyperparameters.epsilon;
    const selection = await selectActionUsingPolicy(agent, request.state, epsilon);

    return { success: true, action: selection.action, selection };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Action selection failed', { agentId: request.agentId, error: message });
    return { success: false, error: message };
  }
}

async function selectActionUsingPolicy(
  agent: RLAgent,
  state: number[],
  epsilon: number
): Promise<ActionSelection> {
  const random = cryptoRandom();

  if (random < epsilon) {
    // Exploration: random action
    const action = Math.floor(cryptoRandom() * agent.actionSpace.actions.length);
    return {
      action,
      qValue: 0,
      policy: 'exploration',
      probabilities: agent.actionSpace.actions.map(() => 1 / agent.actionSpace.actions.length),
    };
  }

  // Exploitation: use policy
  const qValues = await computeQValues(agent, state);
  const bestAction = qValues.indexOf(Math.max(...qValues));

  return {
    action: bestAction,
    qValue: qValues[bestAction],
    policy: 'exploitation',
    probabilities: softmax(qValues),
  };
}

async function computeQValues(agent: RLAgent, state: number[]): Promise<number[]> {
  if (agent.type === 'q_learning') {
    // Q-table lookup (simplified)
    const qTable = agent.policy.parameters['q_table'] || [];
    const stateHash = hashState(state);
    const existingQ: number[] = Array.isArray(qTable[stateHash])
      ? qTable[stateHash] as number[]
      : Array(agent.actionSpace.actions.length).fill(0);

    if (existingQ.length === 0 || existingQ.every((v: number) => v === 0)) {
      return Array(agent.actionSpace.actions.length).fill(0);
    }

    return existingQ;
  } else {
    // Neural network forward pass (simplified)
    const hidden = relu(multiply(state, agent.policy.parameters['w1'] || []));
    const output = softmax(multiply(hidden, agent.policy.parameters['w2'] || []));
    return output;
  }
}

function hashState(state: number[]): number {
  // Simple state hashing
  return state.reduce((acc, val, idx) => acc + Math.round(val * Math.pow(10, idx)), 0) % 10000;
}

function relu(x: number[]): number[] {
  return x.map(v => Math.max(0, v));
}

function softmax(x: number[]): number[] {
  const maxX = Math.max(...x);
  const expX = x.map(v => Math.exp(v - maxX));
  const sumExpX = expX.reduce((a, b) => a + b, 0);
  return expX.map(v => v / sumExpX);
}

function multiply(vec: number[], mat: number[]): number[] {
  if (mat.length === 0) return [];
  const rows = Math.floor(mat.length / vec.length);
  const result: number[] = [];
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < vec.length; j++) {
      sum += vec[j] * mat[i * vec.length + j];
    }
    result.push(sum);
  }
  return result;
}

// ============================================
// EXPERIENCE & TRAINING
// ============================================

export async function addExperience(
  agentId: string,
  experience: Omit<Experience, 'id' | 'agentId' | 'timestamp'>
): Promise<Experience | null> {
  const agent = agents.get(agentId);
  const buffer = replayBuffers.get(agentId);
  if (!agent || !buffer) return null;

  const exp: Experience = {
    id: uuidv4(),
    agentId,
    ...experience,
    timestamp: new Date(),
  };

  // Add to buffer
  buffer.experiences.push(exp);
  if (buffer.experiences.length > buffer.capacity) {
    buffer.experiences.shift();
  }
  buffer.updatedAt = new Date();

  // Update agent metrics
  agent.training.totalSteps++;
  agent.training.currentEpisodeSteps++;

  return exp;
}

export async function updatePolicy(request: UpdatePolicyRequest): Promise<UpdatePolicyResponse> {
  try {
    const agent = agents.get(request.agentId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const buffer = replayBuffers.get(request.agentId);
    if (!buffer) {
      return { success: false, error: 'Replay buffer not found' };
    }

    // Add new experiences
    for (const exp of request.experiences) {
      await addExperience(request.agentId, exp);
    }

    // Compute loss and update policy
    const { loss, improvement } = await computePolicyUpdate(agent, buffer);

    // Update hyperparameters (epsilon decay)
    if (agent.hyperparameters.epsilon > agent.hyperparameters.epsilonMin) {
      agent.hyperparameters.epsilon *= agent.hyperparameters.epsilonDecay;
    }

    agent.metrics.explorationRate = agent.hyperparameters.epsilon;
    agent.training.lastTrainedAt = new Date();

    // Record policy update
    const update: PolicyUpdate = {
      id: uuidv4(),
      agentId: agent.id,
      episode: agent.training.episode,
      policySnapshot: JSON.parse(JSON.stringify(agent.policy.parameters)),
      improvement,
      method: getUpdateMethod(agent.type),
      loss,
      createdAt: new Date(),
    };
    policyUpdates.set(update.id, update);

    agents.set(agent.id, agent);

    return { success: true, improvement, loss };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Policy update failed', { agentId: request.agentId, error: message });
    return { success: false, error: message };
  }
}

async function computePolicyUpdate(agent: RLAgent, buffer: ReplayBuffer): Promise<{ loss: number; improvement: number }> {
  const batchSize = Math.min(agent.hyperparameters.batchSize, buffer.experiences.length);
  const batch = sampleBatch(buffer, batchSize);

  // Compute TD error
  let totalLoss = 0;
  let totalTdError = 0;

  for (const exp of batch) {
    const qValues = await computeQValues(agent, exp.state);
    const nextQValues = await computeQValues(agent, exp.nextState);

    const target = exp.reward + agent.hyperparameters.discountFactor * Math.max(...nextQValues) * (exp.done ? 0 : 1);
    const currentQ = qValues[exp.action];
    const tdError = target - currentQ;

    totalLoss += Math.pow(tdError, 2);
    totalTdError += Math.abs(tdError);

    // Update Q-value estimate (simplified)
    const learningRate = agent.hyperparameters.learningRate;
    qValues[exp.action] = currentQ + learningRate * tdError;
  }

  // Update policy parameters (simplified gradient descent)
  const avgLoss = totalLoss / batch.length;
  const avgTdError = totalTdError / batch.length;

  // Adjust parameters based on loss (simplified)
  const gradientScale = avgLoss * 0.01;
  for (const key of Object.keys(agent.policy.parameters)) {
    agent.policy.parameters[key] = agent.policy.parameters[key].map(
      (v: number) => v - gradientScale * (cryptoRandom() - 0.5)
    );
  }

  const improvement = avgTdError > 0 ? Math.min(1, 0.1 / avgTdError) : 0;

  return { loss: avgLoss, improvement };
}

function sampleBatch(buffer: ReplayBuffer, batchSize: number): Experience[] {
  const experiences = buffer.experiences;
  const batch: Experience[] = [];

  for (let i = 0; i < batchSize && experiences.length > 0; i++) {
    const idx = Math.floor(cryptoRandom() * experiences.length);
    batch.push(experiences[idx]);
  }

  return batch;
}

function getUpdateMethod(agentType: AgentType): PolicyUpdate['method'] {
  switch (agentType) {
    case 'q_learning':
      return 'q_update';
    case 'dqn':
    case 'dqn_per':
      return 'gradient_descent';
    case 'policy_gradient':
      return 'policy_gradient';
    case 'actor_critic':
      return 'actor_critic';
    case 'ppo':
      return 'ppo_clip';
    default:
      return 'gradient_descent';
  }
}

// ============================================
// TRAINING
// ============================================

export async function trainAgent(request: TrainAgentRequest): Promise<TrainAgentResponse> {
  try {
    const agent = agents.get(request.agentId);
    const env = environments.get(request.environmentId);

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    if (!env) {
      return { success: false, error: 'Environment not found' };
    }

    agent.training.status = 'collecting';
    agent.training.startedAt = new Date();
    agents.set(agent.id, agent);

    const trainingId = uuidv4();

    // Start training asynchronously
    setImmediate(() => runTrainingLoop(agent, env, request.episodes, request.maxStepsPerEpisode || 1000));

    logger.info('Training started', { agentId: agent.id, environmentId: request.environmentId, episodes: request.episodes });

    return { success: true, trainingId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Training failed to start', { error: message });
    return { success: false, error: message };
  }
}

async function runTrainingLoop(
  agent: RLAgent,
  env: Environment,
  totalEpisodes: number,
  maxSteps: number
): Promise<void> {
  for (let episode = agent.training.episode; episode < totalEpisodes; episode++) {
    const episodeResult = await runEpisode(agent, env, maxSteps);

    // Update metrics
    agent.training.episode = episode + 1;
    agent.metrics.totalEpisodes++;
    agent.metrics.recentRewards.push(episodeResult.totalReward);

    if (agent.metrics.recentRewards.length > 100) {
      agent.metrics.recentRewards.shift();
    }

    agent.metrics.avgReward =
      agent.metrics.recentRewards.reduce((a, b) => a + b, 0) / agent.metrics.recentRewards.length;

    if (episodeResult.totalReward > agent.metrics.bestReward) {
      agent.metrics.bestReward = episodeResult.totalReward;
    }

    // Update policy periodically
    if (agent.training.episode % agent.hyperparameters.targetUpdateFrequency === 0) {
      agent.training.status = 'training';
      const buffer = replayBuffers.get(agent.id);
      if (buffer && buffer.experiences.length > agent.hyperparameters.batchSize) {
        await computePolicyUpdate(agent, buffer);
      }
      agent.training.status = 'collecting';
    }

    agents.set(agent.id, agent);

    // Log progress
    if (episode % 10 === 0) {
      logger.info('Training progress', {
        episode: agent.training.episode,
        totalEpisodes,
        avgReward: agent.metrics.avgReward.toFixed(2),
        bestReward: agent.metrics.bestReward.toFixed(2),
        explorationRate: agent.metrics.explorationRate.toFixed(4),
      });
    }
  }

  agent.training.status = 'completed';
  agent.training.pausedAt = new Date();
  agents.set(agent.id, agent);

  logger.info('Training completed', { agentId: agent.id, totalEpisodes });
}

async function runEpisode(agent: RLAgent, env: Environment, maxSteps: number): Promise<EpisodeResult> {
  const startTime = Date.now();
  let state = initializeState(env);
  let totalReward = 0;
  const trajectory: number[][] = [state];
  const rewards: number[] = [];

  for (let step = 0; step < maxSteps; step++) {
    // Select action
    const selection = await selectActionUsingPolicy(agent, state, agent.hyperparameters.epsilon);

    // Take step in environment (simplified)
    const { nextState, reward, done } = simulateEnvironmentStep(env, state, selection.action);

    // Add experience
    await addExperience(agent.id, {
      state,
      action: selection.action,
      reward,
      nextState,
      done,
    });

    totalReward += reward;
    rewards.push(reward);
    trajectory.push(nextState);

    if (done) break;
    state = nextState;
  }

  return {
    episode: agent.training.episode,
    totalReward,
    steps: trajectory.length - 1,
    duration: Date.now() - startTime,
    finalState: state,
    trajectory,
    rewards,
    completed: true,
  };
}

function initializeState(env: Environment): number[] {
  return env.stateSpace.dimensions.map((dim, i) => {
    const bounds = env.stateSpace.bounds?.[dim];
    if (bounds) {
      return bounds.min + cryptoRandom() * (bounds.max - bounds.min);
    }
    return cryptoRandom();
  });
}

function simulateEnvironmentStep(
  env: Environment,
  state: number[],
  action: number
): { nextState: number[]; reward: number; done: boolean } {
  // Simplified environment simulation
  const nextState = state.map((s, i) => {
    const delta = (cryptoRandom() - 0.5) * 0.1 + (action === i ? 0.1 : 0);
    return Math.max(0, Math.min(1, s + delta));
  });

  // Simple reward function
  const reward = state.reduce((acc, s) => acc + s, 0) / state.length;

  const done = cryptoRandom() < 0.05; // 5% chance of episode ending

  return { nextState, reward, done };
}

// ============================================
// EVALUATION
// ============================================

export async function evaluateAgent(request: EvaluateAgentRequest): Promise<EvaluateAgentResponse> {
  try {
    const agent = agents.get(request.agentId);
    const env = environments.get(request.environmentId);

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    if (!env) {
      return { success: false, error: 'Environment not found' };
    }

    const results: EpisodeResult[] = [];
    const originalEpsilon = agent.hyperparameters.epsilon;

    // Disable exploration during evaluation
    agent.hyperparameters.epsilon = 0;

    for (let i = 0; i < request.episodes; i++) {
      const result = await runEpisode(agent, env, 1000);
      results.push(result);
    }

    // Restore exploration
    agent.hyperparameters.epsilon = originalEpsilon;

    // Compute metrics
    const metrics = computeEvaluationMetrics(results);

    logger.info('Evaluation completed', {
      agentId: agent.id,
      episodes: request.episodes,
      avgReward: metrics.avgReward.toFixed(2),
    });

    return { success: true, results, metrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Evaluation failed', { error: message });
    return { success: false, error: message };
  }
}

function computeEvaluationMetrics(results: EpisodeResult[]): Record<string, number> {
  const rewards = results.map(r => r.totalReward);
  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const maxReward = Math.max(...rewards);
  const minReward = Math.min(...rewards);
  const stdReward = Math.sqrt(
    rewards.reduce((sum, r) => sum + Math.pow(r - avgReward, 2), 0) / rewards.length
  );

  return {
    avgReward,
    maxReward,
    minReward,
    stdReward,
    totalEpisodes: results.length,
    avgSteps: results.reduce((sum, r) => sum + r.steps, 0) / results.length,
  };
}

// ============================================
// EXPERIMENTS
// ============================================

export async function runExperiment(request: RunExperimentRequest): Promise<RunExperimentResponse> {
  try {
    const experiment: Experiment = {
      id: uuidv4(),
      name: request.name,
      description: request.description || '',
      agentIds: request.agentIds,
      variantPolicies: request.variantPolicies || [],
      trafficSplit: request.trafficSplit,
      status: 'running',
    };

    experiments.set(experiment.id, experiment);

    // Run experiment asynchronously
    setImmediate(() => executeExperiment(experiment.id, request));

    logger.info('Experiment started', { experimentId: experiment.id, name: request.name });

    return { success: true, experiment };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

async function executeExperiment(
  experimentId: string,
  request: RunExperimentRequest
): Promise<void> {
  const experiment = experiments.get(experimentId);
  if (!experiment) return;

  try {
    // Evaluate each variant
    const variantResults = await Promise.all(
      request.agentIds.map((agentId, idx) =>
        evaluateAgent({ agentId, environmentId: 'default', episodes: 10 })
      )
    );

    // Determine winner
    const avgRewards = variantResults.map(r => r.metrics?.avgReward || 0);
    const winner = avgRewards.indexOf(Math.max(...avgRewards));

    experiment.results = {
      variantRewards: avgRewards,
      winner,
      improvement: avgRewards[winner] - (avgRewards[0] || 0),
    };
    experiment.status = 'completed';

    experiments.set(experimentId, experiment);

    logger.info('Experiment completed', {
      experimentId,
      winner: winner,
      improvement: (experiment.results as { improvement: number })?.improvement?.toFixed(2),
    });
  } catch (error) {
    experiment.status = 'failed';
    experiments.set(experimentId, experiment);
  }
}

// ============================================
// CONVERGENCE & MONITORING
// ============================================

export function getConvergenceMetrics(agentId: string, windowSize = 100): ConvergenceMetrics | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  const recentRewards = agent.metrics.recentRewards.slice(-windowSize);
  const avgReward = recentRewards.length > 0
    ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length
    : 0;
  const stdReward = recentRewards.length > 0
    ? Math.sqrt(recentRewards.reduce((sum, r) => sum + Math.pow(r - avgReward, 2), 0) / recentRewards.length)
    : 0;

  // Calculate trend
  let trend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (recentRewards.length >= 10) {
    const firstHalf = recentRewards.slice(0, recentRewards.length / 2);
    const secondHalf = recentRewards.slice(recentRewards.length / 2);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = (secondAvg - firstAvg) / Math.abs(firstAvg || 1);

    if (diff > 0.05) trend = 'improving';
    else if (diff < -0.05) trend = 'degrading';
  }

  return {
    agentId,
    windowSize,
    avgReward,
    stdReward,
    movingAvg: avgReward,
    trend,
    converged: stdReward < 0.1 && Math.abs(avgReward - agent.metrics.bestReward) < 0.01,
  };
}

export function getTrainingMonitor(agentId: string): TrainingMonitor[] {
  return trainingMonitors.get(agentId) || [];
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus(): HealthStatus {
  return {
    status: 'healthy',
    uptime: Date.now(),
    activeAgents: Array.from(agents.values()).filter(a => a.training.status !== 'idle').length,
    totalEpisodes: Array.from(agents.values()).reduce((sum, a) => sum + a.metrics.totalEpisodes, 0),
    totalExperiences: Array.from(replayBuffers.values()).reduce((sum, b) => sum + b.experiences.length, 0),
    activeOptimizations: Array.from(agents.values()).filter(a => a.training.status === 'training').length,
    lastProcessed: new Date(),
  };
}

export function getStats(): ServiceStats {
  const byType: Record<string, number> = {};
  agents.forEach(a => {
    byType[a.type] = (byType[a.type] || 0) + 1;
  });

  const avgReward = Array.from(agents.values())
    .filter(a => a.metrics.avgReward !== 0)
    .reduce((sum, a) => sum + a.metrics.avgReward, 0) / Math.max(1, Array.from(agents.values()).length);

  return {
    totalAgents: agents.size,
    totalEnvironments: environments.size,
    totalExperiments: experiments.size,
    totalExperiences: Array.from(replayBuffers.values()).reduce((sum, b) => sum + b.experiences.length, 0),
    avgTrainingTime: 0,
    avgReward,
    byType,
  };
}

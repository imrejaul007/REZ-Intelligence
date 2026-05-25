/**
 * REZ Reinforcement Optimizer - Main Server
 *
 * Reinforcement Learning Layer - Self-improving AI with reward-based optimization
 * Port: 4147
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger';
import {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  selectAction,
  addExperience,
  updatePolicy,
  trainAgent,
  evaluateAgent,
  runExperiment,
  getConvergenceMetrics,
  getTrainingMonitor,
  getHealthStatus,
  getStats,
} from './rlService';
import type { AgentType } from './types';

const app = express();
const PORT = process.env.PORT || 4147;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { query: req.query, ip: req.ip });
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const stateSpaceSchema = z.object({
  dimensions: z.array(z.string()),
  continuous: z.array(z.string()).optional(),
  discrete: z.array(z.string()).optional(),
  bounds: z.record(z.object({ min: z.number(), max: z.number() })).optional(),
});

const actionSpaceSchema = z.object({
  type: z.enum(['discrete', 'continuous', 'hybrid']),
  actions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['discrete', 'continuous']),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.enum(['float', 'int', 'categorical']),
      min: z.number().optional(),
      max: z.number().optional(),
      options: z.array(z.string()).optional(),
    })).optional(),
  })),
  bounds: z.record(z.object({ min: z.number(), max: z.number() })).optional(),
});

const hyperparametersSchema = z.object({
  learningRate: z.number().optional(),
  discountFactor: z.number().optional(),
  epsilon: z.number().optional(),
  epsilonDecay: z.number().optional(),
  epsilonMin: z.number().optional(),
  batchSize: z.number().optional(),
  replayBufferSize: z.number().optional(),
  targetUpdateFrequency: z.number().optional(),
  gradientClipNorm: z.number().optional(),
  entropyCoef: z.number().optional(),
  valueCoef: z.number().optional(),
});

const createAgentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['q_learning', 'dqn', 'policy_gradient', 'actor_critic', 'ppo', 'dqn_per', 'td3', 'sac']),
  description: z.string().optional(),
  stateSpace: stateSpaceSchema,
  actionSpace: actionSpaceSchema,
  hyperparameters: hyperparametersSchema.optional(),
});

const selectActionSchema = z.object({
  agentId: z.string().min(1),
  state: z.array(z.number()),
  epsilon: z.number().optional(),
});

const addExperienceSchema = z.object({
  state: z.array(z.number()),
  action: z.number(),
  reward: z.number(),
  nextState: z.array(z.number()),
  done: z.boolean(),
  priority: z.number().optional(),
});

const updatePolicySchema = z.object({
  agentId: z.string().min(1),
  experiences: z.array(addExperienceSchema),
});

const trainAgentSchema = z.object({
  agentId: z.string().min(1),
  environmentId: z.string().min(1),
  episodes: z.number().min(1).max(10000),
  maxStepsPerEpisode: z.number().optional(),
  evaluationFrequency: z.number().optional(),
  saveFrequency: z.number().optional(),
});

const evaluateAgentSchema = z.object({
  agentId: z.string().min(1),
  environmentId: z.string().min(1),
  episodes: z.number().min(1).max(1000),
  render: z.boolean().optional(),
});

const runExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  agentIds: z.array(z.string()),
  variantPolicies: z.array(z.object({
    type: z.enum(['epsilon_greedy', 'softmax', 'ucb', 'thompson_sampling', 'gradient']),
    parameters: z.record(z.array(z.number())),
    updateFrequency: z.number(),
    architecture: z.object({
      layers: z.array(z.object({
        type: z.enum(['dense', 'conv1d', 'lstm', 'gru', 'attention']),
        units: z.number(),
        activation: z.string().optional(),
        dropout: z.number().optional(),
      })),
      activation: z.string().optional(),
      optimizer: z.string().optional(),
      learningRate: z.number().optional(),
      lossFunction: z.string().optional(),
    }).optional(),
    targetParameters: z.record(z.array(z.number())).optional(),
  })).optional(),
  trafficSplit: z.array(z.number()),
  duration: z.number(),
});

// ============================================
// AGENT ENDPOINTS
// ============================================

/**
 * POST /api/agents
 * Create a new RL agent
 */
app.post('/api/agents', async (req: Request, res: Response) => {
  try {
    const validation = createAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await createAgent(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Agent creation error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/agents
 * List all RL agents
 */
app.get('/api/agents', async (req: Request, res: Response) => {
  const { type } = req.query;
  const agents = await listAgents(type as AgentType | undefined);
  res.json({ success: true, agents });
});

/**
 * GET /api/agents/:agentId
 * Get agent details
 */
app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
  const agent = await getAgent(req.params.agentId);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, agent });
});

/**
 * PUT /api/agents/:agentId
 * Update agent
 */
app.put('/api/agents/:agentId', async (req: Request, res: Response) => {
  const agent = await updateAgent(req.params.agentId, req.body);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, agent });
});

// ============================================
// ACTION SELECTION
// ============================================

/**
 * POST /api/agents/:agentId/select
 * Select action for a given state
 */
app.post('/api/agents/:agentId/select', async (req: Request, res: Response) => {
  try {
    const validation = selectActionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await selectAction(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Action selection error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// EXPERIENCE & POLICY
// ============================================

/**
 * POST /api/experiences
 * Add experience to replay buffer
 */
app.post('/api/experiences', async (req: Request, res: Response) => {
  try {
    const { agentId, ...experience } = { agentId: req.body.agentId || 'default', ...req.body };
    const result = await addExperience(agentId, experience);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Agent or buffer not found' });
    }
    res.status(201).json({ success: true, experience: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/policy/update
 * Update agent policy
 */
app.post('/api/policy/update', async (req: Request, res: Response) => {
  try {
    const validation = updatePolicySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await updatePolicy(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// TRAINING & EVALUATION
// ============================================

/**
 * POST /api/training/start
 * Start agent training
 */
app.post('/api/training/start', async (req: Request, res: Response) => {
  try {
    const validation = trainAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await trainAgent(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/training/evaluate
 * Evaluate trained agent
 */
app.post('/api/training/evaluate', async (req: Request, res: Response) => {
  try {
    const validation = evaluateAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await evaluateAgent(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/training/:agentId/convergence
 * Get convergence metrics
 */
app.get('/api/training/:agentId/convergence', (req: Request, res: Response) => {
  const { windowSize } = req.query;
  const metrics = getConvergenceMetrics(req.params.agentId, Number(windowSize) || 100);
  if (!metrics) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, ...metrics });
});

/**
 * GET /api/training/:agentId/monitor
 * Get training monitor data
 */
app.get('/api/training/:agentId/monitor', (req: Request, res: Response) => {
  const monitor = getTrainingMonitor(req.params.agentId);
  res.json({ success: true, monitor });
});

// ============================================
// EXPERIMENTS
// ============================================

/**
 * POST /api/experiments
 * Run an experiment
 */
app.post('/api/experiments', async (req: Request, res: Response) => {
  try {
    const validation = runExperimentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await runExperiment(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/experiments
 * List experiments
 */
app.get('/api/experiments', (_req: Request, res: Response) => {
  res.json({ success: true, experiments: [] });
});

/**
 * GET /api/experiments/:experimentId
 * Get experiment details
 */
app.get('/api/experiments/:experimentId', (req: Request, res: Response) => {
  res.json({ success: true, experimentId: req.params.experimentId, experiment: null });
});

// ============================================
// ALGORITHMS
// ============================================

/**
 * GET /api/algorithms
 * List available RL algorithms
 */
app.get('/api/algorithms', (_req: Request, res: Response) => {
  res.json({
    success: true,
    algorithms: [
      { type: 'q_learning', name: 'Q-Learning', category: 'value-based', description: 'Classic tabular RL algorithm' },
      { type: 'dqn', name: 'Deep Q-Network', category: 'value-based', description: 'DQN with experience replay and target network' },
      { type: 'dqn_per', name: 'DQN with PER', category: 'value-based', description: 'DQN with Prioritized Experience Replay' },
      { type: 'policy_gradient', name: 'Policy Gradient', category: 'policy-based', description: 'REINFORCE algorithm' },
      { type: 'actor_critic', name: 'Actor-Critic', category: 'hybrid', description: 'Combines value and policy methods' },
      { type: 'ppo', name: 'PPO', category: 'policy-based', description: 'Proximal Policy Optimization' },
      { type: 'td3', name: 'TD3', category: 'policy-based', description: 'Twin Delayed DDPG for continuous control' },
      { type: 'sac', name: 'SAC', category: 'policy-based', description: 'Soft Actor-Critic' },
    ],
  });
});

// ============================================
// ENVIRONMENT TEMPLATES
// ============================================

/**
 * GET /api/environments/templates
 * List environment templates
 */
app.get('/api/environments/templates', (_req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      { type: 'user_engagement', name: 'User Engagement', description: 'Optimize user engagement metrics' },
      { type: 'pricing', name: 'Dynamic Pricing', description: 'Optimize pricing decisions' },
      { type: 'recommendation', name: 'Recommendation', description: 'Optimize recommendation strategy' },
      { type: 'inventory', name: 'Inventory Management', description: 'Optimize inventory decisions' },
      { type: 'routing', name: 'Smart Routing', description: 'Optimize routing decisions' },
      { type: 'resource_allocation', name: 'Resource Allocation', description: 'Optimize resource distribution' },
    ],
  });
});

// ============================================
// STATS & HEALTH
// ============================================

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = getHealthStatus();
  res.json({ success: true, ...health });
});

/**
 * GET /api/stats
 * Get service statistics
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({ success: true, ...stats });
});

/**
 * GET /api/stats/agents
 * Get agent statistics
 */
app.get('/api/stats/agents', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byType: {},
    total: 0,
    active: 0,
    avgReward: 0,
  });
});

/**
 * GET /api/stats/training
 * Get training statistics
 */
app.get('/api/stats/training', (_req: Request, res: Response) => {
  res.json({
    success: true,
    totalEpisodes: 0,
    totalExperiences: 0,
    avgReward: 0,
    convergenceRate: 0,
  });
});

// ============================================
// ROOT
// ============================================

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Reinforcement Optimizer',
    version: '1.0.0',
    description: 'Reinforcement Learning Layer - Self-improving AI with reward-based optimization',
    port: PORT,
    algorithms: ['q_learning', 'dqn', 'policy_gradient', 'actor_critic', 'ppo', 'dqn_per', 'td3', 'sac'],
    endpoints: {
      agents: [
        'POST /api/agents - Create agent',
        'GET /api/agents - List agents',
        'GET /api/agents/:agentId - Get agent',
        'PUT /api/agents/:agentId - Update agent',
        'POST /api/agents/:agentId/select - Select action',
      ],
      experiences: [
        'POST /api/experiences - Add experience',
      ],
      policy: [
        'POST /api/policy/update - Update policy',
      ],
      training: [
        'POST /api/training/start - Start training',
        'POST /api/training/evaluate - Evaluate agent',
        'GET /api/training/:agentId/convergence - Get convergence',
        'GET /api/training/:agentId/monitor - Get monitor data',
      ],
      experiments: [
        'POST /api/experiments - Run experiment',
        'GET /api/experiments - List experiments',
        'GET /api/experiments/:id - Get experiment',
      ],
      algorithms: [
        'GET /api/algorithms - List algorithms',
      ],
      environments: [
        'GET /api/environments/templates - List templates',
      ],
      stats: [
        'GET /api/stats - Get stats',
        'GET /api/stats/agents - Get agent stats',
        'GET /api/stats/training - Get training stats',
      ],
      health: [
        'GET /api/health - Health check',
      ],
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Reinforcement Optimizer started on port ${PORT}`);
});

export default app;

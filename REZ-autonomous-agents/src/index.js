'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Agent types
const AGENT_TYPES = {
  DEMAND_SIGNAL: 'demand_signal',
  SCARCITY: 'scarcity',
  PERSONALIZATION: 'personalization',
  ATTRIBUTION: 'attribution',
  ADAPTIVE_SCORING: 'adaptive_scoring',
  FEEDBACK_LOOP: 'feedback_loop',
  NETWORK_EFFECT: 'network_effect',
  REVENUE_ATTRIBUTION: 'revenue_attribution'
};

// Agent statuses
const AGENT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// MongoDB Schemas
const agentRunSchema = new mongoose.Schema({
  agentId: { type: String, required: true, index: true },
  agentType: { type: String, required: true, index: true },
  status: { type: String, enum: Object.values(AGENT_STATUS), default: 'idle' },
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  errors: [String],
  metrics: {
    recordsProcessed: Number,
    insightsGenerated: Number,
    actionsTaken: Number
  }
}, { timestamps: true });

agentRunSchema.index({ agentType: 1, createdAt: -1 });

const AgentRun = mongoose.model('AgentRun', agentRunSchema);

// Insight schema
const insightSchema = new mongoose.Schema({
  insightId: { type: String, required: true, unique: true, index: true },
  agentType: { type: String, required: true, index: true },
  type: { type: String, enum: ['trend', 'anomaly', 'opportunity', 'risk', 'prediction'] },
  title: String,
  description: String,
  data: mongoose.Schema.Types.Mixed,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  confidence: { type: Number, min: 0, max: 1 },
  sourceRun: String,
  status: { type: String, enum: ['new', 'reviewing', 'actioned', 'dismissed'], default: 'new' },
  actionedAt: Date
}, { timestamps: true });

insightSchema.index({ agentType: 1, createdAt: -1 });
insightSchema.index({ priority: 1, status: 1 });

const Insight = mongoose.model('Insight', insightSchema);

// Action schema
const actionSchema = new mongoose.Schema({
  actionId: { type: String, required: true, unique: true, index: true },
  agentType: { type: String, required: true },
  type: String,
  target: mongoose.Schema.Types.Mixed,
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'executed', 'failed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  autoExecute: { type: Boolean, default: false },
  approvedBy: String,
  executedAt: Date,
  result: mongoose.Schema.Types.Mixed
}, { timestamps: true });

actionSchema.index({ status: 1, priority: 1 });

const Action = mongoose.model('Action', actionSchema);

// Base Agent class
class BaseAgent {
  constructor(type, config = {}) {
    this.type = type;
    this.config = config;
    this.status = AGENT_STATUS.IDLE;
    this.lastRun = null;
  }

  async run(input = {}) {
    this.status = AGENT_STATUS.RUNNING;
    const startTime = Date.now();

    const run = new AgentRun({
      agentId: `${this.type}_${Date.now()}`,
      agentType: this.type,
      status: AGENT_STATUS.RUNNING,
      startedAt: new Date(),
      input
    });

    try {
      await run.save();
      const output = await this.execute(input);

      run.status = AGENT_STATUS.COMPLETED;
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      run.output = output;
      await run.save();

      this.status = AGENT_STATUS.COMPLETED;
      this.lastRun = run;

      return output;
    } catch (err) {
      run.status = AGENT_STATUS.ERROR;
      run.errors = [err.message];
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      await run.save();

      this.status = AGENT_STATUS.ERROR;
      logger.error(`${this.type} agent failed`, { error: err.message });

      throw err;
    }
  }

  async execute(input) {
    // Override in subclasses
    return { message: 'Override in subclass' };
  }

  async createInsight(type, title, description, data, priority = 'medium') {
    const insight = await Insight.create({
      insightId: `ins_${uuidv4()}`,
      agentType: this.type,
      type,
      title,
      description,
      data,
      priority,
      confidence: data.confidence || 0.7
    });

    logger.info('Insight created', { insightId: insight.insightId, type, title });

    return insight;
  }

  async createAction(type, target, payload, options = {}) {
    const action = await Action.create({
      actionId: `act_${uuidv4()}`,
      agentType: this.type,
      type,
      target,
      payload,
      priority: options.priority || 'medium',
      autoExecute: options.autoExecute || false
    });

    logger.info('Action created', { actionId: action.actionId, type, autoExecute: action.autoExecute });

    // Auto-execute if enabled and low priority
    if (action.autoExecute && action.priority === 'low') {
      await this.executeAction(action);
    }

    return action;
  }

  async executeAction(action) {
    action.status = 'executed';
    action.executedAt = new Date();
    await action.save();

    logger.info('Action executed', { actionId: action.actionId });

    return action;
  }
}

// 1. Demand Signal Agent
class DemandSignalAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.DEMAND_SIGNAL, { schedule: '*/5 * * * *' });
  }

  async execute(input = {}) {
    logger.info('DemandSignalAgent: Aggregating demand signals');

    // Simulate demand analysis
    const demandSignals = {
      timestamp: new Date(),
      totalDemand: Math.floor(Math.random() * 1000),
      byCategory: {
        restaurant: Math.floor(Math.random() * 500),
        hotel: Math.floor(Math.random() * 200),
        retail: Math.floor(Math.random() * 300)
      },
      trends: [
        { category: 'biryani', trend: 'up', velocity: 0.8 },
        { category: 'pizza', trend: 'stable', velocity: 0.5 }
      ],
      merchants: []
    };

    // Generate insights for high-demand categories
    for (const [category, demand] of Object.entries(demandSignals.byCategory)) {
      if (demand > 300) {
        await this.createInsight(
          'opportunity',
          `${category} demand surge`,
          `High demand detected in ${category} category (${demand} orders)`,
          { category, demand, velocity: 0.8 },
          'high'
        );
      }
    }

    return demandSignals;
  }
}

// 2. Scarcity Agent
class ScarcityAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.SCARCITY, { schedule: '*/1 * * * *' });
  }

  async execute(input = {}) {
    logger.info('ScarcityAgent: Analyzing supply/demand ratios');

    const scarcityData = {
      timestamp: new Date(),
      alerts: [],
      urgencySignals: []
    };

    // Simulate scarcity analysis
    const items = [
      { id: 'item_1', name: 'Premium Biryani', demand: 150, supply: 50, ratio: 3 },
      { id: 'item_2', name: 'Chicken Wings', demand: 80, supply: 75, ratio: 1.07 }
    ];

    for (const item of items) {
      if (item.ratio > 2) {
        scarcityData.alerts.push({
          type: 'high_demand_low_supply',
          item: item.name,
          severity: item.ratio > 3 ? 'critical' : 'high',
          message: `${item.name} is running low. Demand is ${item.ratio}x available supply.`
        });

        await this.createInsight(
          'risk',
          `${item.name} scarcity risk`,
          `Supply/demand ratio: ${item.ratio}. Consider increasing inventory.`,
          { item: item.name, ratio: item.ratio },
          item.ratio > 3 ? 'critical' : 'high'
        );
      }
    }

    return scarcityData;
  }
}

// 3. Personalization Agent
class PersonalizationAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.PERSONALIZATION, { schedule: null }); // Event-driven
  }

  async execute(input = {}) {
    logger.info('PersonalizationAgent: Analyzing user response patterns');

    const patterns = {
      timestamp: new Date(),
      segmentsAnalyzed: Math.floor(Math.random() * 10) + 5,
      aBTests: [
        { id: 'test_1', variant: 'A', conversion: 0.12, sample: 500 },
        { id: 'test_1', variant: 'B', conversion: 0.18, sample: 480 }
      ],
      winningVariants: []
    };

    // Identify winning variants
    for (const test of patterns.aBTests) {
      if (test.conversion > 0.15) {
        patterns.winningVariants.push({
          testId: test.id,
          variant: test.variant,
          lift: '+50%'
        });

        await this.createAction(
          'update_campaign',
          { testId: test.id },
          { variant: test.variant },
          { priority: 'high' }
        );
      }
    }

    return patterns;
  }
}

// 4. Attribution Agent
class AttributionAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.ATTRIBUTION, { schedule: null }); // Event-driven
  }

  async execute(input = {}) {
    logger.info('AttributionAgent: Multi-touch conversion attribution');

    const attribution = {
      timestamp: new Date(),
      conversions: Math.floor(Math.random() * 100) + 50,
      touchpoints: {
        push: 0.3,
        email: 0.2,
        sms: 0.15,
        inApp: 0.25,
        organic: 0.1
      },
      channelROI: {
        push: 2.5,
        email: 3.2,
        sms: 4.1,
        inApp: 2.8,
        organic: 1.0
      }
    };

    // Identify best performing channel
    const bestChannel = Object.entries(attribution.channelROI)
      .sort(([, a], [, b]) => b - a)[0];

    await this.createInsight(
      'opportunity',
      `Best channel: ${bestChannel[0]}`,
      `${bestChannel[0]} has highest ROI at ${bestChannel[1]}x`,
      { channel: bestChannel[0], roi: bestChannel[1] },
      'medium'
    );

    return attribution;
  }
}

// 5. Adaptive Scoring Agent
class AdaptiveScoringAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.ADAPTIVE_SCORING, { schedule: '0 * * * *' }); // Hourly
  }

  async execute(input = {}) {
    logger.info('AdaptiveScoringAgent: Retraining ML models');

    const scoring = {
      timestamp: new Date(),
      modelsUpdated: 3,
      accuracy: 0.85 + Math.random() * 0.1,
      improvements: [
        { model: 'churn_predictor', improvement: 0.05, newAccuracy: 0.88 },
        { model: 'reorder_predictor', improvement: 0.03, newAccuracy: 0.82 }
      ],
      features: [
        { name: 'days_since_last_order', importance: 0.4 },
        { name: 'order_frequency', importance: 0.3 },
        { name: 'avg_order_value', importance: 0.2 }
      ]
    };

    for (const model of scoring.improvements) {
      await this.createInsight(
        'trend',
        `${model.model} accuracy improved`,
        `New accuracy: ${(model.newAccuracy * 100).toFixed(1)}% (+${(model.improvement * 100).toFixed(0)}%)`,
        { model: model.model, accuracy: model.newAccuracy, improvement: model.improvement },
        'low'
      );
    }

    return scoring;
  }
}

// 6. Feedback Loop Agent
class FeedbackLoopAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.FEEDBACK_LOOP, { schedule: null }); // Event-driven
  }

  async execute(input = {}) {
    logger.info('FeedbackLoopAgent: Closed-loop optimization');

    const feedback = {
      timestamp: new Date(),
      loopsClosed: Math.floor(Math.random() * 20) + 10,
      driftDetected: false,
      corrections: []
    };

    // Simulate drift detection
    if (Math.random() > 0.8) {
      feedback.driftDetected = true;
      feedback.corrections.push({
        type: 'threshold_adjustment',
        model: 'reorder_predictor',
        change: '-5%'
      });

      await this.createInsight(
        'anomaly',
        'Model drift detected',
        'Reorder predictor showing signs of drift. Automatic correction applied.',
        { model: 'reorder_predictor', correction: '-5%' },
        'high'
      );
    }

    return feedback;
  }
}

// 7. Network Effect Agent
class NetworkEffectAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.NETWORK_EFFECT, { schedule: '0 0 * * *' }); // Daily
  }

  async execute(input = {}) {
    logger.info('NetworkEffectAgent: Collaborative filtering update');

    const network = {
      timestamp: new Date(),
      usersAnalyzed: Math.floor(Math.random() * 10000) + 5000,
      similaritiesComputed: Math.floor(Math.random() * 50000) + 20000,
      newClusters: Math.floor(Math.random() * 5) + 1,
      clusters: [
        { id: 1, size: 250, type: 'foodies', avgOrderValue: 450 },
        { id: 2, size: 180, type: 'budget_diners', avgOrderValue: 200 },
        { id: 3, size: 120, type: 'premium_users', avgOrderValue: 1200 }
      ]
    };

    // Generate cluster insights
    for (const cluster of network.clusters) {
      await this.createInsight(
        'trend',
        `New user cluster: ${cluster.type}`,
        `${cluster.size} users with avg order value ₹${cluster.avgOrderValue}`,
        { cluster },
        'low'
      );
    }

    return network;
  }
}

// 8. Revenue Attribution Agent
class RevenueAttributionAgent extends BaseAgent {
  constructor() {
    super(AGENT_TYPES.REVENUE_ATTRIBUTION, { schedule: '*/15 * * * *' }); // Every 15 min
  }

  async execute(input = {}) {
    logger.info('RevenueAttributionAgent: GMV tracking and ROI analysis');

    const revenue = {
      timestamp: new Date(),
      gmv: {
        total: Math.floor(Math.random() * 1000000) + 500000,
        bySource: {
          organic: 0.3,
          marketing: 0.5,
          repeat: 0.2
        }
      },
      roi: {
        nudge_campaigns: 3.2,
        loyalty_program: 2.8,
        personalization: 4.1
      },
      topAgents: [
        { agent: 'DemandSignalAgent', revenue: 45000, conversions: 150 },
        { agent: 'PersonalizationAgent', revenue: 38000, conversions: 120 },
        { agent: 'ScareAgent', revenue: 28000, conversions: 90 }
      ]
    };

    // Track ROI changes
    for (const [program, roi] of Object.entries(revenue.roi)) {
      if (roi > 3) {
        await this.createInsight(
          'opportunity',
          `${program} showing strong ROI`,
          `ROI: ${roi}x - Consider increasing investment`,
          { program, roi },
          'medium'
        );
      }
    }

    return revenue;
  }
}

// Agent Manager
class AgentManager {
  constructor() {
    this.agents = {
      [AGENT_TYPES.DEMAND_SIGNAL]: new DemandSignalAgent(),
      [AGENT_TYPES.SCARCITY]: new ScarcityAgent(),
      [AGENT_TYPES.PERSONALIZATION]: new PersonalizationAgent(),
      [AGENT_TYPES.ATTRIBUTION]: new AttributionAgent(),
      [AGENT_TYPES.ADAPTIVE_SCORING]: new AdaptiveScoringAgent(),
      [AGENT_TYPES.FEEDBACK_LOOP]: new FeedbackLoopAgent(),
      [AGENT_TYPES.NETWORK_EFFECT]: new NetworkEffectAgent(),
      [AGENT_TYPES.REVENUE_ATTRIBUTION]: new RevenueAttributionAgent()
    };

    this.schedules = {
      [AGENT_TYPES.DEMAND_SIGNAL]: '*/5 * * * *',
      [AGENT_TYPES.SCARCITY]: '*/1 * * * *',
      [AGENT_TYPES.ADAPTIVE_SCORING]: '0 * * * *',
      [AGENT_TYPES.NETWORK_EFFECT]: '0 0 * * *',
      [AGENT_TYPES.REVENUE_ATTRIBUTION]: '*/15 * * * *'
    };
  }

  async runAgent(agentType) {
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    return agent.run();
  }

  async runAllAgents() {
    const results = {};
    for (const type of Object.keys(this.agents)) {
      try {
        results[type] = await this.runAgent(type);
      } catch (err) {
        results[type] = { error: err.message };
      }
    }
    return results;
  }

  getAgentStatus() {
    const status = {};
    for (const [type, agent] of Object.entries(this.agents)) {
      status[type] = {
        status: agent.status,
        lastRun: agent.lastRun?.completedAt,
        schedule: this.schedules[type] || null
      };
    }
    return status;
  }

  setupSchedules() {
    for (const [agentType, cronExpr] of Object.entries(this.schedules)) {
      if (cronExpr) {
        cron.schedule(cronExpr, async () => {
          logger.info(`Scheduled run: ${agentType}`);
          try {
            await this.runAgent(agentType);
          } catch (err) {
            logger.error(`Scheduled ${agentType} failed`, { error: err.message });
          }
        });
        logger.info(`Scheduled ${agentType}: ${cronExpr}`);
      }
    }
  }
}

const agentManager = new AgentManager();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'autonomous-agents',
    agents: Object.keys(AGENT_TYPES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Get all agent statuses
app.get('/api/agents/status', (req, res) => {
  res.json({ success: true, agents: agentManager.getAgentStatus() });
});

// Run specific agent
app.post('/api/agents/:agentType/run', asyncHandler(async (req, res) => {
  const { agentType } = req.params;
  const result = await agentManager.runAgent(agentType);
  res.json({ success: true, agentType, result });
}));

// Run all agents
app.post('/api/agents/run', asyncHandler(async (req, res) => {
  const results = await agentManager.runAllAgents();
  res.json({ success: true, results });
}));

// Get insights
app.get('/api/insights', asyncHandler(async (req, res) => {
  const { agentType, priority, status, limit = 50 } = req.query;

  const query = {};
  if (agentType) query.agentType = agentType;
  if (priority) query.priority = priority;
  if (status) query.status = status;

  const insights = await Insight.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, insights, count: insights.length });
}));

// Get actions
app.get('/api/actions', asyncHandler(async (req, res) => {
  const { agentType, status, priority } = req.query;

  const query = {};
  if (agentType) query.agentType = agentType;
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const actions = await Action.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, actions, count: actions.length });
}));

// Approve/reject action
app.patch('/api/actions/:actionId', asyncHandler(async (req, res) => {
  const { actionId } = req.params;
  const { status, approvedBy } = req.body;

  const action = await Action.findOneAndUpdate(
    { actionId },
    {
      $set: {
        status,
        approvedBy,
        ...(status === 'executed' ? { executedAt: new Date() } : {})
      }
    },
    { new: true }
  );

  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  res.json({ success: true, action });
}));

// Update insight status
app.patch('/api/insights/:insightId', asyncHandler(async (req, res) => {
  const { insightId } = req.params;
  const { status } = req.body;

  const insight = await Insight.findOneAndUpdate(
    { insightId },
    {
      $set: {
        status,
        ...(status === 'actioned' ? { actionedAt: new Date() } : {})
      }
    },
    { new: true }
  );

  if (!insight) {
    return res.status(404).json({ error: 'Insight not found' });
  }

  res.json({ success: true, insight });
}));

// Get agent run history
app.get('/api/agents/:agentType/history', asyncHandler(async (req, res) => {
  const { agentType } = req.params;
  const { limit = 20 } = req.query;

  const runs = await AgentRun.find({ agentType })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, runs, count: runs.length });
}));

// Analytics
app.get('/api/analytics', asyncHandler(async (req, res) => {
  const [insightStats, actionStats, agentStats] = await Promise.all([
    Insight.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    Action.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    AgentRun.aggregate([
      {
        $group: {
          _id: '$agentType',
          runs: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    insights: insightStats,
    actions: actionStats,
    agents: agentStats
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4062;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Setup agent schedules
    agentManager.setupSchedules();

    app.listen(PORT, () => {
      logger.info(`Autonomous Agents Service started on port ${PORT}`);
      logger.info(`Agents: ${Object.keys(agentManager.agents).join(', ')}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

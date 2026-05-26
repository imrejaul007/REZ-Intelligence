'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { randomInt, randomUUID } = require('crypto');

// Logger setup
const logger = {
  info: (msg, meta = {}) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`, JSON.stringify(meta)),
  error: (msg, meta = {}) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, JSON.stringify(meta)),
  warn: (msg, meta = {}) => console.warn(`[${new Date().toISOString()}] WARN: ${msg}`, JSON.stringify(meta)),
  debug: (msg, meta = {}) => console.debug(`[${new Date().toISOString()}] DEBUG: ${msg}`, JSON.stringify(meta))
};

// Agent Types
const AGENT_TYPES = {
  DEMAND_SIGNAL: 'demand_signal',
  SCARCITY: 'scarcity',
  PRICE_ELASTICITY: 'price_elasticity',
  REORDER_PREDICTOR: 'reorder_predictor',
  TASTE_EVOLUTION: 'taste_evolution',
  CHURN_RISK: 'churn_risk',
  LTV_PREDICTOR: 'ltv_predictor',
  INVENTORY_ALERT: 'inventory_alert',
  DEMAND_FORECAST: 'demand_forecast',
  COMPETITOR_MONITOR: 'competitor_monitor',
  TREND_DETECTOR: 'trend_detector',
  PRICE_OPTIMIZER: 'price_optimizer',
  OFFER_MATCHER: 'offer_matcher',
  CROSS_SELL: 'cross_sell',
  URGENCY_TRIGGER: 'urgency_trigger'
};

// Agent Status
const AGENT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Insight Types
const INSIGHT_TYPES = {
  TREND: 'trend',
  ANOMALY: 'anomaly',
  OPPORTUNITY: 'opportunity',
  RISK: 'risk',
  PREDICTION: 'prediction',
  ALERT: 'alert',
  RECOMMENDATION: 'recommendation'
};

// MongoDB Connection
let mongoConnection = null;
let redisClient = null;

// Schemas
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

const AgentRun = mongoose.connection?.models?.AgentRun || mongoose.model('AgentRun', agentRunSchema);

const insightSchema = new mongoose.Schema({
  insightId: { type: String, required: true, unique: true, index: true },
  agentType: { type: String, required: true, index: true },
  type: { type: String, enum: Object.values(INSIGHT_TYPES) },
  title: String,
  description: String,
  data: mongoose.Schema.Types.Mixed,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  confidence: { type: Number, min: 0, max: 1 },
  sourceRun: String,
  status: { type: String, enum: ['new', 'reviewing', 'actioned', 'dismissed'], default: 'new' },
  actionedAt: Date,
  expiresAt: Date
}, { timestamps: true });

insightSchema.index({ agentType: 1, createdAt: -1 });
insightSchema.index({ priority: 1, status: 1 });
insightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Insight = mongoose.connection?.models?.Insight || mongoose.model('Insight', insightSchema);

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

const Action = mongoose.connection?.models?.Action || mongoose.model('Action', actionSchema);

// Base Agent Class
class BaseAgent {
  constructor(name, schedule) {
    this.name = name;
    this.schedule = schedule;
    this.status = AGENT_STATUS.IDLE;
    this.lastRun = null;
    this.executionCount = 0;
    this.errorCount = 0;
    this.lastError = null;
    this.insightsGenerated = 0;
    this.actionsCreated = 0;
  }

  async execute() {
    throw new Error(`${this.name} must implement execute()`);
  }

  async run(input = {}) {
    this.status = AGENT_STATUS.RUNNING;
    const startTime = Date.now();
    const runId = `${this.name}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    const run = new AgentRun({
      agentId: runId,
      agentType: this.name,
      status: AGENT_STATUS.RUNNING,
      startedAt: new Date(),
      input,
      metrics: {
        recordsProcessed: 0,
        insightsGenerated: 0,
        actionsTaken: 0
      }
    });

    try {
      await run.save();
      logger.info(`${this.name}: Starting execution`, { runId });

      const output = await this.execute(input);

      run.status = AGENT_STATUS.COMPLETED;
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      run.output = output;
      run.metrics = {
        recordsProcessed: output.recordsProcessed || 0,
        insightsGenerated: this.insightsGenerated,
        actionsTaken: this.actionsCreated
      };
      await run.save();

      this.status = AGENT_STATUS.COMPLETED;
      this.lastRun = run;
      this.executionCount++;

      logger.info(`${this.name}: Completed successfully`, {
        runId,
        duration: run.duration,
        insightsGenerated: this.insightsGenerated,
        actionsCreated: this.actionsCreated
      });

      return output;
    } catch (err) {
      run.status = AGENT_STATUS.ERROR;
      run.errors = [err.message, err.stack];
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      await run.save();

      this.status = AGENT_STATUS.ERROR;
      this.lastError = err.message;
      this.errorCount++;

      logger.error(`${this.name}: Execution failed`, { runId, error: err.message });

      throw err;
    }
  }

  async createInsight(type, title, description, data = {}, priority = 'medium', options = {}) {
    const insight = await Insight.create({
      insightId: `ins_${uuidv4()}`,
      agentType: this.name,
      type,
      title,
      description,
      data,
      priority,
      confidence: data.confidence || 0.7,
      sourceRun: this.lastRun?.agentId,
      expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
    });

    this.insightsGenerated++;
    logger.info(`${this.name}: Insight created`, {
      insightId: insight.insightId,
      type,
      title,
      priority
    });

    return insight;
  }

  async createAction(type, target, payload, options = {}) {
    const action = await Action.create({
      actionId: `act_${uuidv4()}`,
      agentType: this.name,
      type,
      target,
      payload,
      priority: options.priority || 'medium',
      autoExecute: options.autoExecute || false
    });

    this.actionsCreated++;
    logger.info(`${this.name}: Action created`, {
      actionId: action.actionId,
      type,
      priority,
      autoExecute: action.autoExecute
    });

    if (action.autoExecute && action.priority === 'low') {
      await this.executeAction(action);
    }

    return action;
  }

  async executeAction(action) {
    action.status = 'executed';
    action.executedAt = new Date();
    await action.save();
    logger.info(`${this.name}: Action executed`, { actionId: action.actionId });
    return action;
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      schedule: this.schedule,
      lastRun: this.lastRun?.completedAt,
      lastError: this.lastError,
      executionCount: this.executionCount,
      errorCount: this.errorCount,
      insightsGenerated: this.insightsGenerated,
      actionsCreated: this.actionsCreated
    };
  }
}

// ============================================
// AGENT 1: Demand Signal Agent
// Schedule: Every 5 minutes
// Purpose: Aggregate demand signals across all categories
// ============================================
class DemandSignalAgent extends BaseAgent {
  constructor() {
    super('DemandSignalAgent', '*/5 * * * *');
    this.demandHistory = [];
    this.velocityWindow = 30; // minutes
  }

  async execute() {
    logger.info('DemandSignalAgent: Aggregating demand signals');

    const timestamp = new Date();
    const signals = await this.collectDemandSignals();
    const aggregated = this.aggregateSignals(signals);
    const trends = this.calculateTrends(aggregated);
    const anomalies = this.detectAnomalies(aggregated);

    // Store in history
    this.demandHistory.push({ timestamp, ...aggregated });
    if (this.demandHistory.length > 100) {
      this.demandHistory = this.demandHistory.slice(-100);
    }

    // Generate insights
    for (const trend of trends) {
      await this.createInsight(
        INSIGHT_TYPES.TREND,
        `Demand ${trend.direction} in ${trend.category}`,
        `${trend.category} demand is ${trend.direction} with velocity ${trend.velocity.toFixed(2)} orders/min`,
        { category: trend.category, velocity: trend.velocity, direction: trend.direction },
        trend.velocity > 0.8 ? 'high' : 'medium'
      );
    }

    for (const anomaly of anomalies) {
      await this.createInsight(
        INSIGHT_TYPES.ANOMALY,
        `Unusual demand for ${anomaly.item}`,
        `Detected ${anomaly.deviation}% deviation from expected demand`,
        { item: anomaly.item, deviation: anomaly.deviation, expected: anomaly.expected, actual: anomaly.actual },
        'high'
      );

      await this.createAction(
        'notify_inventory_team',
        { category: anomaly.category },
        { item: anomaly.item, deviation: anomaly.deviation },
        { priority: 'high', autoExecute: anomaly.deviation > 50 }
      );
    }

    return {
      timestamp,
      aggregated,
      trends,
      anomalies,
      totalDemand: aggregated.total,
      recordsProcessed: signals.length
    };
  }

  async collectDemandSignals() {
    // Simulate data collection - replace with actual data sources
    const categories = ['restaurant', 'hotel', 'retail', 'travel', 'services'];
    const signals = [];

    for (const category of categories) {
      const baseDemand = randomInt(100, 600);
      const currentDemand = randomInt(100, Math.floor(baseDemand * 1.5));

      signals.push({
        category,
        current: currentDemand,
        baseline: baseDemand,
        velocity: (currentDemand - baseDemand) / baseDemand,
        timestamp: new Date()
      });
    }

    // Add item-level signals
    const items = [
      { id: 'item_1', name: 'Premium Biryani', category: 'restaurant', demand: 150 },
      { id: 'item_2', name: 'Beach Resort', category: 'hotel', demand: 45 },
      { id: 'item_3', name: 'Electronics Bundle', category: 'retail', demand: 80 },
      { id: 'item_4', name: 'Flight to Mumbai', category: 'travel', demand: 120 },
      { id: 'item_5', name: 'Spa Package', category: 'services', demand: 35 }
    ];

    for (const item of items) {
      signals.push({
        type: 'item',
        ...item,
        current: Math.floor(item.demand * (0.8 + randomInt(0, 400) / 1000)),
        velocity: ((randomInt(0, 200) / 1000) - 0.3) * 0.5
      });
    }

    return signals;
  }

  aggregateSignals(signals) {
    const byCategory = {};
    let total = 0;

    for (const signal of signals) {
      if (signal.category) {
        byCategory[signal.category] = byCategory[signal.category] || { demand: 0, count: 0 };
        byCategory[signal.category].demand += signal.current;
        byCategory[signal.category].count++;
        total += signal.current;
      }
    }

    return { total, byCategory, signalCount: signals.length };
  }

  calculateTrends(aggregated) {
    const trends = [];
    const historicalAvg = this.demandHistory.length > 0
      ? this.demandHistory.reduce((sum, h) => sum + h.total, 0) / this.demandHistory.length
      : aggregated.total;

    for (const [category, data] of Object.entries(aggregated.byCategory)) {
      const historicalCatAvg = this.demandHistory.length > 0
        ? this.demandHistory.reduce((sum, h) => sum + (h.byCategory?.[category]?.demand || 0), 0) / this.demandHistory.length
        : data.demand;

      const velocity = (data.demand - historicalCatAvg) / (historicalCatAvg || 1);
      const direction = velocity > 0.1 ? 'increasing' : velocity < -0.1 ? 'decreasing' : 'stable';

      if (Math.abs(velocity) > 0.1) {
        trends.push({ category, velocity, direction });
      }
    }

    return trends;
  }

  detectAnomalies(aggregated) {
    const anomalies = [];
    const threshold = 0.5; // 50% deviation

    for (const [category, data] of Object.entries(aggregated.byCategory)) {
      const historicalAvg = this.demandHistory.length > 0
        ? this.demandHistory.reduce((sum, h) => sum + (h.byCategory?.[category]?.demand || 0), 0) / this.demandHistory.length
        : data.demand;

      if (historicalAvg > 0) {
        const deviation = ((data.demand - historicalAvg) / historicalAvg) * 100;

        if (Math.abs(deviation) > threshold * 100) {
          anomalies.push({
            category,
            item: category,
            expected: historicalAvg,
            actual: data.demand,
            deviation
          });
        }
      }
    }

    return anomalies;
  }
}

// ============================================
// AGENT 2: Scarcity Agent
// Schedule: Every 1 minute
// Purpose: Monitor supply/demand ratios in real-time
// ============================================
class ScarcityAgent extends BaseAgent {
  constructor() {
    super('ScarcityAgent', '*/1 * * * *');
    this.scarcityThresholds = {
      critical: 3.0,  // 3x demand vs supply
      high: 2.0,
      medium: 1.5
    };
  }

  async execute() {
    logger.info('ScarcityAgent: Analyzing supply/demand ratios');

    const inventory = await this.fetchInventoryLevels();
    const demand = await this.fetchDemandData();
    const ratios = this.calculateRatios(inventory, demand);
    const alerts = this.generateAlerts(ratios);
    const urgencyScores = this.calculateUrgencyScores(alerts);

    // Generate alerts and actions
    for (const alert of alerts) {
      const priority = alert.severity === 'critical' ? 'critical' :
                       alert.severity === 'high' ? 'high' : 'medium';

      await this.createInsight(
        alert.severity === 'critical' ? INSIGHT_TYPES.RISK : INSIGHT_TYPES.OPPORTUNITY,
        `Scarcity alert: ${alert.item}`,
        alert.message,
        { item: alert.item, ratio: alert.ratio, severity: alert.severity },
        priority
      );

      if (alert.severity === 'critical' || alert.severity === 'high') {
        await this.createAction(
          'trigger_urgency_campaign',
          { itemId: alert.itemId },
          { item: alert.item, ratio: alert.ratio, urgencyScore: alert.urgencyScore },
          { priority, autoExecute: alert.severity === 'critical' }
        );
      }
    }

    return {
      timestamp: new Date(),
      alerts,
      urgencyScores,
      ratios,
      recordsProcessed: inventory.length
    };
  }

  async fetchInventoryLevels() {
    // Simulate inventory data - replace with actual API calls
    return [
      { itemId: 'SKU001', item: 'Premium Biryani', supply: 50, category: 'restaurant' },
      { itemId: 'SKU002', item: 'Chicken Wings', supply: 200, category: 'restaurant' },
      { itemId: 'SKU003', item: 'Beach Villa', supply: 5, category: 'hotel' },
      { itemId: 'SKU004', item: 'Deluxe Room', supply: 25, category: 'hotel' },
      { itemId: 'SKU005', item: 'Electronics Bundle', supply: 30, category: 'retail' },
      { itemId: 'SKU006', item: 'Weekend Getaway', supply: 15, category: 'travel' },
      { itemId: 'SKU007', item: 'Spa Package', supply: 10, category: 'services' }
    ];
  }

  async fetchDemandData() {
    // Simulate demand data - replace with actual API calls
    return {
      SKU001: 150, // Premium Biryani - high demand
      SKU002: 180, // Chicken Wings - high demand
      SKU003: 45,  // Beach Villa - very high demand
      SKU004: 30,  // Deluxe Room - moderate
      SKU005: 60,  // Electronics Bundle - high demand
      SKU006: 25,  // Weekend Getaway - moderate
      SKU007: 15   // Spa Package - low demand
    };
  }

  calculateRatios(inventory, demand) {
    return inventory.map(item => {
      const itemDemand = demand[item.itemId] || 0;
      const ratio = itemDemand > 0 ? item.supply / itemDemand : Infinity;
      return {
        ...item,
        demand: itemDemand,
        ratio,
        supplyDemandGap: itemDemand - item.supply
      };
    });
  }

  generateAlerts(ratios) {
    const alerts = [];

    for (const item of ratios) {
      let severity = null;
      let message = '';

      if (item.ratio === Infinity || item.demand === 0) {
        continue; // Skip items with no demand
      }

      if (item.ratio < 0.33) { // Demand is 3x+ supply
        severity = 'critical';
        message = `${item.item} is critically scarce. Demand is ${(1/item.ratio).toFixed(1)}x available supply.`;
      } else if (item.ratio < 0.5) { // Demand is 2x+ supply
        severity = 'high';
        message = `${item.item} supply is running low. Demand/supply ratio: ${(1/item.ratio).toFixed(1)}:1`;
      } else if (item.ratio < 0.67) { // Demand is 1.5x+ supply
        severity = 'medium';
        message = `${item.item} may need restocking soon.`;
      }

      if (severity) {
        alerts.push({
          itemId: item.itemId,
          item: item.item,
          ratio: 1/item.ratio,
          severity,
          message,
          urgencyScore: this.calculateItemUrgency(item)
        });
      }
    }

    return alerts.sort((a, b) => b.urgencyScore - a.urgencyScore);
  }

  calculateUrgencyScores(alerts) {
    return alerts.reduce((scores, alert) => {
      scores[alert.itemId] = alert.urgencyScore;
      return scores;
    }, {});
  }

  calculateItemUrgency(item) {
    // Urgency = demand coverage (inverse of ratio) * price weight * velocity
    const demandCoverage = item.demand > 0 ? item.supply / item.demand : 1;
    const baseUrgency = (1 - demandCoverage) * 100;
    return Math.min(100, Math.max(0, baseUrgency));
  }
}

// ============================================
// AGENT 3: Price Elasticity Agent
// Schedule: Every hour
// Purpose: Calculate price sensitivity for products
// ============================================
class PriceElasticityAgent extends BaseAgent {
  constructor() {
    super('PriceElasticityAgent', '0 * * * *');
    this.elasticityCache = new Map();
    this.analysisWindow = 30; // days
  }

  async execute() {
    logger.info('PriceElasticityAgent: Calculating price elasticity');

    const products = await this.fetchProductData();
    const priceHistory = await this.fetchPriceHistory(products);
    const demandHistory = await this.fetchDemandHistory(products);
    const elasticities = this.calculateElasticities(products, priceHistory, demandHistory);
    const segments = this.segmentByElasticity(elasticities);

    // Update cache
    for (const elasticity of elasticities) {
      this.elasticityCache.set(elasticity.productId, elasticity);
    }

    // Generate insights
    for (const segment of segments.inelastic) {
      await this.createInsight(
        INSIGHT_TYPES.OPPORTUNITY,
        `${segment.product} has inelastic demand`,
        `Price increase of 10% would only reduce demand by ${(segment.elasticity * 10).toFixed(1)}%. Safe to increase prices.`,
        { product: segment.product, elasticity: segment.elasticity, recommendation: 'increase_price' },
        'medium'
      );
    }

    for (const segment of segments.elastic) {
      await this.createInsight(
        INSIGHT_TYPES.RISK,
        `${segment.product} has elastic demand`,
        `Price sensitive product - consider promotions instead of price increases.`,
        { product: segment.product, elasticity: segment.elasticity, recommendation: 'promotion' },
        'medium'
      );

      await this.createAction(
        'optimize_pricing_strategy',
        { productId: segment.productId },
        { product: segment.product, elasticity: segment.elasticity, currentPrice: segment.currentPrice },
        { priority: 'medium' }
      );
    }

    return {
      timestamp: new Date(),
      elasticities,
      segments,
      avgElasticity: elasticities.reduce((sum, e) => sum + e.elasticity, 0) / elasticities.length,
      recordsProcessed: products.length
    };
  }

  async fetchProductData() {
    return [
      { productId: 'PRD001', name: 'Premium Biryani', category: 'restaurant', currentPrice: 299 },
      { productId: 'PRD002', name: 'Beach Villa', category: 'hotel', currentPrice: 8999 },
      { productId: 'PRD003', name: 'Flight Ticket', category: 'travel', currentPrice: 4500 },
      { productId: 'PRD004', name: 'Spa Package', category: 'services', currentPrice: 1500 },
      { productId: 'PRD005', name: 'Electronics Bundle', category: 'retail', currentPrice: 25000 }
    ];
  }

  async fetchPriceHistory(products) {
    // Simulate historical price data
    return products.map(p => ({
      productId: p.productId,
      history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: p.currentPrice * (0.9 + randomInt(0, 200) / 1000)
      }))
    }));
  }

  async fetchDemandHistory(products) {
    // Simulate historical demand data
    return products.map(p => ({
      productId: p.productId,
      history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        demand: randomInt(50, 150)
      }))
    }));
  }

  calculateElasticities(products, priceHistory, demandHistory) {
    return products.map((product, idx) => {
      const prices = priceHistory[idx].history;
      const demands = demandHistory[idx].history;

      // Calculate percentage changes
      const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      const avgDemand = demands.reduce((sum, d) => sum + d.demand, 0) / demands.length;

      // Simple elasticity calculation: % change in demand / % change in price
      // Using coefficient of variation as proxy
      const priceCV = this.coefficientOfVariation(prices.map(p => p.price));
      const demandCV = this.coefficientOfVariation(demands.map(d => d.demand));

      // Elasticity = (CV of demand) / (CV of price)
      // If demand changes more than price proportionally, it's elastic
      const elasticity = priceCV > 0 ? demandCV / priceCV : 1;

      // Normalize: elasticity < 1 = inelastic, > 1 = elastic
      const normalizedElasticity = Math.min(3, Math.max(0.1, elasticity));

      return {
        productId: product.productId,
        product: product.name,
        category: product.category,
        currentPrice: product.currentPrice,
        elasticity: normalizedElasticity,
        elasticityLabel: normalizedElasticity < 1 ? 'inelastic' : 'elastic',
        confidence: 0.6 + randomInt(0, 300) / 1000,
        optimalPriceRange: {
          min: product.currentPrice * 0.85,
          max: product.currentPrice * 1.15
        }
      };
    });
  }

  coefficientOfVariation(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return mean > 0 ? Math.sqrt(variance) / mean : 0;
  }

  segmentByElasticity(elasticities) {
    return {
      elastic: elasticities.filter(e => e.elasticity > 1),
      inelastic: elasticities.filter(e => e.elasticity <= 1),
      neutral: elasticities.filter(e => Math.abs(e.elasticity - 1) < 0.2)
    };
  }
}

// ============================================
// AGENT 4: Reorder Predictor Agent
// Schedule: Every 5 minutes
// Purpose: Score reorder probability for users
// ============================================
class ReorderPredictorAgent extends BaseAgent {
  constructor() {
    super('ReorderPredictorAgent', '*/5 * * * *');
    this.modelWeights = {
      daysSinceLastOrder: 0.25,
      orderFrequency: 0.20,
      avgOrderValue: 0.15,
      categoryAffinity: 0.15,
      browsingHistory: 0.10,
      seasonality: 0.10,
      promotionalActivity: 0.05
    };
  }

  async execute() {
    logger.info('ReorderPredictorAgent: Scoring reorder probability');

    const users = await this.fetchActiveUsers();
    const scores = await this.calculateReorderScores(users);
    const highProbability = scores.filter(s => s.probability > 0.7);
    const recommendations = this.generateRecommendations(highProbability);

    // Generate insights for high-probability users
    for (const user of highProbability.slice(0, 10)) {
      await this.createInsight(
        INSIGHT_TYPES.PREDICTION,
        `${user.userId} likely to reorder soon`,
        `${(user.probability * 100).toFixed(0)}% probability within ${user.estimatedDays} days`,
        { userId: user.userId, probability: user.probability, estimatedDays: user.estimatedDays },
        user.probability > 0.9 ? 'high' : 'medium'
      );

      if (user.probability > 0.8) {
        await this.createAction(
          'send_reorder_nudge',
          { userId: user.userId },
          { probability: user.probability, topCategories: user.topCategories },
          { priority: 'medium', autoExecute: false }
        );
      }
    }

    return {
      timestamp: new Date(),
      totalUsersScored: users.length,
      highProbabilityCount: highProbability.length,
      avgProbability: scores.reduce((sum, s) => sum + s.probability, 0) / scores.length,
      scores: scores.slice(0, 100), // Top 100 for efficiency
      recommendations,
      recordsProcessed: users.length
    };
  }

  async fetchActiveUsers() {
    // Simulate active users - replace with actual query
    return Array.from({ length: 50 }, (_, i) => ({
      userId: `USR${String(i + 1).padStart(6, '0')}`,
      daysSinceLastOrder: randomInt(1, 61),
      orderFrequency: randomInt(1, 11),
      avgOrderValue: randomInt(200, 5200),
      lastCategory: ['restaurant', 'hotel', 'retail', 'travel'][randomInt(0, 4)],
      browsingScore: randomInt(0, 1000) / 1000,
      seasonalFactor: 0.8 + randomInt(0, 400) / 1000
    }));
  }

  async calculateReorderScores(users) {
    return users.map(user => {
      // Calculate individual component scores
      const recencyScore = Math.max(0, 1 - (user.daysSinceLastOrder / 60));
      const frequencyScore = Math.min(1, user.orderFrequency / 10);
      const valueScore = Math.min(1, user.avgOrderValue / 5000);
      const engagementScore = user.browsingScore;
      const seasonalScore = user.seasonalFactor;

      // Weighted sum
      const rawScore =
        recencyScore * this.modelWeights.daysSinceLastOrder +
        frequencyScore * this.modelWeights.orderFrequency +
        valueScore * this.modelWeights.avgOrderValue +
        engagementScore * this.modelWeights.browsingHistory +
        seasonalScore * this.modelWeights.seasonality;

      // Normalize to 0-1
      const probability = Math.min(0.99, Math.max(0.01, rawScore * 1.5));

      // Estimate days until reorder
      const estimatedDays = Math.ceil(
        (1 - probability) * 30 + randomInt(0, 7)
      );

      return {
        userId: user.userId,
        probability,
        estimatedDays,
        topCategories: [user.lastCategory],
        components: {
          recency: recencyScore,
          frequency: frequencyScore,
          value: valueScore,
          engagement: engagementScore,
          seasonal: seasonalScore
        }
      };
    }).sort((a, b) => b.probability - a.probability);
  }

  generateRecommendations(users) {
    return users.map(user => ({
      userId: user.userId,
      action: user.probability > 0.8 ? 'send_personalized_offer' : 'wait_and_monitor',
      urgency: user.probability > 0.9 ? 'immediate' : 'soon',
      suggestedMessage: this.generateMessage(user),
      discount: user.probability > 0.85 ? '10%' : '5%'
    }));
  }

  generateMessage(user) {
    const messages = [
      `Ready for your next order? Get ${user.probability > 0.85 ? '10%' : '5%'} off your reorder!`,
      `We miss you! Your favorites are waiting.`,
      `Time to treat yourself again? Exclusive offer inside!`
    ];
    return messages[randomInt(0, messages.length)];
  }
}

// ============================================
// AGENT 5: Taste Evolution Agent
// Schedule: Daily
// Purpose: Track and analyze preference changes
// ============================================
class TasteEvolutionAgent extends BaseAgent {
  constructor() {
    super('TasteEvolutionAgent', '0 0 * * *');
    this.baselinePreferences = new Map();
    this.trendWindow = 30; // days
  }

  async execute() {
    logger.info('TasteEvolutionAgent: Tracking preference changes');

    const currentPreferences = await this.fetchUserPreferences();
    const previousPreferences = this.loadBaseline();
    const evolutions = this.analyzeEvolution(currentPreferences, previousPreferences);
    const trends = this.identifyMacroTrends(evolutions);
    const segments = this.segmentByEvolution(evolutions);

    // Update baseline
    this.baselinePreferences = new Map(
      currentPreferences.map(p => [p.userId, p])
    );

    // Generate insights
    for (const trend of trends) {
      await this.createInsight(
        INSIGHT_TYPES.TREND,
        `Shift toward ${trend.category}`,
        `${trend.percentage.toFixed(1)}% of users increased preference`,
        { category: trend.category, percentage: trend.percentage, velocity: trend.velocity },
        trend.velocity > 0.3 ? 'high' : 'medium'
      );
    }

    for (const segment of segments.emerging) {
      await this.createAction(
        'adjust_inventory',
        { category: segment.category },
        { demand: segment.demandChange, urgency: 'medium' },
        { priority: 'medium' }
      );
    }

    return {
      timestamp: new Date(),
      evolutions,
      trends,
      segments,
      totalUsersAnalyzed: currentPreferences.length,
      recordsProcessed: currentPreferences.length
    };
  }

  async fetchUserPreferences() {
    // Simulate preference data
    const categories = ['restaurant', 'hotel', 'retail', 'travel', 'services'];
    return Array.from({ length: 100 }, (_, i) => ({
      userId: `USR${String(i + 1).padStart(6, '0')}`,
      preferences: categories.reduce((prefs, cat) => {
        prefs[cat] = randomInt(0, 1000) / 1000;
        return prefs;
      }, {}),
      timestamp: new Date()
    }));
  }

  loadBaseline() {
    return Array.from(this.baselinePreferences.values());
  }

  analyzeEvolution(current, previous) {
    if (previous.length === 0) {
      return current.map(u => ({
        userId: u.userId,
        changes: {},
        velocity: 0
      }));
    }

    return current.map(user => {
      const prev = previous.find(p => p.userId === user.userId);
      if (!prev) return { userId: user.userId, changes: {}, velocity: 0 };

      const changes = {};
      let totalChange = 0;

      for (const [category, pref] of Object.entries(user.preferences)) {
        const prevPref = prev.preferences?.[category] || 0;
        const change = pref - prevPref;
        if (Math.abs(change) > 0.05) {
          changes[category] = change;
          totalChange += Math.abs(change);
        }
      }

      return {
        userId: user.userId,
        changes,
        velocity: totalChange
      };
    });
  }

  identifyMacroTrends(evolutions) {
    const categoryChanges = {};

    for (const evolution of evolutions) {
      for (const [category, change] of Object.entries(evolution.changes)) {
        categoryChanges[category] = categoryChanges[category] || { positive: 0, negative: 0, total: 0 };
        categoryChanges[category].total++;
        if (change > 0) categoryChanges[category].positive++;
        else categoryChanges[category].negative++;
      }
    }

    return Object.entries(categoryChanges)
      .map(([category, data]) => ({
        category,
        percentage: (data.positive / data.total) * 100,
        velocity: data.positive / (data.total || 1),
        trend: data.positive > data.negative ? 'rising' : 'declining'
      }))
      .filter(t => t.velocity > 0.2)
      .sort((a, b) => b.velocity - a.velocity);
  }

  segmentByEvolution(evolutions) {
    return {
      earlyAdopters: evolutions.filter(e => e.velocity > 0.5),
      stable: evolutions.filter(e => e.velocity <= 0.1),
      evolving: evolutions.filter(e => e.velocity > 0.1 && e.velocity <= 0.5),
      emerging: evolutions.filter(e => Object.values(e.changes).some(c => c > 0.3))
    };
  }
}

// ============================================
// AGENT 6: Churn Risk Agent
// Schedule: Daily
// Purpose: Predict and identify churn risk users
// ============================================
class ChurnRiskAgent extends BaseAgent {
  constructor() {
    super('ChurnRiskAgent', '0 1 * * *'); // 1 AM daily
    this.riskThresholds = {
      critical: 0.85,
      high: 0.65,
      medium: 0.40
    };
  }

  async execute() {
    logger.info('ChurnRiskAgent: Predicting churn risk');

    const users = await this.fetchUserMetrics();
    const risks = await this.calculateRiskScores(users);
    const segmented = this.segmentByRisk(risks);
    const interventions = this.suggestInterventions(segmented);

    // Generate insights and actions
    for (const user of segmented.critical) {
      await this.createInsight(
        INSIGHT_TYPES.RISK,
        `Critical churn risk: ${user.userId}`,
        `${(user.riskScore * 100).toFixed(0)}% churn probability. Last active ${user.daysSinceActivity} days ago.`,
        { userId: user.userId, riskScore: user.riskScore, daysSinceActivity: user.daysSinceActivity },
        'critical'
      );

      await this.createAction(
        'urgent_winback',
        { userId: user.userId },
        { riskScore: user.riskScore, interventionType: 'aggressive_offer' },
        { priority: 'critical', autoExecute: true }
      );
    }

    for (const user of segmented.high.slice(0, 50)) {
      await this.createAction(
        'winback_campaign',
        { userId: user.userId },
        { riskScore: user.riskScore, interventionType: 'personalized_offer' },
        { priority: 'high', autoExecute: false }
      );
    }

    return {
      timestamp: new Date(),
      riskDistribution: {
        critical: segmented.critical.length,
        high: segmented.high.length,
        medium: segmented.medium.length,
        low: segmented.low.length
      },
      totalAtRisk: segmented.critical.length + segmented.high.length,
      interventions: interventions.length,
      recordsProcessed: users.length
    };
  }

  async fetchUserMetrics() {
    return Array.from({ length: 200 }, (_, i) => ({
      userId: `USR${String(i + 1).padStart(6, '0')}`,
      daysSinceActivity: randomInt(1, 91),
      daysSinceLastOrder: randomInt(1, 61),
      orderFrequency: randomInt(1, 16),
      avgOrderValue: randomInt(100, 5100),
      supportTickets: randomInt(0, 5),
      negativeFeedback: randomInt(0, 1000) / 1000 > 0.8,
      engagementScore: randomInt(0, 1000) / 1000,
      accountAge: randomInt(30, 1030)
    }));
  }

  async calculateRiskScores(users) {
    return users.map(user => {
      // Risk factors
      const inactivityRisk = Math.min(1, user.daysSinceActivity / 90);
      const orderDeclineRisk = Math.min(1, user.daysSinceLastOrder / 60);
      const frequencyRisk = Math.max(0, 1 - user.orderFrequency / 15);
      const engagementRisk = Math.max(0, 1 - user.engagementScore);
      const satisfactionRisk = user.negativeFeedback ? 0.3 : 0;
      const supportRisk = Math.min(0.2, user.supportTickets * 0.05);

      // Weighted risk score
      const riskScore =
        inactivityRisk * 0.30 +
        orderDeclineRisk * 0.25 +
        frequencyRisk * 0.15 +
        engagementRisk * 0.15 +
        satisfactionRisk * 0.10 +
        supportRisk * 0.05;

      return {
        userId: user.userId,
        riskScore,
        riskFactors: {
          inactivity: inactivityRisk,
          orderDecline: orderDeclineRisk,
          frequency: frequencyRisk,
          engagement: engagementRisk,
          satisfaction: satisfactionRisk,
          support: supportRisk
        },
        daysSinceActivity: user.daysSinceActivity,
        estimatedChurnDate: new Date(Date.now() + (30 - user.daysSinceActivity) * 24 * 60 * 60 * 1000)
      };
    });
  }

  segmentByRisk(risks) {
    return {
      critical: risks.filter(r => r.riskScore >= this.riskThresholds.critical),
      high: risks.filter(r => r.riskScore >= this.riskThresholds.high && r.riskScore < this.riskThresholds.critical),
      medium: risks.filter(r => r.riskScore >= this.riskThresholds.medium && r.riskScore < this.riskThresholds.high),
      low: risks.filter(r => r.riskScore < this.riskThresholds.medium)
    };
  }

  suggestInterventions(segments) {
    const interventions = [];

    for (const user of [...segments.critical, ...segments.high].slice(0, 100)) {
      let interventionType;
      if (user.riskScore >= this.riskThresholds.critical) {
        interventionType = 'aggressive_winback';
      } else if (user.riskFactors.inactivity > 0.5) {
        interventionType = 'reengagement_email';
      } else if (user.riskFactors.orderDecline > 0.5) {
        interventionType = 'order_incentive';
      } else {
        interventionType = 'feedback_request';
      }

      interventions.push({
        userId: user.userId,
        interventionType,
        priority: user.riskScore >= this.riskThresholds.critical ? 'critical' : 'high',
        message: this.generateInterventionMessage(user, interventionType)
      });
    }

    return interventions;
  }

  generateInterventionMessage(user, type) {
    const messages = {
      aggressive_winback: `We miss you! Here's 25% off your next order to welcome you back.`,
      reengagement_email: `It's been a while. Check out what's new!`,
      order_incentive: `Ready for your next order? Get 15% off this week.`,
      feedback_request: `We'd love to hear your feedback. Take our quick survey.`
    };
    return messages[type] || messages.feedback_request;
  }
}

// ============================================
// AGENT 7: LTV Predictor Agent
// Schedule: Weekly
// Purpose: Estimate customer lifetime value
// ============================================
class LTVPredictorAgent extends BaseAgent {
  constructor() {
    super('LTVPredictorAgent', '0 2 * * 0'); // Sunday 2 AM weekly
    this.ltvModel = {
      discountRate: 0.1, // Annual discount rate
      averageLifespan: 365 * 3 // 3 years average
    };
  }

  async execute() {
    logger.info('LTVPredictorAgent: Estimating customer lifetime value');

    const users = await this.fetchUserData();
    const ltvs = await this.calculateLTVs(users);
    const segments = this.segmentByLTV(ltvs);
    const highValue = this.identifyHighValueUsers(segments);
    const predictions = this.generatePredictions(segments);

    // Generate insights
    await this.createInsight(
      INSIGHT_TYPES.PREDICTION,
      `Average LTV: ₹${segments.average.toFixed(0)}`,
      `${highValue.length} high-value users identified with LTV > ₹50000`,
      { averageLTV: segments.average, highValueCount: highValue.length },
      'medium'
    );

    for (const user of highValue.slice(0, 20)) {
      await this.createInsight(
        INSIGHT_TYPES.OPPORTUNITY,
        `VIP User: ${user.userId}`,
        `High LTV of ₹${user.ltv.toFixed(0)} - prioritize retention`,
        { userId: user.userId, ltv: user.ltv, clv: user.clv },
        'high'
      );

      await this.createAction(
        'vip_treatment',
        { userId: user.userId },
        { ltv: user.ltv, priority: 'high', perks: ['priority_support', 'early_access', 'exclusive_offers'] },
        { priority: 'high' }
      );
    }

    return {
      timestamp: new Date(),
      segments,
      totalUsers: users.length,
      averageLTV: segments.average,
      predictedRevenue: segments.total,
      recordsProcessed: users.length
    };
  }

  async fetchUserData() {
    return Array.from({ length: 500 }, (_, i) => ({
      userId: `USR${String(i + 1).padStart(6, '0')}`,
      totalOrders: randomInt(1, 101),
      totalRevenue: randomInt(500, 100500),
      avgOrderValue: randomInt(100, 3100),
      orderFrequency: randomInt(1, 13),
      customerSince: new Date(Date.now() - randomInt(1, 1001) * 24 * 60 * 60 * 1000),
      lastOrderDate: new Date(Date.now() - randomInt(1, 91) * 24 * 60 * 60 * 1000),
      categoryMix: {
        restaurant: randomInt(0, 1000) / 1000,
        hotel: randomInt(0, 1000) / 1000,
        retail: randomInt(0, 1000) / 1000,
        travel: randomInt(0, 1000) / 1000
      }
    }));
  }

  async calculateLTVs(users) {
    return users.map(user => {
      // Customer Lifetime Value calculation
      const avgOrderValue = user.avgOrderValue;
      const ordersPerYear = user.orderFrequency;
      const customerLifespan = this.estimateLifespan(user);

      // Simple LTV = AOV * Frequency * Lifespan
      const clv = avgOrderValue * ordersPerYear * customerLifespan;

      // Discounted LTV (present value)
      const ltv = clv / (1 + this.ltvModel.discountRate);

      // Confidence based on data quality
      const dataConfidence = Math.min(1, user.totalOrders / 20);

      return {
        userId: user.userId,
        ltv,
        clv,
        avgOrderValue,
        ordersPerYear,
        customerLifespan,
        dataConfidence,
        tier: this.classifyLTV(ltv)
      };
    });
  }

  estimateLifespan(user) {
    const daysSinceSignup = (Date.now() - user.customerSince.getTime()) / (24 * 60 * 60 * 1000);
    const daysSinceLastOrder = (Date.now() - user.lastOrderDate.getTime()) / (24 * 60 * 60 * 1000);

    // If inactive for long, reduce lifespan estimate
    if (daysSinceLastOrder > 180) return 0.5;
    if (daysSinceLastOrder > 90) return 1;

    // Base lifespan on signup date, cap at 3 years
    return Math.min(3, Math.max(1, daysSinceSignup / 365));
  }

  classifyLTV(ltv) {
    if (ltv > 50000) return 'platinum';
    if (ltv > 20000) return 'gold';
    if (ltv > 5000) return 'silver';
    return 'bronze';
  }

  segmentByLTV(ltvs) {
    const byTier = {
      platinum: ltvs.filter(l => l.tier === 'platinum'),
      gold: ltvs.filter(l => l.tier === 'gold'),
      silver: ltvs.filter(l => l.tier === 'silver'),
      bronze: ltvs.filter(l => l.tier === 'bronze')
    };

    const total = ltvs.reduce((sum, l) => sum + l.ltv, 0);
    const average = ltvs.length > 0 ? total / ltvs.length : 0;

    return {
      ...byTier,
      average,
      total,
      distribution: {
        platinum: byTier.platinum.length,
        gold: byTier.gold.length,
        silver: byTier.silver.length,
        bronze: byTier.bronze.length
      }
    };
  }

  identifyHighValueUsers(segments) {
    return [
      ...segments.platinum,
      ...segments.gold
    ].sort((a, b) => b.ltv - a.ltv);
  }

  generatePredictions(segments) {
    return {
      projectedRevenue3Month: segments.total * 0.25,
      projectedRevenue6Month: segments.total * 0.5,
      projectedRevenue12Month: segments.total,
      upgradePotential: segments.silver.filter(s => s.ltv > 15000).length,
      retentionRecommendation: segments.bronze.filter(s => s.dataConfidence > 0.7).length
    };
  }
}

// ============================================
// AGENT 8: Inventory Alert Agent
// Schedule: Every 5 minutes
// Purpose: Monitor and alert on low stock levels
// ============================================
class InventoryAlertAgent extends BaseAgent {
  constructor() {
    super('InventoryAlertAgent', '*/5 * * * *');
    this.alertThresholds = {
      critical: 5,   // units remaining
      low: 20,       // units remaining
      warning: 50    // units remaining
    };
  }

  async execute() {
    logger.info('InventoryAlertAgent: Checking inventory levels');

    const inventory = await this.fetchInventory();
    const alerts = this.generateAlerts(inventory);
    const reorder = this.suggestReorders(alerts);

    // Process alerts
    for (const alert of alerts.critical) {
      await this.createInsight(
        INSIGHT_TYPES.ALERT,
        `CRITICAL: ${alert.item} out of stock!`,
        `${alert.current} units remaining. ${alert.lostSales} potential sales lost.`,
        { item: alert.item, current: alert.current, lostSales: alert.lostSales },
        'critical'
      );

      await this.createAction(
        'emergency_reorder',
        { itemId: alert.itemId, supplier: alert.preferredSupplier },
        { item: alert.item, quantity: alert.reorderQuantity, urgency: 'critical' },
        { priority: 'critical', autoExecute: true }
      );
    }

    for (const alert of alerts.low) {
      await this.createInsight(
        INSIGHT_TYPES.ALERT,
        `Low stock: ${alert.item}`,
        `${alert.current} units remaining. Reorder suggested.`,
        { item: alert.item, current: alert.current },
        'high'
      );

      if (!alerts.critical.find(a => a.itemId === alert.itemId)) {
        await this.createAction(
          'schedule_reorder',
          { itemId: alert.itemId },
          { item: alert.item, quantity: alert.reorderQuantity },
          { priority: 'high', autoExecute: false }
        );
      }
    }

    for (const alert of alerts.warning) {
      await this.createAction(
        'monitor_stock',
        { itemId: alert.itemId },
        { item: alert.item, current: alert.current },
        { priority: 'low', autoExecute: false }
      );
    }

    return {
      timestamp: new Date(),
      alerts,
      reorderSuggestions: reorder,
      summary: {
        critical: alerts.critical.length,
        low: alerts.low.length,
        warning: alerts.warning.length,
        healthy: inventory.length - alerts.critical.length - alerts.low.length - alerts.warning.length
      },
      recordsProcessed: inventory.length
    };
  }

  async fetchInventory() {
    // Simulate inventory data
    return [
      { itemId: 'INV001', item: 'Premium Biryani', current: 3, threshold: 50, avgDailySales: 25, preferredSupplier: 'Chef Fresh' },
      { itemId: 'INV002', item: 'Chicken Wings', current: 150, threshold: 50, avgDailySales: 40, preferredSupplier: 'Farm Fresh' },
      { itemId: 'INV003', item: 'Beach Villa Access', current: 2, threshold: 10, avgDailySales: 3, preferredSupplier: 'Resort Partner' },
      { itemId: 'INV004', item: 'Flight Insurance', current: 500, threshold: 100, avgDailySales: 50, preferredSupplier: 'InsureCo' },
      { itemId: 'INV005', item: 'Spa Voucher', current: 15, threshold: 20, avgDailySales: 8, preferredSupplier: 'Wellness Corp' },
      { itemId: 'INV006', item: 'Electronics Bundle', current: 8, threshold: 15, avgDailySales: 5, preferredSupplier: 'Tech Distributors' }
    ];
  }

  generateAlerts(inventory) {
    const alerts = {
      critical: [],
      low: [],
      warning: []
    };

    for (const item of inventory) {
      const daysOfStock = item.avgDailySales > 0 ? item.current / item.avgDailySales : Infinity;
      const lostSales = item.avgDailySales * Math.max(0, item.threshold - item.current);

      const alertData = {
        itemId: item.itemId,
        item: item.item,
        current: item.current,
        threshold: item.threshold,
        daysOfStock,
        lostSales: Math.floor(lostSales),
        reorderQuantity: this.calculateReorderQuantity(item)
      };

      if (item.current <= this.alertThresholds.critical) {
        alerts.critical.push(alertData);
      } else if (item.current <= this.alertThresholds.low) {
        alerts.low.push(alertData);
      } else if (item.current <= this.alertThresholds.warning) {
        alerts.warning.push(alertData);
      }
    }

    return alerts;
  }

  calculateReorderQuantity(item) {
    // Reorder enough for 14 days + safety stock (50% buffer)
    const targetStock = item.avgDailySales * 14 * 1.5;
    return Math.max(0, Math.ceil(targetStock - item.current));
  }

  suggestReorders(alerts) {
    const reorders = [];

    for (const alert of [...alerts.critical, ...alerts.low]) {
      reorders.push({
        itemId: alert.itemId,
        item: alert.item,
        quantity: alert.reorderQuantity,
        priority: alerts.critical.includes(alert) ? 'critical' : 'high',
        estimatedCost: alert.reorderQuantity * 100 // Simplified cost calculation
      });
    }

    return reorders.sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (b.priority === 'critical' && a.priority !== 'critical') return 1;
      return b.estimatedCost - a.estimatedCost;
    });
  }
}

// ============================================
// AGENT 9: Demand Forecast Agent
// Schedule: Daily
// Purpose: 7-day demand prediction
// ============================================
class DemandForecastAgent extends BaseAgent {
  constructor() {
    super('DemandForecastAgent', '0 3 * * *'); // 3 AM daily
    this.forecastHorizon = 7; // days
    this.models = {
      baseline: { weight: 0.4 },
      seasonality: { weight: 0.3 },
      trend: { weight: 0.2 },
      promotional: { weight: 0.1 }
    };
  }

  async execute() {
    logger.info('DemandForecastAgent: Generating 7-day forecast');

    const products = await this.fetchProductData();
    const historicalData = await this.fetchHistoricalDemand(products);
    const forecasts = this.generateForecasts(products, historicalData);
    const alerts = this.identifyForecastAlerts(forecasts);

    // Generate insights
    for (const alert of alerts) {
      await this.createInsight(
        alert.type === 'surge' ? INSIGHT_TYPES.OPPORTUNITY : INSIGHT_TYPES.RISK,
        `${alert.type === 'surge' ? 'Demand surge' : 'Demand drop'} predicted for ${alert.product}`,
        `${alert.type === 'surge' ? '+' : ''}${(alert.change * 100).toFixed(0)}% vs baseline for ${alert.day}`,
        { product: alert.product, day: alert.day, change: alert.change, confidence: alert.confidence },
        alert.magnitude > 0.5 ? 'high' : 'medium'
      );
    }

    return {
      timestamp: new Date(),
      forecasts,
      alerts,
      summary: this.generateForecastSummary(forecasts),
      recordsProcessed: products.length
    };
  }

  async fetchProductData() {
    return [
      { productId: 'PRD001', name: 'Premium Biryani', category: 'restaurant', baseDemand: 100 },
      { productId: 'PRD002', name: 'Beach Villa', category: 'hotel', baseDemand: 20 },
      { productId: 'PRD003', name: 'Flight Tickets', category: 'travel', baseDemand: 150 },
      { productId: 'PRD004', name: 'Spa Package', category: 'services', baseDemand: 40 },
      { productId: 'PRD005', name: 'Electronics', category: 'retail', baseDemand: 80 }
    ];
  }

  async fetchHistoricalDemand(products) {
    // Generate 30 days of historical data
    return products.map(p => ({
      productId: p.productId,
      data: Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
        const dayOfWeek = date.getDay();
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;
        const noise = 0.8 + randomInt(0, 400) / 1000;
        return {
          date,
          demand: Math.floor(p.baseDemand * weekendFactor * noise)
        };
      })
    }));
  }

  generateForecasts(products, historicalData) {
    return products.map((product, idx) => {
      const history = historicalData[idx].data;
      const forecasts = [];

      for (let d = 1; d <= this.forecastHorizon; d++) {
        const forecastDate = new Date(Date.now() + d * 24 * 60 * 60 * 1000);
        const dayOfWeek = forecastDate.getDay();

        // Baseline forecast
        const avgDemand = history.reduce((sum, h) => sum + h.demand, 0) / history.length;
        const baseline = product.baseDemand;

        // Seasonality factor
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;

        // Trend factor (simple linear trend)
        const recentAvg = history.slice(-7).reduce((sum, h) => sum + h.demand, 0) / 7;
        const trendFactor = recentAvg / avgDemand;

        // Combined forecast
        const forecast =
          baseline * this.models.baseline.weight +
          baseline * weekendFactor * this.models.seasonality.weight +
          baseline * trendFactor * this.models.trend.weight;

        // Calculate confidence (decreases with horizon)
        const confidence = Math.max(0.5, 0.95 - (d * 0.05));

        forecasts.push({
          date: forecastDate,
          day: forecastDate.toLocaleDateString('en-US', { weekday: 'short' }),
          predicted: Math.round(forecast),
          lower: Math.round(forecast * 0.85),
          upper: Math.round(forecast * 1.15),
          confidence,
          factors: {
            baseline: baseline * this.models.baseline.weight,
            seasonality: baseline * weekendFactor * this.models.seasonality.weight,
            trend: baseline * trendFactor * this.models.trend.weight
          }
        });
      }

      return {
        productId: product.productId,
        product: product.name,
        category: product.category,
        forecasts
      };
    });
  }

  identifyForecastAlerts(forecasts) {
    const alerts = [];

    for (const forecast of forecasts) {
      const baseline = forecast.forecasts[0].predicted;
      const avgForecast = forecast.forecasts.reduce((sum, f) => sum + f.predicted, 0) / forecast.forecasts.length;

      for (let d = 0; d < forecast.forecasts.length; d++) {
        const f = forecast.forecasts[d];
        const change = (f.predicted - baseline) / baseline;

        if (Math.abs(change) > 0.3) {
          alerts.push({
            productId: forecast.productId,
            product: forecast.product,
            day: f.day,
            date: f.date,
            change,
            magnitude: Math.abs(change),
            type: change > 0 ? 'surge' : 'drop',
            confidence: f.confidence
          });
        }
      }
    }

    return alerts.sort((a, b) => b.magnitude - a.magnitude);
  }

  generateForecastSummary(forecasts) {
    let totalPredicted = 0;
    let peakDay = null;
    let peakDemand = 0;

    for (const forecast of forecasts) {
      for (const f of forecast.forecasts) {
        totalPredicted += f.predicted;
        if (f.predicted > peakDemand) {
          peakDemand = f.predicted;
          peakDay = f.day;
        }
      }
    }

    return {
      total7DayDemand: totalPredicted,
      avgDailyDemand: Math.round(totalPredicted / this.forecastHorizon),
      peakDay,
      peakDemand,
      productsAnalyzed: forecasts.length
    };
  }
}

// ============================================
// AGENT 10: Competitor Monitor Agent
// Schedule: Daily
// Purpose: Track competitor prices and positioning
// ============================================
class CompetitorMonitorAgent extends BaseAgent {
  constructor() {
    super('CompetitorMonitorAgent', '0 4 * * *'); // 4 AM daily
    this.competitors = new Map();
  }

  async execute() {
    logger.info('CompetitorMonitorAgent: Monitoring competitor prices');

    const competitors = await this.fetchCompetitorData();
    const priceAnalysis = this.analyzePrices(competitors);
    const opportunities = this.identifyOpportunities(priceAnalysis);
    const threats = this.identifyThreats(priceAnalysis);

    // Generate insights
    for (const opp of opportunities) {
      await this.createInsight(
        INSIGHT_TYPES.OPPORTUNITY,
        `Price opportunity: ${opp.product}`,
        `Our price is ${(opp.ourPrice - opp.competitorPrice).toFixed(0)}% ${opp.direction} vs ${opp.competitor}`,
        { product: opp.product, ourPrice: opp.ourPrice, competitorPrice: opp.competitorPrice, competitor: opp.competitor },
        opp.magnitude > 20 ? 'high' : 'medium'
      );
    }

    for (const threat of threats) {
      await this.createInsight(
        INSIGHT_TYPES.RISK,
        `Competitive threat: ${threat.product}`,
        `${threat.competitor} is ${(threat.priceDiff * 100).toFixed(0)}% cheaper`,
        { product: threat.product, competitor: threat.competitor, priceDiff: threat.priceDiff },
        threat.priceDiff > 0.2 ? 'high' : 'medium'
      );

      await this.createAction(
        'review_pricing',
        { productId: threat.productId },
        { product: threat.product, competitor: threat.competitor, priceDiff: threat.priceDiff },
        { priority: 'high' }
      );
    }

    return {
      timestamp: new Date(),
      competitors: competitors.length,
      priceAnalysis,
      opportunities,
      threats,
      summary: {
        totalProducts: priceAnalysis.length,
        underpriced: opportunities.filter(o => o.direction === 'higher').length,
        overpriced: opportunities.filter(o => o.direction === 'lower').length,
        competitive: priceAnalysis.filter(p => Math.abs(p.diffPercent) < 5).length
      },
      recordsProcessed: competitors.length
    };
  }

  async fetchCompetitorData() {
    // Simulate competitor data
    const competitors = ['CompetitorA', 'CompetitorB', 'CompetitorC'];

    return [
      { productId: 'PRD001', product: 'Premium Biryani', ourPrice: 299, prices: { CompetitorA: 279, CompetitorB: 289, CompetitorC: 310 } },
      { productId: 'PRD002', product: 'Beach Villa', ourPrice: 8999, prices: { CompetitorA: 9500, CompetitorB: 8750, CompetitorC: 9200 } },
      { productId: 'PRD003', product: 'Flight Ticket', ourPrice: 4500, prices: { CompetitorA: 4200, CompetitorB: 4600, CompetitorC: 4400 } },
      { productId: 'PRD004', product: 'Spa Package', ourPrice: 1500, prices: { CompetitorA: 1600, CompetitorB: 1450, CompetitorC: 1550 } },
      { productId: 'PRD005', product: 'Electronics', ourPrice: 25000, prices: { CompetitorA: 24500, CompetitorB: 25500, CompetitorC: 24800 } }
    ];
  }

  analyzePrices(competitorData) {
    return competitorData.map(item => {
      const competitorPrices = Object.values(item.prices);
      const avgCompetitorPrice = competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length;
      const minCompetitorPrice = Math.min(...competitorPrices);
      const maxCompetitorPrice = Math.max(...competitorPrices);

      const diffPercent = ((item.ourPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

      return {
        productId: item.productId,
        product: item.product,
        ourPrice: item.ourPrice,
        avgCompetitorPrice: Math.round(avgCompetitorPrice),
        minCompetitorPrice,
        maxCompetitorPrice,
        diffPercent: Math.round(diffPercent * 100) / 100,
        pricePosition: this.getPricePosition(diffPercent),
        competitiveIndex: this.calculateCompetitiveIndex(item.ourPrice, avgCompetitorPrice)
      };
    });
  }

  getPricePosition(diffPercent) {
    if (diffPercent < -10) return 'significantly_underpriced';
    if (diffPercent < -5) return 'underpriced';
    if (diffPercent > 10) return 'significantly_overpriced';
    if (diffPercent > 5) return 'overpriced';
    return 'competitive';
  }

  calculateCompetitiveIndex(ourPrice, competitorAvg) {
    return competitorAvg > 0 ? ourPrice / competitorAvg : 1;
  }

  identifyOpportunities(analysis) {
    const opportunities = [];

    for (const item of analysis) {
      for (const [competitor, price] of Object.entries(item.prices)) {
        const diff = (item.ourPrice - price) / price;

        if (diff > 0.05) { // We're more than 5% higher
          opportunities.push({
            productId: item.productId,
            product: item.product,
            ourPrice: item.ourPrice,
            competitorPrice: price,
            competitor,
            diff,
            direction: 'higher',
            magnitude: diff * 100
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.magnitude - a.magnitude);
  }

  identifyThreats(analysis) {
    const threats = [];

    for (const item of analysis) {
      for (const [competitor, price] of Object.entries(item.prices)) {
        const diff = (price - item.ourPrice) / item.ourPrice;

        if (diff > 0.1) { // Competitor is more than 10% cheaper
          threats.push({
            productId: item.productId,
            product: item.product,
            competitor,
            competitorPrice: price,
            ourPrice: item.ourPrice,
            priceDiff: diff
          });
        }
      }
    }

    return threats.sort((a, b) => b.priceDiff - a.priceDiff);
  }
}

// ============================================
// AGENT 11: Trend Detector Agent
// Schedule: Every hour
// Purpose: Identify trending items and patterns
// ============================================
class TrendDetectorAgent extends BaseAgent {
  constructor() {
    super('TrendDetectorAgent', '0 * * * *');
    this.trendThreshold = 1.5; // 50% increase = trend
    this.minVelocity = 0.3;
  }

  async execute() {
    logger.info('TrendDetectorAgent: Detecting trends');

    const signals = await this.collectTrendSignals();
    const trends = this.identifyTrends(signals);
    const emerging = this.identifyEmergingTrends(trends);
    const declining = this.identifyDecliningTrends(trends);

    // Generate insights
    for (const trend of emerging) {
      await this.createInsight(
        INSIGHT_TYPES.TREND,
        `Emerging trend: ${trend.name}`,
        `${trend.name} showing ${(trend.velocity * 100).toFixed(0)}% growth with ${trend.confidence}% confidence`,
        { name: trend.name, category: trend.category, velocity: trend.velocity, confidence: trend.confidence },
        trend.velocity > 2 ? 'critical' : trend.velocity > 1 ? 'high' : 'medium'
      );

      await this.createAction(
        'boost_visibility',
        { itemId: trend.itemId },
        { item: trend.name, velocity: trend.velocity, action: 'increase_recommendations' },
        { priority: trend.velocity > 1 ? 'high' : 'medium' }
      );
    }

    for (const trend of declining) {
      if (trend.velocity < -0.5) {
        await this.createInsight(
          INSIGHT_TYPES.TREND,
          `Declining: ${trend.name}`,
          `${trend.name} down ${(Math.abs(trend.velocity) * 100).toFixed(0)}%. Consider promotions.`,
          { name: trend.name, category: trend.category, velocity: trend.velocity },
          'medium'
        );
      }
    }

    return {
      timestamp: new Date(),
      emerging,
      declining,
      summary: {
        trending: emerging.length,
        declining: declining.length,
        stable: trends.length - emerging.length - declining.length
      },
      recordsProcessed: signals.length
    };
  }

  async collectTrendSignals() {
    // Simulate trend signal collection
    const categories = ['restaurant', 'hotel', 'retail', 'travel', 'services'];

    return [
      { itemId: 'T001', name: 'Biryani', category: 'restaurant', currentSearches: 5000, prevSearches: 3000, orders: 150, prevOrders: 80 },
      { itemId: 'T002', name: 'Beach Resort', category: 'hotel', currentSearches: 2000, prevSearches: 1800, orders: 45, prevOrders: 40 },
      { itemId: 'T003', name: 'Staycation', category: 'hotel', currentSearches: 3500, prevSearches: 1500, orders: 80, prevOrders: 35 },
      { itemId: 'T004', name: 'Smart Watch', category: 'retail', currentSearches: 4000, prevSearches: 4200, orders: 60, prevOrders: 65 },
      { itemId: 'T005', name: 'Spa Weekend', category: 'services', currentSearches: 1500, prevSearches: 800, orders: 30, prevOrders: 15 }
    ];
  }

  identifyTrends(signals) {
    return signals.map(signal => {
      const searchVelocity = (signal.currentSearches - signal.prevSearches) / signal.prevSearches;
      const orderVelocity = (signal.orders - signal.prevOrders) / signal.prevOrders;

      // Combined velocity (weighted average)
      const velocity = searchVelocity * 0.4 + orderVelocity * 0.6;

      // Confidence based on volume
      const volume = signal.currentSearches + signal.orders * 10;
      const confidence = Math.min(0.99, volume / 10000);

      return {
        itemId: signal.itemId,
        name: signal.name,
        category: signal.category,
        searchVelocity,
        orderVelocity,
        velocity,
        confidence: Math.round(confidence * 100),
        volume,
        state: velocity > this.trendThreshold ? 'emerging' : velocity < -this.trendThreshold ? 'declining' : 'stable'
      };
    });
  }

  identifyEmergingTrends(trends) {
    return trends
      .filter(t => t.velocity >= this.trendThreshold && t.confidence > 50)
      .sort((a, b) => b.velocity - a.velocity);
  }

  identifyDecliningTrends(trends) {
    return trends
      .filter(t => t.velocity <= -this.trendThreshold)
      .sort((a, b) => a.velocity - b.velocity);
  }
}

// ============================================
// AGENT 12: Price Optimizer Agent
// Schedule: Daily
// Purpose: Suggest optimal prices for products
// ============================================
class PriceOptimizerAgent extends BaseAgent {
  constructor() {
    super('PriceOptimizerAgent', '0 5 * * *'); // 5 AM daily
    this.optimizationTarget = 'revenue'; // or 'volume', 'margin'
  }

  async execute() {
    logger.info('PriceOptimizerAgent: Optimizing prices');

    const products = await this.fetchProducts();
    const priceHistory = await this.fetchPriceHistory(products);
    const demandCurves = this.estimateDemandCurves(products, priceHistory);
    const optimizations = this.calculateOptimalPrices(products, demandCurves);
    const recommendations = this.generateRecommendations(optimizations);

    // Generate insights
    for (const rec of recommendations) {
      if (rec.change > 0.05) {
        await this.createInsight(
          INSIGHT_TYPES.RECOMMENDATION,
          `Increase price: ${rec.product}`,
          `Suggested: ₹${rec.optimalPrice} (from ₹${rec.currentPrice}). Expected revenue +${(rec.expectedRevenueChange * 100).toFixed(0)}%`,
          { product: rec.product, currentPrice: rec.currentPrice, optimalPrice: rec.optimalPrice, change: rec.change },
          'medium'
        );
      } else if (rec.change < -0.05) {
        await this.createInsight(
          INSIGHT_TYPES.RECOMMENDATION,
          `Decrease price: ${rec.product}`,
          `Suggested: ₹${rec.optimalPrice} (from ₹${rec.currentPrice}). Expected volume +${(Math.abs(rec.expectedVolumeChange) * 100).toFixed(0)}%`,
          { product: rec.product, currentPrice: rec.currentPrice, optimalPrice: rec.optimalPrice, change: rec.change },
          'medium'
        );
      }

      await this.createAction(
        'apply_price_change',
        { productId: rec.productId },
        {
          product: rec.product,
          currentPrice: rec.currentPrice,
          suggestedPrice: rec.optimalPrice,
          reason: rec.reason
        },
        { priority: Math.abs(rec.change) > 0.15 ? 'high' : 'medium' }
      );
    }

    return {
      timestamp: new Date(),
      optimizations,
      recommendations,
      summary: {
        totalProducts: products.length,
        priceIncrease: recommendations.filter(r => r.change > 0.05).length,
        priceDecrease: recommendations.filter(r => r.change < -0.05).length,
        noChange: recommendations.filter(r => Math.abs(r.change) <= 0.05).length,
        expectedRevenueChange: recommendations.reduce((sum, r) => sum + r.expectedRevenueChange, 0) / recommendations.length
      },
      recordsProcessed: products.length
    };
  }

  async fetchProducts() {
    return [
      { productId: 'PRD001', name: 'Premium Biryani', category: 'restaurant', currentPrice: 299, cost: 120 },
      { productId: 'PRD002', name: 'Beach Villa', category: 'hotel', currentPrice: 8999, cost: 4500 },
      { productId: 'PRD003', name: 'Flight Ticket', category: 'travel', currentPrice: 4500, cost: 3800 },
      { productId: 'PRD004', name: 'Spa Package', category: 'services', currentPrice: 1500, cost: 600 },
      { productId: 'PRD005', name: 'Electronics Bundle', category: 'retail', currentPrice: 25000, cost: 18000 }
    ];
  }

  async fetchPriceHistory(products) {
    return products.map(p => ({
      productId: p.productId,
      history: Array.from({ length: 30 }, (_, i) => ({
        price: p.currentPrice * (0.9 + randomInt(0, 200) / 1000),
        demand: Math.floor(100 * (1.2 - (i % 10) * 0.02))
      }))
    }));
  }

  estimateDemandCurves(products, priceHistory) {
    return products.map((product, idx) => {
      const history = priceHistory[idx].history;

      // Simple linear demand curve estimation
      // Price goes up -> demand goes down
      const priceRange = history.map(h => h.price);
      const demandRange = history.map(h => h.demand);

      // Calculate correlation
      const correlation = this.calculateCorrelation(priceRange, demandRange);

      // Elasticity coefficient
      const elasticity = correlation < 0 ? Math.abs(correlation) * 1.5 : 0.5;

      return {
        productId: product.productId,
        elasticity,
        baseDemand: product.currentPrice * 100, // Simplified
        optimalPriceRatio: 1 / (1 + elasticity)
      };
    });
  }

  calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator !== 0 ? numerator / denominator : 0;
  }

  calculateOptimalPrices(products, demandCurves) {
    return products.map((product, idx) => {
      const curve = demandCurves[idx];

      // Optimal price = current price * (1 / (1 + elasticity))
      const optimalPrice = Math.round(product.currentPrice * curve.optimalPriceRatio);

      // Ensure price covers cost
      const minPrice = product.cost * 1.1; // 10% margin
      const finalOptimal = Math.max(optimalPrice, minPrice);

      // Calculate expected changes
      const priceChange = (finalOptimal - product.currentPrice) / product.currentPrice;
      const expectedDemandChange = -curve.elasticity * priceChange;
      const expectedRevenueChange = (finalOptimal * (1 + expectedDemandChange)) / product.currentPrice - 1;

      return {
        productId: product.productId,
        product: product.name,
        category: product.category,
        currentPrice: product.currentPrice,
        optimalPrice: finalOptimal,
        cost: product.cost,
        change: priceChange,
        expectedDemandChange,
        expectedRevenueChange,
        reason: this.generateReason(curve, priceChange),
        confidence: 0.6 + randomInt(0, 300) / 1000
      };
    });
  }

  generateReason(curve, change) {
    if (curve.elasticity > 1) {
      return change < 0 ? 'High elasticity - lower price may increase volume' : 'High elasticity - higher price may lose volume';
    }
    return change < 0 ? 'Minor adjustment to improve volume' : 'Room to increase price without losing demand';
  }

  generateRecommendations(optimizations) {
    return optimizations
      .filter(o => Math.abs(o.change) > 0.02) // Only suggest >2% changes
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }
}

// ============================================
// AGENT 13: Offer Matcher Agent
// Schedule: Every 15 minutes
// Purpose: Match users with relevant offers
// ============================================
class OfferMatcherAgent extends BaseAgent {
  constructor() {
    super('OfferMatcherAgent', '*/15 * * * *');
    this.offers = this.initializeOffers();
  }

  async execute() {
    logger.info('OfferMatcherAgent: Matching users with offers');

    const users = await this.fetchActiveUsers();
    const matches = await this.calculateMatches(users);
    const highValueMatches = this.filterHighValueMatches(matches);

    // Generate insights
    await this.createInsight(
      INSIGHT_TYPES.OPPORTUNITY,
      `${highValueMatches.length} high-value offer matches`,
      `Generated ${highValueMatches.length} personalized offer recommendations`,
      { matchesCount: matches.length, highValueCount: highValueMatches.length },
      'medium'
    );

    for (const match of highValueMatches.slice(0, 20)) {
      await this.createAction(
        'send_personalized_offer',
        { userId: match.userId },
        { offerId: match.offer.offerId, matchScore: match.score, reason: match.reason },
        { priority: match.score > 0.9 ? 'high' : 'medium', autoExecute: match.score > 0.95 }
      );
    }

    return {
      timestamp: new Date(),
      totalUsers: users.length,
      totalMatches: matches.length,
      highValueMatches: highValueMatches.length,
      matchRate: (matches.length / users.length) * 100,
      recordsProcessed: users.length
    };
  }

  initializeOffers() {
    return [
      { offerId: 'OFF001', name: '20% Off Restaurant Orders', categories: ['restaurant'], minOrderValue: 500, discount: 0.2, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      { offerId: 'OFF002', name: 'Free Hotel Night', categories: ['hotel'], minOrderValue: 5000, discount: 1.0, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      { offerId: 'OFF003', name: '15% Off Travel Bookings', categories: ['travel'], minOrderValue: 2000, discount: 0.15, expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
      { offerId: 'OFF004', name: 'Buy 1 Get 1 Spa', categories: ['services'], minOrderValue: 1000, discount: 0.5, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      { offerId: 'OFF005', name: '10% Off Electronics', categories: ['retail'], minOrderValue: 5000, discount: 0.1, expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
    ];
  }

  async fetchActiveUsers() {
    return Array.from({ length: 100 }, (_, i) => ({
      userId: `USR${String(i + 1).padStart(6, '0')}`,
      preferences: ['restaurant', 'hotel', 'retail', 'travel', 'services'].slice(0, randomInt(1, 4)),
      avgOrderValue: randomInt(200, 5200),
      daysSinceLastOrder: randomInt(1, 31),
      orderFrequency: randomInt(1, 11),
      engagementScore: randomInt(0, 1000) / 1000
    }));
  }

  async calculateMatches(users) {
    const matches = [];

    for (const user of users) {
      for (const offer of this.offers) {
        const score = this.calculateMatchScore(user, offer);

        if (score > 0.5) {
          matches.push({
            userId: user.userId,
            offer: {
              offerId: offer.offerId,
              name: offer.name,
              discount: offer.discount,
              expiresAt: offer.expiresAt
            },
            score,
            reason: this.generateMatchReason(user, offer)
          });
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  calculateMatchScore(user, offer) {
    // Category match
    const categoryMatch = offer.categories.some(c => user.preferences.includes(c)) ? 0.4 : 0;

    // Value eligibility
    const valueEligible = user.avgOrderValue >= offer.minOrderValue ? 0.2 : 0;

    // Recency factor (prefer users who haven't ordered recently)
    const recencyScore = user.daysSinceLastOrder > 14 ? 0.2 : user.daysSinceLastOrder > 7 ? 0.1 : 0;

    // Engagement
    const engagementScore = user.engagementScore * 0.1;

    // Expiration urgency
    const hoursUntilExpiry = (offer.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const expiryScore = hoursUntilExpiry < 24 ? 0.1 : hoursUntilExpiry < 72 ? 0.05 : 0;

    return Math.min(1, categoryMatch + valueEligible + recencyScore + engagementScore + expiryScore);
  }

  generateMatchReason(user, offer) {
    const reasons = [];

    if (offer.categories.some(c => user.preferences.includes(c))) {
      reasons.push('matches your preferences');
    }
    if (user.avgOrderValue >= offer.minOrderValue) {
      reasons.push('you qualify for minimum order');
    }
    if (user.daysSinceLastOrder > 14) {
      reasons.push('we miss you!');
    }

    return reasons.join(', ') || 'personalized for you';
  }

  filterHighValueMatches(matches) {
    return matches.filter(m => m.score > 0.7);
  }
}

// ============================================
// AGENT 14: Cross Sell Agent
// Schedule: Every hour
// Purpose: Suggest cross-sell products
// ============================================
class CrossSellAgent extends BaseAgent {
  constructor() {
    super('CrossSellAgent', '0 * * * *');
    this.affinityRules = this.initializeAffinityRules();
  }

  async execute() {
    logger.info('CrossSellAgent: Generating cross-sell recommendations');

    const orders = await this.fetchRecentOrders();
    const recommendations = this.generateRecommendations(orders);
    const topRecommendations = recommendations
      .filter(r => r.confidence > 0.6)
      .sort((a, b) => b.boost - a.boost)
      .slice(0, 50);

    // Generate insights
    for (const rec of topRecommendations.slice(0, 10)) {
      await this.createInsight(
        INSIGHT_TYPES.OPPORTUNITY,
        `Cross-sell: ${rec.primary} -> ${rec.crossSell}`,
        `${rec.crossSell} purchased ${(rec.lift * 100).toFixed(0)}% more after ${rec.primary}. Expected boost: ${(rec.boost * 100).toFixed(0)}%`,
        { primary: rec.primary, crossSell: rec.crossSell, lift: rec.lift, confidence: rec.confidence },
        'medium'
      );

      await this.createAction(
        'recommend_product',
        { productId: rec.crossSellProductId },
        { primary: rec.primary, crossSell: rec.crossSell, boost: rec.boost },
        { priority: rec.boost > 0.3 ? 'high' : 'medium' }
      );
    }

    return {
      timestamp: new Date(),
      totalOrders: orders.length,
      totalRecommendations: recommendations.length,
      highConfidenceCount: topRecommendations.length,
      avgLift: recommendations.reduce((sum, r) => sum + r.lift, 0) / recommendations.length,
      recordsProcessed: orders.length
    };
  }

  initializeAffinityRules() {
    return [
      { primary: 'restaurant', secondary: 'services', lift: 1.8, confidence: 0.75 },
      { primary: 'hotel', secondary: 'travel', lift: 1.5, confidence: 0.70 },
      { primary: 'travel', secondary: 'insurance', lift: 2.0, confidence: 0.85 },
      { primary: 'retail', secondary: 'warranty', lift: 1.6, confidence: 0.72 },
      { primary: 'restaurant', secondary: 'biryani', lift: 2.2, confidence: 0.80 },
      { primary: 'hotel', secondary: 'spa', lift: 1.9, confidence: 0.78 }
    ];
  }

  async fetchRecentOrders() {
    return Array.from({ length: 200 }, (_, i) => ({
      orderId: `ORD${String(i + 1).padStart(8, '0')}`,
      userId: `USR${String(randomInt(1, 101)).padStart(6, '0')}`,
      categories: ['restaurant', 'hotel', 'retail', 'travel', 'services'].slice(0, randomInt(1, 4)),
      totalValue: randomInt(200, 5200),
      items: this.generateRandomItems()
    }));
  }

  generateRandomItems() {
    const items = [
      { id: 'I001', name: 'Premium Biryani', category: 'restaurant', price: 299 },
      { id: 'I002', name: 'Beach Villa', category: 'hotel', price: 8999 },
      { id: 'I003', name: 'Flight Ticket', category: 'travel', price: 4500 },
      { id: 'I004', name: 'Spa Package', category: 'services', price: 1500 },
      { id: 'I005', name: 'Electronics Bundle', category: 'retail', price: 25000 }
    ];

    return items.slice(0, randomInt(1, 4));
  }

  generateRecommendations(orders) {
    const recommendations = [];
    const categoryPairs = new Map();

    // Analyze order patterns
    for (const order of orders) {
      const categories = order.categories;

      for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < categories.length; j++) {
          if (i !== j) {
            const key = `${categories[i]}-${categories[j]}`;
            categoryPairs.set(key, (categoryPairs.get(key) || 0) + 1);
          }
        }
      }
    }

    // Generate recommendations based on affinity rules
    for (const rule of this.affinityRules) {
      const pairKey = `${rule.primary}-${rule.secondary}`;
      const count = categoryPairs.get(pairKey) || 0;

      if (count > 0) {
        recommendations.push({
          primary: rule.primary,
          crossSell: rule.secondary,
          lift: rule.lift,
          confidence: rule.confidence,
          boost: rule.lift * rule.confidence,
          orderCount: count
        });
      }
    }

    // Add cross-sell product IDs
    const productMap = {
      restaurant: 'PRD001',
      hotel: 'PRD002',
      travel: 'PRD003',
      services: 'PRD004',
      retail: 'PRD005',
      biryani: 'PRD001',
      spa: 'PRD004',
      insurance: 'PRD006',
      warranty: 'PRD007'
    };

    return recommendations.map(r => ({
      ...r,
      crossSellProductId: productMap[r.crossSell] || 'UNKNOWN'
    }));
  }
}

// ============================================
// AGENT 15: Urgency Trigger Agent
// Schedule: Every 10 minutes
// Purpose: Create urgency signals and triggers
// ============================================
class UrgencyTriggerAgent extends BaseAgent {
  constructor() {
    super('UrgencyTriggerAgent', '*/10 * * * *');
    this.urgencyRules = this.initializeUrgencyRules();
    this.activeTriggers = new Map();
  }

  async execute() {
    logger.info('UrgencyTriggerAgent: Creating urgency triggers');

    const signals = await this.collectUrgencySignals();
    const triggers = this.evaluateTriggers(signals);
    const activeTriggers = this.activateTriggers(triggers);
    const expiringTriggers = this.checkExpiringTriggers();

    // Generate insights
    for (const trigger of activeTriggers.slice(0, 10)) {
      await this.createInsight(
        INSIGHT_TYPES.ALERT,
        `Urgency: ${trigger.message}`,
        `${trigger.type} - ${trigger.urgencyLevel} priority`,
        { type: trigger.type, urgencyLevel: trigger.urgencyLevel, item: trigger.item },
        trigger.urgencyLevel === 'critical' ? 'critical' : trigger.urgencyLevel === 'high' ? 'high' : 'medium'
      );

      await this.createAction(
        'display_urgency',
        { itemId: trigger.itemId },
        { message: trigger.message, type: trigger.type, urgencyLevel: trigger.urgencyLevel, duration: trigger.duration },
        { priority: trigger.urgencyLevel === 'critical' ? 'critical' : 'high', autoExecute: trigger.urgencyLevel === 'critical' }
      );
    }

    return {
      timestamp: new Date(),
      signalsCount: signals.length,
      triggersActivated: activeTriggers.length,
      expiringTriggers: expiringTriggers.length,
      activeTriggers: this.activeTriggers.size,
      summary: {
        limitedTime: activeTriggers.filter(t => t.type === 'limited_time').length,
        lowStock: activeTriggers.filter(t => t.type === 'low_stock').length,
        priceEnding: activeTriggers.filter(t => t.type === 'price_ending').length,
        socialProof: activeTriggers.filter(t => t.type === 'social_proof').length
      },
      recordsProcessed: signals.length
    };
  }

  initializeUrgencyRules() {
    return [
      { type: 'limited_time', condition: 'timeRemaining < 3600', urgencyLevel: 'critical', multiplier: 2.0 },
      { type: 'limited_time', condition: 'timeRemaining < 7200', urgencyLevel: 'high', multiplier: 1.5 },
      { type: 'low_stock', condition: 'stock < 5', urgencyLevel: 'critical', multiplier: 2.0 },
      { type: 'low_stock', condition: 'stock < 15', urgencyLevel: 'high', multiplier: 1.5 },
      { type: 'price_ending', condition: 'priceEnds < 86400', urgencyLevel: 'high', multiplier: 1.5 },
      { type: 'social_proof', condition: 'recentPurchases > 10', urgencyLevel: 'medium', multiplier: 1.2 }
    ];
  }

  async collectUrgencySignals() {
    return [
      { itemId: 'I001', item: 'Premium Biryani', type: 'product', timeRemaining: 1800, stock: 5, recentPurchases: 15, priceEnds: null },
      { itemId: 'I002', item: 'Beach Villa', type: 'product', timeRemaining: 7200, stock: 10, recentPurchases: 8, priceEnds: null },
      { itemId: 'I003', item: 'Flash Sale', type: 'promotion', timeRemaining: 3600, stock: null, recentPurchases: 45, priceEnds: null },
      { itemId: 'I004', item: 'Spa Package', type: 'product', timeRemaining: null, stock: 20, recentPurchases: 5, priceEnds: 172800 },
      { itemId: 'I005', item: 'Early Bird Hotel', type: 'promotion', timeRemaining: 14400, stock: null, recentPurchases: 12, priceEnds: null }
    ];
  }

  evaluateTriggers(signals) {
    const triggers = [];

    for (const signal of signals) {
      // Limited time urgency
      if (signal.timeRemaining) {
        if (signal.timeRemaining < 3600) {
          triggers.push({
            itemId: signal.itemId,
            item: signal.item,
            type: 'limited_time',
            urgencyLevel: 'critical',
            message: `Only ${Math.floor(signal.timeRemaining / 60)} minutes left for ${signal.item}!`,
            duration: signal.timeRemaining,
            ttl: signal.timeRemaining
          });
        } else if (signal.timeRemaining < 7200) {
          triggers.push({
            itemId: signal.itemId,
            item: signal.item,
            type: 'limited_time',
            urgencyLevel: 'high',
            message: `${Math.floor(signal.timeRemaining / 3600)} hours left - ${signal.item} deal ending soon`,
            duration: signal.timeRemaining,
            ttl: signal.timeRemaining
          });
        }
      }

      // Low stock urgency
      if (signal.stock !== null) {
        if (signal.stock < 5) {
          triggers.push({
            itemId: signal.itemId,
            item: signal.item,
            type: 'low_stock',
            urgencyLevel: 'critical',
            message: `Only ${signal.stock} left! ${signal.item} selling fast`,
            duration: 1800,
            ttl: 1800
          });
        } else if (signal.stock < 15) {
          triggers.push({
            itemId: signal.itemId,
            item: signal.item,
            type: 'low_stock',
            urgencyLevel: 'high',
            message: `Low stock alert: ${signal.stock} units of ${signal.item} remaining`,
            duration: 3600,
            ttl: 3600
          });
        }
      }

      // Social proof
      if (signal.recentPurchases > 10) {
        triggers.push({
          itemId: signal.itemId,
          item: signal.item,
          type: 'social_proof',
          urgencyLevel: 'medium',
          message: `${signal.recentPurchases} people purchased ${signal.item} in the last hour`,
          duration: 600,
          ttl: 600
        });
      }
    }

    return triggers;
  }

  activateTriggers(triggers) {
    const activated = [];

    for (const trigger of triggers) {
      const key = `${trigger.type}-${trigger.itemId}`;

      if (!this.activeTriggers.has(key)) {
        this.activeTriggers.set(key, {
          ...trigger,
          activatedAt: Date.now()
        });
        activated.push(trigger);
      }
    }

    // Clean up expired triggers
    const now = Date.now();
    for (const [key, trigger] of this.activeTriggers.entries()) {
      const age = now - trigger.activatedAt;
      if (age > trigger.ttl * 1000) {
        this.activeTriggers.delete(key);
      }
    }

    return activated;
  }

  checkExpiringTriggers() {
    const expiring = [];
    const now = Date.now();

    for (const [key, trigger] of this.activeTriggers.entries()) {
      const age = now - trigger.activatedAt;
      const remaining = trigger.ttl * 1000 - age;

      if (remaining < 300000) { // Less than 5 minutes remaining
        expiring.push({
          ...trigger,
          remainingMs: remaining
        });
      }
    }

    return expiring;
  }
}

// ============================================
// Agent Manager
// ============================================
class AgentManager {
  constructor() {
    this.agents = {
      [AGENT_TYPES.DEMAND_SIGNAL]: new DemandSignalAgent(),
      [AGENT_TYPES.SCARCITY]: new ScarcityAgent(),
      [AGENT_TYPES.PRICE_ELASTICITY]: new PriceElasticityAgent(),
      [AGENT_TYPES.REORDER_PREDICTOR]: new ReorderPredictorAgent(),
      [AGENT_TYPES.TASTE_EVOLUTION]: new TasteEvolutionAgent(),
      [AGENT_TYPES.CHURN_RISK]: new ChurnRiskAgent(),
      [AGENT_TYPES.LTV_PREDICTOR]: new LTVPredictorAgent(),
      [AGENT_TYPES.INVENTORY_ALERT]: new InventoryAlertAgent(),
      [AGENT_TYPES.DEMAND_FORECAST]: new DemandForecastAgent(),
      [AGENT_TYPES.COMPETITOR_MONITOR]: new CompetitorMonitorAgent(),
      [AGENT_TYPES.TREND_DETECTOR]: new TrendDetectorAgent(),
      [AGENT_TYPES.PRICE_OPTIMIZER]: new PriceOptimizerAgent(),
      [AGENT_TYPES.OFFER_MATCHER]: new OfferMatcherAgent(),
      [AGENT_TYPES.CROSS_SELL]: new CrossSellAgent(),
      [AGENT_TYPES.URGENCY_TRIGGER]: new UrgencyTriggerAgent()
    };

    this.schedules = {};
    for (const [type, agent] of Object.entries(this.agents)) {
      this.schedules[type] = agent.schedule;
    }
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
      status[type] = agent.getStatus();
    }
    return status;
  }

  setupSchedules() {
    for (const [agentType, cronExpr] of Object.entries(this.schedules)) {
      if (cronExpr && cron.validate(cronExpr)) {
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

  getAgents() {
    return Object.values(this.agents);
  }
}

// ============================================
// Express App Setup
// ============================================
const app = express();
const PORT = process.env.PORT || 4063;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'commerce-agents',
    agentCount: Object.keys(AGENT_TYPES).length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/agents/status', (req, res) => {
  res.json({ success: true, agents: agentManager.getAgentStatus() });
});

app.post('/api/agents/:agentType/run', async (req, res) => {
  try {
    const { agentType } = req.params;
    const result = await agentManager.runAgent(agentType);
    res.json({ success: true, agentType, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/agents/run', async (req, res) => {
  try {
    const results = await agentManager.runAllAgents();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// Main Entry Point
// ============================================
const agentManager = new AgentManager();

async function start() {
  logger.info('Starting REZ Commerce Agents Service');

  try {
    // Connect to MongoDB if URI is provided
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Connected to MongoDB');
    } else {
      logger.warn('MONGODB_URI not set - running without database');
    }

    // Setup agent schedules
    agentManager.setupSchedules();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Commerce Agents Service started on port ${PORT}`);
      logger.info(`Agents loaded: ${Object.keys(agentManager.agents).length}`);
      logger.info('Agent schedules:');
      for (const [type, schedule] of Object.entries(agentManager.schedules)) {
        logger.info(`  - ${type}: ${schedule}`);
      }
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  start();
}

// Export for testing
module.exports = {
  agents: agentManager.getAgents(),
  agentManager,
  runAgent: (name) => agentManager.runAgent(name),
  runAllAgents: () => agentManager.runAllAgents(),
  getAgentStatus: () => agentManager.getAgentStatus()
};

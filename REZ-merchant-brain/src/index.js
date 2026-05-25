import logger from './utils/logger';

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Alert types
const ALERT_TYPES = {
  DEMAND_SPIKE: 'demand_spike',
  DEMAND_DROP: 'demand_drop',
  INVENTORY_LOW: 'inventory_low',
  STAFFING: 'staffing',
  REVENUE: 'revenue',
  CHURN: 'churn_risk',
  COMPETITION: 'competition_alert',
  PRICING: 'pricing_opportunity'
};

const ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

// MongoDB Schemas
const merchantBrainSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,

  // Performance metrics
  performance: {
    dailyOrders: { type: Number, default: 0 },
    weeklyOrders: { type: Number, default: 0 },
    monthlyOrders: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    growth: { type: Number, default: 0 }, // % growth
    peakHours: [Number],
    peakDays: [Number]
  },

  // Customer intelligence
  customers: {
    totalCustomers: { type: Number, default: 0 },
    newCustomers: { type: Number, default: 0 },
    returningCustomers: { type: Number, default: 0 },
    churnRisk: { type: Number, default: 0 }, // 0-1
    ltv: { type: Number, default: 0 }
  },

  // Demand forecasting
  forecast: {
    todayOrders: Number,
    tomorrowOrders: Number,
    weekOrders: Number,
    confidence: { type: Number, default: 0.7 },
    lastUpdated: Date
  },

  // Inventory insights
  inventory: {
    fastMoving: [String], // Item IDs
    slowMoving: [String],
    outOfStock: [String],
    reorderRecommendations: [{
      itemId: String,
      itemName: String,
      suggestedQuantity: Number,
      urgency: { type: String, enum: ['low', 'medium', 'high'] }
    }]
  },

  // Competitive intelligence
  competition: {
    nearbyCompetitors: [String],
    pricePosition: { type: String, enum: ['below', 'at', 'above'] },
    avgCompetitorPrice: Number,
    priceGap: Number
  },

  // Optimization recommendations
  recommendations: [{
    type: { type: String, enum: ['pricing', 'inventory', 'staffing', 'marketing', 'menu'] },
    title: String,
    description: String,
    expectedImpact: String,
    priority: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'implemented'], default: 'pending' },
    createdAt: Date,
    implementedAt: Date
  }],

  // Alerts
  alerts: [{
    type: { type: String, enum: Object.values(ALERT_TYPES) },
    severity: { type: String, enum: Object.values(ALERT_SEVERITY) },
    title: String,
    message: String,
    data: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],

  // Health scores
  health: {
    overall: { type: Number, default: 0.8 },
    revenue: { type: Number, default: 0.8 },
    customer: { type: Number, default: 0.8 },
    operations: { type: Number, default: 0.8 }
  },

  lastUpdated: Date
}, { timestamps: true });

merchantBrainSchema.index({ 'alerts.createdAt': -1 });
merchantBrainSchema.index({ 'performance.growth': -1 });

const MerchantBrain = mongoose.model('MerchantBrain', merchantBrainSchema);

// Order data for forecasting
const orderDataSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  orders: { type: Number, required: true },
  revenue: { type: Number, required: true },
  avgOrderValue: { type: Number, required: true },
  customers: { type: Number, required: true },
  hour: Number,
  dayOfWeek: Number
}, { timestamps: true });

orderDataSchema.index({ merchantId: 1, date: -1 });

const OrderData = mongoose.model('OrderData', orderDataSchema);

// Customer data for churn prediction
const customerDataSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  firstOrder: Date,
  lastOrder: Date,
  orderCount: { type: Number, default: 1 },
  totalSpend: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  daysSinceLastOrder: Number,
  predictedChurnRisk: { type: Number, default: 0 }
}, { timestamps: true });

customerDataSchema.index({ merchantId: 1, predictedChurnRisk: -1 });

const CustomerData = mongoose.model('CustomerData', customerDataSchema);

// Merchant Brain Engine
class MerchantBrainEngine {
  // Calculate demand forecast
  async forecastDemand(merchantId, days = 7) {
    const today = new Date();
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const historicalData = await OrderData.find({
      merchantId,
      date: { $gte: startDate, $lte: today }
    }).sort({ date: 1 }).lean();

    if (historicalData.length < 7) {
      return { error: 'Insufficient data', confidence: 0 };
    }

    // Calculate daily averages by day of week
    const dayAverages = {};
    for (const data of historicalData) {
      const dayOfWeek = data.date.getDay();
      if (!dayAverages[dayOfWeek]) {
        dayAverages[dayOfWeek] = { orders: 0, revenue: 0, count: 0 };
      }
      dayAverages[dayOfWeek].orders += data.orders;
      dayAverages[dayOfWeek].revenue += data.revenue;
      dayAverages[dayOfWeek].count += 1;
    }

    // Calculate averages
    for (const day of Object.keys(dayAverages)) {
      dayAverages[day].orders /= dayAverages[day].count;
      dayAverages[day].revenue /= dayAverages[day].count;
    }

    // Calculate trend
    const recentWeek = historicalData.slice(-7);
    const previousWeek = historicalData.slice(-14, -7);
    const recentAvg = recentWeek.reduce((s, d) => s + d.orders, 0) / 7;
    const previousAvg = previousWeek.length > 0
      ? previousWeek.reduce((s, d) => s + d.orders, 0) / previousWeek.length
      : recentAvg;
    const trend = recentAvg / Math.max(1, previousAvg);

    // Forecast
    const forecasts = [];
    for (let i = 0; i < days; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + i);
      const dayOfWeek = forecastDate.getDay();
      const baseOrders = dayAverages[dayOfWeek]?.orders || recentAvg;
      const trendFactor = i === 0 ? trend : Math.pow(trend, i / 7);

      forecasts.push({
        date: forecastDate,
        orders: Math.round(baseOrders * trendFactor),
        revenue: Math.round((dayAverages[dayOfWeek]?.revenue || recentAvg * 300) * trendFactor),
        confidence: Math.max(0.5, 1 - (i * 0.05))
      });
    }

    return {
      forecasts,
      trend: Math.round((trend - 1) * 100),
      confidence: Math.min(0.95, 0.5 + historicalData.length / 100)
    };
  }

  // Calculate churn risk for customers
  async calculateChurnRisk(merchantId) {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const customers = await CustomerData.find({
      merchantId,
      lastOrder: { $lt: cutoffDate }
    }).lean();

    for (const customer of customers) {
      const daysInactive = Math.floor(
        (Date.now() - customer.lastOrder.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Simple churn risk: based on days since last order and order frequency
      const expectedInterval = customer.orderCount > 1
        ? (customer.lastOrder.getTime() - customer.firstOrder.getTime()) / (customer.orderCount - 1)
        : 30 * 24 * 60 * 60 * 1000;

      const expectedDays = expectedInterval / (1000 * 60 * 60 * 24);
      const risk = Math.min(1, daysInactive / expectedDays);

      await CustomerData.findByIdAndUpdate(customer._id, { predictedChurnRisk: risk });
    }

    const avgChurnRisk = customers.length > 0
      ? customers.reduce((s, c) => s + Math.min(1, (Date.now() - c.lastOrder.getTime()) / (30 * 24 * 60 * 60 * 1000)), 0) / customers.length
      : 0;

    return { avgChurnRisk, atRiskCount: customers.length };
  }

  // Generate recommendations
  async generateRecommendations(merchantId) {
    const merchant = await MerchantBrain.findOne({ merchantId });
    if (!merchant) return [];

    const recommendations = [];

    // Growth recommendations
    if (merchant.performance.growth < 0) {
      recommendations.push({
        type: 'marketing',
        title: 'Address declining orders',
        description: 'Your orders have declined. Consider promotions or menu updates.',
        expectedImpact: '+15% orders with targeted campaign',
        priority: 1
      });
    }

    // Churn recommendations
    if (merchant.customers.churnRisk > 0.3) {
      recommendations.push({
        type: 'marketing',
        title: 'Win back at-risk customers',
        description: `${merchant.customers.churnRisk > 0.5 ? 'High' : 'Moderate'} churn risk detected. Send personalized offers.`,
        expectedImpact: 'Reduce churn by 20%',
        priority: 2
      });
    }

    // Inventory recommendations
    if (merchant.inventory.outOfStock?.length > 0) {
      recommendations.push({
        type: 'inventory',
        title: 'Restock popular items',
        description: `${merchant.inventory.outOfStock.length} items are out of stock.`,
        expectedImpact: '+10% orders by preventing stockouts',
        priority: 1
      });
    }

    // Pricing recommendations
    if (merchant.competition.priceGap > 10) {
      recommendations.push({
        type: 'pricing',
        title: 'Review pricing strategy',
        description: `Your prices are ${merchant.competition.priceGap}% above competitors.`,
        expectedImpact: 'Potential 5% order increase',
        priority: 3
      });
    }

    // Peak hours recommendations
    if (merchant.performance.peakHours?.length === 0) {
      recommendations.push({
        type: 'staffing',
        title: 'Identify peak hours',
        description: 'Not enough data to identify peak hours. Monitor for 2 weeks.',
        expectedImpact: 'Optimize staffing',
        priority: 4
      });
    }

    return recommendations;
  }

  // Generate alerts
  async generateAlerts(merchantId) {
    const merchant = await MerchantBrain.findOne({ merchantId });
    if (!merchant) return [];

    const alerts = [];

    // Check for demand spike
    if (merchant.performance.growth > 30) {
      alerts.push({
        type: ALERT_TYPES.DEMAND_SPIKE,
        severity: ALERT_SEVERITY.INFO,
        title: 'Demand surge detected',
        message: `Orders up ${merchant.performance.growth.toFixed(0)}% this week.`,
        data: { growth: merchant.performance.growth }
      });
    }

    // Check for demand drop
    if (merchant.performance.growth < -20) {
      alerts.push({
        type: ALERT_TYPES.DEMAND_DROP,
        severity: ALERT_SEVERITY.WARNING,
        title: 'Demand drop detected',
        message: `Orders down ${Math.abs(merchant.performance.growth).toFixed(0)}% this week.`,
        data: { growth: merchant.performance.growth }
      });
    }

    // Check for high churn
    if (merchant.customers.churnRisk > 0.5) {
      alerts.push({
        type: ALERT_TYPES.CHURN,
        severity: ALERT_SEVERITY.CRITICAL,
        title: 'High customer churn risk',
        message: 'More than 50% of customers at risk of churning.',
        data: { churnRisk: merchant.customers.churnRisk }
      });
    }

    return alerts;
  }

  // Update merchant brain
  async updateBrain(merchantId, data) {
    let merchant = await MerchantBrain.findOne({ merchantId });

    if (!merchant) {
      merchant = new MerchantBrain({ merchantId });
    }

    // Update fields
    if (data.performance) {
      Object.assign(merchant.performance, data.performance);
    }
    if (data.customers) {
      Object.assign(merchant.customers, data.customers);
    }
    if (data.inventory) {
      merchant.inventory = data.inventory;
    }
    if (data.competition) {
      Object.assign(merchant.competition, data.competition);
    }

    // Calculate overall health
    merchant.health.overall = (
      merchant.health.revenue +
      merchant.health.customer +
      merchant.health.operations
    ) / 3;

    merchant.lastUpdated = new Date();

    await merchant.save();
    return merchant;
  }

  // Record order data
  async recordOrder(merchantId, data) {
    const { date, orders, revenue, customers } = data;

    await OrderData.findOneAndUpdate(
      { merchantId, date },
      {
        $set: {
          orders,
          revenue,
          avgOrderValue: orders > 0 ? revenue / orders : 0,
          customers,
          hour: new Date(date).getHours(),
          dayOfWeek: new Date(date).getDay()
        }
      },
      { upsert: true }
    );

    // Update daily aggregates
    await this.updateBrain(merchantId, {
      performance: {
        dailyOrders: orders,
        revenue
      }
    });
  }

  // Record customer data
  async recordCustomer(merchantId, customerData) {
    let customer = await CustomerData.findOne({
      merchantId,
      customerId: customerData.customerId
    });

    if (customer) {
      customer.orderCount += 1;
      customer.totalSpend += customerData.spend || 0;
      customer.avgOrderValue = customer.totalSpend / customer.orderCount;
      customer.lastOrder = new Date();
      customer.daysSinceLastOrder = 0;
    } else {
      customer = new CustomerData({
        merchantId,
        customerId: customerData.customerId,
        firstOrder: new Date(),
        lastOrder: new Date(),
        orderCount: 1,
        totalSpend: customerData.spend || 0,
        avgOrderValue: customerData.spend || 0,
        daysSinceLastOrder: 0
      });
    }

    await customer.save();

    // Update churn risk
    const churnData = await this.calculateChurnRisk(merchantId);
    await MerchantBrain.findOneAndUpdate(
      { merchantId },
      {
        'customers.totalCustomers': await CustomerData.countDocuments({ merchantId }),
        'customers.churnRisk': churnData.avgChurnRisk
      }
    );
  }
}

const brainEngine = new MerchantBrainEngine();

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
    service: 'merchant-brain',
    alertTypes: Object.values(ALERT_TYPES),
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

// Get merchant brain
app.get('/api/brain/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  let brain = await MerchantBrain.findOne({ merchantId });

  if (!brain) {
    brain = new MerchantBrain({ merchantId });
    await brain.save();
  }

  res.json({ success: true, brain });
}));

// Get forecast
app.get('/api/brain/:merchantId/forecast', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { days = 7 } = req.query;

  const forecast = await brainEngine.forecastDemand(merchantId, parseInt(days));

  res.json({ success: true, forecast });
}));

// Get recommendations
app.get('/api/brain/:merchantId/recommendations', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const recommendations = await brainEngine.generateRecommendations(merchantId);

  res.json({ success: true, recommendations });
}));

// Get alerts
app.get('/api/brain/:merchantId/alerts', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { unacknowledged } = req.query;

  const merchant = await MerchantBrain.findOne({ merchantId });

  if (!merchant) {
    return res.json({ success: true, alerts: [] });
  }

  let alerts = merchant.alerts;
  if (unacknowledged === 'true') {
    alerts = alerts.filter(a => !a.acknowledged);
  }

  res.json({ success: true, alerts });
}));

// Record order data
app.post('/api/brain/:merchantId/orders', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { date, orders, revenue, customers } = req.body;

  await brainEngine.recordOrder(merchantId, { date: new Date(date), orders, revenue, customers });

  res.json({ success: true });
}));

// Record customer data
app.post('/api/brain/:merchantId/customers', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { customerId, spend } = req.body;

  await brainEngine.recordCustomer(merchantId, { customerId, spend });

  res.json({ success: true });
}));

// Update merchant brain
app.patch('/api/brain/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const brain = await brainEngine.updateBrain(merchantId, req.body);

  res.json({ success: true, brain });
}));

// Acknowledge alert
app.post('/api/brain/:merchantId/alerts/:alertId/acknowledge', asyncHandler(async (req, res) => {
  const { merchantId, alertId } = req.params;

  const merchant = await MerchantBrain.findOneAndUpdate(
    { merchantId, 'alerts._id': alertId },
    { $set: { 'alerts.$.acknowledged': true } },
    { new: true }
  );

  if (!merchant) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({ success: true });
}));

// Update recommendation status
app.patch('/api/brain/:merchantId/recommendations/:recId', asyncHandler(async (req, res) => {
  const { merchantId, recId } = req.params;
  const { status } = req.body;

  const merchant = await MerchantBrain.findOneAndUpdate(
    { merchantId, 'recommendations._id': recId },
    {
      $set: {
        'recommendations.$.status': status,
        'recommendations.$.implementedAt': status === 'implemented' ? new Date() : undefined
      }
    },
    { new: true }
  );

  if (!merchant) {
    return res.status(404).json({ error: 'Recommendation not found' });
  }

  res.json({ success: true });
}));

// Dashboard data
app.get('/api/brain/:merchantId/dashboard', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const [brain, forecast] = await Promise.all([
    MerchantBrain.findOne({ merchantId }),
    brainEngine.forecastDemand(merchantId, 7)
  ]);

  if (!brain) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  const recommendations = await brainEngine.generateRecommendations(merchantId);
  const unacknowledgedAlerts = brain.alerts.filter(a => !a.acknowledged);

  res.json({
    success: true,
    dashboard: {
      health: brain.health,
      performance: brain.performance,
      customers: brain.customers,
      forecast: forecast.forecasts?.[0],
      recommendations: recommendations.slice(0, 3),
      alertCount: unacknowledgedAlerts.length,
      alerts: unacknowledgedAlerts.slice(0, 5)
    }
  });
}));

// Batch update
app.post('/api/brain/batch', asyncHandler(async (req, res) => {
  const { merchants } = req.body;

  for (const m of merchants) {
    await brainEngine.updateBrain(m.merchantId, m.data);
  }

  res.json({ success: true, processed: merchants.length });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4061;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Merchant Brain Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

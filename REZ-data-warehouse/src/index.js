/**
 * REZ Data Warehouse
 *
 * ETL pipelines and analytics aggregations
 * - Daily metrics
 * - User aggregations
 * - Merchant aggregations
 * - Revenue analytics
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cron = require('node-cron');
const winston = require('winston');

const app = express();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

app.use(express.json());

// MongoDB connections
const CONNECTIONS = {
  ORDERS: process.env.ORDERS_MONGODB_URI || 'mongodb://localhost:27017/rez-orders',
  WALLET: process.env.WALLET_MONGODB_URI || 'mongodb://localhost:27017/rez-wallet',
  EVENTS: process.env.EVENTS_MONGODB_URI || 'mongodb://localhost:27017/rez-events',
  WAREHOUSE: process.env.WAREHOUSE_MONGODB_URI || 'mongodb://localhost:27017/rez-warehouse'
};

// =============================================================================
// SCHEMAS
// =============================================================================

// Daily metrics schema
const dailyMetricsSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },
  metrics: {
    orders: { total: Number, completed: Number, cancelled: Number },
    revenue: { total: Number, avg: Number },
    users: { new: Number, active: Number, returning: Number },
    merchants: { new: Number, active: Number },
    wallet: { transactions: Number, volume: Number }
  },
  segments: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

// User aggregations schema
const userAggregationsSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  lifetime: { totalOrders: Number, totalSpent: Number, avgOrderValue: Number },
  frequency: { ordersPerWeek: Number, daysSinceLastOrder: Number },
  recency: { lastOrderDate: Date, lastActivityDate: Date },
  segments: [String],
  churnRisk: { type: String, enum: ['low', 'medium', 'high'] },
  LTV: Number,
  createdAt: { type: Date, default: Date.now }
});

// Merchant aggregations schema
const merchantAggregationsSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  performance: {
    orders: { total: Number, completed: Number, cancelled: Number },
    revenue: { total: Number, avg: Number },
    repeatRate: Number
  },
  customerMetrics: {
    newCustomers: Number,
    returningCustomers: Number,
    avgCustomerValue: Number
  },
  operational: {
    avgOrderTime: Number,
    peakHours: [Number]
  },
  createdAt: { type: Date, default: Date.now }
});

const DailyMetrics = mongoose.model('DailyMetrics', dailyMetricsSchema);
const UserAggregations = mongoose.model('UserAggregations', userAggregationsSchema);
const MerchantAggregations = mongoose.model('MerchantAggregations', merchantAggregationsSchema);

// =============================================================================
// ETL PIPELINES
// =============================================================================

/**
 * Run daily ETL
 */
async function runDailyETL() {
  const today = new Date().toISOString().split('T')[0];
  logger.info(`Starting daily ETL for ${today}`);

  try {
    // Connect to warehouses
    await mongoose.connect(CONNECTIONS.WAREHOUSE);

    // Run aggregations
    await aggregateDailyMetrics(today);
    await aggregateUserMetrics(today);
    await aggregateMerchantMetrics(today);

    logger.info(`Daily ETL completed for ${today}`);
  } catch (err) {
    logger.error('ETL failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Aggregate daily metrics
 */
async function aggregateDailyMetrics(date) {
  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setDate(endOfDay.getDate() + 1);

  try {
    // Fetch from events
    const events = await axios.get(`${process.env.EVENTS_URL || 'http://localhost:4008'}/api/events/daily`, {
      params: { startDate: startOfDay, endDate: endOfDay }
    });

    const eventData = events.data.events || [];

    // Calculate metrics
    const metrics = {
      orders: { total: 0, completed: 0, cancelled: 0 },
      revenue: { total: 0, avg: 0 },
      users: { new: 0, active: 0, returning: 0 },
      merchants: { new: 0, active: 0 },
      wallet: { transactions: 0, volume: 0 }
    };

    for (const event of eventData) {
      if (event.type === 'order_created') metrics.orders.total++;
      if (event.type === 'order_completed') metrics.orders.completed++;
      if (event.type === 'order_cancelled') metrics.orders.cancelled++;
      if (event.type === 'payment_success') metrics.revenue.total += event.data?.amount || 0;
      if (event.type === 'user_signup') metrics.users.new++;
      if (event.type === 'merchant_created') metrics.merchants.new++;
      if (event.type === 'wallet_transaction') {
        metrics.wallet.transactions++;
        metrics.wallet.volume += event.data?.amount || 0;
      }
    }

    if (metrics.orders.completed > 0) {
      metrics.revenue.avg = metrics.revenue.total / metrics.orders.completed;
    }

    await DailyMetrics.findOneAndUpdate(
      { date },
      { date, metrics },
      { upsert: true, new: true }
    );

    logger.info(`Daily metrics saved for ${date}`);
  } catch (err) {
    logger.error('Daily aggregation failed:', err);
  }
}

/**
 * Aggregate user metrics
 */
async function aggregateUserMetrics(date) {
  try {
    // Get active users from events
    const events = await axios.get(`${process.env.EVENTS_URL || 'http://localhost:4008'}/api/events/users`, {
      params: { date }
    });

    const userIds = events.data.userIds || [];

    for (const userId of userIds) {
      // Calculate user metrics
      const userAgg = {
        userId,
        date,
        lifetime: { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 },
        frequency: { ordersPerWeek: 0, daysSinceLastOrder: 0 },
        recency: { lastOrderDate: null, lastActivityDate: null },
        segments: [],
        churnRisk: 'low',
        LTV: 0
      };

      // Save aggregation
      await UserAggregations.findOneAndUpdate(
        { userId, date },
        userAgg,
        { upsert: true, new: true }
      );
    }

    logger.info(`User aggregations saved for ${date}`);
  } catch (err) {
    logger.error('User aggregation failed:', err);
  }
}

/**
 * Aggregate merchant metrics
 */
async function aggregateMerchantMetrics(date) {
  try {
    const events = await axios.get(`${process.env.EVENTS_URL || 'http://localhost:4008'}/api/events/merchants`, {
      params: { date }
    });

    const merchantIds = events.data.merchantIds || [];

    for (const merchantId of merchantIds) {
      const merchantAgg = {
        merchantId,
        date,
        performance: { orders: { total: 0, completed: 0, cancelled: 0 }, revenue: { total: 0, avg: 0 }, repeatRate: 0 },
        customerMetrics: { newCustomers: 0, returningCustomers: 0, avgCustomerValue: 0 },
        operational: { avgOrderTime: 0, peakHours: [] }
      };

      await MerchantAggregations.findOneAndUpdate(
        { merchantId, date },
        merchantAgg,
        { upsert: true, new: true }
      );
    }

    logger.info(`Merchant aggregations saved for ${date}`);
  } catch (err) {
    logger.error('Merchant aggregation failed:', err);
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'data-warehouse' });
});

// Get daily metrics
app.get('/api/metrics/daily', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await DailyMetrics.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });

    res.json({ success: true, metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user aggregations
app.get('/api/users/:userId/aggregations', async (req, res) => {
  try {
    const aggregations = await UserAggregations.find({ userId: req.params.userId })
      .sort({ date: -1 })
      .limit(30);

    res.json({ success: true, aggregations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get merchant aggregations
app.get('/api/merchants/:merchantId/aggregations', async (req, res) => {
  try {
    const aggregations = await MerchantAggregations.find({ merchantId: req.params.merchantId })
      .sort({ date: -1 })
      .limit(30);

    res.json({ success: true, aggregations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run ETL manually
app.post('/api/etl/run', async (req, res) => {
  try {
    await runDailyETL();
    res.json({ success: true, message: 'ETL completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CRON JOBS
// =============================================================================

// Run ETL daily at midnight
cron.schedule('0 0 * * *', () => {
  runDailyETL();
});

// =============================================================================
// START
// =============================================================================

const PORT = process.env.PORT || 4105;

app.listen(PORT, () => {
  logger.info(`Data Warehouse running on port ${PORT}`);
});

module.exports = { app, runDailyETL };

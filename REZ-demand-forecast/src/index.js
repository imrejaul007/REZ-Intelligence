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
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// MongoDB Schemas
const demandRecordSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  itemId: { type: String, index: true },
  date: { type: Date, required: true, index: true },
  hour: { type: Number, min: 0, max: 23 },
  dayOfWeek: { type: Number, min: 0, max: 6 },
  predictedDemand: { type: Number, default: 0 },
  actualDemand: { type: Number, default: 0 },
  accuracy: { type: Number, min: 0, max: 1 },
  features: {
    historicalAvg: Number,
    dayOfWeekFactor: Number,
    timeFactor: Number,
    weatherFactor: Number,
    eventFactor: Number,
    trendFactor: Number
  }
}, { timestamps: true });

demandRecordSchema.index({ merchantId: 1, itemId: 1, date: 1 }, { unique: true });

const DemandForecast = mongoose.model('DemandForecast', demandRecordSchema);

const merchantDemandSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,

  // Demand patterns
  peakHours: [{ type: Number }], // [12, 13, 19, 20]
  busyDays: [{ type: Number }], // [0, 5, 6] for Sun, Fri, Sat

  // Metrics
  avgDailyOrders: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  avgPrepTime: { type: Number, default: 30 }, // minutes

  // Forecast accuracy
  forecastAccuracy: { type: Number, default: 0.8 },

  // Predictions for today
  todayForecast: {
    totalOrders: Number,
    peakHour: Number,
    estimatedRevenue: Number,
    confidence: Number
  },

  // Weekly forecast
  weeklyForecast: [{
    date: Date,
    predictedOrders: Number,
    predictedRevenue: Number,
    confidence: Number
  }],

  // Alerts
  alerts: [{
    type: { type: String, enum: ['demand_spike', 'demand_drop', 'inventory_low', 'staffing'] },
    severity: { type: String, enum: ['info', 'warning', 'critical'] },
    message: String,
    recommendedAction: String,
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],

  // Historical data summary
  lastUpdated: Date
}, { timestamps: true });

const MerchantDemand = mongoose.model('MerchantDemand', merchantDemandSchema);

// Simple demand forecasting (simplified ML for MVP)
class DemandForecaster {
  constructor() {
    this.WEIGHTS = {
      historicalAvg: 0.4,
      dayOfWeek: 0.2,
      time: 0.15,
      weather: 0.1,
      events: 0.1,
      trend: 0.05
    };
  }

  // Get historical average for merchant/item
  async getHistoricalAvg(merchantId, itemId = null, dayOfWeek = null) {
    const match = { merchantId };
    if (itemId) match.itemId = itemId;

    const records = await DemandForecast.find(match)
      .sort({ date: -1 })
      .limit(30)
      .lean();

    if (records.length === 0) return 0;

    let filtered = records;
    if (dayOfWeek !== null) {
      filtered = records.filter(r => r.dayOfWeek === dayOfWeek);
    }

    return filtered.reduce((sum, r) => sum + (r.actualDemand || r.predictedDemand), 0) / filtered.length;
  }

  // Calculate day of week factor
  getDayOfWeekFactor(dayOfWeek) {
    // Weekend boost
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) return 1.3;
    // Monday dip
    if (dayOfWeek === 1) return 0.8;
    return 1.0;
  }

  // Calculate time factor
  getTimeFactor(hour) {
    // Lunch peak
    if (hour >= 12 && hour <= 14) return 1.5;
    // Dinner peak
    if (hour >= 19 && hour <= 21) return 1.4;
    // Late night
    if (hour >= 22 || hour <= 5) return 0.3;
    // Regular hours
    return 1.0;
  }

  // Get time-based pattern for merchant
  getMerchantTimeFactor(merchantId, hour) {
    // This would normally come from merchant's historical data
    return this.getTimeFactor(hour);
  }

  // Simple trend calculation
  async getTrendFactor(merchantId, days = 7) {
    const recent = await DemandForecast.find({
      merchantId,
      date: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    }).lean();

    if (recent.length < 2) return 1.0;

    // Calculate simple trend
    const halfPoint = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, halfPoint);
    const secondHalf = recent.slice(halfPoint);

    const firstAvg = firstHalf.reduce((s, r) => s + r.actualDemand, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.actualDemand, 0) / secondHalf.length;

    if (firstAvg === 0) return 1.0;
    return Math.min(1.5, Math.max(0.5, secondAvg / firstAvg));
  }

  // Main forecast function
  async forecast(merchantId, itemId = null, date = new Date(), hour = null) {
    const dayOfWeek = date.getDay();
    const forecastHour = hour !== null ? hour : date.getHours();

    // Get components
    const historicalAvg = await this.getHistoricalAvg(merchantId, itemId, dayOfWeek);
    const dayFactor = this.getDayOfWeekFactor(dayOfWeek);
    const timeFactor = this.getMerchantTimeFactor(merchantId, forecastHour);
    const trendFactor = await this.getTrendFactor(merchantId);

    // Calculate weighted prediction
    const predictedDemand = Math.round(
      historicalAvg * this.WEIGHTS.historicalAvg * dayFactor +
      historicalAvg * this.WEIGHTS.dayOfWeek * dayFactor +
      historicalAvg * this.WEIGHTS.time * timeFactor +
      historicalAvg * this.WEIGHTS.trend * trendFactor
    );

    // Calculate confidence based on data availability
    const dataPoints = await DemandForecast.countDocuments({ merchantId });
    const confidence = Math.min(0.95, 0.5 + (dataPoints / 100) * 0.4);

    return {
      predictedDemand: Math.max(0, predictedDemand),
      confidence,
      features: {
        historicalAvg: Math.round(historicalAvg * 100) / 100,
        dayOfWeekFactor: dayFactor,
        timeFactor,
        trendFactor,
        dayOfWeek,
        hour: forecastHour
      }
    };
  }

  // Forecast for entire day
  async forecastDay(merchantId, date = new Date()) {
    const hourlyForecasts = [];
    let totalDemand = 0;

    for (let hour = 6; hour <= 23; hour++) {
      const forecast = await this.forecast(merchantId, null, date, hour);
      hourlyForecasts.push({
        hour,
        ...forecast
      });
      totalDemand += forecast.predictedDemand;
    }

    // Find peak hour
    const peakHour = hourlyForecasts.reduce((max, h) =>
      h.predictedDemand > max.predictedDemand ? h : max
    , hourlyForecasts[0]);

    return {
      date,
      totalDemand,
      peakHour: peakHour.hour,
      peakDemand: peakHour.predictedDemand,
      hourlyBreakdown: hourlyForecasts,
      confidence: peakHour.confidence
    };
  }
}

const forecaster = new DemandForecaster();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
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
  res.json({ status: 'ok', service: 'demand-forecast', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Get forecast for merchant
app.get('/api/forecast/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { date, days = 1 } = req.query;

  const forecastDate = date ? new Date(date) : new Date();

  const forecast = await forecaster.forecastDay(merchantId, forecastDate);

  // Get weekly forecast if requested
  let weeklyForecast = null;
  if (parseInt(days) > 1) {
    weeklyForecast = [];
    for (let i = 0; i < parseInt(days); i++) {
      const dayDate = new Date(forecastDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dayForecast = await forecaster.forecastDay(merchantId, dayDate);
      weeklyForecast.push({
        date: dayDate.toISOString().split('T')[0],
        predictedOrders: dayForecast.totalDemand,
        predictedRevenue: dayForecast.totalDemand * 300, // Assuming avg 300 per order
        confidence: dayForecast.confidence
      });
    }
  }

  res.json({
    success: true,
    merchantId,
    forecast: {
      date: forecastDate.toISOString().split('T')[0],
      totalOrders: forecast.totalDemand,
      peakHour: forecast.peakHour,
      peakDemand: forecast.peakDemand,
      confidence: forecast.confidence,
      hourlyBreakdown: forecast.hourlyBreakdown
    },
    weekly: weeklyForecast
  });
}));

// Get forecast for specific item
app.get('/api/forecast/:merchantId/item/:itemId', asyncHandler(async (req, res) => {
  const { merchantId, itemId } = req.params;
  const { date } = req.query;

  const forecastDate = date ? new Date(date) : new Date();
  const forecast = await forecaster.forecast(merchantId, itemId, forecastDate);

  res.json({
    success: true,
    merchantId,
    itemId,
    forecast: {
      date: forecastDate.toISOString().split('T')[0],
      predictedDemand: forecast.predictedDemand,
      confidence: forecast.confidence
    }
  });
}));

// Record actual demand (for accuracy tracking)
app.post('/api/forecast/:merchantId/record', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const {
    itemId,
    date,
    hour,
    actualDemand,
    predictedDemand
  } = req.body;

  const recordDate = new Date(date);

  // Update or create record
  const record = await DemandForecast.findOneAndUpdate(
    { merchantId, itemId: itemId || null, date: recordDate },
    {
      $set: {
        actualDemand,
        dayOfWeek: recordDate.getDay(),
        hour: hour || recordDate.getHours(),
        accuracy: predictedDemand ? Math.max(0, 1 - Math.abs(actualDemand - predictedDemand) / Math.max(1, predictedDemand)) : null
      }
    },
    { upsert: true, new: true }
  );

  // Update merchant demand summary
  await updateMerchantDemand(merchantId);

  res.json({ success: true, record });
}));

// Get demand insights
app.get('/api/insights/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const merchantDemand = await MerchantDemand.findOne({ merchantId });

  if (!merchantDemand) {
    return res.json({
      success: true,
      insights: { message: 'Insufficient data for insights' }
    });
  }

  const insights = {
    merchantId,
    summary: {
      avgDailyOrders: merchantDemand.avgDailyOrders,
      avgOrderValue: merchantDemand.avgOrderValue,
      forecastAccuracy: (merchantDemand.forecastAccuracy * 100).toFixed(1) + '%'
    },
    patterns: {
      peakHours: merchantDemand.peakHours || [],
      busyDays: merchantDemand.busyDays || []
    },
    alerts: merchantDemand.alerts.filter(a => !a.acknowledged)
  };

  res.json({ success: true, insights });
}));

// Get staffing recommendations
app.get('/api/recommendations/:merchantId/staffing', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const todayForecast = await forecaster.forecastDay(merchantId);

  // Simple staffing model
  const ordersPerStaffPerHour = 5;
  const avgPrepTimeMinutes = 30;

  const recommendations = todayForecast.hourlyBreakdown.map(h => {
    const recommendedStaff = Math.ceil(h.predictedDemand / ordersPerStaffPerHour);
    const status = recommendedStaff > 3 ? 'busy' :
                   recommendedStaff > 1 ? 'normal' : 'quiet';

    return {
      hour: h.hour,
      predictedOrders: h.predictedDemand,
      recommendedStaff,
      status
    };
  });

  res.json({
    success: true,
    merchantId,
    recommendations
  });
}));

// Get inventory recommendations
app.get('/api/recommendations/:merchantId/inventory', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const todayForecast = await forecaster.forecastDay(merchantId);
  const totalOrders = todayForecast.totalDemand;

  // Simple inventory model
  const avgItemsPerOrder = 3;
  const bufferPercent = 0.2; // 20% buffer

  const recommendedInventory = Math.ceil(totalOrders * avgItemsPerOrder * (1 + bufferPercent));

  const recommendations = {
    merchantId,
    date: new Date().toISOString().split('T')[0],
    estimatedOrders: totalOrders,
    estimatedItems: recommendedInventory,
    bufferStock: Math.ceil(recommendedInventory * bufferPercent),
    alerts: []
  };

  // Add alerts
  if (totalOrders > 50) {
    recommendations.alerts.push({
      type: 'demand_spike',
      severity: 'info',
      message: 'High demand expected. Consider increasing inventory by 30%.'
    });
  }

  res.json({ success: true, recommendations });
}));

// Update merchant demand summary
async function updateMerchantDemand(merchantId) {
  const recentOrders = await DemandForecast.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).lean();

  if (recentOrders.length === 0) return;

  // Calculate metrics
  const dailyTotals = {};
  for (const order of recentOrders) {
    const dateKey = order.date.toISOString().split('T')[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + order.actualDemand;
  }

  const avgDailyOrders = Object.values(dailyTotals).reduce((a, b) => a + b, 0) / Object.keys(dailyTotals).length;

  // Calculate peak hours
  const hourlyTotals = {};
  for (const order of recentOrders) {
    const hour = order.hour || 12;
    hourlyTotals[hour] = (hourlyTotals[hour] || 0) + order.actualDemand;
  }

  const peakHours = Object.entries(hourlyTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([h]) => parseInt(h));

  // Calculate busy days
  const dayTotals = {};
  for (const order of recentOrders) {
    const day = order.dayOfWeek || 0;
    dayTotals[day] = (dayTotals[day] || 0) + order.actualDemand;
  }

  const busyDays = Object.entries(dayTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => parseInt(d));

  await MerchantDemand.findOneAndUpdate(
    { merchantId },
    {
      $set: {
        avgDailyOrders: Math.round(avgDailyOrders * 10) / 10,
        peakHours,
        busyDays,
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );
}

app.use(errorHandler);

const PORT = process.env.PORT || 4042;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Demand Forecast Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

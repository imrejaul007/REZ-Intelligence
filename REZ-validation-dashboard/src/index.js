import logger from './utils/logger';

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  warn: (msg, data) => console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

const errorHandler = (err, req, res, next) => {
  logger.error('Error', { error: err.message, path: req.path });
  res.status(500).json({ success: false, error: err.message });
};

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// MongoDB Schemas
const reorderMetricSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  merchantId: String,

  // Predictions
  predictionsSent: { type: Number, default: 0 },
  predictionsCorrect: { type: Number, default: 0 },

  // Notifications
  notificationsSent: { type: Number, default: 0 },
  notificationsClicked: { type: Number, default: 0 },
  notificationsConverted: { type: Number, default: 0 },

  // Reorders
  reordersTriggered: { type: Number, default: 0 },
  repeatPurchases: { type: Number, default: 0 },

  // Accuracy
  accuracy: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 }
});

const identityMetricSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },

  // Cross-app recognition
  usersCrossApp: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  crossAppRate: { type: Number, default: 0 },

  // Identity resolution
  resolutionsAttempted: { type: Number, default: 0 },
  resolutionsSuccessful: { type: Number, default: 0 },
  resolutionRate: { type: Number, default: 0 },

  // Recommendation lift
  personalizedRecs: { type: Number, default: 0 },
  genericRecs: { type: Number, default: 0 },
  recommendationLift: { type: Number, default: 0 }
});

const merchantMetricSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  merchantId: String,

  // ROI metrics
  gmvWithAI: { type: Number, default: 0 },
  gmvWithoutAI: { type: Number, default: 0 },
  gmvLift: { type: Number, default: 0 },

  // Forecast accuracy
  forecastAccuracy: { type: Number, default: 0 },
  inventoryWasteReduction: { type: Number, default: 0 },

  // Retention
  customerRetentionRate: { type: Number, default: 0 },
  churnRate: { type: Number, default: 0 },

  // Revenue
  repeatCustomerRevenue: { type: Number, default: 0 },
  newCustomerRevenue: { type: Number, default: 0 },
  roi: { type: Number, default: 0 }
});

const funnelMetricSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },

  // User funnel
  qrScans: { type: Number, default: 0 },
  pageViews: { type: Number, default: 0 },
  searches: { type: Number, default: 0 },

  // Conversion
  ordersPlaced: { type: Number, default: 0 },
  checkoutRate: { type: Number, default: 0 },

  // Retention
  repeatOrders: { type: Number, default: 0 },
  retentionRate: { type: Number, default: 0 },

  // Revenue
  totalGMV: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 }
});

const experimentSchema = new mongoose.Schema({
  experimentId: { type: String, required: true, unique: true },
  name: String,
  description: String,

  // A/B groups
  control: { type: Number, default: 0 },
  treatment: { type: Number, default: 0 },

  // Results
  controlConversions: { type: Number, default: 0 },
  treatmentConversions: { type: Number, default: 0 },

  controlRate: { type: Number, default: 0 },
  treatmentRate: { type: Number, default: 0 },
  lift: { type: Number, default: 0 },
  pValue: { type: Number, default: 1 },

  // Status
  status: { type: String, enum: ['running', 'completed', 'stopped'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,

  // Statistical significance
  sampleSizeNeeded: Number,
  confidenceInterval: Number
});

const ReorderMetric = mongoose.model('ReorderMetric', reorderMetricSchema);
const IdentityMetric = mongoose.model('IdentityMetric', identityMetricSchema);
const MerchantMetric = mongoose.model('MerchantMetric', merchantMetricSchema);
const FunnelMetric = mongoose.model('FunnelMetric', funnelMetricSchema);
const Experiment = mongoose.model('Experiment', experimentSchema);

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
  const publicPaths = ['/health', '/ready', '/dashboard'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'validation-dashboard', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// ============================================
// REORDER METRICS
// ============================================

// Record reorder prediction
app.post('/api/metrics/reorder/predict', async (req, res) => {
  try {
    const { merchantId, predicted, actual, notificationClicked, notificationConverted } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metric = await ReorderMetric.findOne({ date: today, merchantId });

    if (!metric) {
      metric = new ReorderMetric({ merchantId, date: today });
    }

    metric.predictionsSent += 1;
    if (actual) metric.predictionsCorrect += 1;
    if (notificationClicked) metric.notificationsClicked += 1;
    if (notificationConverted) metric.notificationsConverted += 1;

    // Calculate rates
    metric.accuracy = metric.predictionsSent > 0
      ? (metric.predictionsCorrect / metric.predictionsSent * 100).toFixed(1)
      : 0;
    metric.ctr = metric.notificationsSent > 0
      ? (metric.notificationsClicked / metric.notificationsSent * 100).toFixed(1)
      : 0;
    metric.conversionRate = metric.notificationsClicked > 0
      ? (metric.notificationsConverted / metric.notificationsClicked * 100).toFixed(1)
      : 0;

    await metric.save();

    res.json({ success: true, metric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record notification sent
app.post('/api/metrics/reorder/notification', async (req, res) => {
  try {
    const { merchantId } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metric = await ReorderMetric.findOne({ date: today, merchantId });

    if (!metric) {
      metric = new ReorderMetric({ merchantId, date: today });
    }

    metric.notificationsSent += 1;
    await metric.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get reorder metrics
app.get('/api/metrics/reorder', async (req, res) => {
  try {
    const { days = 7, merchantId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = { date: { $gte: startDate } };
    if (merchantId) query.merchantId = merchantId;

    const metrics = await ReorderMetric.find(query).sort({ date: -1 });

    // Calculate aggregates
    const totals = metrics.reduce((acc, m) => ({
      predictionsSent: acc.predictionsSent + m.predictionsSent,
      predictionsCorrect: acc.predictionsCorrect + m.predictionsCorrect,
      notificationsSent: acc.notificationsSent + m.notificationsSent,
      notificationsClicked: acc.notificationsClicked + m.notificationsClicked,
      notificationsConverted: acc.notificationsConverted + m.notificationsConverted
    }), { predictionsSent: 0, predictionsCorrect: 0, notificationsSent: 0, notificationsClicked: 0, notificationsConverted: 0 });

    const kpis = {
      accuracy: totals.predictionsSent > 0
        ? (totals.predictionsCorrect / totals.predictionsSent * 100).toFixed(1)
        : 0,
      ctr: totals.notificationsSent > 0
        ? (totals.notificationsClicked / totals.notificationsSent * 100).toFixed(1)
        : 0,
      conversionRate: totals.notificationsClicked > 0
        ? (totals.notificationsConverted / totals.notificationsClicked * 100).toFixed(1)
        : 0,
      status: totals.predictionsSent > 0 ? 'GREEN' : 'NO_DATA'
    };

    // Set status
    if (kpis.accuracy >= 65 && kpis.ctr >= 8 && kpis.conversionRate >= 10) {
      kpis.status = 'GREEN';
    } else if (kpis.accuracy >= 50 || kpis.ctr >= 5) {
      kpis.status = 'YELLOW';
    } else if (totals.predictionsSent > 0) {
      kpis.status = 'RED';
    }

    res.json({ success: true, kpis, daily: metrics, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// IDENTITY METRICS
// ============================================

app.post('/api/metrics/identity/resolve', async (req, res) => {
  try {
    const { crossApp } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metric = await IdentityMetric.findOne({ date: today });

    if (!metric) {
      metric = new IdentityMetric({ date: today });
    }

    metric.totalUsers += 1;
    metric.resolutionsAttempted += 1;
    if (crossApp) metric.usersCrossApp += 1;

    metric.crossAppRate = (metric.usersCrossApp / metric.totalUsers * 100).toFixed(1);

    await metric.save();

    res.json({ success: true, metric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics/identity', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const metrics = await IdentityMetric.find({ date: { $gte: startDate } }).sort({ date: -1 });

    const kpis = {
      avgCrossAppRate: 0,
      avgResolutionRate: 0,
      recommendationLift: 0,
      status: 'NO_DATA'
    };

    if (metrics.length > 0) {
      kpis.avgCrossAppRate = (metrics.reduce((s, m) => s + parseFloat(m.crossAppRate || 0), 0) / metrics.length).toFixed(1);
      kpis.avgResolutionRate = (metrics.reduce((s, m) => s + parseFloat(m.resolutionRate || 0), 0) / metrics.length).toFixed(1);
      kpis.recommendationLift = (metrics.reduce((s, m) => s + parseFloat(m.recommendationLift || 0), 0) / metrics.length).toFixed(1);

      if (parseFloat(kpis.recommendationLift) > 10) kpis.status = 'GREEN';
      else if (parseFloat(kpis.recommendationLift) > 5) kpis.status = 'YELLOW';
      else if (metrics.length > 7) kpis.status = 'RED';
    }

    res.json({ success: true, kpis, daily: metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// MERCHANT METRICS
// ============================================

app.post('/api/metrics/merchant', async (req, res) => {
  try {
    const metric = new MerchantMetric(req.body);
    await metric.save();
    res.json({ success: true, metric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics/merchant', async (req, res) => {
  try {
    const { days = 7, merchantId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = { date: { $gte: startDate } };
    if (merchantId) query.merchantId = merchantId;

    const metrics = await MerchantMetric.find(query).sort({ date: -1 });

    const kpis = {
      avgGMVLift: 0,
      avgForecastAccuracy: 0,
      avgRetentionRate: 0,
      avgROI: 0,
      status: 'NO_DATA'
    };

    if (metrics.length > 0) {
      kpis.avgGMVLift = (metrics.reduce((s, m) => s + (m.gmvLift || 0), 0) / metrics.length).toFixed(1);
      kpis.avgForecastAccuracy = (metrics.reduce((s, m) => s + (m.forecastAccuracy || 0), 0) / metrics.length).toFixed(1);
      kpis.avgRetentionRate = (metrics.reduce((s, m) => s + (m.customerRetentionRate || 0), 0) / metrics.length).toFixed(1);
      kpis.avgROI = (metrics.reduce((s, m) => s + (m.roi || 0), 0) / metrics.length).toFixed(1);

      if (parseFloat(kpis.avgROI) >= 10) kpis.status = 'GREEN';
      else if (parseFloat(kpis.avgROI) >= 5) kpis.status = 'YELLOW';
      else if (metrics.length > 14) kpis.status = 'RED';
    }

    res.json({ success: true, kpis, daily: metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FUNNEL METRICS
// ============================================

app.post('/api/metrics/funnel', async (req, res) => {
  try {
    const { type, value = 1 } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metric = await FunnelMetric.findOne({ date: today });

    if (!metric) {
      metric = new FunnelMetric({ date: today });
    }

    switch (type) {
      case 'qr_scan': metric.qrScans += value; break;
      case 'page_view': metric.pageViews += value; break;
      case 'search': metric.searches += value; break;
      case 'order':
        metric.ordersPlaced += value;
        metric.totalGMV += value.gmv || 0;
        break;
      case 'repeat': metric.repeatOrders += value; break;
    }

    // Calculate rates
    metric.checkoutRate = metric.qrScans > 0
      ? (metric.ordersPlaced / metric.qrScans * 100).toFixed(1)
      : 0;
    metric.retentionRate = metric.ordersPlaced > 0
      ? (metric.repeatOrders / metric.ordersPlaced * 100).toFixed(1)
      : 0;
    metric.avgOrderValue = metric.ordersPlaced > 0
      ? (metric.totalGMV / metric.ordersPlaced).toFixed(0)
      : 0;

    await metric.save();

    res.json({ success: true, metric });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/metrics/funnel', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const metrics = await FunnelMetric.find({ date: { $gte: startDate } }).sort({ date: -1 });

    const totals = metrics.reduce((acc, m) => ({
      qrScans: acc.qrScans + (m.qrScans || 0),
      pageViews: acc.pageViews + (m.pageViews || 0),
      searches: acc.searches + (m.searches || 0),
      ordersPlaced: acc.ordersPlaced + (m.ordersPlaced || 0),
      repeatOrders: acc.repeatOrders + (m.repeatOrders || 0),
      totalGMV: acc.totalGMV + (m.totalGMV || 0)
    }), { qrScans: 0, pageViews: 0, searches: 0, ordersPlaced: 0, repeatOrders: 0, totalGMV: 0 });

    const kpis = {
      checkoutRate: totals.qrScans > 0 ? (totals.ordersPlaced / totals.qrScans * 100).toFixed(1) : 0,
      retentionRate: totals.ordersPlaced > 0 ? (totals.repeatOrders / totals.ordersPlaced * 100).toFixed(1) : 0,
      avgOrderValue: totals.ordersPlaced > 0 ? (totals.totalGMV / totals.ordersPlaced).toFixed(0) : 0,
      totalGMV: totals.totalGMV.toFixed(0)
    };

    res.json({ success: true, kpis, daily: metrics, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// EXPERIMENTS (A/B Testing)
// ============================================

app.post('/api/experiments', async (req, res) => {
  try {
    const experiment = new Experiment({
      experimentId: `exp_${uuidv4().substring(0, 8)}`,
      ...req.body
    });
    await experiment.save();
    res.json({ success: true, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/experiments/:id/conversion', async (req, res) => {
  try {
    const { group } = req.body;

    const experiment = await Experiment.findById(req.params.id);

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    if (group === 'control') {
      experiment.control += 1;
      experiment.controlConversions += 1;
    } else {
      experiment.treatment += 1;
      experiment.treatmentConversions += 1;
    }

    // Calculate rates
    experiment.controlRate = experiment.control > 0
      ? (experiment.controlConversions / experiment.control * 100).toFixed(2)
      : 0;
    experiment.treatmentRate = experiment.treatment > 0
      ? (experiment.treatmentConversions / experiment.treatment * 100).toFixed(2)
      : 0;
    experiment.lift = experiment.controlRate > 0
      ? ((experiment.treatmentRate - experiment.controlRate) / experiment.controlRate * 100).toFixed(2)
      : 0;

    // Simple p-value approximation
    const total = experiment.control + experiment.treatment;
    experiment.sampleSizeNeeded = Math.ceil(1000 / (1 + experiment.lift / 10));

    await experiment.save();

    res.json({ success: true, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/experiments', async (req, res) => {
  try {
    const experiments = await Experiment.find().sort({ startedAt: -1 });
    res.json({ success: true, experiments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DASHBOARD (Public)
// ============================================

app.get('/dashboard', async (req, res) => {
  try {
    const [reorderMetrics, identityMetrics, merchantMetrics, funnelMetrics] = await Promise.all([
      ReorderMetric.find().sort({ date: -1 }).limit(7),
      IdentityMetric.find().sort({ date: -1 }).limit(7),
      MerchantMetric.find().sort({ date: -1 }).limit(7),
      FunnelMetric.find().sort({ date: -1 }).limit(7)
    ]);

    // Calculate dashboard KPIs
    const reorderTotals = reorderMetrics.reduce((s, m) => ({
      sent: s.sent + m.notificationsSent,
      clicked: s.clicked + m.notificationsClicked,
      converted: s.converted + m.notificationsConverted
    }), { sent: 0, clicked: 0, converted: 0 });

    const funnelTotals = funnelMetrics.reduce((s, m) => ({
      scans: s.scans + (m.qrScans || 0),
      orders: s.orders + (m.ordersPlaced || 0),
      gmv: s.gmv + (m.totalGMV || 0)
    }), { scans: 0, orders: 0, gmv: 0 });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      kpis: {
        reorder: {
          accuracy: reorderMetrics.length > 0
            ? reorderMetrics[0].accuracy
            : null,
          ctr: reorderTotals.sent > 0
            ? (reorderTotals.clicked / reorderTotals.sent * 100).toFixed(1)
            : null,
          conversion: reorderTotals.clicked > 0
            ? (reorderTotals.converted / reorderTotals.clicked * 100).toFixed(1)
            : null,
          status: reorderMetrics.length > 0 ? 'ACTIVE' : 'NO_DATA'
        },
        identity: {
          crossAppRate: identityMetrics.length > 0
            ? identityMetrics[0].crossAppRate
            : null,
          status: identityMetrics.length > 0 ? 'ACTIVE' : 'NO_DATA'
        },
        merchant: {
          roi: merchantMetrics.length > 0
            ? merchantMetrics[0].roi
            : null,
          status: merchantMetrics.length > 0 ? 'ACTIVE' : 'NO_DATA'
        },
        funnel: {
          checkoutRate: funnelTotals.scans > 0
            ? (funnelTotals.orders / funnelTotals.scans * 100).toFixed(1)
            : null,
          avgOrderValue: funnelTotals.orders > 0
            ? (funnelTotals.gmv / funnelTotals.orders).toFixed(0)
            : null,
          totalGMV: funnelTotals.gmv.toFixed(0),
          status: funnelMetrics.length > 0 ? 'ACTIVE' : 'NO_DATA'
        }
      },
      validation: {
        reorderAccuracy: {
          target: 65,
          current: parseFloat(reorderMetrics[0]?.accuracy || 0),
          pass: parseFloat(reorderMetrics[0]?.accuracy || 0) >= 65
        },
        ctr: {
          target: 8,
          current: parseFloat(reorderTotals.sent > 0
            ? (reorderTotals.clicked / reorderTotals.sent * 100).toFixed(1)
            : 0),
          pass: reorderTotals.sent > 0 && (reorderTotals.clicked / reorderTotals.sent * 100) >= 8
        },
        conversionRate: {
          target: 10,
          current: parseFloat(reorderTotals.clicked > 0
            ? (reorderTotals.converted / reorderTotals.clicked * 100).toFixed(1)
            : 0),
          pass: reorderTotals.clicked > 0 && (reorderTotals.converted / reorderTotals.clicked * 100) >= 10
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '4153', 10);

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Validation Dashboard running on port ${PORT}`);
      logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

import logger from './utils/logger';

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

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

// Dashboard widget types
const WIDGET_TYPES = {
  METRIC: 'metric',
  CHART: 'chart',
  TABLE: 'table',
  ALERT: 'alert',
  ACTION: 'action',
  INSIGHT: 'insight'
};

// MongoDB Schemas
const merchantSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: String,
  phone: String,

  // Business info
  business: {
    type: { type: String, enum: ['restaurant', 'hotel', 'retail', 'services'] },
    name: String,
    address: String,
    city: String,
    pincode: String
  },

  // Subscription
  subscription: {
    plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
    expiresAt: Date,
    features: [String]
  },

  // Connected services
  connections: {
    pos: { type: Boolean, default: false },
    aggregator: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    orders: { type: Boolean, default: false }
  },

  // Preferences
  preferences: {
    dashboardLayout: mongoose.Schema.Types.Mixed,
    notifications: mongoose.Schema.Types.Mixed,
    timezone: { type: String, default: 'Asia/Kolkata' }
  },

  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Merchant = mongoose.model('Merchant', merchantSchema);

// Dashboard schema
const dashboardSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, default: 'Main Dashboard' },

  widgets: [{
    id: String,
    type: { type: String, enum: Object.values(WIDGET_TYPES) },
    title: String,
    config: mongoose.Schema.Types.Mixed,
    position: { x: Number, y: Number, w: Number, h: Number },
    size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
  }],

  filters: {
    dateRange: { type: String, enum: ['today', '7d', '30d', '90d', 'custom'], default: '7d' },
    comparison: { type: Boolean, default: false }
  },

  isDefault: { type: Boolean, default: false },

  updatedAt: Date
}, { timestamps: true });

const Dashboard = mongoose.model('Dashboard', dashboardSchema);

// Alert schema
const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },

  type: { type: String, enum: ['inventory', 'order', 'payment', 'customer', 'performance', 'system'] },
  severity: { type: String, enum: ['info', 'warning', 'critical'] },

  title: String,
  message: String,

  data: mongoose.Schema.Types.Mixed,

  action: {
    type: { type: String, enum: ['none', 'view', 'link'] },
    label: String,
    url: String
  },

  status: { type: String, enum: ['new', 'seen', 'actioned', 'dismissed'], default: 'new' },

  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
}, { timestamps: true });

alertSchema.index({ merchantId: 1, status: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

// Notification schema
const notificationSchema = new mongoose.Schema({
  notificationId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },

  type: { type: String, enum: ['order', 'payment', 'customer', 'system', 'report'] },

  title: String,
  body: String,

  data: mongoose.Schema.Types.Mixed,

  read: { type: Boolean, default: false },
  readAt: Date,

  channels: [{ type: String, enum: ['in_app', 'email', 'sms', 'push'] }],

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ merchantId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

// Merchant OS Engine
class MerchantOSEngine {
  // Generate default dashboard based on subscription
  generateDefaultDashboard(plan) {
    const widgets = [
      {
        id: 'metric_orders',
        type: WIDGET_TYPES.METRIC,
        title: 'Orders Today',
        config: { metric: 'orders', format: 'number' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        size: 'small'
      },
      {
        id: 'metric_revenue',
        type: WIDGET_TYPES.METRIC,
        title: 'Revenue',
        config: { metric: 'revenue', format: 'currency' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        size: 'small'
      },
      {
        id: 'metric_customers',
        type: WIDGET_TYPES.METRIC,
        title: 'New Customers',
        config: { metric: 'new_customers', format: 'number' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        size: 'small'
      },
      {
        id: 'chart_orders',
        type: WIDGET_TYPES.CHART,
        title: 'Orders Trend',
        config: { chartType: 'line', metric: 'orders', groupBy: 'day' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        size: 'medium'
      },
      {
        id: 'alerts_recent',
        type: WIDGET_TYPES.ALERT,
        title: 'Recent Alerts',
        config: { limit: 5, types: ['inventory', 'order'] },
        position: { x: 6, y: 2, w: 6, h: 4 },
        size: 'medium'
      }
    ];

    // Add more widgets for higher plans
    if (plan === 'pro' || plan === 'enterprise') {
      widgets.push({
        id: 'insight_top_items',
        type: WIDGET_TYPES.INSIGHT,
        title: 'Top Performing Items',
        config: { metric: 'top_items', limit: 5 },
        position: { x: 0, y: 6, w: 4, h: 3 },
        size: 'small'
      });
      widgets.push({
        id: 'action_reorder',
        type: WIDGET_TYPES.ACTION,
        title: 'Reorder Suggestions',
        config: { basedOn: 'low_stock' },
        position: { x: 4, y: 6, w: 4, h: 3 },
        size: 'small'
      });
    }

    return widgets;
  }

  // Generate alerts based on data
  async generateAlerts(merchantId) {
    const alerts = [];

    // This would integrate with other services
    // For now, just return structure
    return alerts;
  }

  // Get dashboard metrics
  async getMetrics(merchantId, dateRange = '7d') {
    // Calculate date range
    const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Mock metrics - in production, these would come from other services
    // Using crypto.randomInt for secure mock data generation
    const metrics = {
      orders: crypto.randomInt(100, 600),
      revenue: crypto.randomInt(10000, 110000),
      customers: crypto.randomInt(10, 60),
      avgOrderValue: crypto.randomInt(150, 650),
      newCustomers: crypto.randomInt(5, 25),
      returningCustomers: crypto.randomInt(10, 40),
      completionRate: crypto.randomInt(80, 100),
      avgDeliveryTime: crypto.randomInt(25, 45)
    };

    // Calculate growth
    const previousPeriod = {
      orders: Math.floor(metrics.orders * (0.9 + crypto.randomInt(0, 20) / 100)),
      revenue: Math.floor(metrics.revenue * (0.9 + crypto.randomInt(0, 20) / 100))
    };

    return {
      current: metrics,
      previous: previousPeriod,
      growth: {
        orders: ((metrics.orders - previousPeriod.orders) / previousPeriod.orders * 100).toFixed(1),
        revenue: ((metrics.revenue - previousPeriod.revenue) / previousPeriod.revenue * 100).toFixed(1)
      },
      period: dateRange
    };
  }

  // Get chart data
  async getChartData(merchantId, metric, groupBy = 'day', days = 7) {
    const data = [];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      data.push({
        date: date.toISOString().split('T')[0],
        value: crypto.randomInt(20, 120)
      });
    }

    return { metric, groupBy, data };
  }
}

const engine = new MerchantOSEngine();

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
    service: 'merchant-os',
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

// Merchant endpoints
app.get('/api/merchants/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  let merchant = await Merchant.findOne({ merchantId });

  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  // Update last login
  merchant.lastLogin = new Date();
  await merchant.save();

  res.json({ success: true, merchant });
}));

app.post('/api/merchants', asyncHandler(async (req, res) => {
  const merchantId = `merch_${uuidv4()}`;
  const merchantData = { merchantId, ...req.body };

  const merchant = await Merchant.create(merchantData);

  // Create default dashboard
  const dashboard = await Dashboard.create({
    merchantId,
    name: 'Main Dashboard',
    widgets: engine.generateDefaultDashboard(merchant.subscription?.plan || 'free'),
    isDefault: true
  });

  res.status(201).json({ success: true, merchant, dashboard });
}));

// Dashboard endpoints
app.get('/api/merchants/:merchantId/dashboard', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { dateRange = '7d' } = req.query;

  let dashboard = await Dashboard.findOne({ merchantId, isDefault: true });

  if (!dashboard) {
    const merchant = await Merchant.findOne({ merchantId });
    dashboard = await Dashboard.create({
      merchantId,
      name: 'Main Dashboard',
      widgets: engine.generateDefaultDashboard(merchant?.subscription?.plan || 'free'),
      isDefault: true
    });
  }

  // Get metrics
  const metrics = await engine.getMetrics(merchantId, dateRange);

  res.json({ success: true, dashboard, metrics });
}));

app.patch('/api/merchants/:merchantId/dashboard', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { widgets, filters } = req.body;

  const dashboard = await Dashboard.findOneAndUpdate(
    { merchantId, isDefault: true },
    {
      $set: {
        ...(widgets && { widgets }),
        ...(filters && { filters }),
        updatedAt: new Date()
      }
    },
    { new: true }
  );

  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  res.json({ success: true, dashboard });
}));

// Metrics endpoint
app.get('/api/merchants/:merchantId/metrics', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { dateRange = '7d', comparison = 'true' } = req.query;

  const metrics = await engine.getMetrics(merchantId, dateRange);

  res.json({ success: true, metrics });
}));

// Chart data endpoint
app.get('/api/merchants/:merchantId/charts', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { metric = 'orders', groupBy = 'day', days = 7 } = req.query;

  const chartData = await engine.getChartData(merchantId, metric, groupBy, parseInt(days));

  res.json({ success: true, chartData });
}));

// Alerts endpoints
app.get('/api/merchants/:merchantId/alerts', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { status = 'new', limit = 20 } = req.query;

  const query = { merchantId };
  if (status !== 'all') query.status = status;

  const alerts = await Alert.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, alerts, count: alerts.length });
}));

app.patch('/api/merchants/:merchantId/alerts/:alertId', asyncHandler(async (req, res) => {
  const { merchantId, alertId } = req.params;
  const { status } = req.body;

  const alert = await Alert.findOneAndUpdate(
    { alertId, merchantId },
    { $set: { status } },
    { new: true }
  );

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({ success: true, alert });
}));

// Notifications endpoints
app.get('/api/merchants/:merchantId/notifications', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { unreadOnly = 'false', limit = 50 } = req.query;

  const query = { merchantId };
  if (unreadOnly === 'true') query.read = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  const unreadCount = await Notification.countDocuments({ merchantId, read: false });

  res.json({ success: true, notifications, unreadCount });
}));

app.patch('/api/merchants/:merchantId/notifications/:notificationId/read', asyncHandler(async (req, res) => {
  const { merchantId, notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { notificationId, merchantId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json({ success: true, notification });
}));

// AI-powered insights endpoint
app.get('/api/merchants/:merchantId/insights', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  // Get metrics
  const metrics = await engine.getMetrics(merchantId, '7d');

  // Generate insights based on metrics
  const insights = [];

  // Revenue insight
  if (parseFloat(metrics.growth.revenue) > 15) {
    insights.push({
      type: 'positive',
      title: 'Strong revenue growth',
      description: `Your revenue is up ${metrics.growth.revenue}% compared to last week.`,
      action: { type: 'view', label: 'View details' }
    });
  } else if (parseFloat(metrics.growth.revenue) < -10) {
    insights.push({
      type: 'warning',
      title: 'Revenue decline detected',
      description: `Revenue is down ${metrics.growth.revenue}% compared to last week.`,
      action: { type: 'view', label: 'View details' }
    });
  }

  // Order volume insight
  if (metrics.current.completionRate < 85) {
    insights.push({
      type: 'warning',
      title: 'Order completion rate below target',
      description: `Only ${metrics.current.completionRate}% of orders completed. Consider investigating delays.`,
      action: { type: 'link', label: 'View orders', url: '/orders' }
    });
  }

  // Customer retention insight
  const retentionRate = metrics.current.returningCustomers / (metrics.current.newCustomers + metrics.current.returningCustomers);
  if (retentionRate < 0.5) {
    insights.push({
      type: 'info',
      title: 'Build customer loyalty',
      description: 'Only a third of your customers are returning. Consider a loyalty program.',
      action: { type: 'link', label: 'Learn more', url: '/loyalty' }
    });
  }

  res.json({ success: true, insights });
}));

// SSO endpoints (for merchant app)
app.get('/api/auth/merchant/:merchantId/token', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  // In production, this would verify credentials and generate JWT
  const merchant = await Merchant.findOne({ merchantId });

  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  // Generate temporary token for SSO
  const token = uuidv4();

  res.json({
    success: true,
    token,
    merchant: {
      merchantId: merchant.merchantId,
      name: merchant.name,
      email: merchant.email,
      subscription: merchant.subscription,
      connections: merchant.connections
    }
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4073;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Merchant OS Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

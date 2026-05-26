import 'dotenv/config';
import express, { Request, Response } from 'express';
import { logger } from './utils/logger.js';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { requestIdMiddleware } from './logger.js';
import { errorHandler, asyncHandler } from './errors.js';
import { engine } from './services/MerchantOSEngine.js';
import {
  WidgetType,
  SubscriptionPlan,
  AlertStatus,
  Insight,
  InsightType,
} from './types.js';

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware);

// Internal authentication middleware
const authenticateMiddleware = (req: Request, res: Response, next: express.NextFunction): void => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some((p) => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

app.use(authenticateMiddleware);

// MongoDB Models
const getMerchantModel = () => {
  const mongoose = require('mongoose');
  const merchantSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    business: {
      type: { type: String, enum: ['restaurant', 'hotel', 'retail', 'services'] },
      name: String,
      address: String,
      city: String,
      pincode: String,
    },
    subscription: {
      plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
      expiresAt: Date,
      features: [String],
    },
    connections: {
      pos: { type: Boolean, default: false },
      aggregator: { type: Boolean, default: false },
      payment: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      orders: { type: Boolean, default: false },
    },
    preferences: {
      dashboardLayout: mongoose.Schema.Types.Mixed,
      notifications: mongoose.Schema.Types.Mixed,
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now },
  }, { timestamps: true });

  return mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);
};

const getDashboardModel = () => {
  const mongoose = require('mongoose');
  const dashboardSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, index: true },
    name: { type: String, default: 'Main Dashboard' },
    widgets: [{
      id: String,
      type: { type: String, enum: Object.values(WidgetType) },
      title: String,
      config: mongoose.Schema.Types.Mixed,
      position: { x: Number, y: Number, w: Number, h: Number },
      size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    }],
    filters: {
      dateRange: { type: String, enum: ['today', '7d', '30d', '90d', 'custom'], default: '7d' },
      comparison: { type: Boolean, default: false },
    },
    isDefault: { type: Boolean, default: false },
    updatedAt: Date,
  }, { timestamps: true });

  return mongoose.models.Dashboard || mongoose.model('Dashboard', dashboardSchema);
};

const getAlertModel = () => {
  const mongoose = require('mongoose');
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
      url: String,
    },
    status: { type: String, enum: ['new', 'seen', 'actioned', 'dismissed'], default: 'new' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
  }, { timestamps: true });

  alertSchema.index({ merchantId: 1, status: 1, createdAt: -1 });

  return mongoose.models.Alert || mongoose.model('Alert', alertSchema);
};

const getNotificationModel = () => {
  const mongoose = require('mongoose');
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
    createdAt: { type: Date, default: Date.now },
  }, { timestamps: true });

  notificationSchema.index({ merchantId: 1, read: 1, createdAt: -1 });

  return mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
};

// Health endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'merchant-os',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
}));

// Merchant endpoints
app.get('/api/merchants/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const Merchant = getMerchantModel();
  let merchant = await Merchant.findOne({ merchantId });

  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  // Update last login
  merchant.lastLogin = new Date();
  await merchant.save();

  res.json({ success: true, merchant });
}));

app.post('/api/merchants', asyncHandler(async (req: Request, res: Response) => {
  const merchantId = `merch_${uuidv4()}`;
  const Merchant = getMerchantModel();
  const Dashboard = getDashboardModel();

  const merchant = await Merchant.create({
    merchantId,
    ...req.body,
  });

  // Create default dashboard
  const plan = (merchant.subscription?.plan as SubscriptionPlan) || SubscriptionPlan.FREE;
  const dashboard = await Dashboard.create({
    merchantId,
    name: 'Main Dashboard',
    widgets: engine.generateDefaultDashboard(plan),
    isDefault: true,
  });

  res.status(201).json({ success: true, merchant, dashboard });
}));

// Dashboard endpoints
app.get('/api/merchants/:merchantId/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { dateRange = '7d' } = req.query;

  const Dashboard = getDashboardModel();
  const Merchant = getMerchantModel();

  let dashboard = await Dashboard.findOne({ merchantId, isDefault: true });

  if (!dashboard) {
    const merchant = await Merchant.findOne({ merchantId });
    const plan = (merchant?.subscription?.plan as SubscriptionPlan) || SubscriptionPlan.FREE;
    dashboard = await Dashboard.create({
      merchantId,
      name: 'Main Dashboard',
      widgets: engine.generateDefaultDashboard(plan),
      isDefault: true,
    });
  }

  // Get metrics
  const metrics = await engine.getMetrics(merchantId, dateRange as string);

  res.json({ success: true, dashboard, metrics });
}));

app.patch('/api/merchants/:merchantId/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { widgets, filters } = req.body;

  const Dashboard = getDashboardModel();
  const dashboard = await Dashboard.findOneAndUpdate(
    { merchantId, isDefault: true },
    {
      $set: {
        ...(widgets && { widgets }),
        ...(filters && { filters }),
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  res.json({ success: true, dashboard });
}));

// Metrics endpoint
app.get('/api/merchants/:merchantId/metrics', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { dateRange = '7d' } = req.query;

  const metrics = await engine.getMetrics(merchantId, dateRange as string);

  res.json({ success: true, metrics });
}));

// Chart data endpoint
app.get('/api/merchants/:merchantId/charts', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { metric = 'orders', groupBy = 'day', days = '7' } = req.query;

  const chartData = await engine.getChartData(
    merchantId,
    metric as string,
    groupBy as string,
    parseInt(days as string)
  );

  res.json({ success: true, chartData });
}));

// Alerts endpoints
app.get('/api/merchants/:merchantId/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { status = 'new', limit = '20' } = req.query;

  const Alert = getAlertModel();
  const query: Record<string, unknown> = { merchantId };
  if (status !== 'all') query.status = status;

  const alerts = await Alert.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string))
    .lean();

  res.json({ success: true, alerts, count: alerts.length });
}));

app.patch('/api/merchants/:merchantId/alerts/:alertId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, alertId } = req.params;
  const { status } = req.body;

  const Alert = getAlertModel();
  const alert = await Alert.findOneAndUpdate(
    { alertId, merchantId },
    { $set: { status } as Record<string, unknown> },
    { new: true }
  );

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  res.json({ success: true, alert });
}));

// Notifications endpoints
app.get('/api/merchants/:merchantId/notifications', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { unreadOnly = 'false', limit = '50' } = req.query;

  const Notification = getNotificationModel();
  const query: Record<string, unknown> = { merchantId };
  if (unreadOnly === 'true') query.read = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string))
    .lean();

  const unreadCount = await Notification.countDocuments({ merchantId, read: false });

  res.json({ success: true, notifications, unreadCount });
}));

app.patch('/api/merchants/:merchantId/notifications/:notificationId/read', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, notificationId } = req.params;

  const Notification = getNotificationModel();
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
app.get('/api/merchants/:merchantId/insights', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  // Get metrics
  const metrics = await engine.getMetrics(merchantId, '7d');

  // Generate insights based on metrics
  const insights: Insight[] = [];

  // Revenue insight
  if (parseFloat(metrics.growth.revenue) > 15) {
    insights.push({
      type: InsightType.POSITIVE,
      title: 'Strong revenue growth',
      description: `Your revenue is up ${metrics.growth.revenue}% compared to last week.`,
      action: { type: 'view', label: 'View details' },
    });
  } else if (parseFloat(metrics.growth.revenue) < -10) {
    insights.push({
      type: InsightType.WARNING,
      title: 'Revenue decline detected',
      description: `Revenue is down ${metrics.growth.revenue}% compared to last week.`,
      action: { type: 'view', label: 'View details' },
    });
  }

  // Order volume insight
  if (metrics.current.completionRate < 85) {
    insights.push({
      type: InsightType.WARNING,
      title: 'Order completion rate below target',
      description: `Only ${metrics.current.completionRate}% of orders completed. Consider investigating delays.`,
      action: { type: 'link', label: 'View orders', url: '/orders' },
    });
  }

  // Customer retention insight
  const totalCustomers = metrics.current.newCustomers + metrics.current.returningCustomers;
  const retentionRate = totalCustomers > 0 ? metrics.current.returningCustomers / totalCustomers : 0;
  if (retentionRate < 0.5) {
    insights.push({
      type: InsightType.INFO,
      title: 'Build customer loyalty',
      description: 'Only a third of your customers are returning. Consider a loyalty program.',
      action: { type: 'link', label: 'Learn more', url: '/loyalty' },
    });
  }

  res.json({ success: true, insights });
}));

// SSO endpoints (for merchant app)
app.get('/api/auth/merchant/:merchantId/token', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const Merchant = getMerchantModel();
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
      connections: merchant.connections,
    },
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4073;

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Merchant OS Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: (err as Error).message });
    process.exit(1);
  }
}

start();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import alertRoutes from './routes/alertRoutes.js';
import productRoutes from './routes/productRoutes.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4064;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-inventory-alerts';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Logger setup
const logger = {
  info: (message, meta = {}) => console.log(`[${new Date().toISOString()}] INFO: ${message}`, JSON.stringify(meta)),
  error: (message, meta = {}) => console.error(`[${new Date().toISOString()}] ERROR: ${message}`, JSON.stringify(meta)),
  warn: (message, meta = {}) => console.warn(`[${new Date().toISOString()}] WARN: ${message}`, JSON.stringify(meta))
};

// MongoDB Schemas
const monitoredProductSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  name: String,
  sku: String,
  locationId: { type: String, index: true },
  franchiseId: { type: String, index: true },
  supplierId: String,
  currentStock: { type: Number, default: 0 },
  threshold: { type: Number, default: 10 },
  criticalThreshold: { type: Number, default: 5 },
  reorderPoint: { type: Number },
  reorderQuantity: { type: Number },
  lastChecked: Date,
  lastAlerted: Date,
  status: {
    type: String,
    enum: ['ok', 'low_stock', 'critical', 'out_of_stock', 'paused'],
    default: 'ok'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

monitoredProductSchema.index({ status: 1 });
monitoredProductSchema.index({ currentStock: 1 });

const MonitoredProduct = mongoose.model('MonitoredProduct', monitoredProductSchema);

const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  productId: { type: String, required: true, index: true },
  locationId: String,
  franchiseId: String,
  type: {
    type: String,
    enum: ['low_stock', 'critical', 'out_of_stock', 'restock_complete', 'threshold_changed'],
    required: true
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
  currentStock: Number,
  threshold: Number,
  message: String,
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'snoozed'],
    default: 'active'
  },
  acknowledgedBy: String,
  acknowledgedAt: Date,
  resolvedBy: String,
  resolvedAt: Date,
  snoozedUntil: Date,
  channels: [String],
  sentTo: [{
    channel: String,
    sentAt: Date,
    success: Boolean
  }],
  createdAt: { type: Date, default: Date.now }
});

alertSchema.index({ status: 1, type: 1 });
alertSchema.index({ createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

const alertRuleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  franchiseId: String,
  locationId: String,
  conditions: {
    productIds: [String],
    categories: [String],
    suppliers: [String],
    stockLevels: {
      below: Number,
      above: Number
    }
  },
  actions: {
    notifyChannels: [String],
    notifyEmails: [String],
    webhooks: [String],
    autoReorder: { type: Boolean, default: false }
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

alertRuleSchema.index({ enabled: 1 });

const AlertRule = mongoose.model('AlertRule', alertRuleSchema);

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

function internalAuth(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

const rateLimitMap = new Map();
function rateLimitMiddleware(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, resetTime: now + 60000 };
  if (now > record.resetTime) { rateLimitMap.set(key, { count: 1, resetTime: now + 60000 }); return next(); }
  if (record.count >= 100) return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  record.count++;
  rateLimitMap.set(key, record);
  next();
}

app.use('/api/alerts', rateLimitMiddleware, internalAuth, alertRoutes);
app.use('/api/products', rateLimitMiddleware, internalAuth, productRoutes);

app.get('/api/alerts/health', (_req, res) => {
  res.json({ success: true, status: 'healthy', service: 'rez-inventory-alerts-service', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({ service: 'REZ Inventory Alerts Service', version: '1.0.0', status: 'running', port: PORT });
});

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal Server Error', message: NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message });
});

// Check inventory and generate alerts
async function checkInventoryAndAlert() {
  try {
    const products = await MonitoredProduct.find({ status: { $ne: 'paused' } });
    let alertsGenerated = 0;

    for (const product of products) {
      product.lastChecked = new Date();

      let newStatus = 'ok';
      if (product.currentStock === 0) newStatus = 'out_of_stock';
      else if (product.currentStock <= product.criticalThreshold) newStatus = 'critical';
      else if (product.currentStock <= product.threshold) newStatus = 'low_stock';

      if (newStatus !== product.status && newStatus !== 'ok') {
        const alertType = newStatus === 'out_of_stock' ? 'out_of_stock' :
          newStatus === 'critical' ? 'critical' : 'low_stock';

        const alertId = `ALT-${uuidv4().substring(0, 8).toUpperCase()}`;

        const existingAlert = await Alert.findOne({
          productId: product.productId,
          status: 'active',
          type: alertType
        });

        if (!existingAlert) {
          const severity = newStatus === 'critical' ? 'critical' : newStatus === 'out_of_stock' ? 'critical' : 'warning';

          const alert = new Alert({
            alertId,
            productId: product.productId,
            locationId: product.locationId,
            franchiseId: product.franchiseId,
            type: alertType,
            severity,
            currentStock: product.currentStock,
            threshold: newStatus === 'critical' ? product.criticalThreshold : product.threshold,
            message: `${product.name || product.productId} is ${newStatus.replace('_', ' ')}: ${product.currentStock} units remaining`,
            status: 'active'
          });

          await alert.save();
          alertsGenerated++;
        }

        product.lastAlerted = new Date();
      }

      product.status = newStatus;
      await product.save();
    }

    if (alertsGenerated > 0) {
      logger.info(`Generated ${alertsGenerated} inventory alerts`);
    }
  } catch (error) {
    logger.error('Error checking inventory', { error: error.message });
  }
}

// Schedule inventory checks
function startInventoryChecks() {
  const interval = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 15;
  const cronExpr = `*/${interval} * * * *`;

  cron.schedule(cronExpr, () => {
    logger.info('Running scheduled inventory check');
    checkInventoryAndAlert();
  });

  logger.info(`Inventory checks scheduled every ${interval} minutes`);
}

async function main() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
    logger.info('Connected to MongoDB successfully');

    startInventoryChecks();

    app.listen(PORT, () => {
      logger.info(`REZ Inventory Alerts Service started on port ${PORT}`);
    });

    process.on('SIGTERM', async () => { await mongoose.connection.close(); process.exit(0); });
    process.on('SIGINT', async () => { await mongoose.connection.close(); process.exit(0); });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

export { app, MonitoredProduct, Alert, AlertRule };
main();

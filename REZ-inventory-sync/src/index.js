import logger from './utils/logger';

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
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

// Inventory item status
const ITEM_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued'
};

// Sync status
const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  FAILED: 'failed',
  CONFLICT: 'conflict'
};

// MongoDB Schemas
const inventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },

  // Basic info
  name: { type: String, required: true },
  sku: String,
  category: String,
  variants: [{
    variantId: String,
    name: String,
    sku: String,
    price: Number
  }],

  // Stock levels
  stock: {
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    reorderPoint: { type: Number, default: 10 },
    maxStock: { type: Number }
  },

  // Status
  status: { type: String, enum: Object.values(ITEM_STATUS), default: ITEM_STATUS.IN_STOCK },

  // Sync tracking
  sync: {
    source: { type: String, enum: ['pos', 'admin', 'api', 'import'], default: 'pos' },
    lastSync: Date,
    status: { type: String, enum: Object.values(SYNC_STATUS), default: SYNC_STATUS.SYNCED },
    error: String,
    version: { type: Number, default: 1 }
  },

  // Demand signals
  demand: {
    dailyAvg: { type: Number, default: 0 },
    peakDay: { type: Number, default: 0 }, // Day of week
    velocity: { type: Number, default: 0 }, // units per hour
    trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' }
  },

  // Predictions
  predictions: {
    stockoutDate: Date,
    reorderDate: Date,
    daysOfStockLeft: Number,
    confidence: { type: Number, default: 0.5 }
  },

  // External references
  externalRefs: {
    posItemId: String,
    aggregatorItemId: String,
    menuItemId: String
  },

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,

  lastUpdated: Date
}, { timestamps: true });

inventoryItemSchema.index({ merchantId: 1, status: 1 });
inventoryItemSchema.index({ 'stock.available': 1 });
inventoryItemSchema.index({ 'predictions.stockoutDate': 1 });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

// Sync log
const syncLogSchema = new mongoose.Schema({
  syncId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  source: String,
  type: { type: String, enum: ['full', 'delta', 'webhook'] },
  status: { type: String, enum: ['started', 'completed', 'failed'] },
  itemsProcessed: { type: Number, default: 0 },
  errors: [{ itemId: String, error: String }],
  startedAt: Date,
  completedAt: Date,
  duration: Number
}, { timestamps: true });

const SyncLog = mongoose.model('SyncLog', syncLogSchema);

// POS configuration
const posConfigSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },

  pos: {
    type: { type: String, enum: ['custom', 'juice', ' reconstitution', 'petpooja', 'ratangiri'], default: 'custom' },
    apiUrl: String,
    apiKey: String,
    pollingInterval: { type: Number, default: 300000 } // 5 minutes
  },

  aggregators: [{
    name: { type: String, enum: ['swiggy', 'zomato', 'magicpin', 'dtc'] },
    enabled: { type: Boolean, default: false },
    apiUrl: String,
    apiKey: String,
    lastSync: Date
  }],

  rules: {
    autoUpdate: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 10 },
    syncOnOrder: { type: Boolean, default: true },
    conflictResolution: { type: String, enum: ['pos_wins', 'api_wins', 'manual'], default: 'pos_wins' }
  },

  lastSync: Date,
  status: { type: String, enum: ['active', 'paused', 'error'], default: 'active' }
}, { timestamps: true });

const POSConfig = mongoose.model('POSConfig', posConfigSchema);

// Inventory Sync Engine
class InventorySyncEngine {
  constructor() {
    this.redis = null;
  }

  async init() {
    try {
      this.redis = createClient({ url: process.env.REDIS_URL });
      await this.redis.connect();
      logger.info('Redis connected for inventory sync');
    } catch (err) {
      logger.warn('Redis connection failed', { error: err.message });
    }
  }

  // Calculate stock status
  calculateStatus(quantity, reorderPoint) {
    if (quantity <= 0) return ITEM_STATUS.OUT_OF_STOCK;
    if (quantity <= reorderPoint) return ITEM_STATUS.LOW_STOCK;
    return ITEM_STATUS.IN_STOCK;
  }

  // Predict stockout date
  async predictStockout(item) {
    const demand = item.demand;

    if (!demand || demand.dailyAvg <= 0) {
      return { daysOfStockLeft: null, confidence: 0 };
    }

    const available = item.stock?.available || 0;
    const daysOfStock = available / demand.dailyAvg;
    const stockoutDate = new Date(Date.now() + daysOfStock * 24 * 60 * 60 * 1000);

    // Calculate confidence based on data quality
    const confidence = Math.min(0.95, 0.3 + (demand.velocity > 0 ? 0.3 : 0) + (demand.dailyAvg > 5 ? 0.2 : 0));

    return {
      stockoutDate,
      daysOfStockLeft: Math.round(daysOfStock),
      confidence
    };
  }

  // Calculate reorder date
  async calculateReorderDate(item) {
    const predictions = await this.predictStockout(item);
    if (!predictions.daysOfStockLeft) return null;

    const leadTimeDays = 1; // Would come from merchant config
    const safetyStockDays = 2; // Buffer

    const reorderDate = new Date(Date.now() + (predictions.daysOfStockLeft - leadTimeDays - safetyStockDays) * 24 * 60 * 60 * 1000);

    return reorderDate > new Date() ? reorderDate : new Date();
  }

  // Update item predictions
  async updatePredictions(itemId) {
    const item = await InventoryItem.findOne({ itemId });
    if (!item) return;

    const predictions = await this.predictStockout(item);
    predictions.reorderDate = await this.calculateReorderDate(item);

    item.predictions = predictions;
    item.status = this.calculateStatus(item.stock.quantity, item.stock.reorderPoint);
    item.lastUpdated = new Date();

    await item.save();

    // Publish event
    if (item.status === ITEM_STATUS.LOW_STOCK || item.status === ITEM_STATUS.OUT_OF_STOCK) {
      await this.publishAlert(item);
    }

    return item;
  }

  // Publish stock alert
  async publishAlert(item) {
    const alert = {
      type: 'inventory_alert',
      merchantId: item.merchantId,
      itemId: item.itemId,
      itemName: item.name,
      status: item.status,
      available: item.stock.available,
      message: `${item.name} is ${item.status.replace('_', ' ')}`
    };

    if (this.redis) {
      await this.redis.publish('inventory:alerts', JSON.stringify(alert));
    }

    logger.info('Inventory alert published', alert);
  }

  // Sync item from POS
  async syncItem(merchantId, itemData) {
    const { itemId, stock, status, metadata } = itemData;

    const item = await InventoryItem.findOne({ merchantId, itemId }) ||
                new InventoryItem({ merchantId, itemId, name: itemData.name || itemId });

    // Update stock
    item.stock.quantity = stock?.quantity ?? item.stock.quantity;
    item.stock.reserved = stock?.reserved ?? item.stock.reserved;
    item.stock.available = item.stock.quantity - item.stock.reserved;

    // Update sync status
    item.sync.lastSync = new Date();
    item.sync.status = SYNC_STATUS.SYNCED;
    item.sync.version += 1;

    // Update status
    item.status = this.calculateStatus(item.stock.quantity, item.stock.reorderPoint);

    // Update predictions
    const predictions = await this.predictStockout(item);
    predictions.reorderDate = await this.calculateReorderDate(item);
    item.predictions = predictions;

    // Update demand signals
    if (metadata?.lastSales) {
      item.demand = this.calculateDemand(metadata.lastSales);
    }

    item.lastUpdated = new Date();
    await item.save();

    // Update Redis cache
    if (this.redis) {
      await this.redis.setEx(
        `inventory:${merchantId}:${itemId}`,
        300,
        JSON.stringify({ stock: item.stock, status: item.status })
      );
    }

    return item;
  }

  // Calculate demand from sales data
  calculateDemand(salesData) {
    if (!salesData || salesData.length === 0) {
      return { dailyAvg: 0, velocity: 0, trend: 'stable' };
    }

    // Calculate daily average
    const totalSales = salesData.reduce((sum, s) => sum + s.quantity, 0);
    const days = salesData.length;
    const dailyAvg = totalSales / days;

    // Calculate velocity (units per hour)
    const velocity = dailyAvg / 24;

    // Calculate trend
    const halfPoint = Math.floor(salesData.length / 2);
    const firstHalf = salesData.slice(0, halfPoint);
    const secondHalf = salesData.slice(halfPoint);

    const firstAvg = firstHalf.reduce((s, d) => s + d.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.quantity, 0) / secondHalf.length;

    let trend = 'stable';
    if (secondAvg > firstAvg * 1.2) trend = 'up';
    else if (secondAvg < firstHalf * 0.8) trend = 'down';

    // Find peak day
    const dayTotals = {};
    salesData.forEach(s => {
      const day = new Date(s.date).getDay();
      dayTotals[day] = (dayTotals[day] || 0) + s.quantity;
    });
    const peakDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

    return { dailyAvg: Math.round(dailyAvg * 100) / 100, velocity, trend, peakDay };
  }

  // Full sync from POS
  async fullSync(merchantId, items) {
    const syncId = `sync_${uuidv4()}`;
    const startTime = Date.now();
    const errors = [];

    await SyncLog.create({
      syncId,
      merchantId,
      source: 'pos',
      type: 'full',
      status: 'started',
      startedAt: new Date()
    });

    try {
      for (const itemData of items) {
        try {
          await this.syncItem(merchantId, itemData);
        } catch (err) {
          errors.push({ itemId: itemData.itemId, error: err.message });
        }
      }

      const completed = await SyncLog.findOneAndUpdate(
        { syncId },
        {
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          itemsProcessed: items.length,
          errors,
          completedAt: new Date(),
          duration: Date.now() - startTime
        },
        { new: true }
      );

      logger.info('Full sync completed', { syncId, itemsProcessed: items.length, errors: errors.length });

      return completed;
    } catch (err) {
      await SyncLog.findOneAndUpdate(
        { syncId },
        { status: 'failed', completedAt: new Date(), duration: Date.now() - startTime }
      );

      throw err;
    }
  }
}

const syncEngine = new InventorySyncEngine();

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
    service: 'inventory-sync',
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

// Get merchant inventory
app.get('/api/inventory/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { status, category, lowStock } = req.query;

  const query = { merchantId };
  if (status) query.status = status;
  if (category) query.category = category;
  if (lowStock === 'true') {
    query.status = { $in: [ITEM_STATUS.LOW_STOCK, ITEM_STATUS.OUT_OF_STOCK] };
  }

  const items = await InventoryItem.find(query)
    .sort({ status: 1, 'predictions.daysOfStockLeft': 1 })
    .lean();

  res.json({
    success: true,
    items: items.map(i => ({
      itemId: i.itemId,
      name: i.name,
      category: i.category,
      status: i.status,
      stock: i.stock,
      predictions: i.predictions,
      demand: i.demand,
      lastUpdated: i.lastUpdated
    })),
    count: items.length
  });
}));

// Get single item
app.get('/api/inventory/:merchantId/:itemId', asyncHandler(async (req, res) => {
  const { merchantId, itemId } = req.params;

  // Try cache first
  if (syncEngine.redis) {
    const cached = await syncEngine.redis.get(`inventory:${merchantId}:${itemId}`);
    if (cached) {
      return res.json({ success: true, item: JSON.parse(cached), cached: true });
    }
  }

  const item = await InventoryItem.findOne({ merchantId, itemId });

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json({ success: true, item });
}));

// Update stock
app.patch('/api/inventory/:merchantId/:itemId', asyncHandler(async (req, res) => {
  const { merchantId, itemId } = req.params;
  const { stock, status, reorderPoint } = req.body;

  const item = await InventoryItem.findOne({ merchantId, itemId });

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (stock) {
    item.stock.quantity = stock.quantity ?? item.stock.quantity;
    item.stock.reserved = stock.reserved ?? item.stock.reserved;
    item.stock.available = item.stock.quantity - item.stock.reserved;
    item.stock.reorderPoint = reorderPoint ?? item.stock.reorderPoint;
  }

  if (status) item.status = status;

  // Update predictions
  const predictions = await syncEngine.predictStockout(item);
  predictions.reorderDate = await syncEngine.calculateReorderDate(item);
  item.predictions = predictions;

  item.status = syncEngine.calculateStatus(item.stock.quantity, item.stock.reorderPoint);
  item.sync.lastSync = new Date();
  item.sync.status = SYNC_STATUS.SYNCED;
  item.sync.source = 'api';

  await item.save();

  // Update cache
  if (syncEngine.redis) {
    await syncEngine.redis.setEx(
      `inventory:${merchantId}:${itemId}`,
      300,
      JSON.stringify({ stock: item.stock, status: item.status })
    );
  }

  res.json({ success: true, item });
}));

// Sync item from POS/webhook
app.post('/api/sync/item', asyncHandler(async (req, res) => {
  const { merchantId, item } = req.body;

  if (!merchantId || !item) {
    return res.status(400).json({ error: 'merchantId and item required' });
  }

  const updatedItem = await syncEngine.syncItem(merchantId, item);

  res.json({ success: true, item: updatedItem });
}));

// Full sync from POS
app.post('/api/sync/full', asyncHandler(async (req, res) => {
  const { merchantId, items } = req.body;

  if (!merchantId || !items) {
    return res.status(400).json({ error: 'merchantId and items required' });
  }

  const result = await syncEngine.fullSync(merchantId, items);

  res.json({ success: true, sync: result });
}));

// Get alerts
app.get('/api/alerts/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { type = 'all' } = req.query;

  const query = { merchantId };
  if (type === 'low') {
    query.status = ITEM_STATUS.LOW_STOCK;
  } else if (type === 'out') {
    query.status = ITEM_STATUS.OUT_OF_STOCK;
  } else {
    query.status = { $in: [ITEM_STATUS.LOW_STOCK, ITEM_STATUS.OUT_OF_STOCK] };
  }

  const items = await InventoryItem.find(query)
    .sort({ 'predictions.daysOfStockLeft': 1 })
    .lean();

  const alerts = items.map(item => ({
    type: 'inventory',
    severity: item.status === ITEM_STATUS.OUT_OF_STOCK ? 'critical' : 'warning',
    itemId: item.itemId,
    name: item.name,
    status: item.status,
    available: item.stock.available,
    daysOfStockLeft: item.predictions?.daysOfStockLeft,
    recommendedAction: item.status === ITEM_STATUS.OUT_OF_STOCK
      ? 'Restock immediately'
      : `Reorder within ${item.predictions?.daysOfStockLeft || 7} days`
  }));

  res.json({ success: true, alerts, count: alerts.length });
}));

// Get sync history
app.get('/api/sync/:merchantId/history', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { limit = 20 } = req.query;

  const logs = await SyncLog.find({ merchantId })
    .sort({ startedAt: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, logs });
}));

// POS configuration
app.get('/api/config/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  let config = await POSConfig.findOne({ merchantId });

  if (!config) {
    config = await POSConfig.create({ merchantId });
  }

  res.json({ success: true, config });
}));

app.patch('/api/config/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const config = await POSConfig.findOneAndUpdate(
    { merchantId },
    { $set: req.body },
    { new: true, upsert: true }
  );

  res.json({ success: true, config });
}));

// Get analytics
app.get('/api/analytics/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const [items, lowStock, outOfStock] = await Promise.all([
    InventoryItem.countDocuments({ merchantId }),
    InventoryItem.countDocuments({ merchantId, status: ITEM_STATUS.LOW_STOCK }),
    InventoryItem.countDocuments({ merchantId, status: ITEM_STATUS.OUT_OF_STOCK })
  ]);

  const criticalItems = await InventoryItem.find({
    merchantId,
    'predictions.daysOfStockLeft': { $lte: 2 }
  })
  .sort({ 'predictions.daysOfStockLeft': 1 })
  .limit(10)
  .lean();

  res.json({
    success: true,
    analytics: {
      totalItems: items,
      inStock: items - lowStock - outOfStock,
      lowStock,
      outOfStock,
      critical: criticalItems.length,
      criticalItems: criticalItems.map(i => ({
        itemId: i.itemId,
        name: i.name,
        daysOfStockLeft: i.predictions?.daysOfStockLeft
      }))
    }
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4071;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    await syncEngine.init();

    app.listen(PORT, () => {
      logger.info(`Inventory Sync Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

import 'dotenv/config';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { logger, requestIdMiddleware } from './logger';
import { errorHandler, asyncHandler } from './errors';
import { syncEngine } from './services/InventorySyncEngine';
import {
  ItemStatus,
  SyncStatus,
  SyncSource,
  InventoryItemInput,
  InventoryAlert,
  InventoryAnalytics,
  UpdateStockRequest,
} from './types';

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
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

// Health endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'inventory-sync',
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

// MongoDB Models
const getInventoryItemModel = () => {
  const mongoose = require('mongoose');
  const inventoryItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    sku: String,
    category: String,
    variants: [{
      variantId: String,
      name: String,
      sku: String,
      price: Number,
    }],
    stock: {
      quantity: { type: Number, default: 0 },
      reserved: { type: Number, default: 0 },
      available: { type: Number, default: 0 },
      reorderPoint: { type: Number, default: 10 },
      maxStock: { type: Number },
    },
    status: { type: String, enum: Object.values(ItemStatus), default: ItemStatus.IN_STOCK },
    sync: {
      source: { type: String, enum: Object.values(SyncSource), default: SyncSource.POS },
      lastSync: Date,
      status: { type: String, enum: Object.values(SyncStatus), default: SyncStatus.SYNCED },
      error: String,
      version: { type: Number, default: 1 },
    },
    demand: {
      dailyAvg: { type: Number, default: 0 },
      peakDay: { type: Number, default: 0 },
      velocity: { type: Number, default: 0 },
      trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
    },
    predictions: {
      stockoutDate: Date,
      reorderDate: Date,
      daysOfStockLeft: Number,
      confidence: { type: Number, default: 0.5 },
    },
    externalRefs: {
      posItemId: String,
      aggregatorItemId: String,
      menuItemId: String,
    },
    metadata: mongoose.Schema.Types.Mixed,
    lastUpdated: Date,
  }, { timestamps: true });

  inventoryItemSchema.index({ merchantId: 1, status: 1 });
  inventoryItemSchema.index({ 'stock.available': 1 });
  inventoryItemSchema.index({ 'predictions.stockoutDate': 1 });

  return mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
};

const getSyncLogModel = () => {
  const mongoose = require('mongoose');
  const syncLogSchema = new mongoose.Schema({
    syncId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: String, required: true, index: true },
    source: String,
    type: { type: String, enum: ['full', 'delta', 'webhook'] },
    status: { type: String, enum: ['started', 'completed', 'failed', 'completed_with_errors'] },
    itemsProcessed: { type: Number, default: 0 },
    errors: [{ itemId: String, error: String }],
    startedAt: Date,
    completedAt: Date,
    duration: Number,
  }, { timestamps: true });

  return mongoose.models.SyncLog || mongoose.model('SyncLog', syncLogSchema);
};

const getPOSConfigModel = () => {
  const mongoose = require('mongoose');
  const posConfigSchema = new mongoose.Schema({
    merchantId: { type: String, required: true, unique: true, index: true },
    pos: {
      type: { type: String, enum: ['custom', 'juice', 'reconstitution', 'petpooja', 'ratangiri'], default: 'custom' },
      apiUrl: String,
      apiKey: String,
      pollingInterval: { type: Number, default: 300000 },
    },
    aggregators: [{
      name: { type: String, enum: ['swiggy', 'zomato', 'magicpin', 'dtc'] },
      enabled: { type: Boolean, default: false },
      apiUrl: String,
      apiKey: String,
      lastSync: Date,
    }],
    rules: {
      autoUpdate: { type: Boolean, default: true },
      lowStockThreshold: { type: Number, default: 10 },
      syncOnOrder: { type: Boolean, default: true },
      conflictResolution: { type: String, enum: ['pos_wins', 'api_wins', 'manual'], default: 'pos_wins' },
    },
    lastSync: Date,
    status: { type: String, enum: ['active', 'paused', 'error'], default: 'active' },
  }, { timestamps: true });

  return mongoose.models.POSConfig || mongoose.model('POSConfig', posConfigSchema);
};

// API Routes

// Get merchant inventory
app.get('/api/inventory/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { status, category, lowStock } = req.query;

  const query: Record<string, unknown> = { merchantId };
  if (status) query.status = status;
  if (category) query.category = category;
  if (lowStock === 'true') {
    query.status = { $in: [ItemStatus.LOW_STOCK, ItemStatus.OUT_OF_STOCK] };
  }

  const InventoryItem = getInventoryItemModel();
  const items = await InventoryItem.find(query)
    .sort({ status: 1, 'predictions.daysOfStockLeft': 1 })
    .lean();

  res.json({
    success: true,
    items: items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      category: i.category,
      status: i.status,
      stock: i.stock,
      predictions: i.predictions,
      demand: i.demand,
      lastUpdated: i.lastUpdated,
    })),
    count: items.length,
  });
}));

// Get single item
app.get('/api/inventory/:merchantId/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;

  // Try cache first
  const cached = await syncEngine.getCachedItem(merchantId, itemId);
  if (cached) {
    return res.json({ success: true, item: cached, cached: true });
  }

  const InventoryItem = getInventoryItemModel();
  const item = await InventoryItem.findOne({ merchantId, itemId });

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json({ success: true, item });
}));

// Update stock
app.patch('/api/inventory/:merchantId/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;
  const { stock, status, reorderPoint } = req.body as UpdateStockRequest;

  const InventoryItem = getInventoryItemModel();
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
  item.sync.status = SyncStatus.SYNCED;
  item.sync.source = SyncSource.API;

  await item.save();

  await syncEngine.setCachedItem(merchantId, itemId, item.stock, item.status);

  res.json({ success: true, item });
}));

// Sync item from POS/webhook
app.post('/api/sync/item', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, item } = req.body as { merchantId: string; item: Partial<InventoryItemInput> };

  if (!merchantId || !item) {
    return res.status(400).json({ error: 'merchantId and item required' });
  }

  const updatedItem = await syncEngine.syncItem(merchantId, item);

  res.json({ success: true, item: updatedItem });
}));

// Full sync from POS
app.post('/api/sync/full', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, items } = req.body as { merchantId: string; items: Partial<InventoryItemInput>[] };

  if (!merchantId || !items) {
    return res.status(400).json({ error: 'merchantId and items required' });
  }

  const result = await syncEngine.fullSync(merchantId, items);

  res.json({ success: true, sync: result });
}));

// Get alerts
app.get('/api/alerts/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { type = 'all' } = req.query;

  const query: Record<string, unknown> = { merchantId };
  if (type === 'low') {
    query.status = ItemStatus.LOW_STOCK;
  } else if (type === 'out') {
    query.status = ItemStatus.OUT_OF_STOCK;
  } else {
    query.status = { $in: [ItemStatus.LOW_STOCK, ItemStatus.OUT_OF_STOCK] };
  }

  const InventoryItem = getInventoryItemModel();
  const items = await InventoryItem.find(query)
    .sort({ 'predictions.daysOfStockLeft': 1 })
    .lean();

  const alerts: InventoryAlert[] = items.map((item) => ({
    type: 'inventory',
    severity: item.status === ItemStatus.OUT_OF_STOCK ? 'critical' : 'warning',
    itemId: item.itemId,
    name: item.name,
    status: item.status,
    available: item.stock.available,
    daysOfStockLeft: item.predictions?.daysOfStockLeft,
    recommendedAction: item.status === ItemStatus.OUT_OF_STOCK
      ? 'Restock immediately'
      : `Reorder within ${item.predictions?.daysOfStockLeft || 7} days`,
  }));

  res.json({ success: true, alerts, count: alerts.length });
}));

// Get sync history
app.get('/api/sync/:merchantId/history', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { limit = '20' } = req.query;

  const SyncLog = getSyncLogModel();
  const logs = await SyncLog.find({ merchantId })
    .sort({ startedAt: -1 })
    .limit(parseInt(limit as string))
    .lean();

  res.json({ success: true, logs });
}));

// POS configuration
app.get('/api/config/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const POSConfig = getPOSConfigModel();
  let config = await POSConfig.findOne({ merchantId });

  if (!config) {
    config = await POSConfig.create({ merchantId });
  }

  res.json({ success: true, config });
}));

app.patch('/api/config/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const POSConfig = getPOSConfigModel();
  const config = await POSConfig.findOneAndUpdate(
    { merchantId },
    { $set: req.body },
    { new: true, upsert: true }
  );

  res.json({ success: true, config });
}));

// Get analytics
app.get('/api/analytics/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const InventoryItem = getInventoryItemModel();
  const [items, lowStock, outOfStock] = await Promise.all([
    InventoryItem.countDocuments({ merchantId }),
    InventoryItem.countDocuments({ merchantId, status: ItemStatus.LOW_STOCK }),
    InventoryItem.countDocuments({ merchantId, status: ItemStatus.OUT_OF_STOCK }),
  ]);

  const criticalItems = await InventoryItem.find({
    merchantId,
    'predictions.daysOfStockLeft': { $lte: 2 },
  })
    .sort({ 'predictions.daysOfStockLeft': 1 })
    .limit(10)
    .lean();

  const analytics: InventoryAnalytics = {
    totalItems: items,
    inStock: items - lowStock - outOfStock,
    lowStock,
    outOfStock,
    critical: criticalItems.length,
    criticalItems: criticalItems.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      daysOfStockLeft: i.predictions?.daysOfStockLeft,
    })),
  };

  res.json({ success: true, analytics });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4071;

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');

    await syncEngine.init();

    app.listen(PORT, () => {
      logger.info(`Inventory Sync Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: (err as Error).message });
    process.exit(1);
  }
}

start();

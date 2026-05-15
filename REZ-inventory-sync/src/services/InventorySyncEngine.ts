import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import {
  ItemStatus,
  SyncStatus,
  SyncLogStatus,
  IInventoryItem,
  ISyncLog,
  IPOSConfig,
  StockPrediction,
  InventoryItemInput,
  SaleRecord,
  SyncError,
} from '../types';

// Redis client type
let redis: RedisClientType | null = null;

export class InventorySyncEngine {
  private redis: RedisClientType | null = null;
  private isConnected: boolean = false;

  async init(): Promise<void> {
    try {
      this.redis = createClient({ url: process.env.REDIS_URL });
      await this.redis.connect();
      this.isConnected = true;
      logger.info('Redis connected for inventory sync');
    } catch (err) {
      logger.warn('Redis connection failed', { error: (err as Error).message });
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis && this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  calculateStatus(quantity: number, reorderPoint: number): ItemStatus {
    if (quantity <= 0) return ItemStatus.OUT_OF_STOCK;
    if (quantity <= reorderPoint) return ItemStatus.LOW_STOCK;
    return ItemStatus.IN_STOCK;
  }

  async predictStockout(item: IInventoryItem): Promise<StockPrediction> {
    const demand = item.demand;

    if (!demand || demand.dailyAvg <= 0) {
      return { daysOfStockLeft: null, confidence: 0 };
    }

    const available = item.stock?.available || 0;
    const daysOfStock = available / demand.dailyAvg;
    const stockoutDate = new Date(Date.now() + daysOfStock * 24 * 60 * 60 * 1000);

    // Calculate confidence based on data quality
    const confidence = Math.min(
      0.95,
      0.3 + (demand.velocity > 0 ? 0.3 : 0) + (demand.dailyAvg > 5 ? 0.2 : 0)
    );

    return {
      stockoutDate,
      daysOfStockLeft: Math.round(daysOfStock),
      confidence,
    };
  }

  async calculateReorderDate(item: IInventoryItem): Promise<Date | null> {
    const predictions = await this.predictStockout(item);
    if (!predictions.daysOfStockLeft) return null;

    const leadTimeDays = 1;
    const safetyStockDays = 2;

    const reorderDate = new Date(
      Date.now() + (predictions.daysOfStockLeft - leadTimeDays - safetyStockDays) * 24 * 60 * 60 * 1000
    );

    return reorderDate > new Date() ? reorderDate : new Date();
  }

  async updatePredictions(item: IInventoryItem): Promise<IInventoryItem | null> {
    const predictions = await this.predictStockout(item);
    predictions.reorderDate = await this.calculateReorderDate(item);

    item.predictions = predictions;
    item.status = this.calculateStatus(item.stock.quantity, item.stock.reorderPoint);
    item.lastUpdated = new Date();

    await item.save();

    if (item.status === ItemStatus.LOW_STOCK || item.status === ItemStatus.OUT_OF_STOCK) {
      await this.publishAlert(item);
    }

    return item;
  }

  async publishAlert(item: IInventoryItem): Promise<void> {
    const alert = {
      type: 'inventory_alert',
      merchantId: item.merchantId,
      itemId: item.itemId,
      itemName: item.name,
      status: item.status,
      available: item.stock.available,
      message: `${item.name} is ${item.status.replace('_', ' ')}`,
    };

    if (this.redis && this.isConnected) {
      await this.redis.publish('inventory:alerts', JSON.stringify(alert));
    }

    logger.info('Inventory alert published', alert);
  }

  async syncItem(
    merchantId: string,
    itemData: Partial<InventoryItemInput>
  ): Promise<IInventoryItem> {
    const InventoryItem = this.getInventoryItemModel();
    const { itemId } = itemData;

    if (!itemId) {
      throw new Error('itemId is required');
    }

    let item = await InventoryItem.findOne({ merchantId, itemId }) as IInventoryItem | null;

    if (!item) {
      item = new InventoryItem({
        merchantId,
        itemId,
        name: itemData.name || itemId,
      }) as IInventoryItem;
    }

    // Update stock
    if (itemData.stock) {
      item.stock.quantity = itemData.stock.quantity ?? item.stock.quantity;
      item.stock.reserved = itemData.stock.reserved ?? item.stock.reserved;
      item.stock.available = item.stock.quantity - item.stock.reserved;
    }

    // Update sync status
    item.sync.lastSync = new Date();
    item.sync.status = SyncStatus.SYNCED;
    item.sync.version += 1;

    // Update status
    item.status = this.calculateStatus(item.stock.quantity, item.stock.reorderPoint);

    // Update predictions
    const predictions = await this.predictStockout(item);
    predictions.reorderDate = await this.calculateReorderDate(item);
    item.predictions = predictions;

    item.lastUpdated = new Date();
    await item.save();

    // Update Redis cache
    if (this.redis && this.isConnected) {
      await this.redis.setEx(
        `inventory:${merchantId}:${itemId}`,
        300,
        JSON.stringify({ stock: item.stock, status: item.status })
      );
    }

    return item;
  }

  calculateDemand(salesData: SaleRecord[]): {
    dailyAvg: number;
    velocity: number;
    trend: 'up' | 'down' | 'stable';
    peakDay: number;
  } {
    if (!salesData || salesData.length === 0) {
      return { dailyAvg: 0, velocity: 0, trend: 'stable', peakDay: 0 };
    }

    const totalSales = salesData.reduce((sum, s) => sum + s.quantity, 0);
    const days = salesData.length;
    const dailyAvg = totalSales / days;

    const velocity = dailyAvg / 24;

    const halfPoint = Math.floor(salesData.length / 2);
    const firstHalf = salesData.slice(0, halfPoint);
    const secondHalf = salesData.slice(halfPoint);

    const firstAvg = firstHalf.reduce((s, d) => s + d.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.quantity, 0) / secondHalf.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondAvg > firstAvg * 1.2) trend = 'up';
    else if (secondAvg < firstAvg * 0.8) trend = 'down';

    const dayTotals: Record<number, number> = {};
    salesData.forEach((s) => {
      const day = new Date(s.date).getDay();
      dayTotals[day] = (dayTotals[day] || 0) + s.quantity;
    });
    const peakDay = Number(Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0]) || 0;

    return { dailyAvg: Math.round(dailyAvg * 100) / 100, velocity, trend, peakDay };
  }

  async fullSync(
    merchantId: string,
    items: Partial<InventoryItemInput>[]
  ): Promise<ISyncLog> {
    const SyncLog = this.getSyncLogModel();
    const syncId = `sync_${uuidv4()}`;
    const startTime = Date.now();
    const errors: SyncError[] = [];

    await SyncLog.create({
      syncId,
      merchantId,
      source: 'pos',
      type: 'full',
      status: SyncLogStatus.STARTED,
      startedAt: new Date(),
    });

    try {
      for (const itemData of items) {
        try {
          await this.syncItem(merchantId, itemData);
        } catch (err) {
          errors.push({ itemId: itemData.itemId || 'unknown', error: (err as Error).message });
        }
      }

      const completed = await SyncLog.findOneAndUpdate(
        { syncId },
        {
          status: errors.length > 0 ? SyncLogStatus.COMPLETED_WITH_ERRORS : SyncLogStatus.COMPLETED,
          itemsProcessed: items.length,
          errors,
          completedAt: new Date(),
          duration: Date.now() - startTime,
        },
        { new: true }
      );

      logger.info('Full sync completed', { syncId, itemsProcessed: items.length, errors: errors.length });

      return completed as ISyncLog;
    } catch (err) {
      await SyncLog.findOneAndUpdate(
        { syncId },
        { status: SyncLogStatus.FAILED, completedAt: new Date(), duration: Date.now() - startTime }
      );
      throw err;
    }
  }

  async getCachedItem(merchantId: string, itemId: string): Promise<{ stock: unknown; status: string } | null> {
    if (!this.redis || !this.isConnected) return null;
    const cached = await this.redis.get(`inventory:${merchantId}:${itemId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedItem(merchantId: string, itemId: string, stock: unknown, status: string): Promise<void> {
    if (this.redis && this.isConnected) {
      await this.redis.setEx(
        `inventory:${merchantId}:${itemId}`,
        300,
        JSON.stringify({ stock, status })
      );
    }
  }

  private getInventoryItemModel(): import('mongoose').Model<IInventoryItem> {
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
        source: { type: String, enum: Object.values({ pos: 'pos', admin: 'admin', api: 'api', import: 'import' }), default: 'pos' },
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

    return mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', inventoryItemSchema);
  }

  private getSyncLogModel(): import('mongoose').Model<ISyncLog> {
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

    return mongoose.models.SyncLog || mongoose.model<ISyncLog>('SyncLog', syncLogSchema);
  }
}

export const syncEngine = new InventorySyncEngine();

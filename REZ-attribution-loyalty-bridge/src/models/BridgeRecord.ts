/**
 * Bridge Record Model
 * Tracks all attribution-to-loyalty bridge transactions
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ChannelType } from '../types/schemas.js';

// ============================================
// INTERFACES
// ============================================

export interface IChannelBreakdown {
  coins: number;
  cashback: number;
  percentage: number;
}

export interface IBridgeRecord extends Document {
  bridgeId: string;
  conversionId: string;
  customerId: string;
  userId?: string;
  merchantId: string;
  orderId?: string;
  orderValue: number;
  currency: string;

  // Attribution data
  attributedChannels: ChannelType[];
  attributionModel: string;
  attributedRevenue: Map<string, number>;

  // Reward calculations
  totalCoins: number;
  totalCashback: number;
  coinType: 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral';
  channelBreakdown: Map<string, IChannelBreakdown>;

  // Campaign data
  campaignId?: string;
  campaignMultiplier: number;

  // Status tracking
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

  // Loyalty service sync
  loyaltyTransactionId?: string;
  walletTransactionId?: string;
  loyaltySyncedAt?: Date;

  // Error handling
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  nextRetryAt?: Date;

  // Expiry
  expiresAt?: Date;

  // Metadata
  metadata: Map<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Soft delete
  deletedAt?: Date;

  // Instance methods
  markProcessing(): Promise<void>;
  markCompleted(loyaltyTransactionId?: string, walletTransactionId?: string): Promise<void>;
  markFailed(error: string): Promise<void>;
  scheduleRetry(delayMinutes: number): Promise<void>;
}

// Static methods interface
export interface IBridgeRecordModel extends Model<IBridgeRecord> {
  findPendingRetries(): Promise<IBridgeRecord[]>;
  findByConversion(conversionId: string): Promise<IBridgeRecord[]>;
  findByCustomer(customerId: string, options?: { limit?: number; skip?: number; startDate?: Date; endDate?: Date }): Promise<IBridgeRecord[]>;
  aggregateByChannel(startDate: Date, endDate: Date, merchantId?: string): Promise<Array<{ channel: string; totalCoins: number; totalCashback: number; count: number }>>;
}

// ============================================
// SCHEMA
// ============================================

const ChannelBreakdownSchema = new Schema<IChannelBreakdown>(
  {
    coins: { type: Number, required: true, default: 0 },
    cashback: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 }
  },
  { _id: false }
);

const BridgeRecordSchema = new Schema<IBridgeRecord>(
  {
    bridgeId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    conversionId: {
      type: String,
      required: true,
      index: true
    },
    customerId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      index: true
    },
    merchantId: {
      type: String,
      required: true,
      index: true
    },
    orderId: String,
    orderValue: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },

    // Attribution
    attributedChannels: [{
      type: String,
      enum: [
        'search', 'social', 'display', 'video', 'email', 'sms', 'push',
        'dooh', 'print', 'ooh', 'walkin', 'qr', 'organic', 'referral',
        'wallet', 'loyalty', 'creator', 'aggregator', 'direct', 'unknown'
      ]
    }],
    attributionModel: {
      type: String,
      enum: ['first_touch', 'last_touch', 'last_non_direct', 'linear', 'time_decay', 'position_based', 'data_driven'],
      default: 'last_touch'
    },
    attributedRevenue: {
      type: Map,
      of: Number
    },

    // Rewards
    totalCoins: {
      type: Number,
      required: true,
      default: 0
    },
    totalCashback: {
      type: Number,
      required: true,
      default: 0
    },
    coinType: {
      type: String,
      enum: ['rez', 'prive', 'branded', 'promo', 'cashback', 'referral'],
      default: 'rez'
    },
    channelBreakdown: {
      type: Map,
      of: ChannelBreakdownSchema
    },

    // Campaign
    campaignId: String,
    campaignMultiplier: {
      type: Number,
      default: 1,
      min: 1
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
      default: 'pending',
      index: true
    },

    // Sync tracking
    loyaltyTransactionId: String,
    walletTransactionId: String,
    loyaltySyncedAt: Date,

    // Error handling
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0
    },
    lastRetryAt: Date,
    nextRetryAt: Date,

    // Expiry
    expiresAt: Date,

    // Metadata
    metadata: {
      type: Map,
      of: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// ============================================
// INDEXES
// ============================================

// Compound indexes for common queries
BridgeRecordSchema.index({ customerId: 1, createdAt: -1 });
BridgeRecordSchema.index({ merchantId: 1, createdAt: -1 });
BridgeRecordSchema.index({ campaignId: 1, createdAt: -1 });
BridgeRecordSchema.index({ status: 1, nextRetryAt: 1 }); // For retry queue
BridgeRecordSchema.index({ conversionId: 1, bridgeId: 1 }, { unique: true }); // Prevent duplicates

// Analytics indexes
BridgeRecordSchema.index({ createdAt: -1, totalCoins: -1 });
BridgeRecordSchema.index({ 'attributedChannels': 1, createdAt: -1 });

// Soft delete index
BridgeRecordSchema.index({ deletedAt: 1 });

// ============================================
// VIRTUALS
// ============================================

BridgeRecordSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

BridgeRecordSchema.virtual('isRetryable').get(function () {
  return this.status === 'failed' && this.retryCount < 3;
});

// ============================================
// METHODS
// ============================================

BridgeRecordSchema.methods.markProcessing = async function (): Promise<void> {
  this.status = 'processing';
  await this.save();
};

BridgeRecordSchema.methods.markCompleted = async function (
  loyaltyTransactionId?: string,
  walletTransactionId?: string
): Promise<void> {
  this.status = 'completed';
  this.loyaltyTransactionId = loyaltyTransactionId;
  this.walletTransactionId = walletTransactionId;
  this.loyaltySyncedAt = new Date();
  await this.save();
};

BridgeRecordSchema.methods.markFailed = async function (error: string): Promise<void> {
  this.status = 'failed';
  this.errorMessage = error;
  this.retryCount += 1;
  this.lastRetryAt = new Date();

  // Schedule next retry with exponential backoff
  if (this.retryCount < 3) {
    const backoffMinutes = Math.pow(2, this.retryCount) * 5; // 10, 20, 40 minutes
    this.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
  }

  await this.save();
};

BridgeRecordSchema.methods.scheduleRetry = async function (delayMinutes: number): Promise<void> {
  this.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  await this.save();
};

// ============================================
// STATICS
// ============================================

BridgeRecordSchema.statics.findPendingRetries = async function (): Promise<IBridgeRecord[]> {
  return this.find({
    status: 'failed',
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: 3 }
  });
};

BridgeRecordSchema.statics.findByConversion = async function (
  conversionId: string
): Promise<IBridgeRecord[]> {
  return this.find({ conversionId, deletedAt: { $exists: false } })
    .sort({ createdAt: -1 });
};

BridgeRecordSchema.statics.findByCustomer = async function (
  customerId: string,
  options: { limit?: number; skip?: number; startDate?: Date; endDate?: Date } = {}
): Promise<IBridgeRecord[]> {
  const query: Record<string, unknown> = {
    customerId,
    deletedAt: { $exists: false }
  };

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) (query.createdAt as Record<string, Date>).$gte = options.startDate;
    if (options.endDate) (query.createdAt as Record<string, Date>).$lte = options.endDate;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

BridgeRecordSchema.statics.aggregateByChannel = async function (
  startDate: Date,
  endDate: Date,
  merchantId?: string
): Promise<Array<{ channel: string; totalCoins: number; totalCashback: number; count: number }>> {
  const match: Record<string, unknown> = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'completed',
    deletedAt: { $exists: false }
  };

  if (merchantId) {
    match.merchantId = merchantId;
  }

  return this.aggregate([
    { $match: match },
    { $unwind: '$attributedChannels' },
    {
      $group: {
        _id: '$attributedChannels',
        totalCoins: { $sum: '$totalCoins' },
        totalCashback: { $sum: '$totalCashback' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalCoins: -1 } }
  ]);
};

// ============================================
// MIDDLEWARE
// ============================================

// Prevent hard delete - use soft delete
BridgeRecordSchema.pre('deleteOne', { document: true, query: false }, function () {
  this.deletedAt = new Date();
});

BridgeRecordSchema.pre('deleteMany', function () {
  this.setQuery({ ...this.getQuery(), deletedAt: new Date() });
});

// ============================================
// EXPORT
// ============================================

export const BridgeRecord = (mongoose.models.BridgeRecord as Model<IBridgeRecord, IBridgeRecordModel>) ||
  mongoose.model<IBridgeRecord, IBridgeRecordModel>('BridgeRecord', BridgeRecordSchema);

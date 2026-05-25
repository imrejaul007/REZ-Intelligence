/**
 * Unified Attribution Models
 *
 * Consolidated models that support ALL attribution use cases:
 * - Retail/Omnichannel (DOOH, QR, Store visits)
 * - Digital Marketing (UTM, Paid ads)
 * - Full Commerce (Aggregators, Wallet, Creators)
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// ENUMS
// ============================================

export enum ChannelType {
  // Digital Marketing
  SEARCH = 'search',
  SOCIAL = 'social',
  DISPLAY = 'display',
  VIDEO = 'video',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',

  // Offline/DOOH
  DOOH = 'dooh',
  PRINT = 'print',
  OOH = 'ooh',
  WALKIN = 'walkin',

  // Commerce
  QR = 'qr',
  ORGANIC = 'organic',
  REFERRAL = 'referral',

  // Special
  WALLET = 'wallet',
  LOYALTY = 'loyalty',
  CREATOR = 'creator',
  AGGREGATOR = 'aggregator',

  // Direct
  DIRECT = 'direct',
  UNKNOWN = 'unknown'
}

export enum AttributionModel {
  FIRST_TOUCH = 'first_touch',
  LAST_TOUCH = 'last_touch',
  LAST_NON_DIRECT = 'last_non_direct',
  LINEAR = 'linear',
  TIME_DECAY = 'time_decay',
  POSITION_BASED = 'position_based',
  DATA_DRIVEN = 'data_driven'
}

export enum ConversionType {
  PURCHASE = 'purchase',
  SIGNUP = 'signup',
  LEAD = 'lead',
  SUBSCRIPTION = 'subscription',
  DOWNLOAD = 'download',
  APP_INSTALL = 'app_install',
  VISIT = 'visit'
}

export enum ConversionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  VOIDED = 'voided',
  REFUNDED = 'refunded',
  SUSPECTED = 'suspected'
}

// ============================================
// UNIFIED TOUCHPOINT MODEL
// ============================================

export interface ITouchpoint extends Document {
  touchpointId: string;
  userId: string;
  sessionId: string;
  customerId?: string;
  merchantId: string;
  storeId?: string;

  // Channel
  channel: ChannelType;
  source?: string; // utm_source
  medium?: string; // utm_medium
  campaign?: string; // utm_campaign
  content?: string; // utm_content
  keyword?: string; // utm_term

  // Attribution
  campaignId?: string;
  adId?: string;
  creativeId?: string;
  offerId?: string;

  // Location
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
    city?: string;
    region?: string;
    country?: string;
  };

  // Device
  device?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;

  // DOOH specific
  dooh?: {
    screenId: string;
    screenType: string;
    impressionCount: number;
    dwellTime: number;
    visited?: boolean;
  };

  // QR specific
  qr?: {
    qrId: string;
    context: 'menu' | 'order' | 'payment' | 'feedback' | 'general';
    orderAttributed?: boolean;
  };

  // Creator specific
  creator?: {
    creatorId: string;
    platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter';
    contentType: 'post' | 'story' | 'reel' | 'video';
    engagement: number;
    couponUsed?: boolean;
  };

  // Aggregator specific
  aggregator?: {
    platform: 'swiggy' | 'zomato' | 'dunzo';
    listingVisits: number;
    orderPlaced?: boolean;
  };

  // Wallet/Cashback
  wallet?: {
    cashbackEarned: number;
    cashbackUsed: number;
    orderAttributed?: boolean;
  };

  // Metadata
  metadata: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TouchpointSchema = new Schema<ITouchpoint>({
  touchpointId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  customerId: { type: String, index: true },
  merchantId: { type: String, required: true, index: true },
  storeId: { type: String, index: true },

  channel: { type: String, enum: Object.values(ChannelType), required: true, index: true },
  source: String,
  medium: String,
  campaign: String,
  content: String,
  keyword: String,

  campaignId: String,
  adId: String,
  creativeId: String,
  offerId: String,

  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
    address: String,
    city: String,
    region: String,
    country: String
  },

  device: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
  browser: String,
  os: String,
  ipAddress: String,
  userAgent: String,

  dooh: {
    screenId: String,
    screenType: String,
    impressionCount: Number,
    dwellTime: Number,
    visited: Boolean
  },

  qr: {
    qrId: String,
    context: String,
    orderAttributed: Boolean
  },

  creator: {
    creatorId: String,
    platform: String,
    contentType: String,
    engagement: Number,
    couponUsed: Boolean
  },

  aggregator: {
    platform: String,
    listingVisits: Number,
    orderPlaced: Boolean
  },

  wallet: {
    cashbackEarned: Number,
    cashbackUsed: Number,
    orderAttributed: Boolean
  },

  metadata: { type: Map, of: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Indexes
TouchpointSchema.index({ merchantId: 1, timestamp: -1 });
TouchpointSchema.index({ customerId: 1, timestamp: -1 });
TouchpointSchema.index({ sessionId: 1, timestamp: 1 });

// ============================================
// UNIFIED CONVERSION MODEL
// ============================================

export interface IConversion extends Document {
  conversionId: string;
  userId: string;
  customerId: string;
  sessionId?: string;
  merchantId: string;
  storeId?: string;
  orderId?: string;

  type: ConversionType;
  status: ConversionStatus;
  value: {
    amount: number;
    currency: string;
    isEstimated?: boolean;
  };

  // Products/items
  items?: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;

  // Attribution
  attributedTouchpoints: string[];
  attributedChannels: ChannelType[];
  attributionModel: AttributionModel;

  // Channel-specific revenue
  channelRevenue?: Partial<Record<ChannelType, number>>;

  // Aggregator
  aggregator?: {
    platform: 'swiggy' | 'zomato' | 'dunzo';
    commission: number;
    revenue: number;
    profit: number;
  };

  // DOOH attribution
  doohAttribution?: {
    screenId: string;
    dwellTime: number;
    visitAttributed: boolean;
  };

  // QR attribution
  qrAttribution?: {
    qrId: string;
    context: string;
    source: 'menu' | 'order';
  };

  // Creator attribution
  creatorAttribution?: {
    creatorId: string;
    couponCode?: string;
    commission?: number;
  };

  // Wallet attribution
  walletAttribution?: {
    cashbackUsed: number;
    cashbackSource: 'referral' | 'promotion' | 'loyalty';
  };

  // Timing
  conversionWindow: {
    firstTouch: Date;
    lastTouch: Date;
    conversion: Date;
  };

  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversionSchema = new Schema<IConversion>({
  conversionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  customerId: { type: String, required: true, index: true },
  sessionId: { type: String, index: true },
  merchantId: { type: String, required: true, index: true },
  storeId: { type: String, index: true },
  orderId: String,

  type: { type: String, enum: Object.values(ConversionType), required: true },
  status: { type: String, enum: Object.values(ConversionStatus), default: ConversionStatus.PENDING },

  value: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    isEstimated: Boolean
  },

  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number
  }],

  attributedTouchpoints: [String],
  attributedChannels: [String],
  attributionModel: { type: String, enum: Object.values(AttributionModel), default: AttributionModel.LAST_TOUCH },

  channelRevenue: { type: Map, of: Number },

  aggregator: {
    platform: String,
    commission: Number,
    revenue: Number,
    profit: Number
  },

  doohAttribution: {
    screenId: String,
    dwellTime: Number,
    visitAttributed: Boolean
  },

  qrAttribution: {
    qrId: String,
    context: String,
    source: String
  },

  creatorAttribution: {
    creatorId: String,
    couponCode: String,
    commission: Number
  },

  walletAttribution: {
    cashbackUsed: Number,
    cashbackSource: String
  },

  conversionWindow: {
    firstTouch: Date,
    lastTouch: Date,
    conversion: Date
  },

  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Indexes
ConversionSchema.index({ merchantId: 1, timestamp: -1 });
ConversionSchema.index({ customerId: 1, timestamp: -1 });
ConversionSchema.index({ merchantId: 1, type: 1, timestamp: -1 });
ConversionSchema.index({ status: 1, timestamp: -1 });

// ============================================
// CHANNEL MODEL
// ============================================

export interface IChannel extends Document {
  channelId: string;
  merchantId?: string; // null for platform-wide channels
  name: string;
  type: ChannelType;
  category: 'paid' | 'owned' | 'earned' | 'direct';
  isActive: boolean;

  // Cost tracking
  costPerAcquisition?: number;
  costPerClick?: number;
  costPerThousand?: number;

  // Metadata
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<IChannel>({
  channelId: { type: String, required: true, unique: true, index: true },
  merchantId: String,
  name: { type: String, required: true },
  type: { type: String, enum: Object.values(ChannelType), required: true },
  category: { type: String, enum: ['paid', 'owned', 'earned', 'direct'], default: 'owned' },
  isActive: { type: Boolean, default: true },

  costPerAcquisition: Number,
  costPerClick: Number,
  costPerThousand: Number,

  metadata: { type: Map, of: Schema.Types.Mixed }
}, {
  timestamps: true
});

ChannelSchema.index({ merchantId: 1, type: 1 });
ChannelSchema.index({ isActive: 1 });

// ============================================
// SPEND MODEL
// ============================================

export interface ISpend extends Document {
  spendId: string;
  merchantId: string;
  channel: ChannelType;
  campaignId?: string;
  date: Date;
  amount: number;
  currency: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const SpendSchema = new Schema<ISpend>({
  spendId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  channel: { type: String, enum: Object.values(ChannelType), required: true },
  campaignId: String,
  date: { type: Date, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  impressions: Number,
  clicks: Number,
  conversions: Number,
  metadata: { type: Map, of: Schema.Types.Mixed }
}, {
  timestamps: true
});

SpendSchema.index({ merchantId: 1, channel: 1, date: -1 });

// ============================================
// INCREMENTALITY TEST MODEL
// ============================================

export interface IIncrementalityTest extends Document {
  testId: string;
  merchantId: string;
  name: string;
  type: 'holdout' | 'geo' | 'temporal';
  status: 'draft' | 'running' | 'completed' | 'cancelled';

  // Configuration
  testGroupSize: number; // percentage
  controlGroupSize: number;
  duration: number; // days

  // Dates
  startDate: Date;
  endDate?: Date;

  // Results
  results?: {
    testRevenue: number;
    controlRevenue: number;
    uplift: number;
    upliftPercent: number;
    confidence: number;
    statisticalSignificance: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

const IncrementalityTestSchema = new Schema<IIncrementalityTest>({
  testId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['holdout', 'geo', 'temporal'], required: true },
  status: { type: String, enum: ['draft', 'running', 'completed', 'cancelled'], default: 'draft' },
  testGroupSize: { type: Number, required: true },
  controlGroupSize: { type: Number, required: true },
  duration: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  results: {
    testRevenue: Number,
    controlRevenue: Number,
    uplift: Number,
    upliftPercent: Number,
    confidence: Number,
    statisticalSignificance: Boolean
  }
}, {
  timestamps: true
});

// ============================================
// EXPORT MODELS
// ============================================

export const Touchpoint = mongoose.model<ITouchpoint>('Touchpoint', TouchpointSchema);
export const Conversion = mongoose.model<IConversion>('Conversion', ConversionSchema);
export const Channel = mongoose.model<IChannel>('Channel', ChannelSchema);
export const Spend = mongoose.model<ISpend>('Spend', SpendSchema);
export const IncrementalityTest = mongoose.model<IIncrementalityTest>('IncrementalityTest', IncrementalityTestSchema);

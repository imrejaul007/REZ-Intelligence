/**
 * Campaign Configuration Model
 * Manages campaign-specific reward multipliers and configurations
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { ChannelType } from '../types/schemas.js';

// ============================================
// INTERFACES
// ============================================

export interface IChannelRewardOverride {
  baseCoinsPerHundred: number;
  bonusMultiplier: number;
  maxCashbackPercent: number;
}

export interface ICampaignConfig extends Document {
  campaignId: string;
  name: string;
  description?: string;
  merchantId?: string;

  // Status
  isActive: boolean;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

  // Timing
  startDate: Date;
  endDate: Date;
  timezone: string;

  // Reward multipliers
  rewardMultiplier: number;
  maxBonusCoins?: number;
  minOrderValue?: number;
  maxOrderValue?: number;

  // Channel-specific overrides
  channelOverrides?: Map<ChannelType, IChannelRewardOverride>;

  // Eligibility
  eligibleChannels?: ChannelType[];
  excludedChannels?: ChannelType[];
  eligibleCustomerSegments?: string[];
  newCustomersOnly: boolean;

  // Limits
  budget?: number;
  totalAwarded: number;
  maxRedemptions?: number;
  redemptionCount: number;

  // Metadata
  metadata: Map<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SCHEMA
// ============================================

const ChannelRewardOverrideSchema = new Schema<IChannelRewardOverride>(
  {
    baseCoinsPerHundred: { type: Number, required: true, min: 0 },
    bonusMultiplier: { type: Number, required: true, min: 1 },
    maxCashbackPercent: { type: Number, required: true, min: 0, max: 100 }
  },
  { _id: false }
);

const CampaignConfigSchema = new Schema<ICampaignConfig>(
  {
    campaignId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    merchantId: String,

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
      index: true
    },

    // Timing
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },

    // Reward multipliers
    rewardMultiplier: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1
    },
    maxBonusCoins: Number,
    minOrderValue: {
      type: Number,
      default: 0
    },
    maxOrderValue: Number,

    // Channel overrides
    channelOverrides: {
      type: Map,
      of: ChannelRewardOverrideSchema
    },

    // Eligibility
    eligibleChannels: [{
      type: String,
      enum: [
        'search', 'social', 'display', 'video', 'email', 'sms', 'push',
        'dooh', 'print', 'ooh', 'walkin', 'qr', 'organic', 'referral',
        'wallet', 'loyalty', 'creator', 'aggregator', 'direct', 'unknown'
      ]
    }],
    excludedChannels: [{
      type: String,
      enum: [
        'search', 'social', 'display', 'video', 'email', 'sms', 'push',
        'dooh', 'print', 'ooh', 'walkin', 'qr', 'organic', 'referral',
        'wallet', 'loyalty', 'creator', 'aggregator', 'direct', 'unknown'
      ]
    }],
    eligibleCustomerSegments: [String],
    newCustomersOnly: {
      type: Boolean,
      default: false
    },

    // Limits
    budget: Number,
    totalAwarded: {
      type: Number,
      default: 0
    },
    maxRedemptions: Number,
    redemptionCount: {
      type: Number,
      default: 0
    },

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

CampaignConfigSchema.index({ merchantId: 1, status: 1 });
CampaignConfigSchema.index({ startDate: 1, endDate: 1 });
CampaignConfigSchema.index({ status: 1, isActive: 1 });

// ============================================
// VIRTUALS
// ============================================

CampaignConfigSchema.virtual('isCurrentlyActive').get(function () {
  const now = new Date();
  return (
    this.isActive &&
    this.status === 'active' &&
    now >= this.startDate &&
    now <= this.endDate
  );
});

CampaignConfigSchema.virtual('isExpired').get(function () {
  return new Date() > this.endDate;
});

CampaignConfigSchema.virtual('isWithinBudget').get(function () {
  if (!this.budget) return true;
  return this.totalAwarded < this.budget;
});

CampaignConfigSchema.virtual('remainingBudget').get(function () {
  if (!this.budget) return Infinity;
  return Math.max(0, this.budget - this.totalAwarded);
});

// ============================================
// METHODS
// ============================================

CampaignConfigSchema.methods.isChannelEligible = function (channel: ChannelType): boolean {
  // Check exclusion list first
  if (this.excludedChannels && this.excludedChannels.includes(channel)) {
    return false;
  }

  // Check inclusion list (if specified)
  if (this.eligibleChannels && this.eligibleChannels.length > 0) {
    return this.eligibleChannels.includes(channel);
  }

  return true;
};

CampaignConfigSchema.methods.canRedeem = function (
  orderValue: number,
  isNewCustomer: boolean = false
): { allowed: boolean; reason?: string } {
  const now = new Date();

  if (!this.isActive) {
    return { allowed: false, reason: 'Campaign is not active' };
  }

  if (this.status !== 'active') {
    return { allowed: false, reason: `Campaign status is ${this.status}` };
  }

  if (now < this.startDate) {
    return { allowed: false, reason: 'Campaign has not started yet' };
  }

  if (now > this.endDate) {
    return { allowed: false, reason: 'Campaign has ended' };
  }

  if (this.newCustomersOnly && !isNewCustomer) {
    return { allowed: false, reason: 'Campaign is only for new customers' };
  }

  if (this.minOrderValue && orderValue < this.minOrderValue) {
    return { allowed: false, reason: `Minimum order value is ${this.minOrderValue}` };
  }

  if (this.maxOrderValue && orderValue > this.maxOrderValue) {
    return { allowed: false, reason: `Maximum order value is ${this.maxOrderValue}` };
  }

  if (this.maxRedemptions && this.redemptionCount >= this.maxRedemptions) {
    return { allowed: false, reason: 'Maximum redemptions reached' };
  }

  if (!this.isWithinBudget) {
    return { allowed: false, reason: 'Campaign budget exhausted' };
  }

  return { allowed: true };
};

CampaignConfigSchema.methods.recordRedemption = async function (
  coinsAwarded: number
): Promise<void> {
  this.totalAwarded += coinsAwarded;
  this.redemptionCount += 1;
  await this.save();
};

// ============================================
// STATICS
// ============================================

CampaignConfigSchema.statics.findActiveCampaigns = async function (
  merchantId?: string,
  channel?: ChannelType
): Promise<ICampaignConfig[]> {
  const now = new Date();
  const query: Record<string, unknown> = {
    isActive: true,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  };

  if (merchantId) {
    query.merchantId = { $in: [merchantId, null, undefined] };
  }

  const campaigns = await this.find(query).sort({ rewardMultiplier: -1 });

  // Filter by channel eligibility
  if (channel) {
    return campaigns.filter(c => c.isChannelEligible(channel));
  }

  return campaigns;
};

CampaignConfigSchema.statics.findByCampaignId = async function (
  campaignId: string
): Promise<ICampaignConfig | null> {
  return this.findOne({ campaignId, isActive: true });
};

CampaignConfigSchema.statics.updateExpiredCampaigns = async function (): Promise<number> {
  const now = new Date();
  const result = await this.updateMany(
    {
      isActive: true,
      status: 'active',
      endDate: { $lt: now }
    },
    {
      $set: { status: 'completed' }
    }
  );
  return result.modifiedCount;
};

// ============================================
// EXPORT
// ============================================

export const CampaignConfig = (mongoose.models.CampaignConfig as Model<ICampaignConfig>) ||
  mongoose.model<ICampaignConfig>('CampaignConfig', CampaignConfigSchema);

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ShareChannel,
  InfluenceTier,
  CommunityRole,
  ContentType,
  ReferralStatus
} from '../types';

// Share Event Schema
export interface IShareEvent extends Document {
  shareId: string;
  userId: string;
  contentType: ContentType;
  contentId: string;
  contentTitle?: string;
  channel: ShareChannel;
  recipientCount: number;
  clickCount: number;
  conversionCount: number;
  revenue: number;
  timestamp: Date;
  metadata?: {
    deviceType?: string;
    location?: string;
    campaignId?: string;
  };
}

const ShareEventSchema = new Schema<IShareEvent>(
  {
    shareId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    contentType: {
      type: String,
      required: true,
      enum: ['offer', 'deal', 'product', 'campaign', 'store']
    },
    contentId: { type: String, required: true, index: true },
    contentTitle: { type: String },
    channel: {
      type: String,
      required: true,
      enum: ['whatsapp', 'instagram', 'facebook', 'twitter', 'link', 'sms', 'email']
    },
    recipientCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    conversionCount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      deviceType: String,
      location: String,
      campaignId: String
    }
  },
  {
    timestamps: true,
    collection: 'share_events'
  }
);

// Compound indexes for analytics queries
ShareEventSchema.index({ userId: 1, timestamp: -1 });
ShareEventSchema.index({ contentType: 1, contentId: 1 });
ShareEventSchema.index({ channel: 1, timestamp: -1 });

// Referral Event Schema
export interface IReferralEvent extends Document {
  referralId: string;
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  source: ShareChannel;
  status: ReferralStatus;
  conversionValue?: number;
  conversionTimestamp?: Date;
  expiresAt?: Date;
  timestamp: Date;
}

const ReferralEventSchema = new Schema<IReferralEvent>(
  {
    referralId: { type: String, required: true, unique: true, index: true },
    referrerId: { type: String, required: true, index: true },
    refereeId: { type: String, index: true },
    referralCode: { type: String, required: true, index: true },
    source: {
      type: String,
      required: true,
      enum: ['whatsapp', 'instagram', 'facebook', 'twitter', 'link', 'sms', 'email']
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'converted', 'expired', 'cancelled'],
      default: 'pending',
      index: true
    },
    conversionValue: { type: Number },
    conversionTimestamp: { type: Date },
    expiresAt: { type: Date },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    collection: 'referral_events'
  }
);

// Compound indexes
ReferralEventSchema.index({ referrerId: 1, status: 1 });
ReferralEventSchema.index({ referralCode: 1, status: 1 });

// User Social Profile Schema
export interface IUserSocialProfile extends Document {
  userId: string;
  sharingBehavior: {
    frequency: number;
    avgReach: number;
    shareRate: number;
    preferredChannels: ShareChannel[];
    viralCoefficient: number;
    topSharedCategories: string[];
    lastShareTimestamp?: Date;
  };
  influenceScore: {
    total: number;
    reachScore: number;
    engagementScore: number;
    conversionScore: number;
    tier: InfluenceTier;
    followers?: number;
    audienceDemographics?: string[];
    trendingScore?: number;
  };
  communityRole: {
    role: CommunityRole;
    groupsJoined: number;
    groupsCreated: number;
    eventsOrganized: number;
    eventsAttended: number;
    communityEngagement: number;
    moderatorOf?: string[];
  };
  socialReach: {
    totalImpressions: number;
    uniqueRecipients: number;
    whatsappReach: number;
    instagramReach: number;
    facebookReach: number;
    twitterReach: number;
    linkReach: number;
    estimatedAudience: number;
    reachByCategory: Record<string, number>;
    reachGrowthRate?: number;
  };
  referralMetrics: {
    totalReferrals: number;
    pendingReferrals: number;
    successfulReferrals: number;
    conversionRate: number;
    avgOrderValueFromReferrals: number;
    referralRevenue: number;
    referralLTV: number;
    avgTimeToConversion?: number;
    topReferralCategories?: string[];
  };
  lastUpdated: Date;
}

const SharingBehaviorSchema = new Schema(
  {
    frequency: { type: Number, default: 0 },
    avgReach: { type: Number, default: 0 },
    shareRate: { type: Number, default: 0 },
    preferredChannels: [{ type: String, enum: ['whatsapp', 'instagram', 'facebook', 'twitter', 'link', 'sms', 'email'] }],
    viralCoefficient: { type: Number, default: 0 },
    topSharedCategories: [String],
    lastShareTimestamp: Date
  },
  { _id: false }
);

const InfluenceScoreSchema = new Schema(
  {
    total: { type: Number, default: 0 },
    reachScore: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    conversionScore: { type: Number, default: 0 },
    tier: { type: String, enum: ['macro', 'mid', 'micro', 'nano', 'none'], default: 'none' },
    followers: Number,
    audienceDemographics: [String],
    trendingScore: Number
  },
  { _id: false }
);

const CommunityRoleSchema = new Schema(
  {
    role: { type: String, enum: ['organizer', 'active_member', 'lurker', 'none'], default: 'none' },
    groupsJoined: { type: Number, default: 0 },
    groupsCreated: { type: Number, default: 0 },
    eventsOrganized: { type: Number, default: 0 },
    eventsAttended: { type: Number, default: 0 },
    communityEngagement: { type: Number, default: 0 },
    moderatorOf: [String]
  },
  { _id: false }
);

const SocialReachSchema = new Schema(
  {
    totalImpressions: { type: Number, default: 0 },
    uniqueRecipients: { type: Number, default: 0 },
    whatsappReach: { type: Number, default: 0 },
    instagramReach: { type: Number, default: 0 },
    facebookReach: { type: Number, default: 0 },
    twitterReach: { type: Number, default: 0 },
    linkReach: { type: Number, default: 0 },
    estimatedAudience: { type: Number, default: 0 },
    reachByCategory: { type: Map, of: Number, default: {} },
    reachGrowthRate: Number
  },
  { _id: false }
);

const ReferralMetricsSchema = new Schema(
  {
    totalReferrals: { type: Number, default: 0 },
    pendingReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    avgOrderValueFromReferrals: { type: Number, default: 0 },
    referralRevenue: { type: Number, default: 0 },
    referralLTV: { type: Number, default: 0 },
    avgTimeToConversion: Number,
    topReferralCategories: [String]
  },
  { _id: false }
);

const UserSocialProfileSchema = new Schema<IUserSocialProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    sharingBehavior: { type: SharingBehaviorSchema, default: () => ({}) },
    influenceScore: { type: InfluenceScoreSchema, default: () => ({}) },
    communityRole: { type: CommunityRoleSchema, default: () => ({}) },
    socialReach: { type: SocialReachSchema, default: () => ({}) },
    referralMetrics: { type: ReferralMetricsSchema, default: () => ({}) },
    lastUpdated: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    collection: 'user_social_profiles'
  }
);

// Model Exports
export const ShareEvent: Model<IShareEvent> = mongoose.model<IShareEvent>('ShareEvent', ShareEventSchema);
export const ReferralEvent: Model<IReferralEvent> = mongoose.model<IReferralEvent>('ReferralEvent', ReferralEventSchema);
export const UserSocialProfile: Model<IUserSocialProfile> = mongoose.model<IUserSocialProfile>('UserSocialProfile', UserSocialProfileSchema);

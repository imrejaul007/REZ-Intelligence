/**
 * PersonalizationCampaign Model - TypeScript implementation
 * Migration from JavaScript to TypeScript
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IPersonalizationCampaign,
  IPersonalizationCampaignDocument,
  IPersonalizationCampaignModel,
  ITargeting,
  IContentRules,
  IPersonalizationWeights,
  IABTest,
  IChannel,
  ICampaignMetrics,
  ICampaignSchedule,
  CampaignStatus,
  ABTestVariant,
  ChannelType,
  ChannelFrequency,
} from '../types/index';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const targetingSchema = new Schema<ITargeting>({
  userSegments: [{ type: String }],
  minEngagementScore: { type: Number, default: 0 },
  maxEngagementScore: { type: Number, default: 1 },
  priceTiers: [{ type: String }],
  categories: [{ type: String }],
  excludeUsers: [{ type: String }],
}, { _id: false });

const contentRulesSchema = new Schema<IContentRules>({
  itemTypes: [{ type: String }],
  categories: [{ type: String }],
  minRating: { type: Number },
  maxPrice: { type: Number },
  minPrice: { type: Number },
  brands: [{ type: String }],
}, { _id: false });

const personalizationWeightsSchema = new Schema<IPersonalizationWeights>({
  collaborativeWeight: { type: Number, default: 0.4, min: 0, max: 1 },
  contentBasedWeight: { type: Number, default: 0.35, min: 0, max: 1 },
  popularityWeight: { type: Number, default: 0.15, min: 0, max: 1 },
  diversityWeight: { type: Number, default: 0.1, min: 0, max: 1 },
}, { _id: false });

const abTestMetricsSchema = new Schema({
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
}, { _id: false });

const abTestSchema = new Schema<IABTest>({
  enabled: { type: Boolean, default: false },
  testId: { type: String },
  variant: {
    type: String,
    enum: ['control', 'variant_a', 'variant_b', 'variant_c'] as ABTestVariant[],
  },
  metrics: { type: abTestMetricsSchema, default: () => ({}) },
}, { _id: false });

const channelTemplateSchema = new Schema({
  subject: { type: String },
  body: { type: String },
  cta: { type: String },
}, { _id: false });

const channelTimingSchema = new Schema({
  hour: { type: Number, min: 0, max: 23 },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
}, { _id: false });

const channelSchema = new Schema<IChannel>({
  channel: {
    type: String,
    enum: ['push', 'email', 'sms', 'in_app', 'ad'] as ChannelType[],
  },
  enabled: { type: Boolean, default: true },
  frequency: {
    type: String,
    enum: ['realtime', 'daily', 'weekly', 'monthly'] as ChannelFrequency[],
  },
  timing: { type: channelTimingSchema },
  template: { type: channelTemplateSchema },
}, { _id: false });

const campaignMetricsSchema = new Schema<ICampaignMetrics>({
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 },
}, { _id: false });

const campaignScheduleSchema = new Schema<ICampaignSchedule>({
  startDate: { type: Date },
  endDate: { type: Date },
  timezone: { type: String, default: 'UTC' },
}, { _id: false });

const personalizationCampaignSchema = new Schema<IPersonalizationCampaignDocument>({
  campaignId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String },

  // Targeting
  targeting: { type: targetingSchema, default: () => ({}) },

  // Content rules
  contentRules: { type: contentRulesSchema, default: () => ({}) },

  // Personalization settings
  personalization: { type: personalizationWeightsSchema, default: () => ({}) },

  // A/B Testing
  abTest: { type: abTestSchema, default: () => ({}) },

  // Channel settings
  channels: [{ type: channelSchema }],

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'archived'] as CampaignStatus[],
    default: 'draft',
  },

  // Metrics
  metrics: { type: campaignMetricsSchema, default: () => ({}) },

  // Schedule
  schedule: { type: campaignScheduleSchema, default: () => ({}) },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'personalization_campaigns',
});

// ============================================================================
// INDEXES
// ============================================================================

personalizationCampaignSchema.index({ status: 1, 'schedule.startDate': 1 });
personalizationCampaignSchema.index({ 'targeting.userSegments': 1 });

// ============================================================================
// MODEL EXPORT
// ============================================================================

export const PersonalizationCampaign = mongoose.model<
  IPersonalizationCampaignDocument,
  IPersonalizationCampaignModel
>('PersonalizationCampaign', personalizationCampaignSchema);

export default PersonalizationCampaign;

/**
 * @deprecated Migration to TypeScript in progress
 * TODO: Replace with src/types/index.ts IPersonalizationCampaignDocument interface
 * TODO: See src/models/PersonalizationCampaign.ts for TypeScript implementation
 */

const mongoose = require('mongoose');

const personalizationCampaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String },

  // Targeting
  targeting: {
    userSegments: [{ type: String }],
    minEngagementScore: { type: Number, default: 0 },
    maxEngagementScore: { type: Number, default: 1 },
    priceTiers: [{ type: String }],
    categories: [{ type: String }],
    excludeUsers: [{ type: String }]
  },

  // Content rules
  contentRules: {
    itemTypes: [{ type: String }],
    categories: [{ type: String }],
    minRating: { type: Number },
    maxPrice: { type: Number },
    minPrice: { type: Number },
    brands: [{ type: String }]
  },

  // Personalization settings
  personalization: {
    collaborativeWeight: { type: Number, default: 0.4, min: 0, max: 1 },
    contentBasedWeight: { type: Number, default: 0.35, min: 0, max: 1 },
    popularityWeight: { type: Number, default: 0.15, min: 0, max: 1 },
    diversityWeight: { type: Number, default: 0.1, min: 0, max: 1 }
  },

  // A/B Testing
  abTest: {
    enabled: { type: Boolean, default: false },
    testId: { type: String },
    variant: { type: String, enum: ['control', 'variant_a', 'variant_b', 'variant_c'] },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 }
    }
  },

  // Channel settings
  channels: [{
    channel: { type: String, enum: ['push', 'email', 'sms', 'in_app', 'ad'] },
    enabled: { type: Boolean, default: true },
    frequency: { type: String, enum: ['realtime', 'daily', 'weekly', 'monthly'] },
    timing: {
      hour: { type: Number, min: 0, max: 23 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }]
    },
    template: {
      subject: { type: String },
      body: { type: String },
      cta: { type: String }
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
    default: 'draft'
  },

  // Metrics
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 }
  },

  // Schedule
  schedule: {
    startDate: { type: Date },
    endDate: { type: Date },
    timezone: { type: String, default: 'UTC' }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'personalization_campaigns'
});

personalizationCampaignSchema.index({ status: 1, 'schedule.startDate': 1 });
personalizationCampaignSchema.index({ 'targeting.userSegments': 1 });

const PersonalizationCampaign = mongoose.model('PersonalizationCampaign', personalizationCampaignSchema);

module.exports = PersonalizationCampaign;

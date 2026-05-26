/**
 * RFM++ - Advanced Customer Segmentation Models
 * Beyond RFM: Behavior, Engagement, Lifetime Value
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// INTERFACES
// ============================================

export interface IEngagement {
  sessions?: number;
  pageViews?: number;
  avgSessionDuration?: number;
  lastActive?: Date;
}

export interface ICustomerProfile extends Document {
  customerId: string;
  phone?: string;
  email?: string;
  rfm?: { recency: number; frequency: number; monetary: number };
  rfmScore?: { r: number; f: number; m: number; total: number };
  engagement?: IEngagement;
  cohort?: {
    acquisitionDate: Date;
    acquisitionSource: string;
    acquisitionCampaign: string;
    acquisitionChannel: string;
  };
  lifecycle?: {
    stage: 'new' | 'active' | 'engaged' | 'at_risk' | 'churned' | 'reactivated';
    daysSinceFirstPurchase: number;
    daysSinceLastActivity: number;
  };
  ltv?: { actual: number; predicted: number; confidence: number; clv: number };
  preferences?: {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number };
    preferredChannels: string[];
  };
  riskFlags?: { type: string; severity: number; detectedAt: Date }[];
  segments?: { segment: string; score: number; addedAt: Date }[];
  stats?: {
    totalOrders: number;
    totalSpend: number;
    avgOrderValue: number;
    returns: number;
    refunds: number;
    supportTickets: number;
  };
  updatedAt: Date;
}

// ============================================
// CUSTOMER PROFILE
// ============================================

const CustomerProfileSchema = new Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  phone: String,
  email: String,

  // Basic RFM
  rfm: {
    recency: Number,     // Days since last purchase
    frequency: Number,    // Total transactions
    monetary: Number,    // Total spend
  },

  // RFM Scores (1-5)
  rfmScore: {
    r: { type: Number, min: 1, max: 5 },
    f: { type: Number, min: 1, max: 5 },
    m: { type: Number, min: 1, max: 5 },
    total: Number,
  },

  // Extended Metrics
  engagement: {
    sessions: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    avgSessionDuration: Number,  // seconds
    lastActive: Date,
  },

  // Cohort info
  cohort: {
    acquisitionDate: Date,
    acquisitionSource: String,
    acquisitionCampaign: String,
    acquisitionChannel: String,
  },

  // Lifecycle
  lifecycle: {
    stage: {
      type: String,
      enum: ['new', 'active', 'engaged', 'at_risk', 'churned', 'reactivated'],
      default: 'new'
    },
    daysSinceFirstPurchase: Number,
    daysSinceLastActivity: Number,
  },

  // LTV Prediction
  ltv: {
    actual: Number,        // Historical LTV
    predicted: Number,      // ML predicted LTV
    confidence: Number,     // Prediction confidence
    clv: Number,          // Customer Lifetime Value
  },

  // Preferences
  preferences: {
    categories: [String],
    brands: [String],
    priceRange: { min: Number, max: Number },
    preferredChannels: [String],  // app, web, whatsapp
  },

  // Risk indicators
  riskFlags: [{
    type: String,
    severity: Number,      // 1-10
    detectedAt: Date,
  }],

  // Segments (computed)
  segments: [{
    segment: String,
    score: Number,
    addedAt: Date,
  }],

  // Stats
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    returns: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    supportTickets: { type: Number, default: 0 },
  },

  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

CustomerProfileSchema.index({ 'rfmScore.total': -1 });
CustomerProfileSchema.index({ 'lifecycle.stage': 1 });
CustomerProfileSchema.index({ 'cohort.acquisitionDate': 1 });

export const CustomerProfile = mongoose.model<ICustomerProfile>('CustomerProfile', CustomerProfileSchema);

// ============================================
// COHORT ANALYSIS
// ============================================

const CohortSchema = new Schema({
  cohortId: { type: String, required: true, unique: true },

  // Cohort definition
  definition: {
    type: {
      type: String,
      enum: ['acquisition_date', 'acquisition_source', 'acquisition_channel', 'first_product', 'segment'],
      required: true
    },
    value: String,  // e.g., "2026-01" or "instagram"
  },

  // Time periods
  periods: [{
    period: String,     // Week/Month
    startDate: Date,
    endDate: Date,
  }],

  // Metrics per period
  metrics: [{
    period: String,
    cohortSize: Number,
    revenue: Number,
    orders: Number,
    retention: Number,   // % retained
    ltv: Number,
    activityRate: Number,  // % active
  }],

  // Computed
  avgRetention: Number,
  avgLTV: Number,
}, { timestamps: true });

CohortSchema.index({ 'definition.type': 1, 'definition.value': 1 });

export const Cohort = mongoose.models.Cohort || mongoose.model('Cohort', CohortSchema);

// ============================================
// SEGMENT
// ============================================

const SegmentSchema = new Schema({
  name: { type: String, required: true },
  description: String,

  // Criteria
  criteria: {
    rules: [{
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed,
    }],
    logic: { type: String, enum: ['and', 'or'], default: 'and' },
  },

  // Computed members
  memberCount: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },

  // Status
  active: { type: Boolean, default: true },
  system: { type: Boolean, default: false },  // System segments can't be deleted

  // Priority
  priority: { type: Number, default: 0 },

  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Segment = mongoose.models.Segment || mongoose.model('Segment', SegmentSchema);

// ============================================
// ANALYTICS SNAPSHOT
// ============================================

const AnalyticsSnapshotSchema = new Schema({
  date: { type: Date, required: true, unique: true, index: true },

  // Customers
  customers: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    atRisk: { type: Number, default: 0 },
    churned: { type: Number, default: 0 },
    reactivated: { type: Number, default: 0 },
  },

  // Revenue
  revenue: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    existing: { type: Number, default: 0 },
    reactivated: { type: Number, default: 0 },
  },

  // Orders
  orders: {
    total: { type: Number, default: 0 },
    avgValue: { type: Number, default: 0 },
  },

  // Segments breakdown
  segmentBreakdown: [{
    segment: String,
    count: Number,
    revenue: Number,
  }],

  // Engagement
  engagement: {
    sessions: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    avgDuration: Number,
  },
}, { timestamps: true });

export const AnalyticsSnapshot = mongoose.models.AnalyticsSnapshot || mongoose.model('AnalyticsSnapshot', AnalyticsSnapshotSchema);

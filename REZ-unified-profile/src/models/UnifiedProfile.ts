import mongoose, { Schema, Document, Model } from 'mongoose';

// Unified Profile Document interface
export interface IUnifiedProfile extends Document {
  userId: string;
  identity: {
    primaryId: string;
    emails: string[];
    phones: string[];
    devices: string[];
    linkedAccounts: Array<{
      provider: string;
      externalId: string;
      linkedAt: Date;
    }>;
    trustScore: number;
  };
  demographics: {
    name?: string;
    age?: number;
    gender?: string;
    city?: string;
    pincode?: string;
    language?: string;
    occupation?: string;
    incomeTier?: string;
  };
  signals: {
    location: {
      segments: string[];
      patterns: string[];
      favoriteZones: string[];
      confidence: number;
    };
    behavioral: {
      buyerType: string;
      cashbackSensitivity: number;
      luxuryAffinity: number;
      impulseScore: number;
      confidence: number;
    };
    social: {
      influenceTier: string;
      referralCount: number;
      sharingRate: number;
      confidence: number;
    };
    competitor: {
      loyaltyScore: number;
      switchRisk: string;
      winBackPotential: number;
      confidence: number;
    };
    overall: number;
  };
  segments: string[];
  lifetime: {
    tenureDays: number;
    totalOrders: number;
    totalSpend: number;
    avgOrderValue: number;
    lastOrderDate?: Date;
    firstOrderDate?: Date;
    predictedLTV: number;
  };
  activity: {
    last30Days: {
      orders: number;
      spend: number;
      visits: number;
      sessions: number;
    };
    last90Days: {
      orders: number;
      spend: number;
      visits: number;
      sessions: number;
    };
    engagement: {
      recencyScore: number;
      frequencyScore: number;
      monetaryScore: number;
      engagementIndex: number;
    };
  };
  preferences: {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number };
    notifications: { email: boolean; sms: boolean; push: boolean };
    communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
    timezone?: string;
  };
  lastUpdated: Date;
  createdAt: Date;
  calculateEngagementIndex(): number;
}

// Linked Account Sub-schema
const linkedAccountSchema = new Schema({
  provider: { type: String, required: true },
  externalId: { type: String, required: true },
  linkedAt: { type: Date, default: Date.now }
}, { _id: false });

// Identity Sub-schema
const identitySchema = new Schema({
  primaryId: { type: String, required: true },
  emails: [{ type: String }],
  phones: [{ type: String }],
  devices: [{ type: String }],
  linkedAccounts: [linkedAccountSchema],
  trustScore: { type: Number, default: 0 }
}, { _id: false });

// Demographics Sub-schema
const demographicsSchema = new Schema({
  name: String,
  age: Number,
  gender: String,
  city: String,
  pincode: String,
  language: String,
  occupation: String,
  incomeTier: String
}, { _id: false });

// Location Signals Sub-schema
const locationSignalsSchema = new Schema({
  segments: [{ type: String }],
  patterns: [{ type: String }],
  favoriteZones: [{ type: String }],
  confidence: { type: Number, default: 0 }
}, { _id: false });

// Behavioral Signals Sub-schema
const behavioralSignalsSchema = new Schema({
  buyerType: { type: String, default: 'standard' },
  cashbackSensitivity: { type: Number, default: 0 },
  luxuryAffinity: { type: Number, default: 0 },
  impulseScore: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 }
}, { _id: false });

// Social Signals Sub-schema
const socialSignalsSchema = new Schema({
  influenceTier: { type: String, default: 'low' },
  referralCount: { type: Number, default: 0 },
  sharingRate: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 }
}, { _id: false });

// Competitor Signals Sub-schema
const competitorSignalsSchema = new Schema({
  loyaltyScore: { type: Number, default: 0 },
  switchRisk: { type: String, default: 'low' },
  winBackPotential: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 }
}, { _id: false });

// Signal Scores Sub-schema
const signalScoresSchema = new Schema({
  location: { type: locationSignalsSchema, default: () => ({}) },
  behavioral: { type: behavioralSignalsSchema, default: () => ({}) },
  social: { type: socialSignalsSchema, default: () => ({}) },
  competitor: { type: competitorSignalsSchema, default: () => ({}) },
  overall: { type: Number, default: 0 }
}, { _id: false });

// Lifetime Metrics Sub-schema
const lifetimeMetricsSchema = new Schema({
  tenureDays: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  lastOrderDate: Date,
  firstOrderDate: Date,
  predictedLTV: { type: Number, default: 0 }
}, { _id: false });

// Activity Period Sub-schema
const activityPeriodSchema = new Schema({
  orders: { type: Number, default: 0 },
  spend: { type: Number, default: 0 },
  visits: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 }
}, { _id: false });

// Engagement Metrics Sub-schema
const engagementMetricsSchema = new Schema({
  recencyScore: { type: Number, default: 0 },
  frequencyScore: { type: Number, default: 0 },
  monetaryScore: { type: Number, default: 0 },
  engagementIndex: { type: Number, default: 0 }
}, { _id: false });

// Activity Summary Sub-schema
const activitySummarySchema = new Schema({
  last30Days: { type: activityPeriodSchema, default: () => ({}) },
  last90Days: { type: activityPeriodSchema, default: () => ({}) },
  engagement: { type: engagementMetricsSchema, default: () => ({}) }
}, { _id: false });

// User Preferences Sub-schema
const userPreferencesSchema = new Schema({
  categories: [{ type: String }],
  brands: [{ type: String }],
  priceRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10000 }
  },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  },
  communicationFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'never'],
    default: 'weekly'
  },
  timezone: String
}, { _id: false });

// Main Unified Profile Schema
const unifiedProfileSchema = new Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  identity: {
    type: identitySchema,
    default: () => ({
      primaryId: '',
      emails: [],
      phones: [],
      devices: [],
      linkedAccounts: [],
      trustScore: 0
    })
  },
  demographics: {
    type: demographicsSchema,
    default: () => ({})
  },
  signals: {
    type: signalScoresSchema,
    default: () => ({
      location: { segments: [], patterns: [], favoriteZones: [], confidence: 0 },
      behavioral: { buyerType: 'standard', cashbackSensitivity: 0, luxuryAffinity: 0, impulseScore: 0, confidence: 0 },
      social: { influenceTier: 'low', referralCount: 0, sharingRate: 0, confidence: 0 },
      competitor: { loyaltyScore: 0, switchRisk: 'low', winBackPotential: 0, confidence: 0 },
      overall: 0
    })
  },
  segments: [{
    type: String,
    index: true
  }],
  lifetime: {
    type: lifetimeMetricsSchema,
    default: () => ({
      tenureDays: 0,
      totalOrders: 0,
      totalSpend: 0,
      avgOrderValue: 0,
      predictedLTV: 0
    })
  },
  activity: {
    type: activitySummarySchema,
    default: () => ({
      last30Days: { orders: 0, spend: 0, visits: 0, sessions: 0 },
      last90Days: { orders: 0, spend: 0, visits: 0, sessions: 0 },
      engagement: { recencyScore: 0, frequencyScore: 0, monetaryScore: 0, engagementIndex: 0 }
    })
  },
  preferences: {
    type: userPreferencesSchema,
    default: () => ({
      categories: [],
      brands: [],
      priceRange: { min: 0, max: 10000 },
      notifications: { email: true, sms: true, push: true },
      communicationFrequency: 'weekly'
    })
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: 'lastUpdated' },
  collection: 'unified_profiles'
});

// Indexes for common queries
unifiedProfileSchema.index({ 'identity.emails': 1 });
unifiedProfileSchema.index({ 'identity.phones': 1 });
unifiedProfileSchema.index({ 'demographics.city': 1 });
unifiedProfileSchema.index({ 'lifetime.totalSpend': -1 });
unifiedProfileSchema.index({ 'lifetime.predictedLTV': -1 });
unifiedProfileSchema.index({ 'signals.overall': -1 });
unifiedProfileSchema.index({ segments: 1, 'lifetime.totalSpend': -1 });
unifiedProfileSchema.index({ 'activity.engagement.engagementIndex': -1 });

// Compound index for search
unifiedProfileSchema.index({ 'identity.emails': 1, 'identity.phones': 1, userId: 1 });

// Virtual for full name
unifiedProfileSchema.virtual('fullName').get(function(this: IUnifiedProfile) {
  return this.demographics?.name || 'Unknown';
});

// Method to calculate engagement index
unifiedProfileSchema.methods.calculateEngagementIndex = function(this: IUnifiedProfile): number {
  const eng = this.activity?.engagement;
  if (!eng) return 0;
  return Math.round((eng.recencyScore + eng.frequencyScore + eng.monetaryScore) / 3);
};

// Static method to find by any identifier
unifiedProfileSchema.statics.findByIdentifier = async function(identifier: string) {
  return this.findOne({
    $or: [
      { userId: identifier },
      { 'identity.emails': identifier },
      { 'identity.phones': identifier }
    ]
  });
};

// Static method to get profiles by segment
unifiedProfileSchema.statics.findBySegment = async function(
  segment: string,
  options: { limit?: number; skip?: number; sort?: unknown } = {}
) {
  const { limit = 100, skip = 0, sort = { 'lifetime.totalSpend': -1 } } = options;
  return this.find({ segments: segment })
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Interface for model with static methods
interface IUnifiedProfileModel extends Model<IUnifiedProfile> {
  findByIdentifier(identifier: string): Promise<IUnifiedProfile | null>;
  findBySegment(
    segment: string,
    options?: { limit?: number; skip?: number; sort?: unknown }
  ): Promise<IUnifiedProfile[]>;
}

// Export the model with the interface that includes static methods
export const UnifiedProfileModel = mongoose.model<IUnifiedProfile, IUnifiedProfileModel>(
  'UnifiedProfile',
  unifiedProfileSchema
);

export default UnifiedProfileModel;

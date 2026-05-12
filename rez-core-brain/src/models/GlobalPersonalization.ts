import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUserPreferences, ILoyaltyProfile, IContextualData, IIntelligenceMetrics } from '../types';

// Tone enum
export enum Tone {
  FORMAL = 'formal',
  CASUAL = 'casual',
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
}

// Privacy level enum
export enum PrivacyLevel {
  STRICT = 'strict',
  BALANCED = 'balanced',
  OPEN = 'open',
}

// Loyalty tier enum
export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

// Interface for User Preferences document
export interface IUserPreferencesDocument extends IUserPreferences, Document {
  _id: mongoose.Types.ObjectId;
  updatePreference(key: string, value: unknown): Promise<void>;
  resetToDefaults(): Promise<void>;
}

// User Preferences schema
const userPreferencesSchema = new Schema<IUserPreferencesDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tone: {
      type: String,
      enum: Object.values(Tone),
      default: Tone.FRIENDLY,
    },
    language: {
      type: String,
      default: 'en',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    privacyLevel: {
      type: String,
      enum: Object.values(PrivacyLevel),
      default: PrivacyLevel.BALANCED,
    },
    accessibilityNeeds: {
      type: [String],
      default: [],
    },
    preferredContentTypes: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'user_preferences',
  }
);

// Methods
userPreferencesSchema.methods.updatePreference = async function (
  key: string,
  value: unknown
) {
  const allowedKeys = ['tone', 'language', 'timezone', 'privacyLevel', 'preferredContentTypes'];
  if (!allowedKeys.includes(key)) {
    throw new Error(`Cannot update protected preference: ${key}`);
  }
  (this as Record<string, unknown>)[key] = value;
  await this.save();
};

userPreferencesSchema.methods.resetToDefaults = async function () {
  this.tone = Tone.FRIENDLY;
  this.language = 'en';
  this.timezone = 'UTC';
  this.notificationPreferences = { email: true, push: true, sms: false };
  this.privacyLevel = PrivacyLevel.BALANCED;
  this.accessibilityNeeds = [];
  this.preferredContentTypes = [];
  await this.save();
};

// Interface for Loyalty Profile document
export interface ILoyaltyProfileDocument extends ILoyaltyProfile, Document {
  _id: mongoose.Types.ObjectId;
  addPoints(points: number): Promise<void>;
  deductPoints(points: number): Promise<boolean>;
  upgradeTier(): Promise<void>;
  calculateLifetimeValue(): Promise<void>;
}

// Loyalty Profile schema
const loyaltyProfileSchema = new Schema<ILoyaltyProfileDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tier: {
      type: String,
      enum: Object.values(LoyaltyTier),
      default: LoyaltyTier.BRONZE,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    memberSince: {
      type: Date,
      default: Date.now,
    },
    benefits: {
      type: [String],
      default: [],
    },
    preferences: {
      favoriteCategories: { type: [String], default: [] },
      preferredBrands: { type: [String], default: [] },
      communicationStyle: { type: String },
    },
    history: {
      totalPurchases: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      lastPurchaseDate: { type: Date },
      favoriteStore: { type: String },
    },
  },
  {
    timestamps: true,
    collection: 'loyalty_profiles',
  }
);

// Tier thresholds
const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0,
  [LoyaltyTier.SILVER]: 1000,
  [LoyaltyTier.GOLD]: 5000,
  [LoyaltyTier.PLATINUM]: 15000,
  [LoyaltyTier.DIAMOND]: 50000,
};

// Tier benefits
const TIER_BENEFITS: Record<LoyaltyTier, string[]> = {
  [LoyaltyTier.BRONZE]: ['Basic rewards', 'Email support'],
  [LoyaltyTier.SILVER]: ['5% discount', 'Priority support', 'Early access'],
  [LoyaltyTier.GOLD]: ['10% discount', 'Free shipping', 'Exclusive deals'],
  [LoyaltyTier.PLATINUM]: ['15% discount', 'Personal shopper', 'VIP events'],
  [LoyaltyTier.DIAMOND]: ['20% discount', 'Concierge service', 'Luxury gifts'],
};

// Methods
loyaltyProfileSchema.methods.addPoints = async function (points: number) {
  if (points < 0) {
    throw new Error('Cannot add negative points');
  }
  this.points += points;
  await this.upgradeTier();
  await this.save();
};

loyaltyProfileSchema.methods.deductPoints = async function (points: number) {
  if (points < 0) {
    throw new Error('Cannot deduct negative points');
  }
  if (this.points < points) {
    return false;
  }
  this.points -= points;
  await this.save();
  return true;
};

loyaltyProfileSchema.methods.upgradeTier = async function () {
  const tiers = Object.values(LoyaltyTier);
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (this.points >= TIER_THRESHOLDS[tiers[i] as LoyaltyTier]) {
      if (this.tier !== tiers[i]) {
        this.tier = tiers[i] as LoyaltyTier;
        this.benefits = TIER_BENEFITS[tiers[i] as LoyaltyTier];
      }
      break;
    }
  }
};

loyaltyProfileSchema.methods.calculateLifetimeValue = async function () {
  this.history.averageOrderValue =
    this.history.totalPurchases > 0
      ? this.history.totalSpent / this.history.totalPurchases
      : 0;
  await this.save();
};

// Static methods
loyaltyProfileSchema.statics.getTierInfo = function (tier: LoyaltyTier) {
  return {
    tier,
    threshold: TIER_THRESHOLDS[tier],
    benefits: TIER_BENEFITS[tier],
  };
};

// Interface for Contextual Data document
export interface IContextualDataDocument extends IContextualData, Document {
  _id: mongoose.Types.ObjectId;
  updateActivity(action: string, agent: string): Promise<void>;
  addActiveAgent(agentId: string): Promise<void>;
  removeActiveAgent(agentId: string): Promise<void>;
  addIntent(intent: string): Promise<void>;
}

// Contextual Data schema
const contextualDataSchema = new Schema<IContextualDataDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    currentContext: {
      location: { type: String },
      device: { type: String },
      browser: { type: String },
      os: { type: String },
      appVersion: { type: String },
      sessionId: { type: String },
    },
    recentActivity: {
      lastAction: { type: String },
      lastAgent: { type: String },
      lastTopic: { type: String },
      lastSearch: { type: String },
    },
    temporalContext: {
      dayOfWeek: { type: Number },
      timeOfDay: { type: String },
      isHoliday: { type: Boolean },
      season: { type: String },
    },
    relationships: {
      activeAgents: { type: [String], default: [] },
      recentIntents: { type: [String], default: [] },
      pendingTasks: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
    collection: 'contextual_data',
  }
);

// Methods
contextualDataSchema.methods.updateActivity = async function (
  action: string,
  agent: string
) {
  this.recentActivity.lastAction = action;
  this.recentActivity.lastAgent = agent;
  await this.save();
};

contextualDataSchema.methods.addActiveAgent = async function (agentId: string) {
  if (!this.relationships.activeAgents.includes(agentId)) {
    this.relationships.activeAgents.push(agentId);
    await this.save();
  }
};

contextualDataSchema.methods.removeActiveAgent = async function (agentId: string) {
  this.relationships.activeAgents = this.relationships.activeAgents.filter(
    (id: string) => id !== agentId
  );
  await this.save();
};

contextualDataSchema.methods.addIntent = async function (intent: string) {
  const intents = this.relationships.recentIntents;
  intents.unshift(intent);
  // Keep only last 10 intents
  this.relationships.recentIntents = intents.slice(0, 10);
  await this.save();
};

// Interface for Intelligence Metrics document
export interface IIntelligenceMetricsDocument extends IIntelligenceMetrics, Document {
  _id: mongoose.Types.ObjectId;
  recalculate(): Promise<void>;
}

// Intelligence Metrics schema
const intelligenceMetricsSchema = new Schema<IIntelligenceMetricsDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    engagement: {
      dailyActiveDays: { type: Number, default: 0 },
      averageSessionLength: { type: Number, default: 0 },
      interactionFrequency: { type: Number, default: 0 },
    },
    preferences: {
      consistencyScore: { type: Number, default: 0.5 },
      adaptationRate: { type: Number, default: 0 },
      satisfactionScore: { type: Number },
    },
    behavior: {
      predictabilityScore: { type: Number, default: 0.5 },
      explorationVsExploitation: { type: Number, default: 0.5 },
      preferredAgents: { type: [String], default: [] },
      peakActivityHours: { type: [Number], default: [] },
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'intelligence_metrics',
  }
);

// Methods
intelligenceMetricsSchema.methods.recalculate = async function () {
  // This would typically pull data from various sources
  // For now, just update the calculated timestamp
  this.calculatedAt = new Date();
  await this.save();
};

// Static methods
intelligenceMetricsSchema.statics.getOrCreate = async function (userId: string) {
  let metrics = await this.findOne({ userId });
  if (!metrics) {
    metrics = await this.create({ userId });
  }
  return metrics;
};

// Create and export models
export const UserPreferences: Model<IUserPreferencesDocument> = mongoose.model<IUserPreferencesDocument>(
  'UserPreferences',
  userPreferencesSchema
);

export const LoyaltyProfile: Model<ILoyaltyProfileDocument> = mongoose.model<ILoyaltyProfileDocument>(
  'LoyaltyProfile',
  loyaltyProfileSchema
);

export const ContextualData: Model<IContextualDataDocument> = mongoose.model<IContextualDataDocument>(
  'ContextualData',
  contextualDataSchema
);

export const IntelligenceMetrics: Model<IIntelligenceMetricsDocument> = mongoose.model<IIntelligenceMetricsDocument>(
  'IntelligenceMetrics',
  intelligenceMetricsSchema
);

export {
  userPreferencesSchema,
  loyaltyProfileSchema,
  contextualDataSchema,
  intelligenceMetricsSchema,
};

export default {
  UserPreferences,
  LoyaltyProfile,
  ContextualData,
  IntelligenceMetrics,
};

/**
 * REZ Memory Layer - User Profile Model
 * MongoDB model for storing computed user profiles
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  ComputedSegment,
  ComputedPreferences,
  CategoryPreference,
  BrandPreference,
  PriceRangePreference,
  ChannelPreference,
  TimePattern,
  BehavioralPattern
} from '../types/timeline';

export interface IUserProfileDocument extends Document {
  userId: string;
  segments: ComputedSegment[];
  preferences: ComputedPreferences;
  behavioralPatterns: BehavioralPattern[];
  eventCount: number;
  lastEventTimestamp: Date;
  firstEventTimestamp: Date;
  activityStreak: number;
  engagementScore: number;
  lastComputed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryPreferenceSchema = new Schema<CategoryPreference>(
  {
    category: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    eventCount: { type: Number, required: true, min: 0 },
    lastInteraction: { type: Date, required: true }
  },
  { _id: false }
);

const BrandPreferenceSchema = new Schema<BrandPreference>(
  {
    brand: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    purchaseCount: { type: Number, required: true, min: 0 },
    avgOrderValue: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const PriceRangePreferenceSchema = new Schema<PriceRangePreference>(
  {
    range: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 }
  },
  { _id: false }
);

const ChannelPreferenceSchema = new Schema<ChannelPreference>(
  {
    channel: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    interactionCount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const TimePatternSchema = new Schema<TimePattern>(
  {
    pattern: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'weekday', 'weekend'],
      required: true
    },
    score: { type: Number, required: true, min: 0, max: 1 },
    peakHour: { type: Number, min: 0, max: 23 }
  },
  { _id: false }
);

const ComputedPreferencesSchema = new Schema<ComputedPreferences>(
  {
    categories: [CategoryPreferenceSchema],
    brands: [BrandPreferenceSchema],
    priceRanges: [PriceRangePreferenceSchema],
    channels: [ChannelPreferenceSchema],
    timePatterns: [TimePatternSchema]
  },
  { _id: false }
);

const ComputedSegmentSchema = new Schema<ComputedSegment>(
  {
    segmentId: { type: String, required: true },
    segmentName: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    lastTriggered: { type: Date, required: true },
    triggers: [{ type: String }]
  },
  { _id: false }
);

const BehavioralPatternSchema = new Schema<BehavioralPattern>(
  {
    patternId: { type: String, required: true },
    patternType: { type: String, required: true },
    description: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    occurrences: { type: Number, required: true, min: 0 },
    lastObserved: { type: Date, required: true }
  },
  { _id: false }
);

const UserProfileSchema = new Schema<IUserProfileDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    segments: {
      type: [ComputedSegmentSchema],
      default: []
    },
    preferences: {
      type: ComputedPreferencesSchema,
      default: () => ({
        categories: [],
        brands: [],
        priceRanges: [],
        channels: [],
        timePatterns: []
      })
    },
    behavioralPatterns: {
      type: [BehavioralPatternSchema],
      default: []
    },
    eventCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastEventTimestamp: {
      type: Date,
      default: null
    },
    firstEventTimestamp: {
      type: Date,
      default: null
    },
    activityStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastComputed: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'user_profiles'
  }
);

// Compound indexes
UserProfileSchema.index({ userId: 1 });
UserProfileSchema.index({ 'segments.segmentId': 1 });
UserProfileSchema.index({ lastEventTimestamp: -1 });
UserProfileSchema.index({ engagementScore: -1 });

// Methods
UserProfileSchema.methods.updateSegments = function(
  segments: ComputedSegment[]
) {
  this.segments = segments;
  this.lastComputed = new Date();
  return this.save();
};

UserProfileSchema.methods.updatePreferences = function(
  preferences: ComputedPreferences
) {
  this.preferences = preferences;
  this.lastComputed = new Date();
  return this.save();
};

UserProfileSchema.methods.incrementEventCount = function() {
  this.eventCount += 1;
  this.lastEventTimestamp = new Date();
  if (!this.firstEventTimestamp) {
    this.firstEventTimestamp = new Date();
  }
  return this.save();
};

UserProfileSchema.methods.updateEngagementScore = function(
  score: number
) {
  this.engagementScore = Math.min(100, Math.max(0, score));
  return this.save();
};

// Static methods
UserProfileSchema.statics.findOrCreateByUserId = async function(
  userId: string
): Promise<IUserProfileDocument> {
  let profile = await this.findOne({ userId });

  if (!profile) {
    profile = new this({ userId });
    await profile.save();
  }

  return profile;
};

UserProfileSchema.statics.getTopEngagedUsers = function(
  limit: number = 100,
  minScore: number = 0
) {
  return this.find({ engagementScore: { $gte: minScore } })
    .sort({ engagementScore: -1 })
    .limit(limit);
};

UserProfileSchema.statics.findBySegment = function(segmentId: string) {
  return this.find({ 'segments.segmentId': segmentId });
};

UserProfileSchema.statics.getActiveUsersCount = function(
  hoursSinceLastEvent: number = 24
) {
  const since = new Date(Date.now() - hoursSinceLastEvent * 60 * 60 * 1000);
  return this.countDocuments({ lastEventTimestamp: { $gte: since } });
};

export const UserProfile = mongoose.model<IUserProfileDocument>(
  'UserProfile',
  UserProfileSchema
);

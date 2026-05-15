/**
 * UserLocationProfile Model
 * Aggregated user location profile with patterns and segments
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { UserLocationProfile, LocationPattern, UserSegment } from '../types/index.js';

const locationPatternSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['commuter', 'mall_goer', 'traveler', 'explorer', 'gym_enthusiast', 'foodie']
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  locations: [{
    type: String
  }],
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'occasional']
  },
  peakDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  peakHours: [{
    type: Number,
    min: 0,
    max: 23
  }],
  detectedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

export interface UserLocationProfileDocument extends Omit<UserLocationProfile, '_id'>, Document {}

const userLocationProfileSchema = new Schema<UserLocationProfileDocument>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patterns: [locationPatternSchema],
  segments: [{
    type: String,
    enum: [
      'premium_mall_visitor',
      'office_commuter',
      'college_student',
      'frequent_traveler',
      'high_footfall_seeker',
      'food_enthusiast',
      'fitness_focused',
      'explorer'
    ]
  }],
  totalVisits: {
    type: Number,
    default: 0
  },
  favoriteZones: [{
    type: String
  }],
  lastVisit: {
    type: Date,
    default: undefined
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
  timestamps: false,
  versionKey: false
});

// Index for segment queries
userLocationProfileSchema.index({ segments: 1 });
userLocationProfileSchema.index({ totalVisits: -1 });
userLocationProfileSchema.index({ lastVisit: -1 });

export const UserLocationProfileModel = mongoose.model<UserLocationProfileDocument>(
  'UserLocationProfile',
  userLocationProfileSchema
);

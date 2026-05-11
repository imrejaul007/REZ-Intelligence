/**
 * @deprecated Migration to TypeScript in progress
 * TODO: Replace with src/types/index.ts IUserDNAProfileDocument interface
 * TODO: See src/models/UserDNAProfile.ts for TypeScript implementation
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const behavioralPatternSchema = new mongoose.Schema({
  type: { type: String, required: true },
  frequency: { type: Number, default: 0 },
  lastObserved: { type: Date, default: Date.now },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const preferenceVectorSchema = new mongoose.Schema({
  dimension: { type: String, required: true },
  value: { type: Number, default: 0, min: -1, max: 1 },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const contentAffinitySchema = new mongoose.Schema({
  contentType: { type: String, required: true },
  category: { type: String, required: true },
  score: { type: Number, default: 0, min: 0, max: 1 },
  interactionCount: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  positiveInteractions: { type: Number, default: 0 },
  negativeInteractions: { type: Number, default: 0 }
}, { _id: false });

const userDNAProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // Core Personalization Data
  behavioralPatterns: [behavioralPatternSchema],
  preferenceVector: [preferenceVectorSchema],
  contentAffinityScores: [contentAffinitySchema],

  // Communication & Timing
  communicationStyle: {
    type: String,
    enum: ['formal', 'casual', 'friendly', 'professional', 'mixed'],
    default: 'mixed'
  },
  notificationTimingPreference: {
    morningStart: { type: Number, default: 8 },
    morningEnd: { type: Number, default: 12 },
    afternoonStart: { type: Number, default: 12 },
    afternoonEnd: { type: Number, default: 17 },
    eveningStart: { type: Number, default: 17 },
    eveningEnd: { type: Number, default: 21 },
    preferredDays: [{ type: Number, min: 0, max: 6 }],
    timezone: { type: String, default: 'UTC' },
    optimalTimes: [{ type: Date }]
  },

  // Commerce Preferences
  priceSensitivityTier: {
    type: String,
    enum: ['budget', 'moderate', 'premium', 'luxury', 'insensitive'],
    default: 'moderate'
  },
  averageOrderValue: { type: Number, default: 0 },
  brandPreferences: [{
    brandId: String,
    brandName: String,
    affinity: { type: Number, default: 0, min: 0, max: 1 },
    interactionCount: { type: Number, default: 0 }
  }],
  categoryInterests: [{
    categoryId: String,
    categoryName: String,
    interestScore: { type: Number, default: 0, min: 0, max: 1 },
    clickThroughRate: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    lastViewed: { type: Date }
  }],

  // Engagement Metrics
  engagementScore: { type: Number, default: 0.5, min: 0, max: 1 },
  activityFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'occasional'], default: 'weekly' },
  lastActiveAt: { type: Date, default: Date.now },

  // Diversity Preferences
  diversityTolerance: { type: Number, default: 0.5, min: 0, max: 1 },
  noveltySeeking: { type: Number, default: 0.5, min: 0, max: 1 },

  // Personalization State
  personalizationVersion: { type: Number, default: 1 },
  lastUpdated: { type: Date, default: Date.now },
  profileCompleteness: { type: Number, default: 0, min: 0, max: 1 },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['explicit', 'implicit', 'hybrid'], default: 'implicit' }
}, {
  timestamps: true,
  collection: 'user_dna_profiles'
});

// Indexes
userDNAProfileSchema.index({ 'contentAffinityScores.category': 1, 'contentAffinityScores.score': -1 });
userDNAProfileSchema.index({ 'categoryInterests.interestScore': -1 });
userDNAProfileSchema.index({ engagementScore: -1 });
userDNAProfileSchema.index({ lastActiveAt: -1 });

// Methods
userDNAProfileSchema.methods.updatePreference = function(dimension, value) {
  const existing = this.preferenceVector.find(p => p.dimension === dimension);
  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date();
  } else {
    this.preferenceVector.push({ dimension, value, updatedAt: new Date() });
  }
  this.preferenceVector = this.preferenceVector.slice(-50);
  this.lastUpdated = new Date();
  return this;
};

userDNAProfileSchema.methods.updateAffinity = function(contentType, category, score, interaction = 'view') {
  const existing = this.contentAffinityScores.find(
    a => a.contentType === contentType && a.category === category
  );

  const alpha = 0.2;
  const newScore = existing
    ? existing.score + alpha * (score - existing.score)
    : score;

  if (existing) {
    existing.score = newScore;
    existing.interactionCount += 1;
    existing.lastInteraction = new Date();
    if (interaction === 'positive') existing.positiveInteractions += 1;
    if (interaction === 'negative') existing.negativeInteractions += 1;
  } else {
    this.contentAffinityScores.push({
      contentType,
      category,
      score: newScore,
      interactionCount: 1,
      lastInteraction: new Date(),
      positiveInteractions: interaction === 'positive' ? 1 : 0,
      negativeInteractions: interaction === 'negative' ? 1 : 0
    });
  }

  this.contentAffinityScores = this.contentAffinityScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  this.lastUpdated = new Date();
  return this;
};

userDNAProfileSchema.methods.addBehavioralPattern = function(type, pattern) {
  const existing = this.behavioralPatterns.find(p => p.type === type);
  if (existing) {
    existing.frequency += 1;
    existing.lastObserved = new Date();
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    Object.assign(existing.metadata, pattern.metadata || {});
  } else {
    this.behavioralPatterns.push({
      type,
      frequency: 1,
      lastObserved: new Date(),
      confidence: 0.3,
      metadata: pattern.metadata || {}
    });
  }
  this.behavioralPatterns = this.behavioralPatterns.slice(-20);
  this.lastUpdated = new Date();
  return this;
};

userDNAProfileSchema.methods.calculateCompleteness = function() {
  let score = 0;
  const checks = [
    { field: this.behavioralPatterns.length, weight: 0.15, min: 3 },
    { field: this.preferenceVector.length, weight: 0.2, min: 5 },
    { field: this.contentAffinityScores.length, weight: 0.2, min: 10 },
    { field: this.brandPreferences.length, weight: 0.1, min: 3 },
    { field: this.categoryInterests.length, weight: 0.15, min: 5 },
    { field: this.communicationStyle !== 'mixed', weight: 0.1, min: 1 },
    { field: this.priceSensitivityTier !== 'moderate', weight: 0.1, min: 1 }
  ];

  checks.forEach(check => {
    if (check.field >= check.min) {
      score += check.weight;
    } else {
      score += (check.field / check.min) * check.weight;
    }
  });

  this.profileCompleteness = Math.min(1, score);
  return this.profileCompleteness;
};

// Statics
userDNAProfileSchema.statics.findOrCreate = async function(userId) {
  let profile = await this.findOne({ userId });
  if (!profile) {
    profile = new this({ userId });
    await profile.save();
  }
  return profile;
};

userDNAProfileSchema.statics.getSimilarUsers = async function(userId, limit = 10) {
  const user = await this.findOne({ userId });
  if (!user) return [];

  const topCategories = user.contentAffinityScores
    .slice(0, 5)
    .map(a => a.category);

  const topBrands = user.brandPreferences
    .slice(0, 5)
    .map(b => b.brandId);

  const similarUsers = await this.aggregate([
    {
      $match: {
        userId: { $ne: userId },
        $or: [
          { 'contentAffinityScores.category': { $in: topCategories } },
          { 'brandPreferences.brandId': { $in: topBrands } }
        ]
      }
    },
    {
      $addFields: {
        categoryMatch: {
          $size: {
            $setIntersection: [
              topCategories,
              '$contentAffinityScores.category'
            ]
          }
        },
        brandMatch: {
          $size: {
            $setIntersection: [
              topBrands,
              '$brandPreferences.brandId'
            ]
          }
        }
      }
    },
    {
      $addFields: {
        similarityScore: {
          $add: [
            { $multiply: ['$categoryMatch', 0.6] },
            { $multiply: ['$brandMatch', 0.4] }
          ]
        }
      }
    },
    { $sort: { similarityScore: -1 } },
    { $limit: limit },
    { $project: { userId: 1, similarityScore: 1, engagementScore: 1 } }
  ]);

  return similarUsers;
};

const UserDNAProfile = mongoose.model('UserDNAProfile', userDNAProfileSchema);

module.exports = UserDNAProfile;

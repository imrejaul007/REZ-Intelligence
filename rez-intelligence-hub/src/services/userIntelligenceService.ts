/**
 * REZ Mind - User Intelligence Service
 *
 * Provides user profiling from REZ Mind Intent Graph
 * Connects to Intent Graph to get user intents and generate profiles
 */

import mongoose from 'mongoose';

const INTENT_GRAPH_URL = process.env.INTENT_GRAPH_URL || 'https://rez-intent-graph.onrender.com';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_intelligence';

// Intent Graph Schema (same as in Intent Graph service)
const IntentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, index: true },
  appType: { type: String, enum: ['hotel_ota', 'restaurant', 'retail', 'hotel_guest', 'consumer'] },
  category: { type: String, enum: ['TRAVEL', 'DINING', 'RETAIL', 'HOTEL_SERVICE', 'GENERAL'] },
  intentKey: { type: String, required: true },
  intentQuery: { type: String },
  confidence: { type: Number, default: 0.3 },
  status: { type: String, enum: ['ACTIVE', 'DORMANT', 'FULFILLED', 'EXPIRED'], default: 'ACTIVE' },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  signalCount: { type: Number, default: 1 },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'intents' });

// User Profile derived from intents
const UserIntelligenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  affinities: [{
    category: String,
    score: Number,
    topIntents: [String],
    lastSeen: Date,
  }],
  segments: [String],
  behavior: {
    avgSessionLength: Number,
    avgOrdersPerWeek: Number,
    avgOrderValue: Number,
    preferredCategories: [String],
    preferredTimes: [String],
  },
  predictions: {
    churnRisk: Number,
    purchaseProbability: Number,
    lifetimeValue: Number,
  },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'user_intelligence' });

// Initialize models
let Intent: mongoose.Model<any>;
let UserIntelligence: mongoose.Model<any>;

async function initModels() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI);
  }
  Intent = mongoose.models.Intent || mongoose.model('Intent', IntentSchema);
  UserIntelligence = mongoose.models.UserIntelligence || mongoose.model('UserIntelligence', UserIntelligenceSchema);
}

/**
 * Get user intents from Intent Graph
 * Tries MongoDB first, then falls back to HTTP call
 */
export async function getUserIntents(userId: string, limit: number = 20): Promise<any[]> {
  try {
    await initModels();

    const intents = await Intent.find({ userId })
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .lean();

    return intents;
  } catch (error) {
    console.error('[UserIntelligence] Error fetching intents from MongoDB:', error);

    // Fallback: Call Intent Graph HTTP API
    try {
      const response = await fetch(`${INTENT_GRAPH_URL}/api/intent/active/${userId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (httpError) {
      console.error('[UserIntelligence] HTTP fallback also failed:', httpError);
    }

    return [];
  }
}

/**
 * Get user intelligence profile
 * Combines intents into a user profile
 */
export async function getUserProfile(userId: string): Promise<any> {
  try {
    await initModels();

    // Check cache first
    const cached = await UserIntelligence.findOne({ userId });
    if (cached && Date.now() - cached.lastUpdated.getTime() < 3600000) {
      return cached;
    }

    // Get intents
    const intents = await getUserIntents(userId, 100);

    if (intents.length === 0) {
      return {
        userId,
        affinities: [],
        segments: [],
        behavior: {},
        predictions: {},
        lastUpdated: new Date(),
      };
    }

    // Derive affinities from intents
    const categoryScores: Record<string, { score: number; intents: string[]; lastSeen: Date }> = {};

    intents.forEach((intent: any) => {
      const cat = intent.category || 'GENERAL';
      if (!categoryScores[cat]) {
        categoryScores[cat] = { score: 0, intents: [], lastSeen: new Date(0) };
      }
      categoryScores[cat].score += intent.confidence || 0.3;
      if (intent.intentKey) {
        categoryScores[cat].intents.push(intent.intentKey);
      }
      if (new Date(intent.lastSeenAt) > categoryScores[cat].lastSeen) {
        categoryScores[cat].lastSeen = new Date(intent.lastSeenAt);
      }
    });

    const affinities = Object.entries(categoryScores)
      .map(([category, data]) => ({
        category,
        score: Math.min(data.score, 1.0),
        topIntents: [...new Set(data.intents)].slice(0, 10),
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.score - a.score);

    // Derive segments
    const segments: string[] = [];
    if (affinities.some(a => a.category === 'TRAVEL')) segments.push('travel_lover');
    if (affinities.some(a => a.category === 'DINING')) segments.push('foodie');
    if (affinities.some(a => a.category === 'RETAIL')) segments.push('shopper');
    if (affinities.length >= 3) segments.push('multi_category');

    // Calculate behavior metrics
    const fulfilledIntents = intents.filter((i: any) => i.status === 'FULFILLED');
    const behavior = {
      totalIntents: intents.length,
      fulfilledRate: fulfilledIntents.length / intents.length,
      avgConfidence: intents.reduce((sum: number, i: any) => sum + (i.confidence || 0.3), 0) / intents.length,
    };

    // Calculate predictions
    const predictions = {
      churnRisk: calculateChurnRisk(intents),
      purchaseProbability: calculatePurchaseProbability(intents),
      lifetimeValue: calculateLTV(intents),
    };

    const profile = {
      userId,
      affinities,
      segments,
      behavior,
      predictions,
      lastUpdated: new Date(),
    };

    // Cache the profile
    await UserIntelligence.findOneAndUpdate(
      { userId },
      profile,
      { upsert: true, new: true }
    );

    return profile;
  } catch (error) {
    console.error('[UserIntelligence] Error getting user profile:', error);
    return {
      userId,
      affinities: [],
      segments: [],
      behavior: {},
      predictions: {},
      error: 'Failed to generate profile',
    };
  }
}

/**
 * Get active user IDs with specific intents
 */
export async function getUsersWithIntent(category?: string, limit: number = 100): Promise<string[]> {
  try {
    await initModels();

    const query: any = { status: 'ACTIVE' };
    if (category) {
      query.category = category;
    }

    const intents = await Intent.find(query)
      .sort({ lastSeenAt: -1 })
      .select('userId')
      .limit(limit)
      .lean();

    return [...new Set(intents.map((i: any) => i.userId))];
  } catch (error) {
    console.error('[UserIntelligence] Error getting users with intent:', error);
    return [];
  }
}

/**
 * Get dormant users (for re-engagement)
 */
export async function getDormantUsers(daysThreshold: number = 7, limit: number = 100): Promise<any[]> {
  try {
    await initModels();

    const threshold = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    const dormant = await Intent.aggregate([
      { $match: { status: 'ACTIVE', lastSeenAt: { $lt: threshold } } },
      { $group: {
        _id: '$userId',
        category: { $first: '$category' },
        lastSeenAt: { $max: '$lastSeenAt' },
        intentCount: { $sum: 1 },
      }},
      { $sort: { intentCount: -1 } },
      { $limit: limit },
    ]);

    return dormant.map((d: any) => ({
      userId: d._id,
      category: d.category,
      lastSeenAt: d.lastSeenAt,
      intentCount: d.intentCount,
      daysSinceActive: Math.floor((Date.now() - d.lastSeenAt.getTime()) / (24 * 60 * 60 * 1000)),
    }));
  } catch (error) {
    console.error('[UserIntelligence] Error getting dormant users:', error);
    return [];
  }
}

// Helper functions for predictions
function calculateChurnRisk(intents: any[]): number {
  if (intents.length === 0) return 0.5;

  const now = Date.now();
  const lastActive = Math.max(...intents.map(i => new Date(i.lastSeenAt).getTime()));
  const daysSinceActive = (now - lastActive) / (24 * 60 * 60 * 1000);

  // Higher risk if inactive
  const inactiveRisk = Math.min(daysSinceActive / 30, 1) * 0.5;

  // Higher risk if no recent fulfilled intents
  const recentFulfilled = intents.filter(i =>
    i.status === 'FULFILLED' &&
    new Date(i.lastSeenAt).getTime() > now - 7 * 24 * 60 * 60 * 1000
  ).length;
  const fulfillmentRisk = recentFulfilled === 0 ? 0.3 : 0;

  return Math.min(inactiveRisk + fulfillmentRisk, 1);
}

function calculatePurchaseProbability(intents: any[]): number {
  if (intents.length === 0) return 0;

  const fulfilled = intents.filter(i => i.status === 'FULFILLED').length;
  const checkoutStarted = intents.filter(i => i.intentKey?.includes('checkout')).length;

  // Base probability from fulfillment rate
  let prob = fulfilled / Math.max(intents.length, 1);

  // Boost if user has started checkout
  if (checkoutStarted > 0) prob += 0.2;

  return Math.min(prob, 1);
}

function calculateLTV(intents: any[]): number {
  const fulfilled = intents.filter(i => i.status === 'FULFILLED');

  // Estimate from metadata
  let totalValue = 0;
  fulfilled.forEach(i => {
    if (i.metadata?.orderValue) {
      totalValue += i.metadata.orderValue;
    }
  });

  // If no order data, estimate based on intent count
  if (totalValue === 0) {
    totalValue = fulfilled.length * 500; // Assume 500 avg order
  }

  return totalValue;
}

export const userIntelligence = {
  getUserIntents,
  getUserProfile,
  getUsersWithIntent,
  getDormantUsers,
};

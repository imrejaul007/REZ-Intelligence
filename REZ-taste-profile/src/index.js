'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Commerce categories
const COMMERCE_CATEGORIES = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  RETAIL: 'retail',
  BOOKING: 'booking',
  SERVICES: 'services',
  FINTECH: 'fintech',
  TRAVEL: 'travel',
  GROCERY: 'grocery',
  HEALTH: 'health'
};

// MongoDB Schemas
const preferenceSchema = new mongoose.Schema({
  key: { type: String, required: true },
  score: { type: Number, min: 0, max: 1, default: 0.5 },
  count: { type: Number, default: 1 },
  lastInteraction: { type: Date }
}, { _id: false });

const interactionSchema = new mongoose.Schema({
  merchantId: String,
  itemId: String,
  itemName: String,
  category: String,
  subcategory: String,
  value: Number,
  quantity: Number,
  rating: Number,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const tasteProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // Preferences across categories
  preferences: {
    categories: [preferenceSchema], // restaurant, hotel, retail, etc.
    subcategories: [preferenceSchema], // indian, chinese, luxury, etc.
    brands: [preferenceSchema],
    priceTiers: [preferenceSchema], // budget, moderate, premium, luxury
    features: [preferenceSchema], // organic, gluten-free, eco-friendly, etc.
    amenities: [preferenceSchema], // wifi, parking, pool, etc.
    diets: [preferenceSchema], // vegetarian, vegan, keto, etc.
    occasions: [preferenceSchema], // casual, business, celebration, etc.
  },

  // Behavior patterns
  behaviors: {
    adventurousness: { type: Number, default: 0.5 }, // Tries new things
    brandLoyalty: { type: Number, default: 0.5 }, // Sticks to favorites
    valueConsciousness: { type: Number, default: 0.5 }, // Deal sensitive
    qualityOverPrice: { type: Number, default: 0.5 }, // Quality focused
    spontaneity: { type: Number, default: 0.5 }, // Plans vs impulse
    socialInfluence: { type: Number, default: 0.5 }, // Reviews/recs important
  },

  // Time patterns
  timePatterns: [{
    hour: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    score: { type: Number, min: 0, max: 1, default: 0.5 },
    count: { type: Number, default: 0 }
  }],

  // Location patterns
  locations: [{
    type: { type: String, enum: ['home', 'work', 'travel', 'other'] },
    latitude: Number,
    longitude: Number,
    radius: Number, // km
    score: { type: Number, min: 0, max: 1, default: 0.5 }
  }],

  // Recent interactions (last 100)
  recentInteractions: [interactionSchema],

  // Computed summaries
  topPreferences: {
    categories: [String],
    priceTier: String,
    topOccasions: [String],
    signatureItems: [String]
  },

  // Stats
  stats: {
    totalTransactions: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    favoriteMerchantId: String,
    lastActive: Date,
    accountAge: Number
  },

  // Source tracking (for identity graph)
  sources: [{
    source: { type: String }, // 'rez', 'wasil', 'habixo', 'manual'
    userId: String,
    linkedAt: Date
  }]
}, { timestamps: true });

const TasteProfile = mongoose.model('TasteProfile', tasteProfileSchema);

// Update preference helper
function updatePreference(profile, category, key, increment = 1) {
  const prefs = profile.preferences[category] || [];
  const existing = prefs.find(p => p.key === key);

  if (existing) {
    existing.score = Math.min(1, existing.score + 0.05 * increment);
    existing.count += increment;
    existing.lastInteraction = new Date();
  } else {
    prefs.push({
      key,
      score: 0.3 + 0.1 * increment,
      count: increment,
      lastInteraction: new Date()
    });
  }

  // Keep only top 20
  prefs.sort((a, b) => b.score - a.score);
  profile.preferences[category] = prefs.slice(0, 20);

  return prefs;
}

// Calculate behavior scores
function calculateBehaviors(profile) {
  const totalTx = profile.stats.totalTransactions;
  if (totalTx < 3) return;

  const recentInteractions = profile.recentInteractions || [];

  // Adventurousness: high variety in categories
  const uniqueCategories = new Set(recentInteractions.map(i => i.category)).size;
  profile.behaviors.adventurousness = Math.min(1, uniqueCategories / 10);

  // Brand loyalty: repeats same items/merchants
  const repeats = recentInteractions.filter(i =>
    recentInteractions.filter(r => r.itemId === i.itemId).length > 1
  ).length;
  profile.behaviors.brandLoyalty = totalTx > 0 ? repeats / totalTx : 0.5;

  // Value consciousness: budget tier preference
  const budgetPref = profile.preferences.priceTiers?.find(p => p.key === 'budget');
  profile.behaviors.valueConsciousness = budgetPref?.score || 0.5;

  // Quality over price: premium tier + high ratings
  const premiumPref = profile.preferences.priceTiers?.find(p => p.key === 'premium');
  const avgRating = recentInteractions.reduce((s, i) => s + (i.rating || 0), 0) / (recentInteractions.length || 1);
  profile.behaviors.qualityOverPrice = ((premiumPref?.score || 0) * 0.6 + avgRating / 5 * 0.4);

  // Spontaneity: last-minute bookings vs planned
  // Would need booking time vs use time data

  // Social influence: responds to reviews/recommendations
  // Would need nudge conversion data
}

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'taste-profile',
    categories: Object.values(COMMERCE_CATEGORIES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Update taste profile from interaction
app.post('/api/taste/interaction', asyncHandler(async (req, res) => {
  const {
    userId,
    merchantId,
    itemId,
    itemName,
    category,
    subcategory,
    value,
    quantity = 1,
    rating = 0,
    timestamp = new Date()
  } = req.body;

  if (!userId || !category) {
    return res.status(400).json({ error: 'userId and category required' });
  }

  let profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    profile = new TasteProfile({
      userId,
      preferences: {
        categories: [],
        subcategories: [],
        brands: [],
        priceTiers: [],
        features: [],
        amenities: [],
        diets: [],
        occasions: []
      },
      recentInteractions: [],
      stats: { totalTransactions: 0, totalSpend: 0, avgOrderValue: 0 }
    });
  }

  // Update preferences
  updatePreference(profile, 'categories', category);
  if (subcategory) updatePreference(profile, 'subcategories', subcategory);
  if (value > 0) {
    const priceTier = value > 1000 ? 'luxury' : value > 500 ? 'premium' : value > 200 ? 'moderate' : 'budget';
    updatePreference(profile, 'priceTiers', priceTier);
  }

  // Add interaction
  profile.recentInteractions.unshift({
    merchantId,
    itemId,
    itemName,
    category,
    subcategory,
    value,
    quantity,
    rating,
    timestamp: new Date(timestamp)
  });

  // Keep only last 100
  profile.recentInteractions = profile.recentInteractions.slice(0, 100);

  // Update stats
  profile.stats.totalTransactions += 1;
  profile.stats.totalSpend += value || 0;
  profile.stats.avgOrderValue = profile.stats.totalSpend / profile.stats.totalTransactions;
  profile.stats.lastActive = new Date();
  profile.stats.favoriteMerchantId = merchantId;

  // Recalculate behaviors
  calculateBehaviors(profile);

  // Update top preferences
  profile.topPreferences = {
    categories: profile.preferences.categories?.slice(0, 5).map(p => p.key) || [],
    priceTier: profile.preferences.priceTiers?.sort((a, b) => b.score - a.score)[0]?.key || 'moderate',
    topOccasions: profile.preferences.occasions?.slice(0, 3).map(p => p.key) || [],
    signatureItems: profile.recentInteractions
      .filter(i => profile.recentInteractions.filter(r => r.itemId === i.itemId).length > 1)
      .slice(0, 5)
      .map(i => i.itemName)
  };

  await profile.save();

  logger.info('Taste profile updated', {
    requestId: req.requestId,
    userId,
    category,
    subcategory
  });

  res.json({
    success: true,
    profile: {
      userId: profile.userId,
      topCategories: profile.topPreferences.categories,
      priceTier: profile.topPreferences.priceTier,
      behaviors: profile.behaviors
    }
  });
}));

// Batch update from order
app.post('/api/taste/order', asyncHandler(async (req, res) => {
  const {
    userId,
    merchantId,
    category = 'restaurant',
    items = [],
    orderValue,
    rating = 0,
    timestamp = new Date()
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  let profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    profile = new TasteProfile({
      userId,
      preferences: { categories: [], subcategories: [], priceTiers: [] },
      recentInteractions: [],
      stats: { totalTransactions: 0, totalSpend: 0, avgOrderValue: 0 }
    });
  }

  // Process each item
  for (const item of items) {
    updatePreference(profile, 'categories', category);
    if (item.category) updatePreference(profile, 'categories', item.category);
    if (item.subcategory) updatePreference(profile, 'subcategories', item.subcategory);
    if (item.brand) updatePreference(profile, 'brands', item.brand);
    if (item.features) {
      for (const feature of item.features) {
        updatePreference(profile, 'features', feature);
      }
    }
    if (item.diet) updatePreference(profile, 'diets', item.diet);

    // Price tier
    const price = item.price || orderValue / items.length;
    const priceTier = price > 1000 ? 'luxury' : price > 500 ? 'premium' : price > 200 ? 'moderate' : 'budget';
    updatePreference(profile, 'priceTiers', priceTier);

    profile.recentInteractions.unshift({
      merchantId,
      itemId: item.itemId,
      itemName: item.name,
      category: item.category || category,
      subcategory: item.subcategory,
      value: item.price,
      quantity: item.quantity,
      rating,
      timestamp: new Date(timestamp)
    });
  }

  profile.recentInteractions = profile.recentInteractions.slice(0, 100);

  profile.stats.totalTransactions += 1;
  profile.stats.totalSpend += orderValue || 0;
  profile.stats.avgOrderValue = profile.stats.totalSpend / profile.stats.totalTransactions;
  profile.stats.lastActive = new Date();

  calculateBehaviors(profile);

  profile.topPreferences = {
    categories: profile.preferences.categories?.slice(0, 5).map(p => p.key) || [],
    priceTier: profile.preferences.priceTiers?.sort((a, b) => b.score - a.score)[0]?.key || 'moderate'
  };

  await profile.save();

  res.json({ success: true, profile: { userId, topCategories: profile.topPreferences.categories } });
}));

// Get user taste profile
app.get('/api/taste/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    return res.json({ success: true, profile: null, isNewUser: true });
  }

  res.json({
    success: true,
    isNewUser: false,
    profile: {
      userId: profile.userId,
      topCategories: profile.topPreferences?.categories || [],
      priceTier: profile.topPreferences?.priceTier || 'moderate',
      behaviors: profile.behaviors,
      signatureItems: profile.topPreferences?.signatureItems || [],
      stats: {
        totalTransactions: profile.stats.totalTransactions,
        avgOrderValue: Math.round(profile.stats.avgOrderValue),
        totalSpend: Math.round(profile.stats.totalSpend)
      },
      sources: profile.sources
    }
  });
}));

// Get personalization context
app.get('/api/taste/:userId/context', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    return res.json({
      success: true,
      context: {
        isNewUser: true,
        preferences: {},
        behaviors: {}
      }
    });
  }

  const context = {
    isNewUser: false,
    preferences: {
      categories: profile.topPreferences?.categories || [],
      priceTier: profile.topPreferences?.priceTier,
      diets: profile.preferences.diets?.filter(d => d.score > 0.6).map(d => d.key) || [],
      features: profile.preferences.features?.filter(f => f.score > 0.6).map(f => f.key) || []
    },
    behaviors: profile.behaviors,
    stats: {
      avgOrderValue: profile.stats.avgOrderValue,
      totalTransactions: profile.stats.totalTransactions
    }
  };

  res.json({ success: true, context });
}));

// Link taste profiles (for identity graph)
app.post('/api/taste/:userId/link', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { source, sourceUserId } = req.body;

  const profile = await TasteProfile.findOneAndUpdate(
    { userId },
    {
      $push: {
        sources: { source, userId: sourceUserId, linkedAt: new Date() }
      }
    },
    { new: true }
  );

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json({ success: true, sources: profile.sources });
}));

// Get aggregate preferences (for anonymous/broad targeting)
app.get('/api/taste/aggregate', asyncHandler(async (req, res) => {
  const { category, minTransactions = 5 } = req.query;

  const match = { 'stats.totalTransactions': { $gte: parseInt(minTransactions) } };
  if (category) match['preferences.categories.key'] = category;

  const profiles = await TasteProfile.find(match).limit(1000).lean();

  if (profiles.length === 0) {
    return res.json({ success: true, aggregate: null });
  }

  // Aggregate preferences
  const categoryScores = {};
  const priceTierScores = {};
  const behaviorAvgs = { adventurousness: 0, brandLoyalty: 0, valueConsciousness: 0 };

  for (const p of profiles) {
    for (const c of p.preferences.categories || []) {
      categoryScores[c.key] = (categoryScores[c.key] || 0) + c.score;
    }
    for (const pt of p.preferences.priceTiers || []) {
      priceTierScores[pt.key] = (priceTierScores[pt.key] || 0) + pt.score;
    }
    behaviorAvgs.adventurousness += p.behaviors.adventurousness;
    behaviorAvgs.brandLoyalty += p.behaviors.brandLoyalty;
    behaviorAvgs.valueConsciousness += p.behaviors.valueConsciousness;
  }

  const n = profiles.length;

  res.json({
    success: true,
    aggregate: {
      sampleSize: n,
      topCategories: Object.entries(categoryScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, score]) => ({ category: key, avgScore: score / n })),
      priceTierDistribution: Object.fromEntries(
        Object.entries(priceTierScores).map(([k, v]) => [k, v / n])
      ),
      avgBehaviors: {
        adventurousness: behaviorAvgs.adventurousness / n,
        brandLoyalty: behaviorAvgs.brandLoyalty / n,
        valueConsciousness: behaviorAvgs.valueConsciousness / n
      }
    }
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4041;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Taste Profile Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

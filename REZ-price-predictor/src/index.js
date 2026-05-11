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

// MongoDB Schemas
const priceHistorySchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  price: { type: Number, required: true },
  demand: { type: Number, default: 0 },
  elasticity: { type: Number, default: -1 }, // Price sensitivity
  factors: {
    dayOfWeek: Number,
    hour: Number,
    weather: Number,
    events: Number,
    competition: Number
  }
}, { timestamps: true });

priceHistorySchema.index({ merchantId: 1, itemId: 1, date: -1 });

const PricePrediction = mongoose.model('PricePrediction', priceHistorySchema);

const merchantPricingSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,

  // Pricing strategy
  strategy: {
    type: String,
    enum: ['fixed', 'dynamic', 'competitive', 'value'],
    default: 'dynamic'
  },

  // Base pricing
  baseMargin: { type: Number, default: 0.3 }, // 30% markup
  minMargin: { type: Number, default: 0.15 }, // Never go below 15%
  maxMargin: { type: Number, default: 0.5 }, // Never above 50%

  // Dynamic pricing rules
  peakMultiplier: { type: Number, default: 1.15 }, // 15% higher at peak
  offPeakMultiplier: { type: Number, default: 0.9 }, // 10% lower off-peak
  weekendMultiplier: { type: Number, default: 1.1 }, // 10% higher weekends

  // Competitive positioning
  pricePosition: {
    type: String,
    enum: ['budget', 'mid', 'premium'],
    default: 'mid'
  },
  maxDiscountPercent: { type: Number, default: 20 },

  // Competitor tracking
  competitorIds: [String],
  avgCompetitorPrice: { type: Number },

  // Performance
  avgOrderValue: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0.05 },

  lastUpdated: Date
}, { timestamps: true });

const MerchantPricing = mongoose.model('MerchantPricing', merchantPricingSchema);

// Price elasticity calculation
function calculateElasticity(historicalData) {
  if (historicalData.length < 5) return -1; // Default

  // Simple elasticity: how much does demand change with price
  // e = (% change in demand) / (% change in price)
  let totalElasticity = 0;
  let count = 0;

  for (let i = 1; i < historicalData.length; i++) {
    const prev = historicalData[i - 1];
    const curr = historicalData[i];

    if (prev.price > 0 && curr.demand > 0) {
      const priceChange = (curr.price - prev.price) / prev.price;
      const demandChange = (curr.demand - prev.demand) / curr.demand;

      if (Math.abs(priceChange) > 0.01) { // At least 1% change
        const elasticity = demandChange / priceChange;
        totalElasticity += elasticity;
        count++;
      }
    }
  }

  return count > 0 ? totalElasticity / count : -1;
}

// Price optimization logic
function optimizePrice(basePrice, options = {}) {
  const {
    demandLevel = 1, // 0.5 = low, 1 = normal, 1.5 = high
    timeMultiplier = 1,
    competitionMultiplier = 1,
    elasticity = -1, // Negative = elastic, 0 = neutral, positive = inverse
    minMargin = 0.15,
    maxMargin = 0.5
  } = options;

  // Start with base price
  let optimizedPrice = basePrice;

  // Apply time-based pricing
  optimizedPrice *= timeMultiplier;

  // Apply demand-based pricing
  if (elasticity < 0) {
    // Elastic item: lower price for high demand (to maintain volume)
    const demandAdjustment = 1 - (demandLevel - 1) * Math.abs(elasticity) * 0.2;
    optimizedPrice *= demandAdjustment;
  } else {
    // Inelastic item: can charge more for high demand
    optimizedPrice *= (0.9 + demandLevel * 0.2);
  }

  // Apply competitive pressure
  if (competitionMultiplier < 1) {
    // Competitors are cheaper, consider matching
    optimizedPrice *= (0.95 + competitionMultiplier * 0.05);
  }

  // Apply margin constraints
  const baseCost = basePrice / (1 + 0.3); // Assume 30% base margin
  const minPrice = baseCost * (1 + minMargin);
  const maxPrice = baseCost * (1 + maxMargin);

  optimizedPrice = Math.max(minPrice, Math.min(maxPrice, optimizedPrice));

  return {
    price: Math.round(optimizedPrice * 100) / 100,
    discount: Math.max(0, Math.round((1 - optimizedPrice / basePrice) * 100)),
    recommended: optimizedPrice < basePrice * 0.95,
    confidence: Math.abs(elasticity) > 0.5 ? 'high' : Math.abs(elasticity) > 0.2 ? 'medium' : 'low'
  };
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
  res.json({ status: 'ok', service: 'price-predictor', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Get price prediction for item
app.get('/api/price/:merchantId/:itemId', asyncHandler(async (req, res) => {
  const { merchantId, itemId } = req.params;
  const {
    basePrice,
    demandLevel = 1,
    hour,
    dayOfWeek,
    includeAlternatives = false
  } = req.query;

  const now = new Date();
  const queryHour = hour !== undefined ? parseInt(hour) : now.getHours();
  const queryDay = dayOfWeek !== undefined ? parseInt(dayOfWeek) : now.getDay();

  // Get merchant pricing config
  let merchantPricing = await MerchantPricing.findOne({ merchantId });
  if (!merchantPricing) {
    merchantPricing = await MerchantPricing.create({ merchantId });
  }

  // Calculate time multiplier
  let timeMultiplier = 1;

  // Peak hour adjustment
  if ((queryHour >= 12 && queryHour <= 14) || (queryHour >= 19 && queryHour <= 21)) {
    timeMultiplier *= merchantPricing.peakMultiplier;
  } else if (queryHour >= 15 && queryHour <= 17) {
    timeMultiplier *= merchantPricing.offPeakMultiplier;
  }

  // Weekend adjustment
  if (queryDay === 0 || queryDay === 5 || queryDay === 6) {
    timeMultiplier *= merchantPricing.weekendMultiplier;
  }

  // Get historical elasticity
  const history = await PricePrediction.find({
    merchantId,
    itemId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).sort({ date: -1 }).limit(30).lean();

  const elasticity = calculateElasticity(history);

  // Calculate competitive multiplier
  let competitionMultiplier = 1;
  if (merchantPricing.avgCompetitorPrice && basePrice) {
    competitionMultiplier = parseFloat(basePrice) / merchantPricing.avgCompetitorPrice;
  }

  // Get optimization
  const base = parseFloat(basePrice) || 200;
  const optimization = optimizePrice(base, {
    demandLevel: parseFloat(demandLevel),
    timeMultiplier,
    competitionMultiplier,
    elasticity,
    minMargin: merchantPricing.minMargin,
    maxMargin: merchantPricing.maxMargin
  });

  // Generate alternatives if requested
  let alternatives = null;
  if (includeAlternatives === 'true') {
    alternatives = {
      rushHour: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.peakMultiplier
      }),
      offPeak: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.offPeakMultiplier
      }),
      weekend: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.weekendMultiplier
      })
    };
  }

  res.json({
    success: true,
    merchantId,
    itemId,
    currentPrice: base,
    recommendedPrice: optimization.price,
    discount: optimization.discount,
    confidence: optimization.confidence,
    factors: {
      timeMultiplier: Math.round(timeMultiplier * 100) / 100,
      elasticity: Math.round(elasticity * 100) / 100 || 'unknown',
      demandLevel: parseFloat(demandLevel)
    },
    alternatives
  });
}));

// Get optimal price for time slot
app.get('/api/price/:merchantId/slot', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { items, hour, dayOfWeek } = req.query;

  const queryHour = hour !== undefined ? parseInt(hour) : new Date().getHours();
  const queryDay = dayOfWeek !== undefined ? parseInt(dayOfWeek) : new Date().getDay();

  let merchantPricing = await MerchantPricing.findOne({ merchantId });
  if (!merchantPricing) {
    merchantPricing = await MerchantPricing.create({ merchantId });
  }

  const itemList = items ? JSON.parse(items) : [];

  let timeMultiplier = 1;
  if ((queryHour >= 12 && queryHour <= 14) || (queryHour >= 19 && queryHour <= 21)) {
    timeMultiplier *= merchantPricing.peakMultiplier;
  } else if (queryHour >= 15 && queryHour <= 17) {
    timeMultiplier *= merchantPricing.offPeakMultiplier;
  }
  if (queryDay === 0 || queryDay === 5 || queryDay === 6) {
    timeMultiplier *= merchantPricing.weekendMultiplier;
  }

  let totalOriginal = 0;
  let totalOptimized = 0;

  const itemPrices = itemList.map(item => {
    const optimization = optimizePrice(item.price || 200, {
      timeMultiplier,
      minMargin: merchantPricing.minMargin,
      maxMargin: merchantPricing.maxMargin
    });

    totalOriginal += item.price || 200;
    totalOptimized += optimization.price;

    return {
      itemId: item.itemId,
      name: item.name,
      originalPrice: item.price || 200,
      optimizedPrice: optimization.price,
      discount: optimization.discount
    };
  });

  res.json({
    success: true,
    merchantId,
    slot: { hour: queryHour, dayOfWeek: queryDay },
    multiplier: Math.round(timeMultiplier * 100) / 100,
    items: itemPrices,
    totals: {
      original: Math.round(totalOriginal * 100) / 100,
      optimized: Math.round(totalOptimized * 100) / 100,
      savings: Math.round((totalOriginal - totalOptimized) * 100) / 100
    }
  });
}));

// Record price and demand
app.post('/api/price/:merchantId/:itemId/record', asyncHandler(async (req, res) => {
  const { merchantId, itemId } = req.params;
  const { price, demand, factors = {} } = req.body;

  const record = await PricePrediction.create({
    merchantId,
    itemId,
    date: new Date(),
    price,
    demand: demand || 0,
    factors: {
      ...factors,
      dayOfWeek: factors.dayOfWeek ?? new Date().getDay(),
      hour: factors.hour ?? new Date().getHours()
    }
  });

  // Update merchant avg order value
  const recentRecords = await PricePrediction.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).lean();

  const avgOrderValue = recentRecords.reduce((sum, r) => sum + r.price, 0) / (recentRecords.length || 1);
  await MerchantPricing.findOneAndUpdate(
    { merchantId },
    { avgOrderValue, lastUpdated: new Date() }
  );

  res.json({ success: true, record });
}));

// Get pricing analytics
app.get('/api/analytics/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const merchantPricing = await MerchantPricing.findOne({ merchantId });

  if (!merchantPricing) {
    return res.json({ success: true, analytics: null });
  }

  const recentPrices = await PricePrediction.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).lean();

  // Calculate price distribution
  const prices = recentPrices.map(p => p.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  res.json({
    success: true,
    merchantId,
    analytics: {
      strategy: merchantPricing.strategy,
      baseMargin: (merchantPricing.baseMargin * 100).toFixed(1) + '%',
      priceRange: { min: minPrice, max: maxPrice, avg: Math.round(avgPrice) },
      conversionRate: (merchantPricing.conversionRate * 100).toFixed(2) + '%',
      avgOrderValue: Math.round(merchantPricing.avgOrderValue),
      recommendations: generateRecommendations(merchantPricing, avgPrice)
    }
  });
}));

function generateRecommendations(merchantPricing, avgPrice) {
  const recs = [];

  if (merchantPricing.conversionRate < 0.03) {
    recs.push({
      type: 'low_conversion',
      priority: 'high',
      message: 'Conversion rate is low. Consider testing 5-10% price reduction.',
      potential: 'Increase conversions by 10-20%'
    });
  }

  if (avgPrice < 100) {
    recs.push({
      type: 'low_aov',
      priority: 'medium',
      message: 'Average order value is low. Consider bundle pricing.',
      potential: 'Increase AOV by 15-25%'
    });
  }

  if (merchantPricing.strategy === 'fixed') {
    recs.push({
      type: 'dynamic_pricing',
      priority: 'low',
      message: 'Consider implementing dynamic pricing for peak hours.',
      potential: 'Increase revenue by 5-10%'
    });
  }

  return recs;
}

// Get competitive pricing
app.get('/api/competition/:merchantId', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;

  const merchantPricing = await MerchantPricing.findOne({ merchantId });

  if (!merchantPricing || !merchantPricing.competitorIds?.length) {
    return res.json({
      success: true,
      competitors: [],
      message: 'No competitors tracked'
    });
  }

  const competitorPrices = await PricePrediction.aggregate([
    { $match: { merchantId: { $in: merchantPricing.competitorIds } } },
    { $sort: { date: -1 } },
    { $group: {
      _id: '$merchantId',
      avgPrice: { $avg: '$price' },
      latestPrice: { $first: '$price' },
      recordCount: { $sum: 1 }
    }}
  ]);

  res.json({
    success: true,
    merchantId,
    competitors: competitorPrices,
    avgCompetitorPrice: competitorPrices.reduce((sum, c) => sum + c.avgPrice, 0) / (competitorPrices.length || 1)
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4043;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Price Predictor Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

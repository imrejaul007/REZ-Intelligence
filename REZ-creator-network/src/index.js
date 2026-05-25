import logger from './utils/logger';

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
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Creator tier
const CREATOR_TIERS = {
  MICRO: 'micro', // 1K-10K followers
  MACRO: 'macro', // 10K-100K followers
  MEGA: 'mega', // 100K-1M followers
  CELEBRITY: 'celebrity' // 1M+ followers
};

// Content types
const CONTENT_TYPES = {
  REEL: 'reel',
  STORY: 'story',
  POST: 'post',
  VIDEO: 'video',
  LIVE: 'live'
};

// Campaign status
const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// MongoDB Schemas
const creatorSchema = new mongoose.Schema({
  creatorId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  handle: { type: String, required: true },
  platform: { type: String, enum: ['instagram', 'youtube', 'twitter', 'tiktok'], required: true },
  platformCreatorId: String,

  // Audience metrics
  metrics: {
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    avgLikes: { type: Number, default: 0 },
    avgComments: { type: Number, default: 0 },
    avgShares: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    reachRate: { type: Number, default: 0 }
  },

  // Demographics
  demographics: {
    primaryAgeGroup: { type: String, enum: ['13-17', '18-24', '25-34', '35-44', '45+'] },
    primaryGender: { type: String, enum: ['male', 'female', 'other'] },
    topCountries: [String],
    topCities: [String]
  },

  // Performance
  performance: {
    totalCampaings: { type: Number, default: 0 },
    completedCampaings: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    avgCPM: { type: Number, default: 0 },
    avgCPE: { type: Number, default: 0 }, // Cost per engagement
    conversionRate: { type: Number, default: 0 }
  },

  // AI scores
  scores: {
    authenticity: { type: Number, default: 0.5 },
    influence: { type: Number, default: 0.5 },
    relevance: { type: Number, default: 0.5 },
    quality: { type: Number, default: 0.5 },
    roi: { type: Number, default: 0.5 }
  },

  // Content focus
  niches: [String],
  brands: [String],
  pastCollaborations: [{
    campaignId: String,
    brand: String,
    date: Date,
    performance: mongoose.Schema.Types.Mixed
  }],

  // Verification
  verified: { type: Boolean, default: false },
  tier: { type: String, enum: Object.values(CREATOR_TIERS), default: CREATOR_TIERS.MICRO },

  // Contact
  contact: {
    email: String,
    phone: String,
    manager: String
  },

  // Payment
  paymentInfo: {
    bankName: String,
    accountNumber: String,
    upiId: String,
    preferredMethod: { type: String, enum: ['bank', 'upi', 'paypal'] }
  },

  lastUpdated: Date
}, { timestamps: true });

creatorSchema.index({ platform: 1, handle: 1 });
creatorSchema.index({ 'metrics.followers': -1 });
creatorSchema.index({ 'scores.roi': -1 });
creatorSchema.index({ niches: 1 });

const Creator = mongoose.model('Creator', creatorSchema);

// Campaign schema
const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  brandId: { type: String, required: true, index: true },
  brandName: String,

  name: { type: String, required: true },
  description: String,

  // Targeting
  targeting: {
    minFollowers: { type: Number, default: 1000 },
    maxFollowers: Number,
    niches: [String],
    platforms: [String],
    locations: [String],
    ageGroups: [String],
    engagementMin: { type: Number, default: 2 }
  },

  // Content requirements
  contentType: { type: String, enum: Object.values(CONTENT_TYPES), default: CONTENT_TYPES.REEL },
  deliverables: {
    posts: { type: Number, default: 1 },
    minDuration: Number, // seconds for video
    hashtags: [String],
    mentions: [String]
  },

  // Compensation
  compensation: {
    type: { type: String, enum: ['fixed', 'cpm', 'cpe', 'hybrid'], default: 'fixed' },
    amount: Number,
    currency: { type: String, default: 'INR' },
    bonusForPerformance: Number
  },

  // Timeline
  timeline: {
    startDate: Date,
    endDate: Date,
    submissionDeadline: Date
  },

  // Status
  status: { type: String, enum: Object.values(CAMPAIGN_STATUS), default: CAMPAIGN_STATUS.DRAFT },

  // Applications
  applications: [{
    creatorId: String,
    appliedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'submitted', 'paid'] },
    contentUrl: String,
    performance: mongoose.Schema.Types.Mixed
  }],

  // Performance
  performance: {
    totalReach: { type: Number, default: 0 },
    totalEngagements: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    actualCPM: Number,
    actualCPE: Number,
    conversions: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

campaignSchema.index({ brandId: 1, status: 1 });
campaignSchema.index({ 'targeting.niches': 1 });
campaignSchema.index({ 'applications.creatorId': 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

// Match schema
const matchSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true, index: true },
  campaignId: String,
  creatorId: String,
  score: { type: Number, default: 0 },
  reasons: [String],
  status: { type: String, enum: ['recommended', 'invited', 'applied', 'accepted', 'rejected'], default: 'recommended' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

matchSchema.index({ campaignId: 1, score: -1 });
matchSchema.index({ creatorId: 1, score: -1 });

const Match = mongoose.model('Match', matchSchema);

// Creator Network Engine
class CreatorNetworkEngine {
  // Calculate creator scores
  async calculateCreatorScore(creator) {
    const scores = {};

    // Authenticity: based on engagement rate vs follower ratio
    const expectedEngagement = Math.min(10, 10000 / Math.sqrt(creator.metrics.followers));
    scores.authenticity = Math.min(1, creator.metrics.engagementRate / expectedEngagement);

    // Influence: combination of reach and engagement
    scores.influence = Math.min(1, (
      (creator.metrics.followers / 100000) * 0.4 +
      (creator.metrics.engagementRate / 10) * 0.4 +
      (creator.metrics.reachRate / 100) * 0.2
    ));

    // Quality: based on past campaign performance
    scores.quality = Math.min(1, (
      (creator.performance.completedCampaings / 10) * 0.3 +
      (creator.performance.avgCPM / 1000) * 0.3 +
      (1 - creator.performance.conversionRate) * 0.4 // Lower is better
    ));

    // ROI score
    scores.roi = Math.min(1, (
      (creator.performance.avgCPM / 100) * 0.5 +
      (creator.scores.quality || 0.5) * 0.5
    ));

    // Overall relevance
    scores.relevance = (scores.authenticity + scores.influence + scores.quality) / 3;

    return scores;
  }

  // Find matching creators for campaign
  async findMatches(campaignId) {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) return [];

    const { targeting } = campaign;

    // Build query
    const query = {
      verified: true,
      'metrics.followers': { $gte: targeting.minFollowers || 1000 }
    };

    if (targeting.maxFollowers) {
      query['metrics.followers'].$lte = targeting.maxFollowers;
    }

    if (targeting.niches?.length > 0) {
      query.niches = { $in: targeting.niches };
    }

    if (targeting.engagementMin) {
      query['metrics.engagementRate'] = { $gte: targeting.engagementMin / 100 };
    }

    // Get potential creators
    const creators = await Creator.find(query)
      .sort({ 'scores.roi': -1, 'metrics.followers': -1 })
      .limit(100)
      .lean();

    // Score each creator for this campaign
    const matches = [];
    for (const creator of creators) {
      const score = this.calculateMatchScore(creator, campaign);
      const reasons = this.generateMatchReasons(creator, campaign);

      matches.push({
        matchId: `match_${uuidv4()}`,
        campaignId,
        creatorId: creator.creatorId,
        score,
        reasons,
        status: 'recommended'
      });
    }

    // Sort by score and save
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 20);

    // Save matches
    await Match.insertMany(topMatches);

    return topMatches;
  }

  calculateMatchScore(creator, campaign) {
    let score = 0;

    // Audience fit (40%)
    const audienceScore = (
      (creator.metrics.followers / Math.max(1, campaign.targeting.maxFollowers || 1000000)) * 0.2 +
      (creator.metrics.engagementRate / 10) * 0.2
    );
    score += audienceScore;

    // Niche match (30%)
    const nicheMatch = creator.niches?.filter(n =>
      campaign.targeting.niches?.includes(n)
    ).length || 0;
    const nicheScore = nicheMatch > 0 ? Math.min(1, nicheMatch / 3) : 0;
    score += nicheScore * 0.3;

    // Performance (20%)
    const perfScore = Math.min(1, creator.scores?.roi || 0.5);
    score += perfScore * 0.2;

    // Authenticity (10%)
    const authScore = Math.min(1, creator.scores?.authenticity || 0.5);
    score += authScore * 0.1;

    return Math.round(score * 100) / 100;
  }

  generateMatchReasons(creator, campaign) {
    const reasons = [];

    // Niche overlap
    const nicheOverlap = creator.niches?.filter(n =>
      campaign.targeting.niches?.includes(n)
    ) || [];
    if (nicheOverlap.length > 0) {
      reasons.push(`Strong niche match: ${nicheOverlap.slice(0, 2).join(', ')}`);
    }

    // Audience size
    if (creator.metrics.followers >= campaign.targeting.minFollowers) {
      reasons.push(`${(creator.metrics.followers / 1000).toFixed(1)}K followers in range`);
    }

    // Engagement
    if (creator.metrics.engagementRate > 5) {
      reasons.push(`High engagement: ${creator.metrics.engagementRate.toFixed(1)}%`);
    }

    // Past performance
    if (creator.performance.completedCampaings > 5) {
      reasons.push(`${creator.performance.completedCampaings} successful campaigns`);
    }

    return reasons;
  }

  // Calculate campaign ROI
  async calculateCampaignROI(campaignId) {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) return null;

    const performance = campaign.performance;

    if (performance.totalReach > 0) {
      performance.actualCPM = (performance.totalSpend / performance.totalReach) * 1000;
    }

    if (performance.totalEngagements > 0) {
      performance.actualCPE = performance.totalSpend / performance.totalEngagements;
    }

    await campaign.save();

    return performance;
  }
}

const engine = new CreatorNetworkEngine();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
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
    service: 'creator-network',
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

// Creator endpoints
app.get('/api/creators', asyncHandler(async (req, res) => {
  const { niche, platform, tier, minFollowers, sort = 'followers' } = req.query;

  const query = {};
  if (niche) query.niches = niche;
  if (platform) query.platform = platform;
  if (tier) query.tier = tier;
  if (minFollowers) query['metrics.followers'] = { $gte: parseInt(minFollowers) };

  let sortQuery = { 'metrics.followers': -1 };
  if (sort === 'engagement') sortQuery = { 'metrics.engagementRate': -1 };
  if (sort === 'roi') sortQuery = { 'scores.roi': -1 };

  const creators = await Creator.find(query)
    .sort(sortQuery)
    .limit(50)
    .lean();

  res.json({
    success: true,
    creators: creators.map(c => ({
      creatorId: c.creatorId,
      name: c.name,
      handle: c.handle,
      platform: c.platform,
      tier: c.tier,
      followers: c.metrics.followers,
      engagementRate: c.metrics.engagementRate,
      niches: c.niches,
      scores: c.scores
    })),
    count: creators.length
  });
}));

app.get('/api/creators/:creatorId', asyncHandler(async (req, res) => {
  const { creatorId } = req.params;

  const creator = await Creator.findOne({ creatorId });

  if (!creator) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  res.json({ success: true, creator });
}));

app.post('/api/creators', asyncHandler(async (req, res) => {
  const creatorData = req.body;

  // Calculate scores
  const scores = await engine.calculateCreatorScore(creatorData);
  creatorData.scores = scores;

  // Determine tier
  const followers = creatorData.metrics?.followers || 0;
  if (followers >= 1000000) creatorData.tier = CREATOR_TIERS.CELEBRITY;
  else if (followers >= 100000) creatorData.tier = CREATOR_TIERS.MEGA;
  else if (followers >= 10000) creatorData.tier = CREATOR_TIERS.MACRO;
  else creatorData.tier = CREATOR_TIERS.MICRO;

  const creator = await Creator.create(creatorData);

  res.status(201).json({ success: true, creator });
}));

app.patch('/api/creators/:creatorId', asyncHandler(async (req, res) => {
  const { creatorId } = req.params;

  const creator = await Creator.findOneAndUpdate(
    { creatorId },
    { $set: { ...req.body, lastUpdated: new Date() } },
    { new: true }
  );

  if (!creator) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // Recalculate scores if metrics changed
  if (req.body.metrics) {
    creator.scores = await engine.calculateCreatorScore(creator);
    await creator.save();
  }

  res.json({ success: true, creator });
}));

// Campaign endpoints
app.get('/api/campaigns', asyncHandler(async (req, res) => {
  const { brandId, status } = req.query;

  const query = {};
  if (brandId) query.brandId = brandId;
  if (status) query.status = status;

  const campaigns = await Campaign.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ success: true, campaigns });
}));

app.get('/api/campaigns/:campaignId', asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findOne({ campaignId });

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  res.json({ success: true, campaign });
}));

app.post('/api/campaigns', asyncHandler(async (req, res) => {
  const campaignId = `camp_${uuidv4()}`;
  const campaign = await Campaign.create({ campaignId, ...req.body });

  res.status(201).json({ success: true, campaign });
}));

// Find matches for campaign
app.post('/api/campaigns/:campaignId/match', asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const matches = await engine.findMatches(campaignId);

  // Get creator details
  const creatorIds = matches.map(m => m.creatorId);
  const creators = await Creator.find({ creatorId: { $in: creatorIds } }).lean();

  const creatorMap = new Map(creators.map(c => [c.creatorId, c]));

  const enrichedMatches = matches.map(m => ({
    ...m,
    creator: creatorMap.get(m.creatorId)
  }));

  res.json({ success: true, matches: enrichedMatches });
}));

// Get matches for campaign
app.get('/api/campaigns/:campaignId/matches', asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  const { limit = 20 } = req.query;

  const matches = await Match.find({ campaignId })
    .sort({ score: -1 })
    .limit(parseInt(limit))
    .lean();

  // Get creator details
  const creatorIds = matches.map(m => m.creatorId);
  const creators = await Creator.find({ creatorId: { $in: creatorIds } }).lean();
  const creatorMap = new Map(creators.map(c => [c.creatorId, c]));

  const enrichedMatches = matches.map(m => ({
    ...m,
    creator: creatorMap.get(m.creatorId)
  }));

  res.json({ success: true, matches: enrichedMatches });
}));

// Analytics
app.get('/api/analytics/creators', asyncHandler(async (req, res) => {
  const [byTier, byPlatform, topNiches] = await Promise.all([
    Creator.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 }, avgFollowers: { $avg: '$metrics.followers' } } }
    ]),
    Creator.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 }, avgEngagement: { $avg: '$metrics.engagementRate' } } }
    ]),
    Creator.aggregate([
      { $unwind: '$niches' },
      { $group: { _id: '$niches', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  res.json({
    success: true,
    analytics: {
      byTier,
      byPlatform,
      topNiches
    }
  });
}));

app.get('/api/analytics/campaigns/:campaignId', asyncHandler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await Campaign.findOne({ campaignId });

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const performance = await engine.calculateCampaignROI(campaignId);

  res.json({
    success: true,
    campaignId,
    performance,
    stats: {
      totalApplicants: campaign.applications.length,
      approved: campaign.applications.filter(a => a.status === 'approved').length,
      submitted: campaign.applications.filter(a => a.status === 'submitted').length,
      paid: campaign.applications.filter(a => a.status === 'paid').length
    }
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4072;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Creator Network Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

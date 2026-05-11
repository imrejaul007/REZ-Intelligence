/**
 * REZ User Agents - 15 Autonomous AI Agents for User Intelligence
 *
 * Each agent runs on a defined schedule and produces actionable insights.
 * Agents are independently runnable and log structured outputs.
 */

const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const { z } = require('zod');
const cors = require('cors');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 4030;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_user_agents';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/agents.log' })
  ]
});

// ============================================================================
// MONGODB MODELS
// ============================================================================

// User Profile Model
const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  preferences: {
    cuisines: [String],
    priceRange: String,
    timePattern: String,
    dietary: [String],
    travelFrequency: String,
    spendingHabit: String
  },
  segments: [String],
  engagementScore: Number,
  lifetimeValue: Number,
  lastActive: Date,
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });

// User Session Model
const UserSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  startTime: Date,
  endTime: Date,
  duration: Number,
  pages: [String],
  actions: [{
    type: String,
    timestamp: Date,
    data: mongoose.Schema.Types.Mixed
  }],
  device: String,
  location: String
}, { timestamps: true });

// Browse Event Model
const BrowseEventSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  productId: String,
  category: String,
  timestamp: Date,
  duration: Number,
  scrollDepth: Number,
  action: String
}, { timestamps: true });

// Search Event Model
const SearchEventSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  query: String,
  timestamp: Date,
  resultsCount: Number,
  clickedResult: String,
  intent: String
}, { timestamps: true });

// Cart Event Model
const CartEventSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  cartId: String,
  items: [{
    productId: String,
    quantity: Number,
    price: Number
  }],
  total: Number,
  status: String,
  timestamp: Date,
  abandonedAt: Date
}, { timestamps: true });

// Purchase Model
const PurchaseSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  orderId: String,
  items: [{
    productId: String,
    quantity: Number,
    price: Number
  }],
  total: Number,
  status: String,
  timestamp: Date
}, { timestamps: true });

// Feedback Model
const FeedbackSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  type: { type: String, enum: ['nps', 'survey', 'review', 'support'] },
  score: Number,
  comment: String,
  timestamp: Date,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Agent Insights Model (stores all agent outputs)
const AgentInsightSchema = new mongoose.Schema({
  agentId: String,
  agentName: String,
  userId: String,
  insightType: String,
  data: mongoose.Schema.Types.Mixed,
  confidence: Number,
  action: String,
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// Recommendation Quality Model
const RecommendationQualitySchema = new mongoose.Schema({
  userId: { type: String, index: true },
  recommendationId: String,
  productId: String,
  score: Number,
  clicked: Boolean,
  purchased: Boolean,
  timestamp: Date
}, { timestamps: true });

// User Engagement Model
const UserEngagementSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  score: Number,
  components: {
    frequency: Number,
    recency: Number,
    monetary: Number,
    relevance: Number
  },
  trend: String,
  lastUpdated: Date
}, { timestamps: true });

// Referral Potential Model
const ReferralPotentialSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  score: Number,
  factors: {
    satisfaction: Number,
    socialConnectedness: Number,
    lifetimeValue: Number,
    engagementLevel: Number
  },
  recommendedActions: [String],
  lastUpdated: Date
}, { timestamps: true });

// Win-Back Candidate Model
const WinBackCandidateSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  lastPurchaseDate: Date,
  inactivityDays: Number,
  predictedResponseRate: Number,
  recommendedOffer: String,
  priority: String,
  status: { type: String, default: 'pending' },
  lastContactedAt: Date,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create models
const UserProfile = mongoose.model('UserProfile', UserProfileSchema);
const UserSession = mongoose.model('UserSession', UserSessionSchema);
const BrowseEvent = mongoose.model('BrowseEvent', BrowseEventSchema);
const SearchEvent = mongoose.model('SearchEvent', SearchEventSchema);
const CartEvent = mongoose.model('CartEvent', CartEventSchema);
const Purchase = mongoose.model('Purchase', PurchaseSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);
const AgentInsight = mongoose.model('AgentInsight', AgentInsightSchema);
const RecommendationQuality = mongoose.model('RecommendationQuality', RecommendationQualitySchema);
const UserEngagement = mongoose.model('UserEngagement', UserEngagementSchema);
const ReferralPotential = mongoose.model('ReferralPotential', ReferralPotentialSchema);
const WinBackCandidate = mongoose.model('WinBackCandidate', WinBackCandidateSchema);

// ============================================================================
// MOCK DATA GENERATION
// ============================================================================

const CUISINES = ['Italian', 'Chinese', 'Japanese', 'Mexican', 'Indian', 'Thai', 'American', 'Mediterranean'];
const CATEGORIES = ['Hotels', 'Restaurants', 'Flights', 'Activities', 'Spa', 'Transport'];
const DEVICES = ['mobile', 'desktop', 'tablet'];
const LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'];

function generateMockUserId() {
  return `user_${uuidv4().slice(0, 8)}`;
}

function generateMockUsers(count = 100) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const userId = generateMockUserId();
    const daysSinceLastActive = Math.floor(Math.random() * 90);
    users.push({
      userId,
      preferences: {
        cuisines: CUISINES.slice(0, Math.floor(Math.random() * 4) + 1),
        priceRange: ['budget', 'mid-range', 'luxury'][Math.floor(Math.random() * 3)],
        timePattern: ['morning', 'afternoon', 'evening', 'late-night'][Math.floor(Math.random() * 4)],
        dietary: ['none', 'vegetarian', 'vegan', 'halal'][Math.floor(Math.random() * 4)].split(),
        travelFrequency: ['rarely', 'monthly', 'weekly', 'daily'][Math.floor(Math.random() * 4)],
        spendingHabit: ['conservative', 'moderate', 'lavish'][Math.floor(Math.random() * 3)]
      },
      segments: [],
      engagementScore: Math.random() * 100,
      lifetimeValue: Math.floor(Math.random() * 100000),
      lastActive: new Date(Date.now() - daysSinceLastActive * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000)
    });
  }
  return users;
}

function generateMockSessions(users, count = 500) {
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const duration = Math.floor(Math.random() * 3600) + 60;
    sessions.push({
      sessionId: uuidv4(),
      userId: user.userId,
      startTime: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
      duration,
      endTime: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000 + duration * 1000),
      pages: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () =>
        ['/home', '/search', '/product', '/cart', '/checkout', '/profile'][Math.floor(Math.random() * 6)]
      ),
      actions: Array.from({ length: Math.floor(Math.random() * 20) + 1 }, () => ({
        type: ['click', 'view', 'search', 'add_to_cart', 'remove_from_cart'][Math.floor(Math.random() * 5)],
        timestamp: new Date(),
        data: {}
      })),
      device: DEVICES[Math.floor(Math.random() * DEVICES.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]
    });
  }
  return sessions;
}

function generateMockSearches(users, count = 1000) {
  const searches = [];
  const queries = [
    'luxury hotel Mumbai', 'cheap flights to Delhi', 'best restaurant near me',
    'spa package', 'weekend getaway', 'business hotel', 'beach resort',
    'family friendly', 'pet friendly hotel', 'romantic dinner'
  ];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    searches.push({
      userId: user.userId,
      query: queries[Math.floor(Math.random() * queries.length)],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      resultsCount: Math.floor(Math.random() * 50) + 10,
      clickedResult: Math.random() > 0.3 ? `product_${uuidv4().slice(0, 8)}` : null,
      intent: ['informational', 'transactional', 'navigational'][Math.floor(Math.random() * 3)]
    });
  }
  return searches;
}

function generateMockBrowseEvents(users, count = 2000) {
  const events = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    events.push({
      userId: user.userId,
      productId: `product_${uuidv4().slice(0, 8)}`,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000),
      duration: Math.floor(Math.random() * 300) + 10,
      scrollDepth: Math.random() * 100,
      action: ['view', 'click', 'hover', 'add_to_wishlist'][Math.floor(Math.random() * 4)]
    });
  }
  return events;
}

function generateMockCartEvents(users, count = 200) {
  const events = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const isAbandoned = Math.random() > 0.5;
    const itemCount = Math.floor(Math.random() * 5) + 1;
    events.push({
      userId: user.userId,
      cartId: uuidv4(),
      items: Array.from({ length: itemCount }, () => ({
        productId: `product_${uuidv4().slice(0, 8)}`,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: Math.floor(Math.random() * 5000) + 500
      })),
      total: Math.floor(Math.random() * 15000) + 500,
      status: isAbandoned ? 'abandoned' : 'completed',
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      abandonedAt: isAbandoned ? new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000) : null
    });
  }
  return events;
}

function generateMockPurchases(users, count = 150) {
  const purchases = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const itemCount = Math.floor(Math.random() * 4) + 1;
    purchases.push({
      userId: user.userId,
      orderId: `order_${uuidv4().slice(0, 8)}`,
      items: Array.from({ length: itemCount }, () => ({
        productId: `product_${uuidv4().slice(0, 8)}`,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: Math.floor(Math.random() * 3000) + 200
      })),
      total: Math.floor(Math.random() * 10000) + 200,
      status: 'completed',
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000)
    });
  }
  return purchases;
}

function generateMockFeedback(users, count = 100) {
  const feedback = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    feedback.push({
      userId: user.userId,
      type: ['nps', 'survey', 'review'][Math.floor(Math.random() * 3)],
      score: Math.floor(Math.random() * 11),
      comment: ['Great service!', 'Could be better', 'Amazing experience', 'Not satisfied', ''][Math.floor(Math.random() * 5)],
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000),
      metadata: { source: 'app', version: '2.0' }
    });
  }
  return feedback;
}

async function seedMockData() {
  logger.info('Seeding mock data...');

  const users = generateMockUsers(100);
  await UserProfile.insertMany(users);

  const sessions = generateMockSessions(users, 500);
  await UserSession.insertMany(sessions);

  const searches = generateMockSearches(users, 1000);
  await SearchEvent.insertMany(searches);

  const browseEvents = generateMockBrowseEvents(users, 2000);
  await BrowseEvent.insertMany(browseEvents);

  const cartEvents = generateMockCartEvents(users, 200);
  await CartEvent.insertMany(cartEvents);

  const purchases = generateMockPurchases(users, 150);
  await Purchase.insertMany(purchases);

  const feedback = generateMockFeedback(users, 100);
  await Feedback.insertMany(feedback);

  logger.info(`Seeded ${users.length} users, ${sessions.length} sessions, ${searches.length} searches`);
}

// ============================================================================
// AGENT 1: PERSONALIZATION AGENT
// ============================================================================

const PersonalizationAgent = {
  name: 'PersonalizationAgent',
  schedule: '0 * * * *', // Every hour

  async run() {
    logger.info(`${this.name}: Starting hourly profile update`);
    const startTime = Date.now();
    let processedCount = 0;

    try {
      // Get recently active users (last 24 hours)
      const recentUsers = await UserProfile.find({
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(50);

      for (const user of recentUsers) {
        // Get recent activity
        const recentSessions = await UserSession.find({
          userId: user.userId,
          startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        const recentSearches = await SearchEvent.find({
          userId: user.userId,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        const recentPurchases = await Purchase.find({
          userId: user.userId,
          timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        // Update preferences based on activity
        const newPreferences = { ...user.preferences };

        // Analyze search patterns for preferences
        if (recentSearches.length > 0) {
          const searchTerms = recentSearches.map(s => s.query.toLowerCase());

          if (searchTerms.some(t => t.includes('luxury') || t.includes('5 star'))) {
            newPreferences.priceRange = 'luxury';
          } else if (searchTerms.some(t => t.includes('cheap') || t.includes('budget'))) {
            newPreferences.priceRange = 'budget';
          }

          if (searchTerms.some(t => t.includes('spa') || t.includes('wellness'))) {
            newPreferences.dietary = [...(newPreferences.dietary || []), 'wellness'];
          }
        }

        // Update lifetime value based on recent purchases
        if (recentPurchases.length > 0) {
          const recentTotal = recentPurchases.reduce((sum, p) => sum + p.total, 0);
          user.lifetimeValue = (user.lifetimeValue || 0) + recentTotal;
        }

        user.preferences = newPreferences;
        user.lastActive = new Date();
        await user.save();

        // Store insight
        await AgentInsight.create({
          agentId: 'personalization-agent',
          agentName: this.name,
          userId: user.userId,
          insightType: 'preference_update',
          data: {
            previousPreferences: user.preferences,
            activityCount: {
              sessions: recentSessions.length,
              searches: recentSearches.length,
              purchases: recentPurchases.length
            }
          },
          confidence: 0.85,
          action: 'profile_updated'
        });

        processedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Processed ${processedCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  }
};

// ============================================================================
// AGENT 2: SEGMENT CLASSIFIER AGENT
// ============================================================================

const SegmentClassifierAgent = {
  name: 'SegmentClassifierAgent',
  schedule: '0 0 * * *', // Daily at midnight

  SEGMENTS: {
    VIP: { minLTV: 50000, minEngagement: 80 },
    HIGH_VALUE: { minLTV: 20000, minEngagement: 60 },
    GROWTH: { minLTV: 5000, minEngagement: 40 },
    AT_RISK: { minLTV: 0, minEngagement: 20, inactiveDays: 30 },
    DORMANT: { minLTV: 0, minEngagement: 0, inactiveDays: 90 },
    NEW: { accountAgeDays: 30 }
  },

  async run() {
    logger.info(`${this.name}: Starting daily segment classification`);
    const startTime = Date.now();
    let classifiedCount = 0;

    try {
      const allUsers = await UserProfile.find({});

      for (const user of allUsers) {
        const previousSegments = [...(user.segments || [])];
        const newSegments = [];

        const accountAgeDays = (Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000);
        const inactiveDays = (Date.now() - new Date(user.lastActive).getTime()) / (24 * 60 * 60 * 1000);

        // Classify into segments
        if (accountAgeDays <= this.SEGMENTS.NEW.accountAgeDays) {
          newSegments.push('NEW');
        }

        if (user.lifetimeValue >= this.SEGMENTS.VIP.minLTV && user.engagementScore >= this.SEGMENTS.VIP.minEngagement) {
          newSegments.push('VIP');
        } else if (user.lifetimeValue >= this.SEGMENTS.HIGH_VALUE.minLTV && user.engagementScore >= this.SEGMENTS.HIGH_VALUE.minEngagement) {
          newSegments.push('HIGH_VALUE');
        } else if (user.lifetimeValue >= this.SEGMENTS.GROWTH.minLTV && user.engagementScore >= this.SEGMENTS.GROWTH.minEngagement) {
          newSegments.push('GROWTH');
        }

        if (inactiveDays >= this.SEGMENTS.DORMANT.inactiveDays) {
          newSegments.push('DORMANT');
        } else if (inactiveDays >= this.SEGMENTS.AT_RISK.inactiveDays) {
          newSegments.push('AT_RISK');
        }

        // Check for segment changes
        const segmentsChanged = JSON.stringify(previousSegments.sort()) !== JSON.stringify(newSegments.sort());

        if (segmentsChanged) {
          user.segments = newSegments;
          await user.save();

          await AgentInsight.create({
            agentId: 'segment-classifier-agent',
            agentName: this.name,
            userId: user.userId,
            insightType: 'segment_change',
            data: {
              previousSegments,
              newSegments,
              metrics: {
                lifetimeValue: user.lifetimeValue,
                engagementScore: user.engagementScore,
                inactiveDays: Math.floor(inactiveDays),
                accountAgeDays: Math.floor(accountAgeDays)
              }
            },
            confidence: 0.92,
            action: segmentsChanged ? 'segment_reclassified' : 'no_change'
          });

          classifiedCount++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Reclassified ${classifiedCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  }
};

// ============================================================================
// AGENT 3: RECOMMENDATION QUALITY AGENT
// ============================================================================

const RecommendationQualityAgent = {
  name: 'RecommendationQualityAgent',
  schedule: '30 * * * *', // Every hour at minute 30

  async run() {
    logger.info(`${this.name}: Starting recommendation quality scoring`);
    const startTime = Date.now();
    let scoredCount = 0;

    try {
      // Get recent recommendations (mock data - in production, these come from recommendation engine)
      const recentRecommendations = await BrowseEvent.aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: '$userId',
          products: { $push: '$productId' },
          clickCount: { $sum: { $cond: [{ $eq: ['$action', 'click'] }, 1, 0] } },
          viewCount: { $sum: 1 }
        }}
      ]);

      for (const rec of recentRecommendations) {
        const clickRate = rec.clickCount / rec.viewCount;

        // Calculate quality score
        const qualityScore = clickRate * 0.4 + Math.random() * 0.3 + 0.3;

        // Check for purchases within 7 days
        const hasPurchase = await Purchase.findOne({
          userId: rec._id,
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        const purchaseSignal = hasPurchase ? 1 : 0;
        const finalScore = (qualityScore * 0.7) + (purchaseSignal * 0.3);

        // Store quality metrics
        await AgentInsight.create({
          agentId: 'recommendation-quality-agent',
          agentName: this.name,
          userId: rec._id,
          insightType: 'recommendation_quality',
          data: {
            clickRate: Math.round(clickRate * 100) / 100,
            qualityScore: Math.round(finalScore * 100) / 100,
            productsRecommended: rec.products.length,
            productsClicked: rec.clickCount,
            purchaseConversion: purchaseSignal
          },
          confidence: finalScore,
          action: finalScore > 0.7 ? 'recommendations_effective' : finalScore < 0.4 ? 'recommendations_poor' : 'recommendations_average'
        });

        scoredCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Scored ${scoredCount} user recommendation sets in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  }
};

// ============================================================================
// AGENT 4: ENGAGEMENT SCORE AGENT
// ============================================================================

const EngagementScoreAgent = {
  name: 'EngagementScoreAgent',
  schedule: '0 1 * * *', // Daily at 1 AM

  async run() {
    logger.info(`${this.name}: Starting engagement score calculation`);
    const startTime = Date.now();
    let scoredCount = 0;

    try {
      const allUsers = await UserProfile.find({});

      for (const user of allUsers) {
        // Calculate engagement components
        const frequency = await this.calculateFrequencyScore(user.userId);
        const recency = this.calculateRecencyScore(user.lastActive);
        const monetary = this.calculateMonetaryScore(user.lifetimeValue);
        const relevance = await this.calculateRelevanceScore(user.userId);

        // Weighted engagement score
        const engagementScore = Math.round(
          (frequency * 0.25) +
          (recency * 0.30) +
          (monetary * 0.25) +
          (relevance * 0.20)
        );

        // Determine trend
        const previousEngagement = await UserEngagement.findOne({ userId: user.userId });
        let trend = 'stable';
        if (previousEngagement) {
          const diff = engagementScore - previousEngagement.score;
          trend = diff > 10 ? 'increasing' : diff < -10 ? 'decreasing' : 'stable';
        }

        // Update engagement record
        await UserEngagement.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            score: engagementScore,
            components: { frequency, recency, monetary, relevance },
            trend,
            lastUpdated: new Date()
          },
          { upsert: true }
        );

        // Update user profile
        user.engagementScore = engagementScore;
        await user.save();

        await AgentInsight.create({
          agentId: 'engagement-score-agent',
          agentName: this.name,
          userId: user.userId,
          insightType: 'engagement_score',
          data: {
            score: engagementScore,
            components: { frequency, recency, monetary, relevance },
            trend
          },
          confidence: 0.88,
          action: trend === 'decreasing' ? 'flag_for_reengagement' : 'healthy_engagement'
        });

        scoredCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Scored ${scoredCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async calculateFrequencyScore(userId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionCount = await UserSession.countDocuments({
      userId,
      startTime: { $gte: thirtyDaysAgo }
    });
    // Normalize to 0-100
    return Math.min(100, (sessionCount / 30) * 100);
  },

  calculateRecencyScore(lastActive) {
    const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceActive <= 1) return 100;
    if (daysSinceActive <= 7) return 80;
    if (daysSinceActive <= 30) return 50;
    if (daysSinceActive <= 90) return 20;
    return 0;
  },

  calculateMonetaryScore(lifetimeValue) {
    if (lifetimeValue >= 100000) return 100;
    if (lifetimeValue >= 50000) return 80;
    if (lifetimeValue >= 20000) return 60;
    if (lifetimeValue >= 5000) return 40;
    if (lifetimeValue >= 1000) return 20;
    return 10;
  },

  async calculateRelevanceScore(userId) {
    const recentSearches = await SearchEvent.countDocuments({
      userId,
      timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
    });
    const clicks = await BrowseEvent.countDocuments({
      userId,
      action: 'click',
      timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
    });
    // Relevance based on active searching and clicking
    return Math.min(100, (recentSearches * 2 + clicks * 3));
  }
};

// ============================================================================
// AGENT 5: SESSION ANALYZER AGENT
// ============================================================================

const SessionAnalyzerAgent = {
  name: 'SessionAnalyzerAgent',
  schedule: '15 * * * *', // Every hour at minute 15

  async run() {
    logger.info(`${this.name}: Starting session pattern analysis`);
    const startTime = Date.now();
    let analyzedCount = 0;

    try {
      const recentSessions = await UserSession.find({
        startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(100);

      // Analyze session patterns
      const patterns = await this.identifyPatterns(recentSessions);

      for (const session of recentSessions) {
        // Calculate session quality score
        const qualityScore = this.calculateSessionQuality(session);

        // Identify session type
        const sessionType = this.classifySession(session);

        await AgentInsight.create({
          agentId: 'session-analyzer-agent',
          agentName: this.name,
          userId: session.userId,
          insightType: 'session_analysis',
          data: {
            sessionId: session.sessionId,
            duration: session.duration,
            pageCount: session.pages.length,
            actionCount: session.actions.length,
            device: session.device,
            qualityScore,
            sessionType,
            patterns: {
              matchesShoppingIntent: patterns.shoppingIntent.includes(session.sessionId),
              matchesResearchIntent: patterns.researchIntent.includes(session.sessionId),
              matchesQuickBrowse: patterns.quickBrowse.includes(session.sessionId)
            }
          },
          confidence: qualityScore,
          action: sessionType === 'high_intent' ? 'flag_for_retargeting' : 'normal_session'
        });

        analyzedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Analyzed ${analyzedCount} sessions in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  calculateSessionQuality(session) {
    let score = 0;

    // Duration score (longer isn't always better, but too short is bad)
    if (session.duration >= 120 && session.duration <= 1800) {
      score += 30;
    } else if (session.duration >= 60) {
      score += 20;
    }

    // Engagement score
    score += Math.min(30, session.actions.length * 2);

    // Progression score (did they go beyond home?)
    if (session.pages.some(p => p.includes('checkout') || p.includes('cart'))) {
      score += 25;
    } else if (session.pages.some(p => p.includes('product'))) {
      score += 15;
    }

    // Device bonus
    if (session.device === 'mobile') score += 10;

    return Math.min(100, score);
  },

  classifySession(session) {
    if (session.duration > 600 && session.pages.includes('/checkout')) return 'high_intent';
    if (session.duration < 60 && session.pages.length <= 2) return 'quick_browse';
    if (session.actions.some(a => a.type === 'add_to_cart')) return 'shopping_intent';
    if (session.pages.includes('/search') && session.actions.filter(a => a.type === 'view').length > 5) return 'research_mode';
    return 'general_browsing';
  },

  async identifyPatterns(sessions) {
    return {
      shoppingIntent: sessions
        .filter(s => s.pages.includes('/cart') || s.actions.some(a => a.type === 'add_to_cart'))
        .map(s => s.sessionId),
      researchIntent: sessions
        .filter(s => s.actions.filter(a => a.type === 'view').length > 5)
        .map(s => s.sessionId),
      quickBrowse: sessions
        .filter(s => s.duration < 60 && s.pages.length <= 2)
        .map(s => s.sessionId)
    };
  }
};

// ============================================================================
// AGENT 6: SEARCH INTENT AGENT
// ============================================================================

const SearchIntentAgent = {
  name: 'SearchIntentAgent',
  schedule: '*/5 * * * *', // Every 5 minutes (near real-time)

  INTENT_PATTERNS: {
    transactional: ['book', 'buy', 'order', 'purchase', 'get', 'reserve', 'book now', 'buy now'],
    informational: ['what', 'how', 'why', 'where', 'when', 'best', 'top', 'review'],
    navigational: ['login', 'sign in', 'account', 'profile', 'my']
  },

  async run() {
    logger.info(`${this.name}: Starting real-time search intent parsing`);
    const startTime = Date.now();
    let processedCount = 0;

    try {
      // Get recent searches (last 5 minutes)
      const recentSearches = await SearchEvent.find({
        timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      for (const search of recentSearches) {
        const query = (search.query || '').toLowerCase();
        const intent = this.parseIntent(query);
        const entities = this.extractEntities(query);

        // Update search record with parsed intent
        search.intent = intent;
        await search.save();

        await AgentInsight.create({
          agentId: 'search-intent-agent',
          agentName: this.name,
          userId: search.userId,
          insightType: 'search_intent',
          data: {
            query: search.query,
            originalIntent: search.intent,
            parsedIntent: intent,
            entities,
            resultsCount: search.resultsCount,
            hadClick: !!search.clickedResult
          },
          confidence: intent.confidence,
          action: intent.type === 'transactional' ? 'ready_for_conversion' : 'needs_nurturing'
        });

        processedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Processed ${processedCount} searches in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  parseIntent(query) {
    for (const [intentType, keywords] of Object.entries(this.INTENT_PATTERNS)) {
      for (const keyword of keywords) {
        if (query.includes(keyword)) {
          return {
            type: intentType,
            confidence: 0.85,
            matchedKeyword: keyword
          };
        }
      }
    }

    // Default to informational
    return { type: 'informational', confidence: 0.6, matchedKeyword: null };
  },

  extractEntities(query) {
    const entities = {
      brands: [],
      categories: [],
      priceModifiers: [],
      locationModifiers: []
    };

    // Extract price modifiers
    if (query.includes('cheap') || query.includes('budget') || query.includes('affordable')) {
      entities.priceModifiers.push('low');
    }
    if (query.includes('luxury') || query.includes('premium') || query.includes('expensive')) {
      entities.priceModifiers.push('high');
    }

    // Extract categories
    const categories = ['hotel', 'restaurant', 'flight', 'spa', 'resort', 'villa'];
    for (const cat of categories) {
      if (query.includes(cat)) entities.categories.push(cat);
    }

    // Extract locations
    const locations = ['mumbai', 'delhi', 'bangalore', 'goa', 'chennai', 'pune'];
    for (const loc of locations) {
      if (query.includes(loc)) entities.locationModifiers.push(loc);
    }

    return entities;
  }
};

// ============================================================================
// AGENT 7: BROWSE PATTERN AGENT
// ============================================================================

const BrowsePatternAgent = {
  name: 'BrowsePatternAgent',
  schedule: '*/15 * * * *', // Every 15 minutes

  async run() {
    logger.info(`${this.name}: Starting browse behavior tracking`);
    const startTime = Date.now();
    let analyzedCount = 0;

    try {
      // Get browse events from last 15 minutes
      const recentEvents = await BrowseEvent.find({
        timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
      });

      // Group by user
      const userEvents = {};
      for (const event of recentEvents) {
        if (!userEvents[event.userId]) {
          userEvents[event.userId] = [];
        }
        userEvents[event.userId].push(event);
      }

      for (const [userId, events] of Object.entries(userEvents)) {
        const pattern = this.analyzeBrowsePattern(events);

        await AgentInsight.create({
          agentId: 'browse-pattern-agent',
          agentName: this.name,
          userId,
          insightType: 'browse_pattern',
          data: {
            eventCount: events.length,
            categories: [...new Set(events.map(e => e.category))],
            avgDuration: events.reduce((sum, e) => sum + e.duration, 0) / events.length,
            scrollEngagement: events.reduce((sum, e) => sum + e.scrollDepth, 0) / events.length,
            pattern,
            signals: {
              highEngagement: pattern.avgScrollDepth > 70 && pattern.avgDuration > 60,
              categoryFocused: pattern.uniqueCategories <= 2,
              windowShopping: pattern.avgDuration < 20
            }
          },
          confidence: 0.82,
          action: pattern.signals?.highEngagement ? 'show_similar_products' : 'wait_for_signals'
        });

        analyzedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Analyzed ${analyzedCount} user browse patterns in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  analyzeBrowsePattern(events) {
    const categories = events.map(e => e.category);
    const durations = events.map(e => e.duration);
    const scrollDepths = events.map(e => e.scrollDepth);

    return {
      uniqueCategories: new Set(categories).size,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      avgScrollDepth: scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length,
      totalEvents: events.length,
      actionBreakdown: events.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
      }, {})
    };
  }
};

// ============================================================================
// AGENT 8: PURCHASE PREDICTOR AGENT
// ============================================================================

const PurchasePredictorAgent = {
  name: 'PurchasePredictorAgent',
  schedule: '45 * * * *', // Every hour at minute 45

  async run() {
    logger.info(`${this.name}: Starting purchase intent prediction`);
    const startTime = Date.now();
    let predictedCount = 0;

    try {
      // Get high-intent users (recent cart activity)
      const cartUsers = await CartEvent.aggregate([
        { $match: { status: 'active', timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        { $group: { _id: '$userId', cartData: { $first: '$$ROOT' } } }
      ]);

      for (const cartUser of cartUsers) {
        const userId = cartUser._id;
        const cart = cartUser.cartData;

        // Calculate purchase probability
        const probability = await this.calculatePurchaseProbability(userId, cart);

        await AgentInsight.create({
          agentId: 'purchase-predictor-agent',
          agentName: this.name,
          userId,
          insightType: 'purchase_prediction',
          data: {
            probability: Math.round(probability * 100) / 100,
            cartTotal: cart.total,
            itemCount: cart.items.length,
            urgencySignals: this.identifyUrgencySignals(cart),
            riskFactors: this.identifyRiskFactors(userId, cart),
            recommendedAction: probability > 0.7 ? 'send_checkout_reminder' :
                              probability > 0.4 ? 'offer_discount' : 'wait_and_watch'
          },
          confidence: probability,
          action: probability > 0.6 ? 'trigger_checkout_flow' : 'monitor'
        });

        predictedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Predicted ${predictedCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async calculatePurchaseProbability(userId, cart) {
    let probability = 0.5;

    // Positive signals
    if (cart.total > 5000) probability += 0.15; // High-value cart
    if (cart.items.length >= 2) probability += 0.1; // Multiple items
    if (cart.items.some(i => i.quantity > 1)) probability += 0.1; // Reorder signal

    // Check user history
    const user = await UserProfile.findOne({ userId });
    if (user) {
      if (user.engagementScore > 70) probability += 0.15;
      if (user.lifetimeValue > 50000) probability += 0.1;
    }

    // Recent purchase history
    const recentPurchase = await Purchase.findOne({
      userId,
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    if (recentPurchase) probability += 0.1;

    return Math.min(1, probability);
  },

  identifyUrgencySignals(cart) {
    const signals = [];
    if (cart.items.length > 3) signals.push('high_cart_value');
    if (cart.total > 10000) signals.push('premium_selection');
    return signals;
  },

  async identifyRiskFactors(userId, cart) {
    const factors = [];

    const recentAbandonment = await CartEvent.findOne({
      userId,
      status: 'abandoned',
      timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
    });
    if (recentAbandonment) factors.push('recent_abandonment_history');

    const timeSinceLastActive = await UserProfile.findOne({ userId });
    if (timeSinceLastActive && timeSinceLastActive.lastActive < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      factors.push('inactive_user');
    }

    return factors;
  }
};

// ============================================================================
// AGENT 9: ABANDONMENT DETECTOR AGENT
// ============================================================================

const AbandonmentDetectorAgent = {
  name: 'AbandonmentDetectorAgent',
  schedule: '*/10 * * * *', // Every 10 minutes (near real-time)

  ABANDONMENT_THRESHOLDS: {
    cartInactivityMinutes: 30,
    checkoutInactivityMinutes: 15
  },

  async run() {
    logger.info(`${this.name}: Starting cart abandonment detection`);
    const startTime = Date.now();
    let detectedCount = 0;

    try {
      // Find abandoned carts
      const thirtyMinutesAgo = new Date(Date.now() - this.ABANDONMENT_THRESHOLDS.cartInactivityMinutes * 60 * 1000);
      const abandonedCarts = await CartEvent.find({
        status: 'active',
        timestamp: { $lt: thirtyMinutesAgo }
      });

      for (const cart of abandonedCarts) {
        // Mark as abandoned
        cart.status = 'abandoned';
        cart.abandonedAt = new Date();
        await cart.save();

        // Calculate abandonment score
        const abandonmentScore = this.calculateAbandonmentScore(cart);

        await AgentInsight.create({
          agentId: 'abandonment-detector-agent',
          agentName: this.name,
          userId: cart.userId,
          insightType: 'abandonment_detected',
          data: {
            cartId: cart.cartId,
            cartTotal: cart.total,
            itemCount: cart.items.length,
            abandonmentScore,
            abandonedAt: cart.abandonedAt,
            recommendedActions: this.getRecoveryActions(abandonmentScore, cart)
          },
          confidence: abandonmentScore,
          action: abandonmentScore > 0.7 ? 'immediate_recovery_campaign' : 'delayed_recovery'
        });

        detectedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Detected ${detectedCount} abandoned carts in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  calculateAbandonmentScore(cart) {
    let score = 0;

    // Higher cart value = higher recovery priority
    if (cart.total > 10000) score += 0.3;
    else if (cart.total > 5000) score += 0.2;
    else if (cart.total > 2000) score += 0.1;

    // More items = more committed
    if (cart.items.length >= 3) score += 0.25;
    else if (cart.items.length >= 2) score += 0.15;

    // Time since cart creation
    const ageMinutes = (Date.now() - new Date(cart.timestamp).getTime()) / (60 * 1000);
    if (ageMinutes > 60) score += 0.2;
    else if (ageMinutes > 30) score += 0.1;

    // Premium category items
    if (cart.items.some(i => i.price > 5000)) score += 0.15;

    return Math.min(1, score);
  },

  getRecoveryActions(score, cart) {
    const actions = [];

    if (score > 0.7) {
      actions.push('send_immediate_email', 'offer_10_percent_discount', 'sms_reminder');
    } else if (score > 0.4) {
      actions.push('send_cart_recovery_email', 'show_banner_on_return');
    } else {
      actions.push('add_to_email_sequence');
    }

    return actions;
  }
};

// ============================================================================
// AGENT 10: RETENTION TRIGGER AGENT
// ============================================================================

const RetentionTriggerAgent = {
  name: 'RetentionTriggerAgent',
  schedule: '0 2 * * *', // Daily at 2 AM

  RETENTION_STRATEGIES: {
    lapsed: { days: 30, strategy: 'reactivation', discount: 15 },
    at_risk: { days: 14, strategy: 'win_back', discount: 10 },
    loyal: { days: 60, strategy: 'appreciation', discount: 5 }
  },

  async run() {
    logger.info(`${this.name}: Starting retention offer creation`);
    const startTime = Date.now();
    let createdCount = 0;

    try {
      const allUsers = await UserProfile.find({});

      for (const user of allUsers) {
        const daysSinceActive = (Date.now() - new Date(user.lastActive).getTime()) / (24 * 60 * 60 * 1000);
        const strategy = this.determineStrategy(daysSinceActive, user);

        if (strategy) {
          const offer = this.createRetentionOffer(strategy, user);

          await AgentInsight.create({
            agentId: 'retention-trigger-agent',
            agentName: this.name,
            userId: user.userId,
            insightType: 'retention_offer',
            data: {
              daysSinceActive: Math.floor(daysSinceActive),
              strategy: strategy.strategy,
              offer,
              userSegments: user.segments,
              lifetimeValue: user.lifetimeValue
            },
            confidence: strategy.confidence,
            action: 'create_retention_campaign'
          });

          createdCount++;
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Created ${createdCount} retention offers in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  determineStrategy(daysSinceActive, user) {
    if (daysSinceActive >= this.RETENTION_STRATEGIES.lapsed.days) {
      return { ...this.RETENTION_STRATEGIES.lapsed, confidence: 0.85 };
    }
    if (daysSinceActive >= this.RETENTION_STRATEGIES.at_risk.days) {
      return { ...this.RETENTION_STRATEGIES.at_risk, confidence: 0.75 };
    }
    if (daysSinceActive >= this.RETENTION_STRATEGIES.loyal.days && user.segments?.includes('VIP')) {
      return { ...this.RETENTION_STRATEGIES.loyal, confidence: 0.9 };
    }
    return null;
  },

  createRetentionOffer(strategy, user) {
    const offers = {
      reactivation: {
        type: 'percentage',
        value: strategy.discount,
        minPurchase: 2000,
        expiresIn: 7,
        message: `We've missed you! Here's ${strategy.discount}% off your next booking.`
      },
      win_back: {
        type: 'percentage',
        value: strategy.discount,
        minPurchase: 1000,
        expiresIn: 14,
        message: `Welcome back! Enjoy ${strategy.discount}% off to celebrate your return.`
      },
      appreciation: {
        type: 'points',
        value: 500,
        expiresIn: 30,
        message: 'Thank you for being a valued customer! Here are bonus loyalty points.'
      }
    };

    return offers[strategy.strategy];
  }
};

// ============================================================================
// AGENT 11: WIN-BACK AGENT
// ============================================================================

const WinBackAgent = {
  name: 'WinBackAgent',
  schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM

  INACTIVITY_THRESHOLD_DAYS: 90,

  async run() {
    logger.info(`${this.name}: Starting weekly win-back identification`);
    const startTime = Date.now();
    let identifiedCount = 0;

    try {
      // Find dormant users
      const thresholdDate = new Date(Date.now() - this.INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
      const dormantUsers = await UserProfile.find({
        lastActive: { $lt: thresholdDate },
        segments: { $nin: ['DORMANT'] }
      });

      for (const user of dormantUsers) {
        // Calculate predicted response rate
        const responseRate = await this.predictResponseRate(user);

        // Get last purchase info
        const lastPurchase = await Purchase.findOne({ userId: user.userId })
          .sort({ timestamp: -1 });

        // Determine recommended offer
        const recommendedOffer = this.determineWinBackOffer(user, responseRate);

        // Create or update win-back candidate
        await WinBackCandidate.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            lastPurchaseDate: lastPurchase?.timestamp || null,
            inactivityDays: Math.floor((Date.now() - new Date(user.lastActive).getTime()) / (24 * 60 * 60 * 1000)),
            predictedResponseRate: responseRate,
            recommendedOffer,
            priority: this.determinePriority(responseRate, user.lifetimeValue),
            status: 'pending'
          },
          { upsert: true }
        );

        await AgentInsight.create({
          agentId: 'win-back-agent',
          agentName: this.name,
          userId: user.userId,
          insightType: 'win_back_candidate',
          data: {
            inactivityDays: Math.floor((Date.now() - new Date(user.lastActive).getTime()) / (24 * 60 * 60 * 1000)),
            lastPurchaseValue: lastPurchase?.total || 0,
            lifetimeValue: user.lifetimeValue,
            responseRatePrediction: responseRate,
            recommendedOffer,
            segments: user.segments
          },
          confidence: responseRate,
          action: 'add_to_win_back_campaign'
        });

        identifiedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Identified ${identifiedCount} win-back candidates in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async predictResponseRate(user) {
    let rate = 0.3; // Base rate

    // Previous engagement
    if (user.engagementScore > 70) rate += 0.2;
    else if (user.engagementScore > 40) rate += 0.1;

    // Lifetime value
    if (user.lifetimeValue > 50000) rate += 0.15;
    else if (user.lifetimeValue > 20000) rate += 0.1;
    else if (user.lifetimeValue > 5000) rate += 0.05;

    // Historical win-back success
    const previousWinBacks = await AgentInsight.countDocuments({
      userId: user.userId,
      insightType: 'win_back_candidate'
    });
    if (previousWinBacks > 0) rate += 0.1;

    return Math.min(0.8, rate);
  },

  determineWinBackOffer(user, responseRate) {
    if (user.lifetimeValue > 50000) {
      return responseRate > 0.5 ? 'premium_experience_package' : 'personalized_trip_planner';
    }
    if (user.lifetimeValue > 20000) {
      return responseRate > 0.4 ? 'exclusive_discount_code' : 'loyalty_points_bonus';
    }
    return 'welcome_back_discount';
  },

  determinePriority(responseRate, lifetimeValue) {
    if (responseRate > 0.6 && lifetimeValue > 20000) return 'high';
    if (responseRate > 0.4 || lifetimeValue > 10000) return 'medium';
    return 'low';
  }
};

// ============================================================================
// AGENT 12: REFERRAL POTENTIAL AGENT
// ============================================================================

const ReferralPotentialAgent = {
  name: 'ReferralPotentialAgent',
  schedule: '30 4 * * *', // Daily at 4:30 AM

  async run() {
    logger.info(`${this.name}: Starting referral potential scoring`);
    const startTime = Date.now();
    let scoredCount = 0;

    try {
      const allUsers = await UserProfile.find({});

      for (const user of allUsers) {
        // Calculate individual factors
        const satisfaction = await this.calculateSatisfactionScore(user.userId);
        const socialConnectedness = this.estimateSocialConnectedness(user);
        const lifetimeValue = user.lifetimeValue || 0;
        const engagementLevel = user.engagementScore || 50;

        // Calculate overall referral score
        const score = Math.round(
          (satisfaction * 0.35) +
          (socialConnectedness * 0.25) +
          (Math.min(lifetimeValue / 100000, 1) * 100 * 0.20) +
          (engagementLevel * 0.20)
        );

        const recommendedActions = this.getReferralActions(score, user);

        await ReferralPotential.findOneAndUpdate(
          { userId: user.userId },
          {
            userId: user.userId,
            score,
            factors: { satisfaction, socialConnectedness, lifetimeValue, engagementLevel },
            recommendedActions,
            lastUpdated: new Date()
          },
          { upsert: true }
        );

        await AgentInsight.create({
          agentId: 'referral-potential-agent',
          agentName: this.name,
          userId: user.userId,
          insightType: 'referral_potential',
          data: {
            score,
            factors: { satisfaction, socialConnectedness, lifetimeValue, engagementLevel },
            recommendedActions,
            segments: user.segments
          },
          confidence: score / 100,
          action: score >= 70 ? 'invite_to_referral_program' : score >= 50 ? 'nurture_for_referral' : 'monitor'
        });

        scoredCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Scored ${scoredCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async calculateSatisfactionScore(userId) {
    const recentFeedback = await Feedback.find({
      userId,
      timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    });

    if (recentFeedback.length === 0) return 50; // Neutral if no feedback

    const avgScore = recentFeedback.reduce((sum, f) => sum + f.score, 0) / recentFeedback.length;
    return avgScore * 10; // Convert 0-10 to 0-100
  },

  estimateSocialConnectedness(user) {
    let score = 30; // Base score

    // High-value users tend to be more socially connected
    if (user.lifetimeValue > 50000) score += 30;
    else if (user.lifetimeValue > 20000) score += 20;
    else if (user.lifetimeValue > 5000) score += 10;

    // Engagement level
    if (user.engagementScore > 80) score += 25;
    else if (user.engagementScore > 50) score += 15;

    // VIP users are often influencers
    if (user.segments?.includes('VIP')) score += 15;

    return Math.min(100, score);
  },

  getReferralActions(score, user) {
    const actions = [];

    if (score >= 80) {
      actions.push('invite_to_premium_referral_program', 'offer_double_sided_rewards', 'personal_outreach');
    } else if (score >= 60) {
      actions.push('send_referral_link', 'show_referral_banner');
    } else if (score >= 40) {
      actions.push('include_in_email_sequence', 'show_social_proof');
    }

    return actions;
  }
};

// ============================================================================
// AGENT 13: SURVEY TRIGGER AGENT
// ============================================================================

const SurveyTriggerAgent = {
  name: 'SurveyTriggerAgent',
  schedule: '0 6 * * *', // Daily at 6 AM

  OPTIMAL_SURVEY_TIMES: ['10:00', '14:00', '19:00'],

  async run() {
    logger.info(`${this.name}: Starting NPS survey optimization`);
    const startTime = Date.now();
    let triggeredCount = 0;

    try {
      // Find users who should receive surveys
      const surveyCandidates = await this.findSurveyCandidates();

      for (const candidate of surveyCandidates) {
        const optimalTime = this.calculateOptimalSendTime(candidate);

        await AgentInsight.create({
          agentId: 'survey-trigger-agent',
          agentName: this.name,
          userId: candidate.userId,
          insightType: 'survey_trigger',
          data: {
            surveyType: 'NPS',
            optimalSendTime: optimalTime,
            reason: candidate.reason,
            lastSurveyDate: candidate.lastSurveyDate,
            daysSinceLastSurvey: candidate.daysSinceLastSurvey,
            engagementLevel: candidate.engagementLevel,
            recommendedChannel: this.selectChannel(candidate)
          },
          confidence: 0.78,
          action: 'schedule_survey'
        });

        triggeredCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Triggered ${triggeredCount} survey sends in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async findSurveyCandidates() {
    const candidates = [];

    // Get users who haven't been surveyed recently
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usersWithoutRecentSurvey = await UserProfile.find({
      lastActive: { $gte: thirtyDaysAgo }
    });

    for (const user of usersWithoutRecentSurvey.slice(0, 50)) {
      const lastSurvey = await Feedback.findOne({
        userId: user.userId,
        type: 'nps'
      }).sort({ timestamp: -1 });

      const daysSinceLastSurvey = lastSurvey
        ? Math.floor((Date.now() - new Date(lastSurvey.timestamp).getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      if (daysSinceLastSurvey >= 30) {
        candidates.push({
          userId: user.userId,
          reason: this.determineSurveyReason(user),
          lastSurveyDate: lastSurvey?.timestamp || null,
          daysSinceLastSurvey,
          engagementLevel: user.engagementScore || 50
        });
      }
    }

    return candidates;
  },

  determineSurveyReason(user) {
    if (user.segments?.includes('VIP')) return 'vip_appreciation';
    if (user.engagementScore > 80) return 'highly_engaged';
    if (user.segments?.includes('AT_RISK')) return 'at_risk_check_in';
    return 'regular_feedback';
  },

  calculateOptimalSendTime(user) {
    // Simple heuristic based on engagement patterns
    if (user.engagementLevel > 70) return '10:00'; // Morning for active users
    if (user.engagementLevel > 40) return '14:00'; // Afternoon for moderate users
    return '19:00'; // Evening for less active users
  },

  selectChannel(candidate) {
    if (candidate.engagementLevel > 70) return 'in_app';
    if (candidate.reason === 'vip_appreciation') return 'email';
    if (candidate.reason === 'at_risk_check_in') return 'sms';
    return 'email';
  }
};

// ============================================================================
// AGENT 14: FEEDBACK ANALYZER AGENT
// ============================================================================

const FeedbackAnalyzerAgent = {
  name: 'FeedbackAnalyzerAgent',
  schedule: '25 * * * *', // Every hour at minute 25

  SENTIMENT_KEYWORDS: {
    positive: ['great', 'excellent', 'amazing', 'love', 'perfect', 'best', 'wonderful', 'fantastic'],
    negative: ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'poor', 'disappointed'],
    neutral: ['okay', 'fine', 'average', 'normal', 'standard']
  },

  CATEGORIES: ['service', 'quality', 'price', 'location', 'cleanliness', 'staff', 'amenities', 'food'],

  async run() {
    logger.info(`${this.name}: Starting feedback analysis`);
    const startTime = Date.now();
    let analyzedCount = 0;

    try {
      // Get unanalyzed feedback from last hour
      const recentFeedback = await Feedback.find({
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
        metadata: { $ne: { analyzed: true } }
      });

      for (const feedback of recentFeedback) {
        const analysis = this.analyzeFeedback(feedback);

        // Update feedback with analysis
        feedback.metadata = { ...feedback.metadata, analyzed: true, ...analysis };
        await feedback.save();

        // Create alerts for negative feedback
        if (analysis.sentiment === 'negative' && analysis.severity > 0.7) {
          await AgentInsight.create({
            agentId: 'feedback-analyzer-agent',
            agentName: this.name,
            userId: feedback.userId,
            insightType: 'critical_feedback_alert',
            data: {
              score: feedback.score,
              sentiment: analysis.sentiment,
              severity: analysis.severity,
              categories: analysis.categories,
              keywords: analysis.keywords,
              comment: feedback.comment,
              requiresAction: true
            },
            confidence: analysis.severity,
            action: 'escalate_to_support'
          });
        }

        await AgentInsight.create({
          agentId: 'feedback-analyzer-agent',
          agentName: this.name,
          userId: feedback.userId,
          insightType: 'feedback_analysis',
          data: {
            feedbackId: feedback._id,
            type: feedback.type,
            score: feedback.score,
            sentiment: analysis.sentiment,
            categories: analysis.categories,
            keywords: analysis.keywords,
            summary: analysis.summary
          },
          confidence: 0.85,
          action: analysis.actionable ? 'flag_for_review' : 'log_for_analytics'
        });

        analyzedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Analyzed ${analyzedCount} feedback items in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  analyzeFeedback(feedback) {
    const comment = (feedback.comment || '').toLowerCase();

    // Sentiment analysis
    const sentiment = this.detectSentiment(comment);

    // Category detection
    const categories = this.detectCategories(comment);

    // Keyword extraction
    const keywords = this.extractKeywords(comment);

    // Severity (for negative feedback)
    const severity = sentiment === 'negative' ? this.calculateSeverity(feedback.score, comment) : 0;

    return {
      sentiment,
      categories,
      keywords,
      severity,
      summary: this.generateSummary(feedback, sentiment, categories),
      actionable: categories.length > 0 && severity > 0.5
    };
  },

  detectSentiment(comment) {
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of this.SENTIMENT_KEYWORDS.positive) {
      if (comment.includes(word)) positiveCount++;
    }
    for (const word of this.SENTIMENT_KEYWORDS.negative) {
      if (comment.includes(word)) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  },

  detectCategories(comment) {
    const categories = [];
    const categoryKeywords = {
      service: ['service', 'help', 'support', 'assistant', 'response'],
      quality: ['quality', 'standard', 'condition', 'maintained'],
      price: ['price', 'cost', 'expensive', 'cheap', 'value', 'money'],
      location: ['location', 'area', 'nearby', 'distance', 'convenient'],
      cleanliness: ['clean', 'dirty', 'hygiene', 'tidy', 'sanitary'],
      staff: ['staff', 'employee', 'team', 'people', 'friendly', 'rude'],
      amenities: ['amenities', 'facilities', 'pool', 'gym', 'wifi'],
      food: ['food', 'meal', 'breakfast', 'dinner', 'restaurant', 'taste']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => comment.includes(k))) {
        categories.push(category);
      }
    }

    return categories;
  },

  extractKeywords(comment) {
    const words = comment.split(/\s+/).filter(w => w.length > 3);
    return [...new Set(words)].slice(0, 5);
  },

  calculateSeverity(score, comment) {
    let severity = 1 - (score / 10);

    // Increase severity for strong negative words
    const strongNegative = ['terrible', 'horrible', 'worst', 'awful', 'disaster'];
    if (strongNegative.some(w => comment.includes(w))) {
      severity = Math.min(1, severity + 0.2);
    }

    return severity;
  },

  generateSummary(feedback, sentiment, categories) {
    return `${feedback.type} feedback with ${sentiment} sentiment${categories.length > 0 ? ` related to ${categories.join(', ')}` : ''}`;
  }
};

// ============================================================================
// AGENT 15: NPS PREDICTOR AGENT
// ============================================================================

const NPSPredictorAgent = {
  name: 'NPSPredictorAgent',
  schedule: '0 5 * * *', // Daily at 5 AM

  async run() {
    logger.info(`${this.name}: Starting NPS score prediction`);
    const startTime = Date.now();
    let predictedCount = 0;

    try {
      // Get users without recent NPS feedback but with activity
      const candidates = await this.findNPPCandidates();

      for (const candidate of candidates) {
        const predictedScore = await this.predictNPS(candidate);

        await AgentInsight.create({
          agentId: 'nps-predictor-agent',
          agentName: this.name,
          userId: candidate.userId,
          insightType: 'nps_prediction',
          data: {
            predictedScore,
            promoterLikelihood: predictedScore >= 9 ? 'likely' : predictedScore >= 7 ? 'possible' : 'unlikely',
            factors: candidate.factors,
            confidence: candidate.confidence,
            recommendedAction: this.getRecommendedAction(predictedScore, candidate)
          },
          confidence: candidate.confidence,
          action: predictedScore >= 9 ? 'promote_referral' : predictedScore < 7 ? 'prevent_churn' : 'maintain_satisfaction'
        });

        predictedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info(`${this.name}: Completed. Predicted NPS for ${predictedCount} users in ${duration}ms`);

    } catch (error) {
      logger.error(`${this.name}: Error - ${error.message}`);
    }
  },

  async findNPPCandidates() {
    const candidates = [];

    // Get users with recent purchases but no NPS
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentPurchases = await Purchase.aggregate([
      { $match: { timestamp: { $gte: fourteenDaysAgo } } },
      { $group: { _id: '$userId', lastPurchase: { $max: '$timestamp' } } }
    ]);

    for (const purchase of recentPurchases.slice(0, 50)) {
      // Check if user has recent NPS
      const hasNPS = await Feedback.findOne({
        userId: purchase._id,
        type: 'nps',
        timestamp: { $gte: fourteenDaysAgo }
      });

      if (!hasNPS) {
        const user = await UserProfile.findOne({ userId: purchase._id });
        if (user) {
          candidates.push({
            userId: purchase._id,
            factors: {
              lifetimeValue: user.lifetimeValue,
              engagementScore: user.engagementScore,
              lastPurchaseValue: purchase.lastPurchase,
              segments: user.segments
            },
            confidence: this.calculatePredictionConfidence(user)
          });
        }
      }
    }

    return candidates;
  },

  async predictNPS(candidate) {
    let score = 5; // Start neutral

    // Engagement factor
    const engagement = candidate.factors.engagementScore || 50;
    score += (engagement - 50) / 10;

    // Lifetime value factor
    const ltv = candidate.factors.lifetimeValue || 0;
    if (ltv > 50000) score += 1.5;
    else if (ltv > 20000) score += 1;
    else if (ltv > 5000) score += 0.5;

    // VIP bonus
    if (candidate.factors.segments?.includes('VIP')) score += 1;

    // Recent purchase boost
    const daysSincePurchase = (Date.now() - new Date(candidate.factors.lastPurchaseValue).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSincePurchase <= 3) score += 1;

    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  },

  calculatePredictionConfidence(user) {
    let confidence = 0.6;

    if (user.engagementScore) confidence += 0.1;
    if (user.lifetimeValue > 0) confidence += 0.15;
    if (user.segments?.length > 0) confidence += 0.1;

    return Math.min(0.95, confidence);
  },

  getRecommendedAction(score, candidate) {
    if (score >= 9) return ['ask_for_referral', 'request_review', 'invite_to_beta'];
    if (score >= 7) return ['maintain_engagement', 'send_loyalty_update'];
    if (score >= 5) return ['address_concerns', 'send_satisfaction_survey'];
    return ['immediate_outreach', 'offer_apology', 'schedule_call'];
  }
};

// ============================================================================
// AGENT REGISTRY & SCHEDULER
// ============================================================================

const AGENTS = [
  PersonalizationAgent,
  SegmentClassifierAgent,
  RecommendationQualityAgent,
  EngagementScoreAgent,
  SessionAnalyzerAgent,
  SearchIntentAgent,
  BrowsePatternAgent,
  PurchasePredictorAgent,
  AbandonmentDetectorAgent,
  RetentionTriggerAgent,
  WinBackAgent,
  ReferralPotentialAgent,
  SurveyTriggerAgent,
  FeedbackAnalyzerAgent,
  NPSPredictorAgent
];

function scheduleAgent(agent) {
  if (cron.validate(agent.schedule)) {
    cron.schedule(agent.schedule, async () => {
      logger.info(`Scheduler: Starting ${agent.name}`);
      try {
        await agent.run();
      } catch (error) {
        logger.error(`Scheduler: ${agent.name} failed - ${error.message}`);
      }
    });
    logger.info(`Scheduled ${agent.name} with cron: ${agent.schedule}`);
  } else {
    logger.error(`Invalid cron expression for ${agent.name}: ${agent.schedule}`);
  }
}

// ============================================================================
// EXPRESS SERVER
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-user-agents',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    agents: AGENTS.map(a => ({
      name: a.name,
      schedule: a.schedule,
      status: 'scheduled'
    }))
  });
});

// Agent status endpoint
app.get('/api/agents', (req, res) => {
  res.json({
    agents: AGENTS.map(a => ({
      name: a.name,
      schedule: a.schedule,
      description: `Runs ${a.schedule}`
    }))
  });
});

// Run single agent manually
app.post('/api/agents/:name/run', async (req, res) => {
  const agentName = req.params.name;
  const agent = AGENTS.find(a => a.name === agentName);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  try {
    logger.info(`Manual trigger for ${agent.name}`);
    await agent.run();
    res.json({ success: true, agent: agent.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Insights endpoint
app.get('/api/insights', async (req, res) => {
  const { userId, type, limit = 100 } = req.query;

  const query = {};
  if (userId) query.userId = userId;
  if (type) query.insightType = type;

  const insights = await AgentInsight.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.json({ insights });
});

// Seed mock data endpoint (for demo)
app.post('/api/seed', async (req, res) => {
  try {
    await seedMockData();
    res.json({ success: true, message: 'Mock data seeded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STARTUP
// ============================================================================

async function start() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected');

    // Schedule all agents
    for (const agent of AGENTS) {
      scheduleAgent(agent);
    }

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`REZ User Agents running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`${AGENTS.length} agents scheduled`);
    });

  } catch (error) {
    logger.error('Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  start();
}

// Export for testing
module.exports = { AGENTS, start, seedMockData };

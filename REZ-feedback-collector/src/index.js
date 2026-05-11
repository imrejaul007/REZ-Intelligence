'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// MongoDB Schemas
const conversionSchema = new mongoose.Schema({
  feedbackId: { type: String, required: true, unique: true, index: true },

  // Attribution
  nudgeId: String,
  campaignId: String,
  recommendationId: String,

  // User
  userId: String,
  unifiedId: String,
  appId: String,

  // Conversion details
  converted: { type: Boolean, default: false },
  orderId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },

  // Attribution data
  attribution: {
    source: String, // nudge, recommendation, organic
    channel: String, // push, email, sms, in_app
    touchpoints: [{
      type: String,
      timestamp: Date,
      nudgeId: String,
      offer: String
    }],
    daysToConvert: Number
  },

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  convertedAt: Date
});

const recommendationFeedbackSchema = new mongoose.Schema({
  feedbackId: { type: String, required: true, unique: true, index: true },

  recommendationId: String,
  userId: String,
  unifiedId: String,
  appId: String,

  // Feedback
  action: { type: String, enum: ['click', 'view', 'purchase', 'dismiss', 'save'] },
  itemId: String,
  itemCategory: String,

  // Context
  position: Number,
  context: String,

  // Revenue (if purchased)
  revenue: Number,

  metadata: mongoose.Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now }
});

const modelFeedbackSchema = new mongoose.Schema({
  feedbackId: { type: String, required: true, unique: true, index: true },

  modelId: String,
  modelType: String,

  userId: String,
  unifiedId: String,
  appId: String,

  // Prediction feedback
  prediction: mongoose.Schema.Types.Mixed,
  actual: mongoose.Schema.Types.Mixed,
  correct: Boolean,
  error: Number,

  metadata: mongoose.Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now }
});

const nudgeFeedbackSchema = new mongoose.Schema({
  feedbackId: { type: String, required: true, unique: true, index: true },

  nudgeId: String,
  userId: String,
  unifiedId: String,
  appId: String,

  // Event
  event: { type: String, enum: ['sent', 'delivered', 'clicked', 'converted', 'dismissed'] },

  // Conversion
  converted: { type: Boolean, default: false },
  orderId: String,
  amount: Number,

  // Timing
  sentAt: Date,
  deliveredAt: Date,
  clickedAt: Date,
  convertedAt: Date,

  metadata: mongoose.Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now }
});

// Indexes
conversionSchema.index({ userId: 1, createdAt: -1 });
conversionSchema.index({ nudgeId: 1, createdAt: -1 });
conversionSchema.index({ campaignId: 1, createdAt: -1 });
conversionSchema.index({ converted: 1 });

recommendationFeedbackSchema.index({ userId: 1, action: 1 });
recommendationFeedbackSchema.index({ recommendationId: 1 });

modelFeedbackSchema.index({ modelId: 1, correct: 1 });
modelFeedbackSchema.index({ createdAt: -1 });

nudgeFeedbackSchema.index({ nudgeId: 1, event: 1 });
nudgeFeedbackSchema.index({ userId: 1, createdAt: -1 });

const Conversion = mongoose.model('Conversion', conversionSchema);
const RecommendationFeedback = mongoose.model('RecommendationFeedback', recommendationFeedbackSchema);
const ModelFeedback = mongoose.model('ModelFeedback', modelFeedbackSchema);
const NudgeFeedback = mongoose.model('NudgeFeedback', nudgeFeedbackSchema);

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready', '/dashboard'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'feedback-collector', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ error: 'Not ready' });
  }
});

// ============================================
// CONVERSION TRACKING
// ============================================

// Track conversion attribution
app.post('/api/feedback/conversion', async (req, res) => {
  try {
    const { nudgeId, userId, appId, converted, orderId, amount, metadata } = req.body;

    // Check if conversion already exists
    if (orderId) {
      const existing = await Conversion.findOne({ orderId });
      if (existing) {
        return res.json({ success: true, message: 'Already tracked', conversion: existing });
      }
    }

    // Create conversion record
    const conversion = await Conversion.create({
      feedbackId: `conv_${uuidv4()}`,
      nudgeId,
      userId,
      appId,
      converted,
      orderId,
      amount,
      convertedAt: converted ? new Date() : null,
      metadata
    });

    // If nudge conversion, update nudge feedback
    if (nudgeId && converted) {
      await NudgeFeedback.findOneAndUpdate(
        { nudgeId, event: 'clicked' },
        {
          $set: {
            converted: true,
            orderId,
            amount,
            convertedAt: new Date()
          }
        }
      );

      // Update conversion with days to convert
      const nudgeFeedback = await NudgeFeedback.findOne({ nudgeId });
      if (nudgeFeedback?.sentAt) {
        conversion.attribution = {
          source: 'nudge',
          daysToConvert: Math.floor((Date.now() - nudgeFeedback.sentAt.getTime()) / (1000 * 60 * 60 * 24))
        };
        await conversion.save();
      }
    }

    logger.info('Conversion tracked', { feedbackId: conversion.feedbackId, converted, amount });

    res.json({ success: true, conversion });
  } catch (err) {
    logger.error('Conversion tracking failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// RECOMMENDATION FEEDBACK
// ============================================

app.post('/api/feedback/recommendation', async (req, res) => {
  try {
    const { recommendationId, userId, appId, action, itemId, metadata } = req.body;

    const feedback = await RecommendationFeedback.create({
      feedbackId: `recfb_${uuidv4()}`,
      recommendationId,
      userId,
      appId,
      action,
      itemId,
      metadata
    });

    logger.info('Recommendation feedback', { feedbackId: feedback.feedbackId, action });

    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// MODEL FEEDBACK
// ============================================

app.post('/api/feedback/model', async (req, res) => {
  try {
    const { modelId, userId, appId, prediction, actual, metadata } = req.body;

    const correct = JSON.stringify(prediction) === JSON.stringify(actual);
    const error = calculateError(prediction, actual);

    const feedback = await ModelFeedback.create({
      feedbackId: `modfb_${uuidv4()}`,
      modelId,
      userId,
      appId,
      prediction,
      actual,
      correct,
      error,
      metadata
    });

    logger.info('Model feedback', { feedbackId: feedback.feedbackId, correct });

    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// NUDGE FEEDBACK
// ============================================

// Track nudge event
app.post('/api/feedback/nudge', async (req, res) => {
  try {
    const { nudgeId, userId, appId, event, metadata } = req.body;

    const timestamp = new Date();
    const update = { event, metadata };

    switch (event) {
      case 'delivered': update.deliveredAt = timestamp; break;
      case 'clicked': update.clickedAt = timestamp; break;
      case 'converted': update.convertedAt = timestamp; break;
    }

    let feedback = await NudgeFeedback.findOneAndUpdate(
      { nudgeId, userId },
      { $set: update },
      { upsert: true, new: true }
    );

    logger.info('Nudge feedback', { nudgeId, event });

    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS
// ============================================

// Attribution dashboard
app.get('/dashboard/attribution', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Conversion stats
    const [total, converted, bySource] = await Promise.all([
      Conversion.countDocuments({ createdAt: { $gte: startDate } }),
      Conversion.countDocuments({ createdAt: { $gte: startDate }, converted: true }),
      Conversion.aggregate([
        { $match: { createdAt: { $gte: startDate }, converted: true } },
        { $group: { _id: '$attribution.source', count: { $sum: 1 }, revenue: { $sum: '$amount' } } }
      ])
    ]);

    // Attribution rates
    const nudgeConversions = await Conversion.countDocuments({
      createdAt: { $gte: startDate },
      converted: true,
      nudgeId: { $exists: true, $ne: null }
    });

    const organicConversions = await Conversion.countDocuments({
      createdAt: { $gte: startDate },
      converted: true,
      $or: [{ nudgeId: { $exists: false } }, { nudgeId: null }]
    });

    const nudgeRate = converted > 0 ? (nudgeConversions / converted * 100).toFixed(1) : 0;

    res.json({
      success: true,
      period: `${days} days`,
      summary: {
        totalAttributions: total,
        convertedAttributions: converted,
        conversionRate: total > 0 ? (converted / total * 100).toFixed(1) : 0,
        totalRevenue: bySource.reduce((s, r) => s + (r.revenue || 0), 0)
      },
      attribution: {
        nudgeRate: nudgeRate,
        organicRate: (100 - nudgeRate).toFixed(1),
        bySource: bySource.map(s => ({ source: s._id, count: s.count, revenue: s.revenue }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recommendation performance
app.get('/dashboard/recommendations', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [byAction, topItems] = await Promise.all([
      RecommendationFeedback.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      RecommendationFeedback.aggregate([
        { $match: { createdAt: { $gte: startDate }, action: 'purchase' } },
        { $group: { _id: '$itemId', count: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const totalClicks = byAction.find(a => a._id === 'click')?.count || 0;
    const totalPurchases = byAction.find(a => a._id === 'purchase')?.count || 0;
    const clickToPurchase = totalClicks > 0 ? (totalPurchases / totalClicks * 100).toFixed(1) : 0;

    res.json({
      success: true,
      period: `${days} days`,
      summary: {
        totalFeedback: byAction.reduce((s, a) => s + a.count, 0),
        clicks: totalClicks,
        purchases: totalPurchases,
        clickToPurchaseRate: clickToPurchase
      },
      topItems,
      byAction: byAction.map(a => ({ action: a._id, count: a.count }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Model accuracy
app.get('/dashboard/models', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const modelStats = await ModelFeedback.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
        _id: '$modelId',
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$correct', 1, 0] } },
        avgError: { $avg: '$error' }
      }},
      { $project: {
        modelId: '$_id',
        total: 1,
        accuracy: { $multiply: [{ $divide: ['$correct', '$total'] }, 100] },
        avgError: { $round: ['$avgError', 4] }
      }}
    ]);

    res.json({
      success: true,
      period: `${days} days`,
      models: modelStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nudge performance
app.get('/dashboard/nudges', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [byEvent, funnel] = await Promise.all([
      NudgeFeedback.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$event', count: { $sum: 1 } } }
      ]),
      NudgeFeedback.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $facet: {
          sent: [{ $match: { event: 'sent' } }, { $count: 'count' }],
          clicked: [{ $match: { event: 'clicked' } }, { $count: 'count' }],
          converted: [{ $match: { event: 'converted' } }, { $count: 'count' }]
        }}
      ])
    ]);

    const sent = funnel[0].sent[0]?.count || 0;
    const clicked = funnel[0].clicked[0]?.count || 0;
    const converted = funnel[0].converted[0]?.count || 0;

    res.json({
      success: true,
      period: `${days} days`,
      funnel: {
        sent,
        clicked,
        converted,
        ctr: sent > 0 ? (clicked / sent * 100).toFixed(1) : 0,
        conversionRate: clicked > 0 ? (converted / clicked * 100).toFixed(1) : 0
      },
      byEvent: byEvent.map(e => ({ event: e._id, count: e.count }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Error helper
function calculateError(prediction, actual) {
  if (typeof prediction === 'number' && typeof actual === 'number') {
    return Math.abs(prediction - actual) / Math.max(actual, 1);
  }
  return 0;
}

const PORT = process.env.PORT || 4085;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Feedback Collector running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

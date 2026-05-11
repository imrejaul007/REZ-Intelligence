'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
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

// Fraud risk levels
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Transaction types
const TX_TYPES = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  WITHDRAWAL: 'withdrawal',
  TOPUP: 'topup',
  TRANSFER: 'transfer'
};

// MongoDB Schemas
const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  merchantId: String,
  type: { type: String, enum: Object.values(TX_TYPES), required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },

  // Fraud scoring
  fraudScore: { type: Number, min: 0, max: 1, default: 0 },
  riskLevel: { type: String, enum: Object.values(RISK_LEVELS), default: 'low' },
  fraudFlags: [String],

  // Velocity tracking
  velocity: {
    count24h: { type: Number, default: 0 },
    amount24h: { type: Number, default: 0 },
    count7d: { type: Number, default: 0 },
    amount7d: { type: Number, default: 0 }
  },

  // Device & location
  deviceFingerprint: String,
  ip: String,
  location: {
    country: String,
    city: String,
    lat: Number,
    lng: Number
  },

  // Payment details
  paymentMethod: { type: String, enum: ['upi', 'card', 'wallet', 'netbanking', 'cod'] },
  provider: String, // razorpay, stripe, etc.
  providerTxId: String,

  // Metadata
  metadata: mongoose.Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ fraudScore: -1 });
transactionSchema.index({ 'velocity.count24h': -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

// User payment profile
const paymentProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // Behavioral patterns
  patterns: {
    avgTransactionValue: { type: Number, default: 0 },
    maxTransactionValue: { type: Number, default: 0 },
    preferredPaymentMethod: String,
    preferredTimeHours: [Number], // 10, 14, 20
    typicalLocations: [String], // cities
    avgTransactionsPerWeek: { type: Number, default: 0 }
  },

  // Trust score
  trustScore: { type: Number, min: 0, max: 1, default: 0.5 },
  accountAge: { type: Number, default: 0 }, // days
  verified: { type: Boolean, default: false },
  kycLevel: { type: Number, default: 0 },

  // Fraud history
  fraudHistory: [{
    transactionId: String,
    fraudScore: Number,
    type: String,
    resolved: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
  }],

  // Velocity stats
  velocityStats: {
    dailyCount: { type: Number, default: 0 },
    dailyAmount: { type: Number, default: 0 },
    weeklyCount: { type: Number, default: 0 },
    weeklyAmount: { type: Number, default: 0 },
    lastUpdated: Date
  },

  // Risk factors
  riskFactors: [{
    factor: String,
    score: Number,
    description: String
  }],

  lastUpdated: Date
}, { timestamps: true });

const PaymentProfile = mongoose.model('PaymentProfile', paymentProfileSchema);

// Merchant payment analytics
const merchantPaymentSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },

  // Volume metrics
  volume: {
    daily: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    monthly: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },

  // Success rates
  successRate: { type: Number, default: 0.95 },
  refundRate: { type: Number, default: 0 },
  chargebackRate: { type: Number, default: 0 },

  // Payment method distribution
  paymentMethods: {
    upi: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
    wallet: { type: Number, default: 0 },
    netbanking: { type: Number, default: 0 },
    cod: { type: Number, default: 0 }
  },

  // Fraud metrics
  fraudMetrics: {
    attemptedCount: { type: Number, default: 0 },
    detectedCount: { type: Number, default: 0 },
    preventedAmount: { type: Number, default: 0 }
  },

  // Customer metrics
  customers: {
    total: { type: Number, default: 0 },
    newCount: { type: Number, default: 0 },
    returningCount: { type: Number, default: 0 }
  },

  lastUpdated: Date
}, { timestamps: true });

const MerchantPayment = mongoose.model('MerchantPayment', merchantPaymentSchema);

// Payments Brain Engine
class PaymentsBrainEngine {
  // Calculate fraud score for a transaction
  async calculateFraudScore(transaction, userProfile) {
    let score = 0;
    const flags = [];

    // 1. Velocity check (40% weight)
    const velocityScore = this.checkVelocity(transaction, userProfile);
    score += velocityScore.score * 0.4;
    flags.push(...velocityScore.flags);

    // 2. Amount anomaly (20% weight)
    const amountScore = this.checkAmountAnomaly(transaction, userProfile);
    score += amountScore.score * 0.2;
    flags.push(...amountScore.flags);

    // 3. Device/location anomaly (20% weight)
    const locationScore = await this.checkLocationAnomaly(transaction, userProfile);
    score += locationScore.score * 0.2;
    flags.push(...locationScore.flags);

    // 4. Behavioral anomaly (20% weight)
    const behaviorScore = this.checkBehavioralAnomaly(transaction, userProfile);
    score += behaviorScore.score * 0.2;
    flags.push(...behaviorScore.flags);

    // Normalize score
    score = Math.min(1, Math.max(0, score));

    // Determine risk level
    let riskLevel = RISK_LEVELS.LOW;
    if (score >= 0.8) riskLevel = RISK_LEVELS.CRITICAL;
    else if (score >= 0.6) riskLevel = RISK_LEVELS.HIGH;
    else if (score >= 0.4) riskLevel = RISK_LEVELS.MEDIUM;

    return { score, riskLevel, flags };
  }

  checkVelocity(transaction, userProfile) {
    let score = 0;
    const flags = [];
    const vel = transaction.velocity || {};

    // Check daily count
    if (vel.count24h > 20) {
      score += 0.3;
      flags.push('high_velocity_count_24h');
    } else if (vel.count24h > 10) {
      score += 0.15;
      flags.push('elevated_velocity_count_24h');
    }

    // Check daily amount
    const avgDaily = userProfile?.velocityStats?.dailyAmount || 0;
    if (vel.amount24h > avgDaily * 5 && avgDaily > 0) {
      score += 0.3;
      flags.push('high_velocity_amount_24h');
    } else if (vel.amount24h > avgDaily * 3 && avgDaily > 0) {
      score += 0.15;
      flags.push('elevated_velocity_amount_24h');
    }

    // Check for burst pattern
    if (vel.count24h > 5 && transaction.amount > 10000) {
      score += 0.2;
      flags.push('burst_high_value');
    }

    return { score: Math.min(1, score), flags };
  }

  checkAmountAnomaly(transaction, userProfile) {
    let score = 0;
    const flags = [];
    const patterns = userProfile?.patterns || {};

    const avgValue = patterns.avgTransactionValue || 0;
    const maxValue = patterns.maxTransactionValue || 0;

    // First large transaction
    if (avgValue === 0 && transaction.amount > 1000) {
      score += 0.4;
      flags.push('first_large_transaction');
    }

    // Significantly above average
    if (avgValue > 0 && transaction.amount > avgValue * 5) {
      score += 0.3;
      flags.push('amount_anomaly_high');
    }

    // Above historical max
    if (maxValue > 0 && transaction.amount > maxValue * 2) {
      score += 0.2;
      flags.push('amount_exceeds_history');
    }

    // Suspicious round amounts
    if (transaction.amount % 1000 === 0 && transaction.amount >= 5000) {
      score += 0.1;
      flags.push('suspicious_round_amount');
    }

    return { score: Math.min(1, score), flags };
  }

  async checkLocationAnomaly(transaction, userProfile) {
    let score = 0;
    const flags = [];

    const location = transaction.location;
    const typicalLocations = userProfile?.patterns?.typicalLocations || [];

    if (location && typicalLocations.length > 0) {
      // Check if location is typical
      if (!typicalLocations.includes(location.country)) {
        score += 0.3;
        flags.push('new_country');
      }

      // Check for high-risk countries (simplified)
      const highRiskCountries = ['NG', 'GH', 'PK', 'BD']; // Would be more comprehensive
      if (highRiskCountries.includes(location.country)) {
        score += 0.3;
        flags.push('high_risk_country');
      }
    }

    // No location data
    if (!location) {
      score += 0.1;
      flags.push('no_location_data');
    }

    return { score: Math.min(1, score), flags };
  }

  checkBehavioralAnomaly(transaction, userProfile) {
    let score = 0;
    const flags = [];

    const patterns = userProfile?.patterns || {};

    // Unusual payment method
    if (patterns.preferredPaymentMethod &&
        transaction.paymentMethod !== patterns.preferredPaymentMethod) {
      score += 0.1;
      flags.push('unusual_payment_method');
    }

    // Unusual time
    const hour = new Date().getHours();
    const typicalHours = patterns.preferredTimeHours || [];
    if (typicalHours.length > 0 && !typicalHours.includes(hour)) {
      // Only flag if very unusual (between 2-5 AM)
      if (hour >= 2 && hour <= 5) {
        score += 0.2;
        flags.push('unusual_transaction_time');
      }
    }

    // Low trust score
    if (userProfile?.trustScore < 0.3) {
      score += 0.3;
      flags.push('low_trust_score');
    }

    // Unverified account
    if (!userProfile?.verified) {
      score += 0.1;
      flags.push('unverified_account');
    }

    return { score: Math.min(1, score), flags };
  }

  // Update velocity counters
  async updateVelocity(userId) {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [dayTxns, weekTxns] = await Promise.all([
      Transaction.find({ userId, createdAt: { $gte: dayAgo } }),
      Transaction.find({ userId, createdAt: { $gte: weekAgo } })
    ]);

    const dayCount = dayTxns.length;
    const dayAmount = dayTxns.reduce((sum, t) => sum + t.amount, 0);
    const weekCount = weekTxns.length;
    const weekAmount = weekTxns.reduce((sum, t) => sum + t.amount, 0);

    return { dayCount, dayAmount, weekCount, weekAmount };
  }

  // Update user payment profile
  async updatePaymentProfile(userId, transaction) {
    let profile = await PaymentProfile.findOne({ userId });

    if (!profile) {
      profile = new PaymentProfile({ userId });
    }

    // Update patterns
    const txns = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (txns.length > 0) {
      const amounts = txns.map(t => t.amount);
      const avgValue = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const maxValue = Math.max(...amounts);

      profile.patterns.avgTransactionValue = avgValue;
      profile.patterns.maxTransactionValue = maxValue;

      // Payment method distribution
      const methodCounts = {};
      txns.forEach(t => {
        methodCounts[t.paymentMethod] = (methodCounts[t.paymentMethod] || 0) + 1;
      });
      const preferredMethod = Object.entries(methodCounts)
        .sort((a, b) => b[1] - a[1])[0];
      profile.patterns.preferredPaymentMethod = preferredMethod?.[0];
    }

    // Update velocity stats
    const velocity = await this.updateVelocity(userId);
    profile.velocityStats = {
      ...velocity,
      lastUpdated: new Date()
    };

    // Calculate trust score
    const trustScore = this.calculateTrustScore(profile);
    profile.trustScore = trustScore;

    profile.lastUpdated = new Date();
    await profile.save();

    return profile;
  }

  calculateTrustScore(profile) {
    let score = 0.5; // Base score

    // Account age factor
    const ageDays = profile.accountAge || 0;
    if (ageDays > 365) score += 0.15;
    else if (ageDays > 180) score += 0.1;
    else if (ageDays > 30) score += 0.05;

    // KYC factor
    if (profile.kycLevel >= 3) score += 0.2;
    else if (profile.kycLevel >= 2) score += 0.1;
    else if (profile.kycLevel >= 1) score += 0.05;

    // Verified factor
    if (profile.verified) score += 0.1;

    // Fraud history penalty
    const unresolvedFraud = profile.fraudHistory?.filter(f => !f.resolved).length || 0;
    score -= unresolvedFraud * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  // Optimize payment routing
  async optimizePaymentRoute(userId, amount, options = {}) {
    const profile = await PaymentProfile.findOne({ userId });

    // Calculate success probability for each method
    const methods = ['upi', 'card', 'wallet', 'netbanking'];

    const routes = methods.map(method => {
      let probability = 0.9; // Base probability

      // Adjust based on user's history with this method
      if (profile?.patterns?.preferredPaymentMethod === method) {
        probability += 0.05;
      }

      // Adjust based on amount
      if (amount > 10000 && method === 'upi') {
        probability += 0.02;
      } else if (amount > 5000 && method === 'card') {
        probability -= 0.05; // Cards have higher failure for large amounts
      }

      // Cost factor (lower is better)
      const costs = {
        upi: 0.005,
        wallet: 0.02,
        card: 0.025,
        netbanking: 0.015
      };

      return {
        method,
        probability: Math.min(1, probability),
        estimatedCost: amount * costs[method],
        recommended: probability > 0.9
      };
    });

    // Sort by probability
    routes.sort((a, b) => b.probability - a.probability);

    return {
      userId,
      amount,
      recommendedRoute: routes[0],
      alternatives: routes.slice(1),
      timestamp: new Date()
    };
  }
}

const brain = new PaymentsBrainEngine();

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
    service: 'payments-brain',
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

// Fraud check endpoint
app.post('/api/fraud/check', asyncHandler(async (req, res) => {
  const { transactionId, userId, amount, paymentMethod, deviceFingerprint, ip, location } = req.body;

  // Get user profile
  const userProfile = await PaymentProfile.findOne({ userId });

  // Get velocity
  const velocity = await brain.updateVelocity(userId);

  // Create transaction object for scoring
  const transaction = {
    amount,
    paymentMethod,
    deviceFingerprint,
    ip,
    location,
    velocity
  };

  // Calculate fraud score
  const fraudResult = await brain.calculateFraudScore(transaction, userProfile);

  // Determine action
  let action = 'allow';
  if (fraudResult.riskLevel === 'critical') action = 'block';
  else if (fraudResult.riskLevel === 'high') action = 'review';
  else if (fraudResult.riskLevel === 'medium') action = 'challenge';

  // Create transaction record
  const txn = await Transaction.create({
    transactionId: transactionId || `tx_${uuidv4()}`,
    userId,
    amount,
    paymentMethod,
    deviceFingerprint,
    ip,
    location,
    velocity,
    fraudScore: fraudResult.score,
    riskLevel: fraudResult.riskLevel,
    fraudFlags: fraudResult.flags
  });

  // Update user profile
  await brain.updatePaymentProfile(userId, txn);

  logger.info('Fraud check completed', {
    requestId: req.requestId,
    userId,
    fraudScore: fraudResult.score,
    riskLevel: fraudResult.riskLevel,
    action
  });

  res.json({
    success: true,
    transactionId: txn.transactionId,
    fraudScore: fraudResult.score,
    riskLevel: fraudResult.riskLevel,
    flags: fraudResult.flags,
    action,
    reviewRequired: action === 'review' || action === 'challenge'
  });
}));

// Payment route optimization
app.get('/api/route/optimize/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount = 500 } = req.query;

  const route = await brain.optimizePaymentRoute(userId, parseFloat(amount));

  res.json({ success: true, route });
}));

// Get user payment profile
app.get('/api/profile/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const profile = await PaymentProfile.findOne({ userId });

  if (!profile) {
    return res.json({
      success: true,
      profile: null,
      message: 'No payment profile yet'
    });
  }

  res.json({
    success: true,
    profile: {
      userId: profile.userId,
      trustScore: profile.trustScore,
      patterns: profile.patterns,
      verified: profile.verified,
      kycLevel: profile.kycLevel,
      riskFactors: profile.riskFactors,
      velocityStats: profile.velocityStats
    }
  });
}));

// Update transaction status
app.patch('/api/transaction/:transactionId', asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { status, fraudScore, resolved } = req.body;

  const update = {};
  if (status) update.status = status;
  if (fraudScore !== undefined) update.fraudScore = fraudScore;
  if (resolved !== undefined) {
    update['fraudHistory.$.resolved'] = resolved;
  }

  const txn = await Transaction.findOneAndUpdate(
    { transactionId },
    { $set: update },
    { new: true }
  );

  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json({ success: true, transaction: txn });
}));

// Get merchant payment analytics
app.get('/api/merchant/:merchantId/analytics', asyncHandler(async (req, res) => {
  const { merchantId } = req.params;
  const { period = '7d' } = req.query;

  let startDate;
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const transactions = await Transaction.find({
    merchantId,
    createdAt: { $gte: startDate }
  }).lean();

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const successCount = transactions.filter(t => t.status === 'success').length;
  const refundCount = transactions.filter(t => t.status === 'refunded').length;
  const failedCount = transactions.filter(t => t.status === 'failed').length;
  const fraudCount = transactions.filter(t => t.fraudScore > 0.6).length;

  // Payment method distribution
  const methodCounts = {};
  transactions.forEach(t => {
    methodCounts[t.paymentMethod] = (methodCounts[t.paymentMethod] || 0) + 1;
  });

  res.json({
    success: true,
    analytics: {
      period,
      totalTransactions: transactions.length,
      totalVolume,
      successRate: transactions.length > 0 ? successCount / transactions.length : 0,
      refundRate: transactions.length > 0 ? refundCount / transactions.length : 0,
      failedRate: transactions.length > 0 ? failedCount / transactions.length : 0,
      fraudDetected: fraudCount,
      fraudRate: transactions.length > 0 ? fraudCount / transactions.length : 0,
      paymentMethods: methodCounts,
      avgTransactionValue: transactions.length > 0 ? totalVolume / transactions.length : 0
    }
  });
}));

// Get fraud analytics
app.get('/api/analytics/fraud', asyncHandler(async (req, res) => {
  const { period = '7d' } = req.query;

  let startDate;
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [highRisk, mediumRisk, lowRisk, flagged] = await Promise.all([
    Transaction.countDocuments({ fraudScore: { $gte: 0.8 }, createdAt: { $gte: startDate } }),
    Transaction.countDocuments({ fraudScore: { $gte: 0.6, $lt: 0.8 }, createdAt: { $gte: startDate } }),
    Transaction.countDocuments({ fraudScore: { $lt: 0.6 }, createdAt: { $gte: startDate } }),
    Transaction.find({ fraudScore: { $gte: 0.6 }, createdAt: { $gte: startDate } })
      .sort({ fraudScore: -1 })
      .limit(20)
      .lean()
  ]);

  // Aggregate flags
  const flagCounts = {};
  flagged.forEach(t => {
    (t.fraudFlags || []).forEach(flag => {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    });
  });

  res.json({
    success: true,
    analytics: {
      period,
      riskDistribution: { high: highRisk, medium: mediumRisk, low: lowRisk },
      topFlags: Object.entries(flagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([flag, count]) => ({ flag, count }))
    }
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4070;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Payments Brain Service started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();

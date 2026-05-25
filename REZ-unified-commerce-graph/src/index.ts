/**
 * REZ Unified Commerce Graph
 *
 * Single graph combining:
 * - Customer (identity, behavior, preferences)
 * - Merchant (intelligence, offers, performance)
 * - Location (geofencing, patterns, proximity)
 * - Transaction (purchases, visits, spend)
 * - Loyalty (coins, badges, rewards)
 * - Campaigns (ads, offers, attribution)
 *
 * This is the brain of the hyperlocal commerce network.
 */

import express, { Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4170', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-unified-commerce-graph';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// GRAPH SCHEMAS
// ============================================

// Customer Node
interface ICustomerNode extends Document {
  userId: string;
  phone?: string;
  email?: string;
  deviceIds: string[];
  walletIds: string[];
  segments: string[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue: number;
  totalSpend: number;
  visitCount: number;
  avgBill: number;
  lastVisit: Date;
  interests: string[];
  location: { lat: number; lng: number };
  behaviors: {
    visitFrequency: number;
    preferredTime: string;
    preferredDays: string[];
    categoryAffinity: Record<string, number>;
    spendTendency: 'low' | 'medium' | 'high';
  };
  predictions: {
    churnRisk: number;
    ltvScore: number;
    revisitProbability: number;
    spendProbability: number;
  };
  loyalty: {
    coins: number;
    expiringCoins: number;
    coinExpiryDate?: Date;
    streak: number;
    badges: string[];
  };
  lifecycle: {
    birthday?: Date;
    anniversary?: Date;
    signupDate: Date;
    lastActive: Date;
    inactivityDays: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomerNode>({
  userId: { type: String, required: true, unique: true, index: true },
  phone: String,
  email: String,
  deviceIds: [String],
  walletIds: [String],
  segments: [String],
  tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  lifetimeValue: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  visitCount: { type: Number, default: 0 },
  avgBill: { type: Number, default: 0 },
  lastVisit: Date,
  interests: [String],
  location: {
    lat: Number,
    lng: Number
  },
  behaviors: {
    visitFrequency: Number,
    preferredTime: String,
    preferredDays: [String],
    categoryAffinity: { type: Map, of: Number },
    spendTendency: String
  },
  predictions: {
    churnRisk: Number,
    ltvScore: Number,
    revisitProbability: Number,
    spendProbability: Number
  },
  loyalty: {
    coins: Number,
    expiringCoins: Number,
    coinExpiryDate: Date,
    streak: Number,
    badges: [String]
  },
  lifecycle: {
    birthday: Date,
    anniversary: Date,
    signupDate: Date,
    lastActive: Date,
    inactivityDays: Number
  }
}, { timestamps: true });

customerSchema.index({ 'location.lat': 1, 'location.lng': 1 });
customerSchema.index({ 'behaviors.categoryAffinity': 1 });
customerSchema.index({ tier: 1, lifetimeValue: -1 });

// Merchant Node
interface IMerchantNode extends Document {
  merchantId: string;
  name: string;
  category: string;
  subcategory: string;
  location: { lat: number; lng: number; address: string; area: string };
  tier: 'basic' | 'standard' | 'premium' | 'elite';
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    totalCustomers: number;
    repeatCustomerRate: number;
    churnRate: number;
  };
  offers: {
    active: number;
    total: number;
    avgCashback: number;
  };
  competitors: string[];
  targetAudience: string[];
  peakHours: string[];
  createdAt: Date;
  updatedAt: Date;
}

const merchantSchema = new Schema<IMerchantNode>({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,
  category: { type: String, required: true, index: true },
  subcategory: String,
  location: {
    lat: Number,
    lng: Number,
    address: String,
    area: String
  },
  tier: { type: String, enum: ['basic', 'standard', 'premium', 'elite'], default: 'basic' },
  metrics: {
    totalRevenue: Number,
    totalOrders: Number,
    avgOrderValue: Number,
    totalCustomers: Number,
    repeatCustomerRate: Number,
    churnRate: Number
  },
  offers: {
    active: Number,
    total: Number,
    avgCashback: Number
  },
  competitors: [String],
  targetAudience: [String],
  peakHours: [String]
}, { timestamps: true });

merchantSchema.index({ 'location.area': 1 });
merchantSchema.index({ category: 1, 'metrics.totalRevenue': -1 });

// Transaction Edge
interface ITransactionEdge extends Document {
  customerId: string;
  merchantId: string;
  transactionId: string;
  type: 'visit' | 'purchase' | 'redemption' | 'refund';
  amount: number;
  category: string;
  items: string[];
  paymentMethod: string;
  coinsEarned: number;
  cashbackEarned: number;
  campaignId?: string;
  attributionChannel?: string;
  timestamp: Date;
}

const transactionSchema = new Schema<ITransactionEdge>({
  customerId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  transactionId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['visit', 'purchase', 'redemption', 'refund'] },
  amount: Number,
  category: String,
  items: [String],
  paymentMethod: String,
  coinsEarned: Number,
  cashbackEarned: Number,
  campaignId: String,
  attributionChannel: String,
  timestamp: { type: Date, default: Date.now }
});

transactionSchema.index({ customerId: 1, timestamp: -1 });
transactionSchema.index({ merchantId: 1, timestamp: -1 });

// CrossSell Relationship
interface ICrossSellRelationship extends Document {
  fromMerchantId: string;
  toMerchantId: string;
  fromCategory: string;
  toCategory: string;
  strength: number;
  avgConversionRate: number;
  avgOrderValue: number;
  customerOverlap: number;
}

const crossSellSchema = new Schema<ICrossSellRelationship>({
  fromMerchantId: String,
  toMerchantId: String,
  fromCategory: String,
  toCategory: String,
  strength: Number,
  avgConversionRate: Number,
  avgOrderValue: Number,
  customerOverlap: Number
});

crossSellSchema.index({ fromMerchantId: 1, strength: -1 });
crossSellSchema.index({ fromCategory: 1, toCategory: 1 });

// ============================================
// MODELS
// ============================================

const Customer = mongoose.model<ICustomerNode>('Customer', customerSchema);
const Merchant = mongoose.model<IMerchantNode>('Merchant', merchantSchema);
const Transaction = mongoose.model<ITransactionEdge>('Transaction', transactionSchema);
const CrossSell = mongoose.model<ICrossSellRelationship>('CrossSell', crossSellSchema);

// ============================================
// HEALTH
// ============================================

app.get('/health', async (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const counts = await Promise.all([
    Customer.countDocuments(),
    Merchant.countDocuments(),
    Transaction.countDocuments(),
    CrossSell.countDocuments()
  ]);

  res.json({
    status: 'healthy',
    service: 'REZ-unified-commerce-graph',
    version: '1.0.0',
    database: dbStatus,
    counts: {
      customers: counts[0],
      merchants: counts[1],
      transactions: counts[2],
      crossSells: counts[3]
    }
  });
});

// ============================================
// CUSTOMER APIs
// ============================================

// Get customer 360
app.get('/api/customers/:userId', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ userId: req.params.userId });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get recent transactions
    const recentTransactions = await Transaction.find({ customerId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(20);

    // Get predicted cross-sells
    const crossSells = await CrossSell.find({
      fromMerchantId: { $in: recentTransactions.map(t => t.merchantId) }
    }).sort({ strength: -1 }).limit(5);

    res.json({
      success: true,
      data: {
        customer,
        recentTransactions,
        crossSellOpportunities: crossSells
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Update customer predictions
app.patch('/api/customers/:userId/predictions', async (req: Request, res: Response) => {
  try {
    const { churnRisk, ltvScore, revisitProbability, spendProbability } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { userId: req.params.userId },
      {
        $set: {
          'predictions.churnRisk': churnRisk,
          'predictions.ltvScore': ltvScore,
          'predictions.revisitProbability': revisitProbability,
          'predictions.spendProbability': spendProbability
        }
      },
      { new: true }
    );

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// MERCHANT APIs
// ============================================

// Get merchant intelligence
app.get('/api/merchants/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchant = await Merchant.findOne({ merchantId: req.params.merchantId });
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    // Get recent transactions
    const recentTransactions = await Transaction.find({ merchantId: req.params.merchantId })
      .sort({ timestamp: -1 })
      .limit(20);

    // Get cross-sell partners
    const crossSellPartners = await CrossSell.find({ fromMerchantId: req.params.merchantId })
      .sort({ strength: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        merchant,
        recentTransactions,
        crossSellPartners
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// TRANSACTION APIs
// ============================================

// Record transaction
app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();

    // Update customer metrics
    await Customer.findOneAndUpdate(
      { userId: transaction.customerId },
      {
        $inc: { visitCount: 1, totalSpend: transaction.amount },
        $set: { lastVisit: transaction.timestamp, 'lifecycle.lastActive': new Date() }
      }
    );

    // Update merchant metrics
    await Merchant.findOneAndUpdate(
      { merchantId: transaction.merchantId },
      {
        $inc: { 'metrics.totalOrders': 1, 'metrics.totalRevenue': transaction.amount }
      }
    );

    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// CROSS-SELL APIs
// ============================================

// Get cross-sell recommendations for customer
app.get('/api/customers/:userId/cross-sells', async (req: Request, res: Response) => {
  try {
    const { category, limit = 10 } = req.query;

    // Get customer's visited merchants
    const visitedTransactions = await Transaction.find({ customerId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(50);

    const visitedMerchantIds = [...new Set(visitedTransactions.map(t => t.merchantId))];

    // Find cross-sell opportunities
    const crossSells = await CrossSell.find({
      fromMerchantId: { $in: visitedMerchantIds },
      ...(category && { toCategory: category })
    })
      .sort({ strength: -1 })
      .limit(parseInt(limit as string))
      .populate('fromMerchantId toMerchantId');

    // Get merchant details
    const toMerchantIds = crossSells.map(cs => cs.toMerchantId);
    const merchants = await Merchant.find({ merchantId: { $in: toMerchantIds } });

    const recommendations = crossSells.map(cs => {
      const merchant = merchants.find(m => m.merchantId === cs.toMerchantId);
      return {
        fromCategory: cs.fromCategory,
        toCategory: cs.toCategory,
        reason: `Customers who visit ${cs.fromCategory} also like ${cs.toCategory}`,
        merchant,
        conversionRate: cs.avgConversionRate,
        avgOrderValue: cs.avgOrderValue
      };
    });

    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// MOMENT-BASED TARGETING APIs
// ============================================

// Get moment triggers for user
app.get('/api/customers/:userId/moments', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findOne({ userId: req.params.userId });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const moments: unknown[] = [];

    // 1. Coin expiry trigger
    if (customer.loyalty.expiringCoins > 0) {
      const daysUntilExpiry = customer.loyalty.coinExpiryDate
        ? Math.ceil((customer.loyalty.coinExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 30;

      moments.push({
        type: 'coin_expiry',
        urgency: daysUntilExpiry <= 7 ? 'high' : 'medium',
        data: {
          expiringCoins: customer.loyalty.expiringCoins,
          daysUntilExpiry
        },
        action: 'Show nearby merchants with coin-earning offers'
      });
    }

    // 2. Streak at risk trigger
    if (customer.loyalty.streak >= 5 && customer.behaviors.visitFrequency > 0) {
      const expectedDaysSinceVisit = Math.ceil(1 / customer.behaviors.visitFrequency);
      if (customer.lifecycle.inactivityDays >= expectedDaysSinceVisit * 0.8) {
        moments.push({
          type: 'streak_risk',
          urgency: 'high',
          data: {
            streak: customer.loyalty.streak,
            daysSinceVisit: customer.lifecycle.inactivityDays,
            preferredTime: customer.behaviors.preferredTime,
            preferredDays: customer.behaviors.preferredDays
          },
          action: 'Send reminder to maintain streak'
        });
      }
    }

    // 3. Birthday trigger (within 7 days)
    if (customer.lifecycle.birthday) {
      const daysUntilBirthday = getDaysUntil(customer.lifecycle.birthday);
      if (daysUntilBirthday <= 7) {
        moments.push({
          type: 'birthday',
          urgency: 'high',
          data: {
            daysUntil: daysUntilBirthday
          },
          action: 'Show birthday rewards at favorite merchants'
        });
      }
    }

    // 4. Churn risk trigger
    if (customer.predictions.churnRisk > 0.7) {
      moments.push({
        type: 'churn_risk',
        urgency: 'high',
        data: {
          risk: customer.predictions.churnRisk
        },
        action: 'Offer retention incentives'
      });
    }

    // 5. High-value customer trigger
    if (customer.predictions.spendProbability > 0.8) {
      moments.push({
        type: 'high_spender',
        urgency: 'medium',
        data: {
          avgBill: customer.avgBill,
          tier: customer.tier
        },
        action: 'Show premium merchant offers'
      });
    }

    res.json({ success: true, data: moments });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// NEARBY MERCHANTS APIs
// ============================================

// Get nearby merchants with offers
app.get('/api/location/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5, category, userId } = req.query;

    // Get customer's category preferences
    let preferredCategories: string[] = [];
    if (userId) {
      const customer = await Customer.findOne({ userId: userId as string });
      if (customer) {
        const affinity = customer.behaviors.categoryAffinity;
        preferredCategories = Object.entries(affinity || {})
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([cat]) => cat);
      }
    }

    // Find merchants within radius (using simple bounding box)
    const radiusKm = parseFloat(radius as string);
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(parseFloat(lat as string) * Math.PI / 180));

    const merchants = await Merchant.find({
      'location.lat': {
        $gte: parseFloat(lat as string) - latDelta,
        $lte: parseFloat(lat as string) + latDelta
      },
      'location.lng': {
        $gte: parseFloat(lng as string) - lngDelta,
        $lte: parseFloat(lng as string) + lngDelta
      },
      ...(category && { category: category })
    }).limit(50);

    // Score by relevance
    const scored = merchants.map(m => {
      let score = 50; // Base score

      // Boost if matches customer preference
      if (preferredCategories.includes(m.category)) {
        score += 30;
      }

      // Boost if has active offers
      if (m.offers.active > 0) {
        score += 15;
      }

      // Boost for premium tier
      if (m.tier === 'elite') score += 5;

      return {
        ...m.toObject(),
        distance: calculateDistance(
          parseFloat(lat as string),
          parseFloat(lng as string),
          m.location.lat,
          m.location.lng
        ),
        relevanceScore: score
      };
    });

    // Sort by relevance score
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({ success: true, data: scored });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// AD DECISION APIs
// ============================================

// Get ad decisions for user moment
app.post('/api/ads/decide', async (req: Request, res: Response) => {
  try {
    const { userId, location, moment } = req.body;

    const customer = await Customer.findOne({ userId });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const decisions: unknown[] = [];

    // Decision 1: Cross-sell opportunity
    if (moment === 'idle' || moment === 'nearby') {
      const crossSells = await CrossSell.find({
        fromCategory: { $in: Object.keys(customer.behaviors.categoryAffinity || {})
      })
        .sort({ strength: -1 })
        .limit(3);

      for (const cs of crossSells) {
        const merchant = await Merchant.findOne({ category: cs.toCategory, tier: { $in: ['premium', 'elite'] } });
        if (merchant) {
          decisions.push({
            type: 'cross_sell',
            merchant,
            bidAmount: Math.round(customer.avgBill * 0.05 * 100) / 100,
            targetingReason: `Cross-sell from ${cs.fromCategory} to ${cs.toCategory}`,
            cashbackOffer: Math.round(customer.avgBill * 0.1 * 100) / 100
          });
        }
      }
    }

    // Decision 2: Coin expiry
    if (customer.loyalty.expiringCoins > 0) {
      const nearbyMerchants = await Merchant.find({
        'location.lat': { $exists: true },
        'offers.active': { $gt: 0 }
      }).limit(5);

      for (const merchant of nearbyMerchants) {
        decisions.push({
          type: 'coin_retention',
          merchant,
          bidAmount: customer.loyalty.expiringCoins * 0.01,
          targetingReason: `User has ${customer.loyalty.expiringCoins} coins expiring`,
          cashbackOffer: customer.loyalty.expiringCoins * 0.5
        });
      }
    }

    // Decision 3: Churn risk
    if (customer.predictions.churnRisk > 0.5) {
      const topCategories = Object.entries(customer.behaviors.categoryAffinity || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 2)
        .map(([cat]) => cat);

      const merchants = await Merchant.find({
        category: { $in: topCategories },
        tier: 'elite'
      }).limit(3);

      for (const merchant of merchants) {
        decisions.push({
          type: 'churn_prevention',
          merchant,
          bidAmount: customer.predictions.churnRisk * 10,
          targetingReason: 'High churn risk - retention offer',
          loyaltyBonus: 50
        });
      }
    }

    // Sort by bid amount (auction)
    decisions.sort((a, b) => b.bidAmount - a.bidAmount);

    res.json({
      success: true,
      data: {
        userId,
        moment,
        decisions: decisions.slice(0, 5),
        customer: {
          tier: customer.tier,
          lifetimeValue: customer.lifetimeValue,
          churnRisk: customer.predictions.churnRisk
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getDaysUntil(date: Date): number {
  const today = new Date();
  const target = new Date(date);
  target.setFullYear(today.getFullYear());
  if (target < today) target.setFullYear(today.getFullYear() + 1);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================
// START SERVER
// ============================================

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`REZ Unified Commerce Graph running on port ${PORT}`);
      logger.info(`
┌─────────────────────────────────────────────────────────┐
│         REZ UNIFIED COMMERCE GRAPH                      │
├─────────────────────────────────────────────────────────┤
│  Customer: Identity, Behavior, Predictions, Loyalty     │
│  Merchant: Intelligence, Offers, Performance          │
│  Transaction: Visits, Purchases, Attribution           │
│  CrossSell: Category Relationships, Conversion Rates   │
├─────────────────────────────────────────────────────────┤
│  MOMENT-BASED ADS API: /api/ads/decide                │
│  CROSS-SELL API: /api/customers/:id/cross-sells       │
│  NEARBY API: /api/location/nearby                    │
└─────────────────────────────────────────────────────────┘
      `);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

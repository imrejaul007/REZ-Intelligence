/**
 * REZ Predictive Engine - Spend Prediction Module
 *
 * Predicts likely bill amount/spend for users based on:
 * - Historical spending patterns
 * - Category preferences
 * - Time of day/week
 * - Location
 * - Seasonality
 * - Payday cycles
 * - Weather
 */

import express, { Request, Response } import logger from './utils/logger';
import from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-predictive-engine';

// ============================================
// SPEND PREDICTION TYPES
// ============================================

interface SpendPrediction {
  userId: string;
  predictedSpend: number;
  confidence: number;
  categoryBreakdown: {
    category: string;
    predictedAmount: number;
    confidence: number;
  }[];
  factors: {
    type: string;
    impact: number; // positive or negative
    description: string;
  }[];
  recommendations: {
    type: 'upsell' | 'cross_sell' | 'retention';
    targetCategory: string;
    suggestedAmount: number;
  }[];
}

interface TransactionRecord {
  userId: string;
  merchantId: string;
  category: string;
  subcategory: string;
  amount: number;
  dayOfWeek: number;
  hourOfDay: number;
  isPayday: boolean;
  daysSincePayday: number;
  season: string;
  weather?: string;
  locationArea?: string;
  timestamp: Date;
}

// ============================================
// SPEND PREDICTION SCHEMA
// ============================================

const spendPredictionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  predictedSpend: { type: Number, required: true },
  confidence: { type: Number, required: true }, // 0-1
  avgBill: { type: Number, default: 0 },
  maxBill: { type: Number, default: 0 },
  minBill: { type: Number, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  avgTransactionsPerWeek: { type: Number, default: 0 },
  categoryBreakdown: [{
    category: String,
    predictedAmount: Number,
    avgAmount: Number,
    frequency: Number,
    confidence: Number
  }],
  timePatterns: {
    preferredDays: [String],
    preferredTime: String,
    peakSpendDay: String,
    peakSpendTime: String
  },
  spendTendency: { type: String, enum: ['increasing', 'stable', 'decreasing'], default: 'stable' },
  lastUpdated: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  userId: String,
  merchantId: String,
  category: String,
  amount: Number,
  dayOfWeek: Number,
  hourOfDay: Number,
  isPayday: Boolean,
  timestamp: Date
}));

const SpendPrediction = mongoose.model('SpendPrediction', spendPredictionSchema);

// ============================================
// SPEND PREDICTION SERVICE
// ============================================

class SpendPredictor {
  /**
   * Predict spend for a user
   */
  async predict(userId: string, options: {
    category?: string;
    timeRange?: 'today' | 'week' | 'month';
  } = {}): Promise<SpendPrediction> {
    // Get historical transactions
    const transactions = await Transaction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);

    if (transactions.length === 0) {
      return this.getDefaultPrediction(userId);
    }

    // Calculate base metrics
    const { avgBill, maxBill, minBill } = this.calculateBillMetrics(transactions);
    const categoryBreakdown = this.calculateCategoryBreakdown(transactions);
    const timePatterns = this.calculateTimePatterns(transactions);
    const factors = this.identifySpendFactors(transactions);

    // Adjust prediction based on factors
    let prediction = avgBill;
    let confidence = 0.5 + (transactions.length / 200) * 0.4; // 0.5-0.9 based on history

    for (const factor of factors) {
      if (factor.type === 'payday') {
        prediction *= 1 + (factor.impact * 0.3);
        confidence += 0.05;
      } else if (factor.type === 'weekend') {
        prediction *= 1 + (factor.impact * 0.2);
      } else if (factor.type === 'seasonal') {
        prediction *= 1 + (factor.impact * 0.15);
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(categoryBreakdown, avgBill);

    return {
      userId,
      predictedSpend: Math.round(prediction * 100) / 100,
      confidence: Math.min(confidence, 0.95),
      categoryBreakdown,
      factors,
      recommendations
    };
  }

  /**
   * Predict spend for specific category
   */
  async predictByCategory(userId: string, category: string): Promise<{
    predictedAmount: number;
    confidence: number;
    avgAmount: number;
    frequency: number;
  }> {
    const transactions = await Transaction.find({ userId, category });

    if (transactions.length === 0) {
      return { predictedAmount: 0, confidence: 0, avgAmount: 0, frequency: 0 };
    }

    const amounts = transactions.map(t => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const frequency = transactions.length / this.weeksSinceFirst(transactions);

    return {
      predictedAmount: avgAmount,
      confidence: Math.min(0.5 + (transactions.length / 50) * 0.4, 0.9),
      avgAmount,
      frequency
    };
  }

  /**
   * Batch prediction for multiple users
   */
  async batchPredict(userIds: string[]): Promise<Map<string, SpendPrediction>> {
    const predictions = new Map<string, SpendPrediction>();

    await Promise.all(userIds.map(async (userId) => {
      const prediction = await this.predict(userId);
      predictions.set(userId, prediction);
    }));

    return predictions;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private calculateBillMetrics(transactions: unknown[]): {
    avgBill: number;
    maxBill: number;
    minBill: number;
  } {
    const amounts = transactions.map(t => t.amount);
    const avgBill = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxBill = Math.max(...amounts);
    const minBill = Math.min(...amounts);

    return { avgBill, maxBill, minBill };
  }

  private calculateCategoryBreakdown(transactions: unknown[]): SpendPrediction['categoryBreakdown'] {
    const categoryMap = new Map<string, { total: number; count: number }>();

    for (const t of transactions) {
      const existing = categoryMap.get(t.category) || { total: 0, count: 0 };
      categoryMap.set(t.category, {
        total: existing.total + t.amount,
        count: existing.count + 1
      });
    }

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      predictedAmount: data.total / data.count,
      avgAmount: data.total / data.count,
      frequency: data.count,
      confidence: Math.min(0.5 + (data.count / 20) * 0.4, 0.9)
    })).sort((a, b) => b.frequency - a.frequency);
  }

  private calculateTimePatterns(transactions: unknown[]): SpendPrediction['timePatterns'] {
    const dayTotals = new Map<string, { total: number; count: number }>();
    const hourTotals = new Map<number, { total: number; count: number }>();

    for (const t of transactions) {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.dayOfWeek];

      const dayStats = dayTotals.get(dayName) || { total: 0, count: 0 };
      dayTotals.set(dayName, { total: dayStats.total + t.amount, count: dayStats.count + 1 });

      const hourStats = hourTotals.get(t.hourOfDay) || { total: 0, count: 0 };
      hourTotals.set(t.hourOfDay, { total: hourStats.total + t.amount, count: hourStats.count + 1 });
    }

    const preferredDays = Array.from(dayTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 3)
      .map(([day]) => day);

    const peakSpendDay = preferredDays[0];

    const peakSpendTime = Array.from(hourTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)[0]?.[0];

    const preferredTime = peakSpendTime !== undefined
      ? peakSpendTime < 12 ? 'morning' : peakSpendTime < 17 ? 'afternoon' : 'evening'
      : 'evening';

    return {
      preferredDays,
      preferredTime,
      peakSpendDay,
      peakSpendTime: peakSpendTime !== undefined ? `${peakSpendTime}:00` : undefined
    };
  }

  private identifySpendFactors(transactions: unknown[]): SpendPrediction['factors'] {
    const factors: SpendPrediction['factors'] = [];

    // Check for payday effect
    const paydayTransactions = transactions.filter(t => t.isPayday);
    if (paydayTransactions.length >= 2) {
      const paydayAvg = paydayTransactions.reduce((a, b) => a + b.amount, 0) / paydayTransactions.length;
      const normalAvg = transactions.reduce((a, b) => a + b.amount, 0) / transactions.length;
      const impact = (paydayAvg - normalAvg) / normalAvg;

      if (Math.abs(impact) > 0.1) {
        factors.push({
          type: 'payday',
          impact: impact > 0 ? 1 : -1,
          description: `Spend ${impact > 0 ? 'increases' : 'decreases'} by ${Math.round(Math.abs(impact) * 100)}% on payday`
        });
      }
    }

    // Check for weekend effect
    const weekendTransactions = transactions.filter(t => t.dayOfWeek === 0 || t.dayOfWeek === 6);
    const weekdayTransactions = transactions.filter(t => t.dayOfWeek > 0 && t.dayOfWeek < 6);

    if (weekendTransactions.length >= 3 && weekdayTransactions.length >= 3) {
      const weekendAvg = weekendTransactions.reduce((a, b) => a + b.amount, 0) / weekendTransactions.length;
      const weekdayAvg = weekdayTransactions.reduce((a, b) => a + b.amount, 0) / weekdayTransactions.length;
      const impact = (weekendAvg - weekdayAvg) / weekdayAvg;

      if (Math.abs(impact) > 0.1) {
        factors.push({
          type: 'weekend',
          impact: impact > 0 ? 1 : -1,
          description: `Weekend spend is ${impact > 0 ? 'higher' : 'lower'} by ${Math.round(Math.abs(impact) * 100)}%`
        });
      }
    }

    // Check for seasonal trend
    const recentTransactions = transactions.slice(0, Math.ceil(transactions.length / 2));
    const olderTransactions = transactions.slice(Math.ceil(transactions.length / 2));

    if (recentTransactions.length >= 5 && olderTransactions.length >= 5) {
      const recentAvg = recentTransactions.reduce((a, b) => a + b.amount, 0) / recentTransactions.length;
      const olderAvg = olderTransactions.reduce((a, b) => a + b.amount, 0) / olderTransactions.length;
      const trend = (recentAvg - olderAvg) / olderAvg;

      factors.push({
        type: 'trend',
        impact: trend,
        description: `Spend is ${trend > 0 ? 'increasing' : 'decreasing'} by ${Math.round(trend * 100)}%`
      });
    }

    return factors;
  }

  private generateRecommendations(
    categoryBreakdown: SpendPrediction['categoryBreakdown'],
    avgBill: number
  ): SpendPrediction['recommendations'] {
    const recommendations: SpendPrediction['recommendations'] = [];

    // Find top category for upsell
    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      recommendations.push({
        type: 'upsell',
        targetCategory: topCategory.category,
        suggestedAmount: topCategory.avgAmount * 1.15 // 15% higher
      });
    }

    // Find underused category for cross-sell
    if (categoryBreakdown.length > 1) {
      const lowCategory = categoryBreakdown[categoryBreakdown.length - 1];
      recommendations.push({
        type: 'cross_sell',
        targetCategory: lowCategory.category,
        suggestedAmount: lowCategory.avgAmount
      });
    }

    return recommendations;
  }

  private weeksSinceFirst(transactions: unknown[]): number {
    if (transactions.length === 0) return 1;
    const first = transactions[transactions.length - 1].timestamp;
    const days = (Date.now() - new Date(first).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(1, days / 7);
  }

  private getDefaultPrediction(userId: string): SpendPrediction {
    return {
      userId,
      predictedSpend: 0,
      confidence: 0,
      categoryBreakdown: [],
      factors: [{
        type: 'new_user',
        impact: 0,
        description: 'New user with no transaction history'
      }],
      recommendations: []
    };
  }
}

const spendPredictor = new SpendPredictor();

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  res.json({
    status: 'healthy',
    service: 'spend-predictor',
    database: dbStatus
  });
});

// Predict spend for user
app.post('/api/predict/spend', async (req: Request, res: Response) => {
  try {
    const { userId, category, timeRange } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const prediction = await spendPredictor.predict(userId, { category, timeRange });

    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Predict spend by category
app.post('/api/predict/spend/category', async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.body;

    if (!userId || !category) {
      return res.status(400).json({ success: false, error: 'userId and category are required' });
    }

    const prediction = await spendPredictor.predictByCategory(userId, category);

    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Batch prediction
app.post('/api/predict/spend/batch', async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ success: false, error: 'userIds array is required' });
    }

    const predictions = await spendPredictor.batchPredict(userIds);
    const result: Record<string, SpendPrediction> = {};
    predictions.forEach((value, key) => {
      result[key] = value;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// START
// ============================================

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Spend Predictor connected to MongoDB');

    const PORT = parseInt(process.env.PORT || '4147', 10);
    app.listen(PORT, () => {
      logger.info(`Spend Predictor running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

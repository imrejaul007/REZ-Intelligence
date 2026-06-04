/**
 * REZ Merchant Health Score Service
 * Composite score based on revenue, churn, engagement, and growth
 *
 * Features:
 * - Multi-dimensional health scoring
 * - Industry benchmarking
 * - Risk alerts
 * - Growth recommendations
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

const healthScoreSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, index: true },
  score: { type: Number, required: true }, // 0-100
  tier: { type: String, enum: ['platinum', 'gold', 'silver', 'bronze', 'at_risk'], required: true },

  // Component scores
  components: {
    revenue: {
      score: Number,
      trend: Number, // percentage change
      benchmark: Number
    },
    customer: {
      score: Number,
      newCustomers: Number,
      returningCustomers: Number,
      churnRate: Number
    },
    engagement: {
      score: Number,
      loyaltyMembers: Number,
      referralRate: Number,
      reviewScore: Number
    },
    growth: {
      score: Number,
      mrrGrowth: Number,
      customerGrowth: Number,
      aovGrowth: Number
    },
    operational: {
      score: Number,
      avgOrderTime: Number,
      fulfillmentRate: Number,
      complaintRate: Number
    }
  },

  // Risk factors
  risks: [{
    type: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    description: String,
    recommendation: String
  }],

  // Industry comparison
  industry: String,
  industryRank: Number,
  industryPercentile: Number,

  // Historical
  history: [{
    date: Date,
    score: Number,
    tier: String
  }],

  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const HealthScore = mongoose.model('HealthScore', healthScoreSchema);

// ============== TYPES ==============

interface MerchantMetrics {
  merchantId: string;
  industry: string;

  // Revenue metrics
  revenue: {
    current: number;
    previous: number;
    target: number;
  };

  // Customer metrics
  customers: {
    total: number;
    new: number;
    active: number;
    churned: number;
    returning: number;
  };

  // Engagement metrics
  engagement: {
    loyaltyMembers: number;
    referrals: number;
    reviews: number;
    avgRating: number;
    positiveReviews: number;
  };

  // Operational metrics
  operational: {
    avgOrderValue: number;
    ordersPerDay: number;
    fulfillmentRate: number;
    avgDeliveryTime: number;
    complaints: number;
  };

  // Marketing metrics
  marketing: {
    campaignSpend: number;
    campaignRevenue: number;
    roas: number;
    channelMix: Record<string, number>;
  };
}

// ============== SERVICE ==============

class MerchantHealthScoreService {
  private app: express.Application;

  // Scoring weights (must sum to 100)
  private readonly WEIGHTS = {
    revenue: 30,
    customer: 25,
    engagement: 20,
    growth: 15,
    operational: 10
  };

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', service: 'merchant-health-score' });
    });

    // Calculate health score
    this.app.post('/api/score', async (req: Request, res: Response) => {
      try {
        const metrics: MerchantMetrics = req.body;
        const score = await this.calculateScore(metrics);
        res.json(score);
      } catch (error) {
        res.status(500).json({ error: 'Failed to calculate score' });
      }
    });

    // Get health score
    this.app.get('/api/score/:merchantId', async (req: Request, res: Response) => {
      try {
        const score = await HealthScore.findOne({ merchantId: req.params.merchantId });
        if (!score) {
          return res.status(404).json({ error: 'Score not found. Calculate first.' });
        }
        res.json(score);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch score' });
      }
    });

    // Get all scores (with filters)
    this.app.get('/api/scores', async (req: Request, res: Response) => {
      try {
        const { tier, industry, minScore, limit } = req.query;

        const query: any = {};
        if (tier) query.tier = tier;
        if (industry) query.industry = industry;
        if (minScore) query.score = { $gte: Number(minScore) };

        const scores = await HealthScore.find(query)
          .sort({ score: -1 })
          .limit(Number(limit) || 100)
          .lean();

        res.json(scores);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scores' });
      }
    });

    // Get score history
    this.app.get('/api/score/:merchantId/history', async (req: Request, res: Response) => {
      try {
        const score = await HealthScore.findOne({ merchantId: req.params.merchantId });
        res.json(score?.history || []);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
      }
    });

    // Get risk alerts
    this.app.get('/api/alerts/:merchantId', async (req: Request, res: Response) => {
      try {
        const score = await HealthScore.findOne({ merchantId: req.params.merchantId });
        res.json(score?.risks || []);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
      }
    });

    // Get industry benchmarks
    this.app.get('/api/benchmarks/:industry', async (req: Request, res: Response) => {
      try {
        const scores = await HealthScore.find({ industry: req.params.industry });

        if (scores.length === 0) {
          return res.json({ message: 'No data for this industry yet' });
        }

        const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        const scoreDistribution = {
          platinum: scores.filter(s => s.tier === 'platinum').length,
          gold: scores.filter(s => s.tier === 'gold').length,
          silver: scores.filter(s => s.tier === 'silver').length,
          bronze: scores.filter(s => s.tier === 'bronze').length,
          at_risk: scores.filter(s => s.tier === 'at_risk').length
        };

        res.json({
          industry: req.params.industry,
          merchantCount: scores.length,
          averageScore: avgScore,
          distribution: scoreDistribution
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch benchmarks' });
      }
    });

    // Batch calculate scores
    this.app.post('/api/score/batch', async (req: Request, res: Response) => {
      try {
        const metricsList: MerchantMetrics[] = req.body;
        const results = [];

        for (const metrics of metricsList) {
          const score = await this.calculateScore(metrics);
          results.push(score);
        }

        res.json(results);
      } catch (error) {
        res.status(500).json({ error: 'Failed to batch calculate' });
      }
    });
  }

  /**
   * Calculate composite health score
   */
  async calculateScore(metrics: MerchantMetrics): Promise<any> {
    const { WEIGHTS } = this;

    // Calculate component scores (0-100)
    const revenueScore = this.scoreRevenue(metrics);
    const customerScore = this.scoreCustomers(metrics);
    const engagementScore = this.scoreEngagement(metrics);
    const growthScore = this.scoreGrowth(metrics);
    const operationalScore = this.scoreOperational(metrics);

    // Weighted total
    const totalScore = Math.round(
      (revenueScore * WEIGHTS.revenue +
        customerScore * WEIGHTS.customer +
        engagementScore * WEIGHTS.engagement +
        growthScore * WEIGHTS.growth +
        operationalScore * WEIGHTS.operational) / 100
    );

    // Determine tier
    const tier = this.getTier(totalScore);

    // Detect risks
    const risks = this.detectRisks(metrics, {
      revenue: revenueScore,
      customer: customerScore,
      engagement: engagementScore,
      growth: growthScore,
      operational: operationalScore
    });

    // Get existing score for history
    const existing = await HealthScore.findOne({ merchantId: metrics.merchantId });

    // Create/update score
    const scoreData: any = {
      merchantId: metrics.merchantId,
      score: totalScore,
      tier,
      components: {
        revenue: {
          score: revenueScore,
          trend: this.calculateTrend(metrics.revenue.current, metrics.revenue.previous),
          benchmark: 70 // Target
        },
        customer: {
          score: customerScore,
          newCustomers: metrics.customers.new,
          returningCustomers: metrics.customers.returning,
          churnRate: metrics.customers.churned / metrics.customers.total * 100
        },
        engagement: {
          score: engagementScore,
          loyaltyMembers: metrics.engagement.loyaltyMembers,
          referralRate: metrics.engagement.referrals / metrics.customers.total * 100,
          reviewScore: metrics.engagement.avgRating
        },
        growth: {
          score: growthScore,
          mrrGrowth: this.calculateTrend(metrics.revenue.current, metrics.revenue.previous),
          customerGrowth: this.calculateTrend(metrics.customers.total, metrics.customers.total - metrics.customers.new),
          aovGrowth: 0 // Would need historical AOV
        },
        operational: {
          score: operationalScore,
          avgOrderTime: metrics.operational.avgDeliveryTime,
          fulfillmentRate: metrics.operational.fulfillmentRate,
          complaintRate: metrics.operational.complaints / metrics.operational.ordersPerDay * 100
        }
      },
      risks,
      industry: metrics.industry,
      history: existing?.history || []
    };

    // Add to history if score changed
    if (!existing || existing.score !== totalScore) {
      scoreData.history = [
        ...(existing?.history || []),
        { date: new Date(), score: totalScore, tier }
      ].slice(-30); // Keep last 30 entries
    }

    // Calculate industry rank
    const betterCount = await HealthScore.countDocuments({
      industry: metrics.industry,
      score: { $gt: totalScore }
    });
    const sameIndustry = await HealthScore.countDocuments({ industry: metrics.industry });
    scoreData.industryRank = betterCount + 1;
    scoreData.industryPercentile = sameIndustry > 0
      ? Math.round(((sameIndustry - betterCount) / sameIndustry) * 100)
      : 100;

    // Save
    const score = await HealthScore.findOneAndUpdate(
      { merchantId: metrics.merchantId },
      scoreData,
      { upsert: true, new: true }
    );

    return score;
  }

  private scoreRevenue(m: MerchantMetrics): number {
    const targetAchievement = m.revenue.current / m.revenue.target;
    const trend = this.calculateTrend(m.revenue.current, m.revenue.previous);

    // Score based on target achievement and trend
    let score = Math.min(100, targetAchievement * 70 + 30);

    // Adjust for trend
    if (trend > 10) score = Math.min(100, score + 10);
    else if (trend > 5) score = Math.min(100, score + 5);
    else if (trend < -10) score = Math.max(0, score - 15);
    else if (trend < -5) score = Math.max(0, score - 8);

    return Math.round(score);
  }

  private scoreCustomers(m: MerchantMetrics): number {
    const { customers } = m;

    // Churn rate scoring (inverse - lower is better)
    const churnRate = customers.churned / customers.total;
    let churnScore = Math.max(0, 100 - churnRate * 200);

    // Retention rate
    const retentionRate = customers.returning / customers.total;
    let retentionScore = retentionRate * 100;

    // New customer acquisition
    const acquisitionRate = customers.new / customers.total;
    let acquisitionScore = acquisitionRate * 100;

    // Weighted average
    const score = (churnScore * 0.4 + retentionScore * 0.35 + acquisitionScore * 0.25);

    return Math.round(Math.min(100, score));
  }

  private scoreEngagement(m: MerchantMetrics): number {
    const { engagement, customers } = m;

    // Loyalty participation
    const loyaltyRate = engagement.loyaltyMembers / customers.total;
    let loyaltyScore = Math.min(100, loyaltyRate * 200);

    // Referral rate
    const referralRate = engagement.referrals / customers.total;
    let referralScore = Math.min(100, referralRate * 300);

    // Review health
    const reviewScore = engagement.avgRating * 20; // 5 * 20 = 100
    const positiveRate = engagement.positiveReviews / (engagement.reviews || 1);
    let sentimentScore = reviewScore * (0.5 + positiveRate * 0.5);

    return Math.round((loyaltyScore * 0.4 + referralScore * 0.3 + sentimentScore * 0.3));
  }

  private scoreGrowth(m: MerchantMetrics): number {
    const trend = this.calculateTrend(m.revenue.current, m.revenue.previous);
    const customerGrowth = this.calculateTrend(
      m.customers.total,
      m.customers.total - m.customers.new
    );

    // Base score from revenue trend
    let score = 50 + trend * 2;

    // Add customer growth factor
    score += customerGrowth * 0.5;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private scoreOperational(m: MerchantMetrics): number {
    const { operational } = m;

    // Fulfillment rate (higher is better)
    let fulfillmentScore = operational.fulfillmentRate;

    // Delivery time (lower is better)
    const idealTime = 30; // minutes
    const deliveryScore = Math.max(0, 100 - (operational.avgDeliveryTime - idealTime) * 2);

    // Complaint rate (lower is better)
    const idealComplaints = 0;
    const complaintScore = Math.max(0, 100 - operational.complaints * 5);

    // AOV performance
    const aovScore = Math.min(100, operational.avgOrderValue / 10);

    return Math.round(
      fulfillmentScore * 0.3 +
      deliveryScore * 0.25 +
      complaintScore * 0.25 +
      aovScore * 0.2
    );
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getTier(score: number): string {
    if (score >= 90) return 'platinum';
    if (score >= 75) return 'gold';
    if (score >= 60) return 'silver';
    if (score >= 40) return 'bronze';
    return 'at_risk';
  }

  private detectRisks(m: MerchantMetrics, scores: Record<string, number>): any[] {
    const risks = [];

    // High churn
    const churnRate = m.customers.churned / m.customers.total;
    if (churnRate > 0.2) {
      risks.push({
        type: 'high_churn',
        severity: 'critical',
        description: `Churn rate is ${(churnRate * 100).toFixed(1)}% - exceeding 20% threshold`,
        recommendation: 'Launch customer retention campaign and loyalty upgrade offer'
      });
    } else if (churnRate > 0.1) {
      risks.push({
        type: 'moderate_churn',
        severity: 'high',
        description: `Churn rate at ${(churnRate * 100).toFixed(1)}% - monitor closely`,
        recommendation: 'Consider win-back campaign for at-risk customers'
      });
    }

    // Declining revenue
    const revenueTrend = this.calculateTrend(m.revenue.current, m.revenue.previous);
    if (revenueTrend < -20) {
      risks.push({
        type: 'revenue_decline',
        severity: 'critical',
        description: `Revenue declined ${Math.abs(revenueTrend).toFixed(1)}% month-over-month`,
        recommendation: 'Review pricing, launch acquisition campaign, analyze competitive landscape'
      });
    }

    // Low engagement
    if (scores.engagement < 40) {
      risks.push({
        type: 'low_engagement',
        severity: 'high',
        description: 'Customer engagement score is below 40',
        recommendation: 'Launch referral program and review request campaign'
      });
    }

    // High complaints
    if (m.operational.complaints > m.operational.ordersPerDay * 0.05) {
      risks.push({
        type: 'quality_issues',
        severity: 'high',
        description: 'Complaint rate exceeds 5% of orders',
        recommendation: 'Review operational processes, address root cause of complaints'
      });
    }

    // Low loyalty participation
    const loyaltyRate = m.engagement.loyaltyMembers / m.customers.total;
    if (loyaltyRate < 0.1) {
      risks.push({
        type: 'low_loyalty',
        severity: 'medium',
        description: 'Less than 10% of customers are loyalty members',
        recommendation: 'Launch loyalty program with attractive sign-up incentive'
      });
    }

    return risks;
  }

  async start(port: number = 4293): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_merchant_health'
      );
      console.log('[MerchantHealthScore] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[MerchantHealthScore] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[MerchantHealthScore] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new MerchantHealthScoreService();
service.start(4293);

export default service;

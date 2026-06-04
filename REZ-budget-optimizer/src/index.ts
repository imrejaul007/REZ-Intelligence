/**
 * REZ Budget Optimizer Service
 * AI-powered campaign budget allocation and optimization across channels
 *
 * Features:
 * - Automatic budget allocation based on ROI
 * - Channel performance optimization
 * - Real-time budget reallocation
 * - A/B testing for budget allocation
 */

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  channel: {
    type: String,
    enum: ['instagram', 'facebook', 'whatsapp', 'sms', 'email', 'push', 'google', 'dooh'],
    required: true
  },
  currentBudget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  roas: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'draft'],
    default: 'draft'
  },
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Budget Allocation Schema
const allocationSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  campaignId: { type: String, required: true },
  channel: { type: String, required: true },
  allocatedAmount: { type: Number, required: true },
  expectedRoas: { type: Number },
  actualRoas: { type: Number },
  weight: { type: Number, default: 1 }, // Importance weight for optimization
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'applied'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Optimization Experiment Schema
const experimentSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  strategy: {
    type: String,
    enum: ['roas_based', 'conversion_based', 'revenue_based', 'balanced'],
    default: 'roas_based'
  },
  totalBudget: { type: Number, required: true },
  allocations: [{
    channel: String,
    percentage: Number,
    amount: Number
  }],
  controlGroupPercentage: { type: Number, default: 10 },
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ['draft', 'running', 'completed', 'paused'], default: 'draft' },
  results: {
    controlRevenue: { type: Number, default: 0 },
    testRevenue: { type: Number, default: 0 },
    lift: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

// Channel Performance Schema
const channelPerformanceSchema = new mongoose.Schema({
  channel: { type: String, required: true, unique: true },
  totalSpend: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalConversions: { type: Number, default: 0 },
  avgRoas: { type: Number, default: 0 },
  avgCpa: { type: Number, default: 0 }, // Cost per acquisition
  avgCtr: { type: Number, default: 0 }, // Click-through rate
  avgConversionRate: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

// Models
const Campaign = mongoose.model('Campaign', campaignSchema);
const Allocation = mongoose.model('Allocation', allocationSchema);
const Experiment = mongoose.model('Experiment', experimentSchema);
const ChannelPerformance = mongoose.model('ChannelPerformance', channelPerformanceSchema);

// ============== TYPES ==============

interface BudgetOptimizationRequest {
  merchantId: string;
  totalBudget: number;
  strategy?: 'roas_based' | 'conversion_based' | 'revenue_based' | 'balanced';
  minChannelBudget?: number;
  excludeChannels?: string[];
}

interface OptimizationResult {
  allocations: Array<{
    channel: string;
    amount: number;
    percentage: number;
    expectedRoas: number;
    reason: string;
  }>;
  totalBudget: number;
  expectedTotalRoas: number;
  confidence: number;
}

// ============== SERVICE ==============

class BudgetOptimizerService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[BudgetOptimizer] ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'budget-optimizer' });
    });

    // Get optimization recommendations
    this.app.post('/api/optimize', async (req: Request, res: Response) => {
      try {
        const request: BudgetOptimizationRequest = req.body;
        const result = await this.optimizeBudget(request);
        res.json(result);
      } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ error: 'Optimization failed' });
      }
    });

    // Get channel performance
    this.app.get('/api/channels/performance', async (req: Request, res: Response) => {
      try {
        const performance = await ChannelPerformance.find().lean();
        res.json(performance);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance' });
      }
    });

    // Get campaigns
    this.app.get('/api/campaigns/:merchantId', async (req: Request, res: Response) => {
      try {
        const campaigns = await Campaign.find({ merchantId: req.params.merchantId }).lean();
        res.json(campaigns);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
      }
    });

    // Create campaign
    this.app.post('/api/campaigns', async (req: Request, res: Response) => {
      try {
        const campaign = new Campaign(req.body);
        await campaign.save();
        res.json(campaign);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create campaign' });
      }
    });

    // Update campaign spend
    this.app.patch('/api/campaigns/:id/spend', async (req: Request, res: Response) => {
      try {
        const { spent, revenue, conversions } = req.body;
        const campaign = await Campaign.findByIdAndUpdate(
          req.params.id,
          { spent, revenue, conversions, roas: revenue / (spent || 1), updatedAt: new Date() },
          { new: true }
        );
        res.json(campaign);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update spend' });
      }
    });

    // Create optimization experiment
    this.app.post('/api/experiments', async (req: Request, res: Response) => {
      try {
        const experiment = new Experiment(req.body);
        await experiment.save();
        res.json(experiment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create experiment' });
      }
    });

    // Get experiments
    this.app.get('/api/experiments/:merchantId', async (req: Request, res: Response) => {
      try {
        const experiments = await Experiment.find({ merchantId: req.params.merchantId }).lean();
        res.json(experiments);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch experiments' });
      }
    });

    // Apply allocation
    this.app.post('/api/allocations/apply', async (req: Request, res: Response) => {
      try {
        const allocation = new Allocation({ ...req.body, status: 'applied' });
        await allocation.save();

        // Update campaign budget
        await Campaign.findByIdAndUpdate(
          allocation.campaignId,
          { currentBudget: allocation.allocatedAmount }
        );

        res.json(allocation);
      } catch (error) {
        res.status(500).json({ error: 'Failed to apply allocation' });
      }
    });

    // Get allocation history
    this.app.get('/api/allocations/:merchantId', async (req: Request, res: Response) => {
      try {
        const allocations = await Allocation.find({ merchantId: req.params.merchantId })
          .sort({ createdAt: -1 })
          .lean();
        res.json(allocations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch allocations' });
      }
    });
  }

  /**
   * Optimize budget allocation across channels
   */
  async optimizeBudget(request: BudgetOptimizationRequest): Promise<OptimizationResult> {
    const {
      merchantId,
      totalBudget,
      strategy = 'roas_based',
      minChannelBudget = 500,
      excludeChannels = []
    } = request;

    // Get all campaigns for this merchant
    const campaigns = await Campaign.find({
      merchantId,
      status: 'active',
      channel: { $nin: excludeChannels }
    }).lean();

    // Get channel performance data
    const channelPerformance = await ChannelPerformance.find().lean();

    // Calculate channel metrics
    const channelMetrics = new Map<string, {
      totalRoas: number;
      totalRevenue: number;
      totalSpend: number;
      campaignCount: number;
      avgRoas: number;
    }>();

    for (const campaign of campaigns) {
      const existing = channelMetrics.get(campaign.channel) || {
        totalRoas: 0,
        totalRevenue: 0,
        totalSpend: 0,
        campaignCount: 0,
        avgRoas: 0
      };

      existing.totalRoas += campaign.roas;
      existing.totalRevenue += campaign.revenue;
      existing.totalSpend += campaign.spent;
      existing.campaignCount += 1;
      existing.avgRoas = existing.totalRoas / existing.campaignCount;

      channelMetrics.set(campaign.channel, existing);
    }

    // Calculate weights based on strategy
    const weights = this.calculateWeights(channelMetrics, strategy);

    // Allocate budget
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    const allocations: OptimizationResult['allocations'] = [];

    for (const [channel, weight] of weights) {
      if (weight === 0) continue;

      const percentage = (weight / totalWeight) * 100;
      let amount = Math.round((totalBudget * percentage) / 100);

      // Enforce minimum budget
      if (amount < minChannelBudget) {
        amount = minChannelBudget;
      }

      // Get expected ROAS from historical data
      const metrics = channelMetrics.get(channel);
      const expectedRoas = metrics?.avgRoas || 1.5;

      // Generate reason
      const reason = this.generateReason(channel, percentage, expectedRoas, strategy);

      allocations.push({
        channel,
        amount,
        percentage: (amount / totalBudget) * 100,
        expectedRoas,
        reason
      });
    }

    // Sort by amount descending
    allocations.sort((a, b) => b.amount - a.amount);

    // Calculate expected total ROAS
    const expectedTotalRoas = allocations.reduce((sum, a) => {
      return sum + (a.amount * a.expectedRoas);
    }, 0) / totalBudget;

    return {
      allocations,
      totalBudget,
      expectedTotalRoas,
      confidence: this.calculateConfidence(campaigns.length, allocations.length)
    };
  }

  private calculateWeights(
    channelMetrics: Map<string, any>,
    strategy: string
  ): Map<string, number> {
    const weights = new Map<string, number>();
    const channels = ['instagram', 'facebook', 'whatsapp', 'sms', 'email', 'push', 'google', 'dooh'];

    for (const channel of channels) {
      const metrics = channelMetrics.get(channel);

      if (!metrics || metrics.campaignCount === 0) {
        // Give new channels a small base weight
        weights.set(channel, 1);
        continue;
      }

      let weight = 1;

      switch (strategy) {
        case 'roas_based':
          // Weight by ROAS performance
          weight = Math.max(0.1, metrics.avgRoas - 0.5); // Penalize low ROAS
          break;

        case 'conversion_based':
          // Weight by conversion efficiency
          const conversions = metrics.totalRevenue / (metrics.totalSpend || 1);
          weight = Math.max(0.1, conversions);
          break;

        case 'revenue_based':
          // Weight by total revenue contribution
          weight = metrics.totalRevenue / 10000; // Normalize
          break;

        case 'balanced':
          // Balance all factors
          const roasWeight = Math.max(0.1, metrics.avgRoas - 0.5) * 0.4;
          const revWeight = (metrics.totalRevenue / 10000) * 0.3;
          const convWeight = (metrics.totalRevenue / (metrics.totalSpend || 1)) * 0.3;
          weight = roasWeight + revWeight + convWeight;
          break;
      }

      weights.set(channel, Math.max(0.1, weight)); // Minimum weight of 0.1
    }

    return weights;
  }

  private generateReason(
    channel: string,
    percentage: number,
    expectedRoas: number,
    strategy: string
  ): string {
    const channelNames: Record<string, string> = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
      sms: 'SMS',
      email: 'Email',
      push: 'Push Notifications',
      google: 'Google Ads',
      dooh: 'Digital Out-of-Home'
    };

    const name = channelNames[channel] || channel;

    if (percentage > 30) {
      return `High allocation (${percentage.toFixed(1)}%) due to strong ${strategy === 'roas_based' ? 'ROAS performance' : 'overall metrics'}. Expected ROAS: ${expectedRoas.toFixed(2)}x`;
    } else if (percentage > 15) {
      return `Moderate allocation (${percentage.toFixed(1)}%) with expected ROAS of ${expectedRoas.toFixed(2)}x`;
    } else {
      return `Testing allocation (${percentage.toFixed(1)}%) for ${name} - monitor performance closely`;
    }
  }

  private calculateConfidence(campaignCount: number, channelCount: number): number {
    // More data = higher confidence
    const baseConfidence = Math.min(0.95, campaignCount * 0.05 + 0.2);
    // Penalize for too many channels with little data
    const channelPenalty = Math.max(0, (channelCount - 4) * 0.05);
    return Math.max(0.5, baseConfidence - channelPenalty);
  }

  async start(port: number = 4290): Promise<void> {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_budget_optimizer');
      console.log('[BudgetOptimizer] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[BudgetOptimizer] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[BudgetOptimizer] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new BudgetOptimizerService();
service.start(4290);

export default service;

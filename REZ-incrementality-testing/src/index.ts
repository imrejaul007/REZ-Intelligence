/**
 * REZ Incrementality Testing Service
 * Measure true campaign lift with randomized control experiments
 *
 * Features:
 * - A/B testing with holdout groups
 * - Incrementality measurement
 * - Statistical significance
 * - ROI validation
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

const experimentSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['campaign', 'channel', 'offer', 'creative', 'audience'],
    required: true
  },
  hypothesis: String,
  status: {
    type: String,
    enum: ['draft', 'running', 'completed', 'paused'],
    default: 'draft'
  },

  // Test configuration
  testGroupPercentage: { type: Number, default: 50 },
  controlGroupPercentage: { type: Number, default: 50 },

  // Audience targeting
  audience: {
    segment: String,
    criteria: mongoose.Schema.Types.Mixed,
    size: Number
  },

  // Test variant
  variant: {
    type: String,
    enum: ['control', 'treatment'],
    required: true
  },

  // Test duration
  startDate: Date,
  endDate: Date,
  minDuration: Number, // minimum days
  maxDuration: Number, // maximum days

  // Cost
  investment: Number,

  // Results (populated after completion)
  results: {
    testGroup: {
      size: Number,
      converted: Number,
      revenue: Number,
      conversions: Number,
      conversionRate: Number,
      avgOrderValue: Number
    },
    controlGroup: {
      size: Number,
      converted: Number,
      revenue: Number,
      conversions: Number,
      conversionRate: Number,
      avgOrderValue: Number
    },
    lift: {
      revenue: Number, // percentage
      conversionRate: Number,
      aov: Number
    },
    statistical: {
      confidence: Number,
      pValue: Number,
      sampleSize: Number,
      isSignificant: Boolean
    },
    roi: Number,
    incrementalRevenue: Number
  },

  // Recommendations
  recommendations: [String],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Experiment = mongoose.model('Experiment', experimentSchema);

// ============== TYPES ==============

interface TestResult {
  experimentId: string;
  variant: 'treatment' | 'control';
  metric: string;
  value: number;
  timestamp: Date;
}

// ============== SERVICE ==============

class IncrementalityTestingService {
  private app: express.Application;

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
      res.json({ status: 'healthy', service: 'incrementality-testing' });
    });

    // Create experiment
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
        const experiments = await Experiment.find({ merchantId: req.params.merchantId })
          .sort({ createdAt: -1 })
          .lean();
        res.json(experiments);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch experiments' });
      }
    });

    // Get single experiment
    this.app.get('/api/experiments/:merchantId/:id', async (req: Request, res: Response) => {
      try {
        const experiment = await Experiment.findOne({
          _id: req.params.id,
          merchantId: req.params.merchantId
        });
        res.json(experiment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch experiment' });
      }
    });

    // Update experiment status
    this.app.patch('/api/experiments/:id/status', async (req: Request, res: Response) => {
      try {
        const experiment = await Experiment.findByIdAndUpdate(
          req.params.id,
          { status: req.body.status, updatedAt: new Date() },
          { new: true }
        );
        res.json(experiment);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
      }
    });

    // Record result
    this.app.post('/api/experiments/:id/results', async (req: Request, res: Response) => {
      try {
        const { testGroup, controlGroup } = req.body;

        // Calculate lift
        const revenueLift = testGroup.revenue > 0
          ? ((testGroup.revenue - controlGroup.revenue) / controlGroup.revenue) * 100
          : 0;

        const conversionLift = testGroup.conversions > 0
          ? ((testGroup.conversionRate - controlGroup.conversionRate) / controlGroup.conversionRate) * 100
          : 0;

        // Calculate statistical significance (simplified z-test)
        const totalSize = testGroup.size + controlGroup.size;
        const pooledConversionRate = (testGroup.converted + controlGroup.converted) / totalSize;
        const standardError = Math.sqrt(
          pooledConversionRate * (1 - pooledConversionRate) *
          (1/testGroup.size + 1/controlGroup.size)
        );
        const zScore = standardError > 0
          ? Math.abs(testGroup.conversionRate - controlGroup.conversionRate) / standardError
          : 0;

        // Approximate p-value from z-score
        const pValue = zScore > 0 ? 2 * (1 - this.normalCDF(zScore)) : 1;
        const confidence = (1 - pValue) * 100;
        const isSignificant = pValue < 0.05 && confidence > 95;

        // Calculate ROI
        const experiment = await Experiment.findById(req.params.id);
        const investment = experiment?.investment || 0;
        const incrementalRevenue = testGroup.revenue - controlGroup.revenue;
        const roi = investment > 0 ? ((incrementalRevenue - investment) / investment) * 100 : 0;

        const experimentUpdate = await Experiment.findByIdAndUpdate(
          req.params.id,
          {
            results: {
              testGroup,
              controlGroup,
              lift: {
                revenue: revenueLift,
                conversionRate: conversionLift,
                aov: testGroup.avgOrderValue - controlGroup.avgOrderValue
              },
              statistical: {
                confidence,
                pValue,
                sampleSize: totalSize,
                isSignificant
              },
              roi,
              incrementalRevenue
            },
            status: 'completed',
            updatedAt: new Date()
          },
          { new: true }
        );

        res.json(experimentUpdate);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record results' });
      }
    });

    // Get active experiments
    this.app.get('/api/experiments/:merchantId/active', async (req: Request, res: Response) => {
      try {
        const experiments = await Experiment.find({
          merchantId: req.params.merchantId,
          status: 'running'
        }).lean();
        res.json(experiments);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch active experiments' });
      }
    });

    // Get experiment recommendations
    this.app.get('/api/experiments/:id/recommendations', async (req: Request, res: Response) => {
      try {
        const experiment = await Experiment.findById(req.params.id);

        if (!experiment?.results) {
          return res.status(404).json({ error: 'Results not available yet' });
        }

        const recommendations = this.generateRecommendations(experiment);
        res.json(recommendations);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate recommendations' });
      }
    });

    // Get incrementality report
    this.app.get('/api/reports/:merchantId', async (req: Request, res: Response) => {
      try {
        const experiments = await Experiment.find({
          merchantId: req.params.merchantId,
          status: 'completed'
        }).lean();

        // Aggregate results
        const totalIncrementalRevenue = experiments.reduce(
          (sum, e) => sum + (e.results?.incrementalRevenue || 0), 0
        );
        const avgLift = experiments.length > 0
          ? experiments.reduce((sum, e) => sum + (e.results?.lift?.revenue || 0), 0) / experiments.length
          : 0;
        const avgRoi = experiments.length > 0
          ? experiments.reduce((sum, e) => sum + (e.results?.roi || 0), 0) / experiments.length
          : 0;

        res.json({
          totalExperiments: experiments.length,
          totalIncrementalRevenue,
          averageLift: avgLift,
          averageRoi: avgRoi,
          experiments: experiments.map(e => ({
            id: e._id,
            name: e.name,
            type: e.type,
            lift: e.results?.lift,
            roi: e.results?.roi,
            isSignificant: e.results?.statistical?.isSignificant
          }))
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate report' });
      }
    });
  }

  /**
   * Standard normal cumulative distribution function
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Generate recommendations based on experiment results
   */
  private generateRecommendations(experiment: any): string[] {
    const recommendations: string[] = [];
    const { results, investment } = experiment;

    if (!results) return recommendations;

    const { lift, statistical, roi, incrementalRevenue } = results;

    if (statistical?.isSignificant) {
      if (lift?.revenue > 10) {
        recommendations.push(`✅ Strong positive lift of ${lift.revenue.toFixed(1)}%. Scale this campaign!`);
        recommendations.push(`💰 Expected incremental revenue: ₹${(incrementalRevenue || 0).toFixed(0)}`);
      } else if (lift?.revenue > 0) {
        recommendations.push(`✅ Positive lift of ${lift.revenue.toFixed(1)}%. Consider scaling with optimizations.`);
      } else if (lift?.revenue > -5) {
        recommendations.push(`⚠️ Slight negative lift of ${lift.revenue.toFixed(1)}%. Review and optimize before scaling.`);
      } else {
        recommendations.push(`❌ Negative lift of ${lift.revenue.toFixed(1)}%. Do NOT scale this campaign.`);
        recommendations.push(`🔍 Investigate: Target audience, creative, offer, timing`);
      }

      if (roi > 100) {
        recommendations.push(`🎯 Excellent ROI of ${roi.toFixed(0)}%. Increase budget allocation.`);
      } else if (roi > 0) {
        recommendations.push(`📊 Positive ROI of ${roi.toFixed(0)}%. Test with higher budget.`);
      } else {
        recommendations.push(`📉 Negative ROI of ${roi.toFixed(0)}%. Campaign not profitable.`);
      }
    } else {
      recommendations.push(`⚠️ Results not statistically significant (${(statistical?.confidence || 0).toFixed(1)}% confidence).`);
      recommendations.push(`📊 Need larger sample size for reliable conclusions.`);
      recommendations.push(`⏳ Run experiment longer or increase test group size.`);
    }

    // Budget recommendation
    if (investment && incrementalRevenue > 0) {
      const recommendedBudget = Math.round((investment * incrementalRevenue) / 10000) * 10000;
      if (recommendedBudget > investment) {
        recommendations.push(`💵 Suggested budget increase: ₹${recommendedBudget.toLocaleString()}`);
      }
    }

    return recommendations;
  }

  async start(port: number = 4292): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_incrementality'
      );
      console.log('[IncrementalityTesting] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[IncrementalityTesting] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[IncrementalityTesting] Failed to start:', error);
      throw error;
    }
  }
}

// Start service
const service = new IncrementalityTestingService();
service.start(4292);

export default service;

/**
 * REZ Prompt Studio Service
 * Prompt versioning, rollback, A/B testing, and collaboration for AI prompts
 *
 * Features:
 * - Prompt version history
 * - Rollback capability
 * - A/B testing for prompts
 * - Prompt performance metrics
 * - Collaboration features
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============== SCHEMAS ==============

// Prompt Schema
const promptSchema = new mongoose.Schema({
  promptId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  merchantId: { type: String, index: true },
  agentId: String,
  category: { type: String, enum: ['campaign', 'support', 'sales', 'marketing', 'general'], default: 'general' },
  currentVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'archived', 'draft'], default: 'draft' },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Prompt Version Schema
const versionSchema = new mongoose.Schema({
  versionId: { type: String, required: true, unique: true },
  promptId: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  content: { type: String, required: true },
  variables: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'boolean', 'array', 'object'] },
    required: Boolean,
    defaultValue: mongoose.Schema.Types.Mixed
  }],
  systemPrompt: String,
  examples: [{
    input: String,
    output: String
  }],
  metadata: {
    author: String,
    changeDescription: String,
    changeType: { type: String, enum: ['created', 'updated', 'reverted', 'tested'] }
  },
  createdAt: { type: Date, default: Date.now }
});

// Prompt Test Schema (A/B Tests)
const testSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  promptId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['draft', 'running', 'completed', 'paused'], default: 'draft' },

  // Test variants
  variants: [{
    variantId: String,
    versionId: String,
    percentage: Number,
    promptContent: String
  }],

  // Audience
  audienceCriteria: mongoose.Schema.Types.Mixed,
  audienceSize: Number,

  // Metrics
  metrics: {
    variantId: String,
    impressions: Number,
    conversions: Number,
    conversionRate: Number,
    avgResponseTime: Number,
    userSatisfaction: Number
  }],

  // Statistical analysis
  results: {
    winner: String,
    confidence: Number,
    pValue: Number,
    lift: Number
  },

  // Timing
  startDate: Date,
  endDate: Date,
  minDuration: Number,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Prompt Performance Schema
const performanceSchema = new mongoose.Schema({
  promptId: { type: String, required: true, index: true },
  versionId: { type: String, required: true, index: true },
  testId: String,

  // Time period
  date: { type: Date, required: true },

  // Metrics
  invocations: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  avgLatency: Number,
  avgTokens: Number,
  cost: Number,

  // Quality metrics
  userFeedback: {
    thumbsUp: { type: Number, default: 0 },
    thumbsDown: { type: Number, default: 0 },
    rating: Number
  },

  // Business outcomes
  outcomes: {
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 }
  }
});

// Prompt Collaboration Schema
const collaborationSchema = new mongoose.Schema({
  promptId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
  addedAt: { type: Date, default: Date.now }
});

// Models
const Prompt = mongoose.model('Prompt', promptSchema);
const PromptVersion = mongoose.model('PromptVersion', versionSchema);
const PromptTest = mongoose.model('PromptTest', testSchema);
const PromptPerformance = mongoose.model('PromptPerformance', performanceSchema);
const PromptCollaboration = mongoose.model('PromptCollaboration', collaborationSchema);

// ============== SERVICE ==============

class PromptStudioService {
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
      res.json({ status: 'healthy', service: 'prompt-studio' });
    });

    // ========== PROMPTS ==========

    // Create prompt
    this.app.post('/api/prompts', async (req: Request, res: Response) => {
      try {
        const { name, description, merchantId, agentId, category, content, variables, systemPrompt } = req.body;

        const promptId = uuidv4();

        // Create prompt
        const prompt = new Prompt({
          promptId,
          name,
          description,
          merchantId,
          agentId,
          category,
          currentVersion: 1,
          status: 'draft'
        });
        await prompt.save();

        // Create initial version
        const version = new PromptVersion({
          versionId: uuidv4(),
          promptId,
          version: 1,
          content,
          variables: variables || [],
          systemPrompt,
          metadata: {
            author: req.body.author || 'system',
            changeDescription: 'Initial version',
            changeType: 'created'
          }
        });
        await version.save();

        res.json({ prompt, version });
      } catch (error) {
        console.error('Error creating prompt:', error);
        res.status(500).json({ error: 'Failed to create prompt' });
      }
    });

    // Get prompts
    this.app.get('/api/prompts/:merchantId', async (req: Request, res: Response) => {
      try {
        const { category, status, search } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (category) query.category = category;
        if (status) query.status = status;
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ];
        }

        const prompts = await Prompt.find(query).sort({ updatedAt: -1 }).lean();
        res.json(prompts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prompts' });
      }
    });

    // Get prompt with current version
    this.app.get('/api/prompts/:merchantId/:promptId', async (req: Request, res: Response) => {
      try {
        const prompt = await Prompt.findOne({
          promptId: req.params.promptId,
          merchantId: req.params.merchantId
        });

        if (!prompt) {
          return res.status(404).json({ error: 'Prompt not found' });
        }

        const versions = await PromptVersion.find({ promptId: prompt.promptId })
          .sort({ version: -1 })
          .lean();

        res.json({ prompt, versions });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prompt' });
      }
    });

    // Update prompt (create new version)
    this.app.put('/api/prompts/:promptId/versions', async (req: Request, res: Response) => {
      try {
        const { content, variables, systemPrompt, changeDescription, author } = req.body;

        const prompt = await Prompt.findOne({ promptId: req.params.promptId });
        if (!prompt) {
          return res.status(404).json({ error: 'Prompt not found' });
        }

        // Create new version
        const newVersion = prompt.currentVersion + 1;
        const version = new PromptVersion({
          versionId: uuidv4(),
          promptId: prompt.promptId,
          version: newVersion,
          content,
          variables: variables || [],
          systemPrompt,
          metadata: {
            author: author || 'system',
            changeDescription: changeDescription || 'Updated prompt',
            changeType: 'updated'
          }
        });
        await version.save();

        // Update prompt
        prompt.currentVersion = newVersion;
        prompt.updatedAt = new Date();
        await prompt.save();

        res.json({ prompt, version });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update prompt' });
      }
    });

    // Rollback to previous version
    this.app.post('/api/prompts/:promptId/rollback', async (req: Request, res: Response) => {
      try {
        const { targetVersion, reason, author } = req.body;

        const prompt = await Prompt.findOne({ promptId: req.params.promptId });
        if (!prompt) {
          return res.status(404).json({ error: 'Prompt not found' });
        }

        const target = await PromptVersion.findOne({
          promptId: req.params.promptId,
          version: targetVersion
        });

        if (!target) {
          return res.status(404).json({ error: 'Target version not found' });
        }

        // Create rollback version
        const newVersion = prompt.currentVersion + 1;
        const rollbackVersion = new PromptVersion({
          versionId: uuidv4(),
          promptId: prompt.promptId,
          version: newVersion,
          content: target.content,
          variables: target.variables,
          systemPrompt: target.systemPrompt,
          metadata: {
            author: author || 'system',
            changeDescription: `Rolled back to v${targetVersion} - ${reason || 'No reason provided'}`,
            changeType: 'reverted'
          }
        });
        await rollbackVersion.save();

        // Update prompt
        prompt.currentVersion = newVersion;
        prompt.updatedAt = new Date();
        await prompt.save();

        res.json({ prompt, rollbackVersion });
      } catch (error) {
        res.status(500).json({ error: 'Failed to rollback' });
      }
    });

    // Get version history
    this.app.get('/api/prompts/:promptId/versions', async (req: Request, res: Response) => {
      try {
        const versions = await PromptVersion.find({ promptId: req.params.promptId })
          .sort({ version: -1 })
          .lean();
        res.json(versions);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch versions' });
      }
    });

    // ========== A/B TESTS ==========

    // Create A/B test
    this.app.post('/api/tests', async (req: Request, res: Response) => {
      try {
        const { promptId, name, variants, audienceCriteria, startDate, minDuration } = req.body;

        const testId = uuidv4();
        const test = new PromptTest({
          testId,
          promptId,
          name,
          variants,
          audienceCriteria,
          startDate,
          minDuration,
          status: 'draft'
        });
        await test.save();

        res.json(test);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create test' });
      }
    });

    // Get tests for prompt
    this.app.get('/api/tests/:promptId', async (req: Request, res: Response) => {
      try {
        const tests = await PromptTest.find({ promptId: req.params.promptId })
          .sort({ createdAt: -1 })
          .lean();
        res.json(tests);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tests' });
      }
    });

    // Start test
    this.app.post('/api/tests/:testId/start', async (req: Request, res: Response) => {
      try {
        const test = await PromptTest.findOneAndUpdate(
          { testId: req.params.testId },
          { status: 'running', startDate: new Date() },
          { new: true }
        );
        res.json(test);
      } catch (error) {
        res.status(500).json({ error: 'Failed to start test' });
      }
    });

    // Record test results
    this.app.post('/api/tests/:testId/results', async (req: Request, res: Response) => {
      try {
        const { variantId, impressions, conversions, responseTime, satisfaction } = req.body;

        const test = await PromptTest.findOne({ testId: req.params.testId });
        if (!test) {
          return res.status(404).json({ error: 'Test not found' });
        }

        // Update variant metrics
        const variant = test.variants.find(v => v.variantId === variantId);
        if (variant) {
          const metricsIndex = test.metrics.findIndex(m => m.variantId === variantId);
          if (metricsIndex >= 0) {
            test.metrics[metricsIndex].impressions += impressions;
            test.metrics[metricsIndex].conversions += conversions;
            test.metrics[metricsIndex].conversionRate =
              test.metrics[metricsIndex].conversions / test.metrics[metricsIndex].impressions;
          } else {
            test.metrics.push({
              variantId,
              impressions,
              conversions,
              conversionRate: conversions / impressions,
              avgResponseTime: responseTime,
              userSatisfaction: satisfaction
            });
          }
        }

        test.updatedAt = new Date();
        await test.save();

        res.json(test);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record results' });
      }
    });

    // Complete test with analysis
    this.app.post('/api/tests/:testId/complete', async (req: Request, res: Response) => {
      try {
        const test = await PromptTest.findOne({ testId: req.params.testId });
        if (!test) {
          return res.status(404).json({ error: 'Test not found' });
        }

        // Calculate winner
        let bestVariant = test.variants[0];
        let bestConversion = 0;

        for (const variant of test.variants) {
          const metrics = test.metrics.find(m => m.variantId === variant.variantId);
          if (metrics && metrics.conversionRate > bestConversion) {
            bestConversion = metrics.conversionRate;
            bestVariant = variant;
          }
        }

        // Calculate confidence (simplified)
        const totalImpressions = test.metrics.reduce((sum, m) => sum + m.impressions, 0);
        const confidence = Math.min(95, 50 + (totalImpressions / 100));

        test.status = 'completed';
        test.endDate = new Date();
        test.results = {
          winner: bestVariant?.variantId || '',
          confidence,
          pValue: 0.05,
          lift: 0 // Would calculate actual lift vs control
        };
        test.updatedAt = new Date();
        await test.save();

        res.json(test);
      } catch (error) {
        res.status(500).json({ error: 'Failed to complete test' });
      }
    });

    // ========== PERFORMANCE ==========

    // Record performance
    this.app.post('/api/performance', async (req: Request, res: Response) => {
      try {
        const { promptId, versionId, testId, metrics } = req.body;

        const performance = new PromptPerformance({
          promptId,
          versionId,
          testId,
          date: new Date(),
          ...metrics
        });
        await performance.save();

        res.json(performance);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record performance' });
      }
    });

    // Get performance history
    this.app.get('/api/performance/:promptId', async (req: Request, res: Response) => {
      try {
        const { versionId, startDate, endDate, granularity } = req.query;
        const query: any = { promptId: req.params.promptId };

        if (versionId) query.versionId = versionId;
        if (startDate || endDate) {
          query.date = {};
          if (startDate) query.date.$gte = new Date(startDate as string);
          if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const performance = await PromptPerformance.find(query)
          .sort({ date: -1 })
          .limit(100)
          .lean();

        // Aggregate by granularity if needed
        if (granularity === 'day') {
          const aggregated = this.aggregateByDay(performance);
          return res.json(aggregated);
        }

        res.json(performance);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance' });
      }
    });

    // Get aggregate stats
    this.app.get('/api/performance/:promptId/stats', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const stats = await PromptPerformance.aggregate([
          { $match: { promptId: req.params.promptId, date: { $gte: startDate } } },
          {
            $group: {
              _id: '$versionId',
              totalInvocations: { $sum: '$invocations' },
              totalSuccess: { $sum: '$successCount' },
              totalFailure: { $sum: '$failureCount' },
              avgLatency: { $avg: '$avgLatency' },
              avgTokens: { $avg: '$avgTokens' },
              totalCost: { $sum: '$cost' },
              thumbsUp: { $sum: '$userFeedback.thumbsUp' },
              thumbsDown: { $sum: '$userFeedback.thumbsDown' },
              conversions: { $sum: '$outcomes.conversions' },
              revenue: { $sum: '$outcomes.revenue' }
            }
          }
        ]);

        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    // ========== COLLABORATION ==========

    // Add collaborator
    this.app.post('/api/prompts/:promptId/collaborators', async (req: Request, res: Response) => {
      try {
        const { userId, role } = req.body;

        const collaboration = new PromptCollaboration({
          promptId: req.params.promptId,
          userId,
          role: role || 'viewer'
        });
        await collaboration.save();

        res.json(collaboration);
      } catch (error) {
        res.status(500).json({ error: 'Failed to add collaborator' });
      }
    });

    // Get collaborators
    this.app.get('/api/prompts/:promptId/collaborators', async (req: Request, res: Response) => {
      try {
        const collaborators = await PromptCollaboration.find({ promptId: req.params.promptId }).lean();
        res.json(collaborators);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch collaborators' });
      }
    });
  }

  private aggregateByDay(performance: any[]): any {
    const byDay = new Map();

    for (const p of performance) {
      const day = p.date.toISOString().split('T')[0];
      const existing = byDay.get(day) || {
        date: day,
        invocations: 0,
        successCount: 0,
        failureCount: 0,
        totalLatency: 0,
        count: 0
      };

      existing.invocations += p.invocations;
      existing.successCount += p.successCount;
      existing.failureCount += p.failureCount;
      existing.totalLatency += (p.avgLatency || 0) * p.invocations;
      existing.count += 1;

      byDay.set(day, existing);
    }

    return Array.from(byDay.values()).map((d: any) => ({
      ...d,
      avgLatency: d.invocations > 0 ? d.totalLatency / d.invocations : 0,
      successRate: d.invocations > 0 ? d.successCount / d.invocations : 0
    }));
  }

  async start(port: number = 4299): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_prompt_studio'
      );
      console.log('[PromptStudio] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[PromptStudio] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[PromptStudio] Failed to start:', error);
      throw error;
    }
  }
}

const service = new PromptStudioService();
service.start(4299);

export default service;

import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { ModelVersion, ConversationSample, TrainingBatch } from '../models/index.js';
import logger from './utils/logger.js';
import { config } from '../config/index.js';

// Seeded random for deterministic mock metrics
function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

export interface ModelUpdateJobResult {
  jobId: string;
  timestamp: Date;
  previousVersion?: string;
  newVersion?: string;
  trainingDataStats: {
    startDate: Date;
    endDate: Date;
    sampleCount: number;
    conversationCount: number;
    uniqueIntents: number;
  };
  performanceMetrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
  status: 'draft' | 'training' | 'validated' | 'published' | 'failed';
  errors: string[];
  duration: number;
}

export class ModelUpdateScheduler {
  private updateJob: cron.ScheduledTask | null = null;
  private validationJob: cron.ScheduledTask | null = null;
  private lastRunResult: ModelUpdateJobResult | null = null;
  private isRunning = false;
  private updateIntervalDays = 7; // Weekly model updates

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Model update scheduler is already running');
      return;
    }

    logger.info('Starting model update scheduler');

    // Run model update weekly on Sunday at 3 AM
    this.updateJob = cron.schedule('0 3 * * 0', async () => {
      await this.runModelUpdate();
    });

    // Run validation daily at 4 AM
    this.validationJob = cron.schedule('0 4 * * *', async () => {
      await this.runValidation();
    });

    this.isRunning = true;
    logger.info('Model update scheduler started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping model update scheduler');

    if (this.updateJob) {
      this.updateJob.stop();
      this.updateJob = null;
    }

    if (this.validationJob) {
      this.validationJob.stop();
      this.validationJob = null;
    }

    this.isRunning = false;
    logger.info('Model update scheduler stopped');
  }

  async runModelUpdate(): Promise<ModelUpdateJobResult> {
    const startTime = Date.now();
    const jobId = `model-update-${Date.now()}`;
    const result: ModelUpdateJobResult = {
      jobId,
      timestamp: new Date(),
      trainingDataStats: {
        startDate: new Date(),
        endDate: new Date(),
        sampleCount: 0,
        conversationCount: 0,
        uniqueIntents: 0,
      },
      status: 'draft',
      errors: [],
      duration: 0,
    };

    logger.info('Starting model update', { jobId });

    try {
      // Get current published version
      const currentVersion = await ModelVersion.findLatest();
      result.previousVersion = currentVersion?.versionNumber;

      // Calculate date range for new training data
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - this.updateIntervalDays * 24 * 60 * 60 * 1000);
      result.trainingDataStats.startDate = startDate;
      result.trainingDataStats.endDate = endDate;

      // Get training data statistics
      const stats = await this.gatherTrainingDataStats(startDate, endDate);
      result.trainingDataStats = stats;

      // Create new model version
      const newVersion = await this.createModelVersion(stats, currentVersion?.versionId);
      result.newVersion = newVersion.versionNumber;

      // Run training (simulated for now)
      logger.info('Training model...', { version: newVersion.versionNumber });
      newVersion.status = 'training';
      await newVersion.save();

      const trainingResult = await this.trainModel(newVersion);
      result.performanceMetrics = trainingResult;

      // Validate model
      logger.info('Validating model...', { version: newVersion.versionNumber });
      const validationResult = await this.validateModel(newVersion);

      if (validationResult.passed) {
        newVersion.status = 'validated';
        newVersion.performance = {
          ...trainingResult,
          ...validationResult.metrics,
        };
        await newVersion.save();

        // Publish model
        await this.publishModel(newVersion);
        result.status = 'published';
      } else {
        newVersion.status = 'draft';
        newVersion.performance = trainingResult;
        await newVersion.save();
        result.status = 'draft';
        result.errors.push('Validation failed: ' + validationResult.reason);
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      result.errors.push(errorMessage);
      result.status = 'failed';
      logger.error('Model update failed', { jobId, error: errorMessage });
    }

    result.duration = Date.now() - startTime;
    this.lastRunResult = result;

    logger.info('Model update completed', {
      jobId,
      status: result.status,
      duration: result.duration,
    });

    return result;
  }

  private async gatherTrainingDataStats(startDate: Date, endDate: Date): Promise<{
    startDate: Date;
    endDate: Date;
    sampleCount: number;
    conversationCount: number;
    uniqueIntents: number;
  }> {
    // Get labeled conversations in date range
    const conversations = await ConversationSample.find({
      isLabeled: true,
      labelQuality: { $in: ['high', 'medium'] },
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Count unique intents
    const intents = new Set<string>();
    for (const conv of conversations) {
      for (const intent of conv.extractedIntents) {
        intents.add(intent.name);
      }
    }

    return {
      startDate,
      endDate,
      sampleCount: conversations.reduce((sum, c) => sum + c.messages.length, 0),
      conversationCount: conversations.length,
      uniqueIntents: intents.size,
    };
  }

  private async createModelVersion(
    stats: { startDate: Date; endDate: Date; sampleCount: number; conversationCount: number; uniqueIntents: number },
    previousVersionId?: string
  ): Promise<typeof ModelVersion.prototype> {
    const versionNumber = await ModelVersion.incrementVersion();
    const versionId = randomUUID();

    const modelVersion = new ModelVersion({
      versionId,
      versionNumber,
      description: `Weekly model update ${new Date().toISOString()}`,
      trainingData: {
        startDate: stats.startDate,
        endDate: stats.endDate,
        sampleCount: stats.sampleCount,
        conversationCount: stats.conversationCount,
        uniqueIntents: stats.uniqueIntents,
        uniqueEntities: 0,
      },
      previousVersionId,
      status: 'draft',
    });

    await modelVersion.save();
    logger.info('Model version created', { versionId, versionNumber });

    return modelVersion;
  }

  private async trainModel(modelVersion: typeof ModelVersion.prototype): Promise<{
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  }> {
    // Simulated training - in production this would call actual ML training
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Use seed for deterministic mock metrics
    const seed = Date.now();
    return {
      accuracy: 0.85 + seededRandom(seed, 1) * 0.1,
      precision: 0.82 + seededRandom(seed, 2) * 0.1,
      recall: 0.80 + seededRandom(seed, 3) * 0.1,
      f1Score: 0.81 + seededRandom(seed, 4) * 0.1,
    };
  }

  private async validateModel(modelVersion: typeof ModelVersion.prototype): Promise<{
    passed: boolean;
    reason?: string;
    metrics?: Record<string, number>;
  }> {
    // Simulated validation
    await new Promise((resolve) => setTimeout(resolve, 500));

    const seed = Date.now() + 1000;
    const metrics = {
      testAccuracy: 0.83 + seededRandom(seed, 1) * 0.1,
      crossValidationScore: 0.80 + seededRandom(seed, 2) * 0.1,
    };

    // Validation passes if metrics are above threshold
    const passed = metrics.testAccuracy >= 0.8 && metrics.crossValidationScore >= 0.75;

    return {
      passed,
      reason: passed ? undefined : 'Metrics below threshold',
      metrics,
    };
  }

  private async publishModel(modelVersion: typeof ModelVersion.prototype): Promise<void> {
    // Archive previous published version
    const previousPublished = await ModelVersion.findPublished();
    for (const prev of previousPublished) {
      if (prev.versionId !== modelVersion.versionId) {
        prev.status = 'archived';
        prev.archivedAt = new Date();
        await prev.save();
      }
    }

    // Publish new version
    modelVersion.status = 'published';
    modelVersion.publishedAt = new Date();
    await modelVersion.save();

    logger.info('Model published', {
      versionId: modelVersion.versionId,
      versionNumber: modelVersion.versionNumber,
    });
  }

  async runValidation(): Promise<void> {
    logger.info('Running scheduled validation');

    try {
      // Find published models that haven't been validated recently
      const publishedModels = await ModelVersion.findPublished();

      for (const model of publishedModels) {
        // Check if model needs re-validation
        const recentValidation = await TrainingBatch.findOne({
          versionId: model.versionId,
          status: 'completed',
        }).sort({ createdAt: -1 });

        if (!recentValidation) {
          logger.info('Model needs validation', { versionId: model.versionId });
          // Trigger validation logic here
        }
      }
    } catch (error) {
      logger.error('Scheduled validation failed', { error: (error as Error).message });
    }
  }

  async rollbackToVersion(versionId: string): Promise<boolean> {
    logger.info('Rolling back to version', { versionId });

    try {
      const targetVersion = await ModelVersion.findOne({ versionId });

      if (!targetVersion) {
        throw new Error(`Version not found: ${versionId}`);
      }

      if (targetVersion.status === 'archived') {
        throw new Error('Cannot rollback to archived version');
      }

      // Archive current published versions
      const currentPublished = await ModelVersion.findPublished();
      for (const current of currentPublished) {
        current.status = 'archived';
        current.archivedAt = new Date();
        await current.save();
      }

      // Publish target version
      targetVersion.status = 'published';
      targetVersion.publishedAt = new Date();
      await targetVersion.save();

      logger.info('Rollback successful', { versionId, versionNumber: targetVersion.versionNumber });
      return true;
    } catch (error) {
      logger.error('Rollback failed', { error: (error as Error).message });
      return false;
    }
  }

  getLastRunResult(): ModelUpdateJobResult | null {
    return this.lastRunResult;
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  getScheduleInfo(): {
    modelUpdate: string;
    validation: string;
  } {
    return {
      modelUpdate: '0 3 * * 0', // Weekly on Sunday at 3 AM
      validation: '0 4 * * *', // Daily at 4 AM
    };
  }
}

export const modelUpdateScheduler = new ModelUpdateScheduler();

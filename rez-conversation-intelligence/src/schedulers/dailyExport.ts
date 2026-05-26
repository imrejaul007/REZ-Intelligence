import cron from 'node-cron';
import { extractionPipeline, labelingPipeline, exportPipeline } from '../pipelines/index.js';
import logger from './utils/logger';
import { config } from '../config/index.js';

export interface DailyExportJobResult {
  jobId: string;
  timestamp: Date;
  extraction?: {
    processedCount: number;
    failedCount: number;
  };
  labeling?: {
    labeledCount: number;
    updatedCount: number;
    skippedCount: number;
  };
  export?: {
    batchId: string;
    status: string;
  };
  errors: string[];
  duration: number;
}

export class DailyExportScheduler {
  private extractionJob: cron.ScheduledTask | null = null;
  private labelingJob: cron.ScheduledTask | null = null;
  private exportJob: cron.ScheduledTask | null = null;
  private lastRunResult: DailyExportJobResult | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daily export scheduler is already running');
      return;
    }

    logger.info('Starting daily export scheduler');

    // Run extraction pipeline every hour
    this.extractionJob = cron.schedule('0 * * * *', async () => {
      await this.runExtraction();
    });

    // Run labeling pipeline every 4 hours
    this.labelingJob = cron.schedule('0 */4 * * *', async () => {
      await this.runLabeling();
    });

    // Run export pipeline daily at 2 AM
    this.exportJob = cron.schedule('0 2 * * *', async () => {
      await this.runFullPipeline();
    });

    this.isRunning = true;
    logger.info('Daily export scheduler started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping daily export scheduler');

    if (this.extractionJob) {
      this.extractionJob.stop();
      this.extractionJob = null;
    }

    if (this.labelingJob) {
      this.labelingJob.stop();
      this.labelingJob = null;
    }

    if (this.exportJob) {
      this.exportJob.stop();
      this.exportJob = null;
    }

    this.isRunning = false;
    logger.info('Daily export scheduler stopped');
  }

  async runFullPipeline(): Promise<DailyExportJobResult> {
    const startTime = Date.now();
    const jobId = `daily-${Date.now()}`;
    const result: DailyExportJobResult = {
      jobId,
      timestamp: new Date(),
      errors: [],
      duration: 0,
    };

    logger.info('Starting full daily pipeline', { jobId });

    try {
      // Step 1: Extraction
      logger.info('Running extraction pipeline...');
      const extractionResult = await extractionPipeline.run();
      result.extraction = {
        processedCount: extractionResult.processedCount,
        failedCount: extractionResult.failedCount,
      };
      logger.info('Extraction completed', result.extraction);

      // Step 2: Labeling
      logger.info('Running labeling pipeline...');
      const labelingResult = await labelingPipeline.run();
      result.labeling = {
        labeledCount: labelingResult.labeledCount,
        updatedCount: labelingResult.updatedCount,
        skippedCount: labelingResult.skippedCount,
      };
      logger.info('Labeling completed', result.labeling);

      // Apply feedback corrections
      logger.info('Applying feedback corrections...');
      const correctionsApplied = await labelingPipeline.applyCorrectionsFromFeedback();
      if (correctionsApplied > 0) {
        logger.info(`Applied ${correctionsApplied} feedback corrections`);
      }

      // Step 3: Export
      logger.info('Running export pipeline...');
      const exportResult = await exportPipeline.runScheduled();
      result.export = {
        batchId: exportResult.batchId,
        status: exportResult.status,
      };
      logger.info('Export completed', result.export);

    } catch (error) {
      const errorMessage = (error as Error).message;
      result.errors.push(errorMessage);
      logger.error('Daily pipeline error', { jobId, error: errorMessage });
    }

    result.duration = Date.now() - startTime;
    this.lastRunResult = result;

    logger.info('Daily pipeline completed', {
      jobId,
      duration: result.duration,
      errors: result.errors.length,
    });

    return result;
  }

  async runExtraction(): Promise<{
    processedCount: number;
    failedCount: number;
  }> {
    logger.info('Running scheduled extraction');

    try {
      const result = await extractionPipeline.run();
      logger.info('Scheduled extraction completed', result);
      return result;
    } catch (error) {
      logger.error('Scheduled extraction failed', { error: (error as Error).message });
      throw error;
    }
  }

  async runLabeling(): Promise<{
    labeledCount: number;
    updatedCount: number;
    skippedCount: number;
  }> {
    logger.info('Running scheduled labeling');

    try {
      const result = await labelingPipeline.run();
      logger.info('Scheduled labeling completed', result);
      return result;
    } catch (error) {
      logger.error('Scheduled labeling failed', { error: (error as Error).message });
      throw error;
    }
  }

  getLastRunResult(): DailyExportJobResult | null {
    return this.lastRunResult;
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  getScheduleInfo(): {
    extraction: string;
    labeling: string;
    export: string;
  } {
    return {
      extraction: '0 * * * *', // Every hour
      labeling: '0 */4 * * *', // Every 4 hours
      export: '0 2 * * *', // Daily at 2 AM
    };
  }
}

export const dailyExportScheduler = new DailyExportScheduler();

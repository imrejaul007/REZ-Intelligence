/**
 * REZ Flow Runtime - Execution Worker
 * BullMQ worker for processing workflow executions
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import { ExecutionJob, WorkflowDefinition, ExecutionContext, ExecutionStatus } from '../types/workflow';
import { Execution, Workflow } from '../models/Execution';
import { workflowExecutor } from '../services/workflowExecutor';
import dlqService from '../services/dlqService';
import logger from '../services/logger';

// Configuration
const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-flow-runtime',
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  workerName: process.env.WORKER_NAME || 'execution-worker'
};

// Initialize Redis connection
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Create worker
const worker = new Worker<ExecutionJob>(
  'rez-flow-executions',
  async (job: Job<ExecutionJob>) => {
    const { executionId, workflowId, workflowDefinition, context } = job.data;

    logger.info('Processing execution job', {
      jobId: job.id,
      executionId,
      workflowId,
      attempt: job.attemptsMade
    });

    try {
      // Load execution record
      const execution = await Execution.findById(executionId);
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      // Check if execution was cancelled
      if (execution.status === ExecutionStatus.CANCELLED) {
        logger.info('Skipping cancelled execution', { executionId });
        return { status: 'cancelled', executionId };
      }

      // Parse workflow definition
      const workflow = workflowDefinition as unknown as WorkflowDefinition;

      // Execute workflow
      const result = await workflowExecutor.execute(workflow, context, execution);

      logger.info('Execution job completed', {
        jobId: job.id,
        executionId,
        result
      });

      return {
        status: result,
        executionId,
        stats: execution.stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Execution job failed', {
        jobId: job.id,
        executionId,
        error: errorMessage,
        attempt: job.attemptsMade
      });

      // Update execution status
      try {
        const execution = await Execution.findById(executionId);
        if (execution) {
          execution.markFailed(errorMessage);
          await execution.save();
        }
      } catch (updateError) {
        logger.error('Failed to update execution status', { executionId, error: updateError });
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: config.concurrency,
    limiter: {
      max: 100,
      duration: 1000
    }
  }
);

// Event handlers
worker.on('completed', (job) => {
  logger.info('Job completed', {
    jobId: job.id,
    executionId: job.data.executionId,
    duration: job.finishedOn! - job.timestamp
  });
});

worker.on('failed', async (job, error) => {
  if (!job) return;

  logger.error('Job failed', {
    jobId: job.id,
    executionId: job.data.executionId,
    error: error.message,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts
  });

  // Add to DLQ if max retries reached
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    try {
      await dlqService.addToQueue({
        executionId: job.data.executionId,
        nodeId: 'root',
        error: error.message,
        retryCount: job.attemptsMade,
        failedAt: new Date(),
        workflowDefinition: job.data.workflowDefinition as WorkflowDefinition,
        nodeData: { label: 'execution', type: 'unknown', config: {} },
        context: job.data.context
      });
    } catch (dlqError) {
      logger.error('Failed to add to DLQ', { error: dlqError });
    }
  }
});

worker.on('stalled', (job) => {
  logger.warn('Job stalled', { jobId: job?.id, executionId: job?.data.executionId });
});

worker.on('error', (error) => {
  logger.error('Worker error', { error: error.message });
});

// Progress tracking
worker.on('progress', (job, progress) => {
  logger.debug('Job progress', {
    jobId: job.id,
    executionId: job.data.executionId,
    progress
  });
});

// ==================== STARTUP ====================

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...', { mongoUri: config.mongoUri });
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected');

    // Connect DLQ service
    logger.info('Connecting DLQ service...');
    await dlqService.connect();
    logger.info('DLQ service connected');

    // Start worker
    logger.info('Starting execution worker...', {
      concurrency: config.concurrency,
      workerName: config.workerName
    });

    // Ready signal
    process.send?.('ready');

    logger.info('Execution worker started successfully', {
      workerName: config.workerName,
      pid: process.pid
    });
  } catch (error) {
    logger.error('Failed to start worker', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down worker...');

  try {
    await worker.close();
    await dlqService.disconnect();
    await mongoose.disconnect();
    await connection.quit();

    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  shutdown();
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

// Start
start();

export { worker, start, shutdown };

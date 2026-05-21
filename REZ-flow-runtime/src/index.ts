/**
 * REZ Flow Runtime - Main Entry Point
 * Workflow execution engine for REZ-workflow-builder
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import Redis from 'ioredis';

import { Execution, Workflow } from './models/Execution';
import executionRoutes from './routes/execution.routes';
import workflowRoutes from './routes/workflow.routes';
import { authenticateInternal, optionalAuth } from './middleware/auth';
import dlqService from './services/dlqService';
import logger from './services/logger';

// ==================== CONFIGURATION ====================

const config = {
  port: parseInt(process.env.PORT || '4200', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-flow-runtime',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceToken: process.env.INTERNAL_SERVICE_TOKEN || 'dev-token-change-in-production',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10)
};

// ==================== EXPRESS APP ====================

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for API server
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Internal-Token',
    'X-API-Key',
    'X-Service-Id',
    'X-Webhook-Signature'
  ],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use service ID if available, otherwise use IP
    return (req.headers['x-service-id'] as string) || req.ip || 'unknown';
  }
});

app.use('/api/', limiter);

// Stricter rate limit for execution endpoints
const executionLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many execution requests'
    }
  }
});

app.use('/api/executions', executionLimiter);

// ==================== HEALTH ENDPOINTS ====================

app.get('/health', async (req: Request, res: Response) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      mongodb: 'unknown',
      redis: 'unknown',
      dlq: 'unknown'
    }
  };

  // Check MongoDB
  try {
    await mongoose.connection.db?.admin().ping();
    checks.checks.mongodb = 'connected';
  } catch {
    checks.checks.mongodb = 'disconnected';
    checks.status = 'degraded';
  }

  // Check Redis
  try {
    const redis = new Redis(config.redisUrl, { connectTimeout: 1000 });
    await redis.ping();
    await redis.quit();
    checks.checks.redis = 'connected';
  } catch {
    checks.checks.redis = 'disconnected';
    checks.status = 'degraded';
  }

  // Check DLQ
  try {
    await dlqService.getStats();
    checks.checks.dlq = 'connected';
  } catch {
    checks.checks.dlq = 'disconnected';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

app.get('/health/live', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const isReady =
    mongoose.connection.readyState === 1 &&
    process.env.INTERNAL_SERVICE_TOKEN !== undefined;

  if (isReady) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({
      status: 'not_ready',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      token: process.env.INTERNAL_SERVICE_TOKEN ? 'configured' : 'missing'
    });
  }
});

// ==================== API ROUTES ====================

// Workflow routes
app.use('/api/workflows', workflowRoutes);

// Execution routes
app.use('/api/executions', executionRoutes);

// ==================== DLQ ROUTES ====================

app.get('/api/dlq', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const stats = await dlqService.getStats();
    const messages = await dlqService.listMessages({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20
    });

    res.json({
      success: true,
      data: {
        stats,
        messages: messages.messages,
        pagination: {
          total: messages.total,
          page: messages.page,
          limit: messages.limit,
          totalPages: Math.ceil(messages.total / messages.limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get DLQ', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve DLQ data'
      }
    });
  }
});

app.post('/api/dlq/:jobId/retry', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const success = await dlqService.retryMessage(jobId);

    if (success) {
      res.json({
        success: true,
        message: 'Message retry queued'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'DLQ message not found'
        }
      });
    }
  } catch (error) {
    logger.error('Failed to retry DLQ message', { jobId: req.params.jobId, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retry message'
      }
    });
  }
});

app.delete('/api/dlq/:jobId', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const success = await dlqService.discardMessage(jobId, reason || 'Manual discard');

    if (success) {
      res.json({
        success: true,
        message: 'Message discarded'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'DLQ message not found'
        }
      });
    }
  } catch (error) {
    logger.error('Failed to discard DLQ message', { jobId: req.params.jobId, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to discard message'
      }
    });
  }
});

// ==================== STATS ENDPOINT ====================

app.get('/api/stats', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const [executionStats, dlqStats, workflowStats] = await Promise.all([
      Execution.getStats(),
      dlqService.getStats(),
      Workflow.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        executions: executionStats,
        dlq: {
          totalMessages: dlqStats.totalMessages,
          retryStats: dlqStats.retryStats
        },
        workflows: {
          byStatus: workflowStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        },
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve statistics'
      }
    });
  }
});

// ==================== WEBHOOK TRIGGER ENDPOINT ====================

import { validateWebhookSignature } from './middleware/auth';
import { v4 as uuidv4 } from 'uuid';

app.post('/api/triggers/webhook/:workflowId', validateWebhookSignature, async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const payload = req.body;

    // Find workflow
    const workflow = await Workflow.findOne({ workflowId, status: 'published' });
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Published workflow not found: ${workflowId}`
        }
      });
      return;
    }

    // Create execution
    const executionId = uuidv4();
    const execution = new Execution({
      workflowId: workflow._id,
      workflowVersion: workflow.version,
      status: 'pending',
      triggerType: 'webhook',
      triggerData: payload,
      context: {
        variables: {}
      },
      nodeResults: [],
      executionPath: [],
      logs: [{
        id: uuidv4(),
        timestamp: new Date(),
        level: 'info',
        message: 'Webhook trigger received'
      }],
      stats: {
        totalNodes: workflow.nodes.length,
        completedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        totalRetries: 0
      }
    });

    await execution.save();

    logger.info('Webhook trigger received', { workflowId, executionId: execution._id.toString() });

    res.status(202).json({
      success: true,
      data: {
        executionId: execution._id.toString(),
        status: 'pending',
        receivedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to process webhook trigger', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process webhook'
      }
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint not found: ${req.method} ${req.path}`
    }
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.nodeEnv === 'production' ? 'Internal server error' : err.message
    }
  });
});

// ==================== STARTUP ====================

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...', { uri: config.mongoUri });
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected');

    // Initialize DLQ service
    logger.info('Connecting DLQ service...');
    await dlqService.connect();
    logger.info('DLQ service connected');

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`REZ Flow Runtime started`, {
        port: config.port,
        env: config.nodeEnv,
        pid: process.pid
      });
      console.log(`\n🚀 REZ Flow Runtime running on port ${config.port}`);
      console.log(`   Health: http://localhost:${config.port}/health`);
      console.log(`   API: http://localhost:${config.port}/api`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await mongoose.disconnect();
          await dlqService.disconnect();
          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      shutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };

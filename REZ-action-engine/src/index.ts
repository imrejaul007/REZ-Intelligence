import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './config/logger';
import { ActionEngine } from './engine/action-engine';
import { ApprovalQueue } from './engine/approval-queue';
import { getEventConsumer, subscribe } from './integrations/event-consumer';
import { handleDormantFinanceUser, handleEMIDueReminder } from './handlers/financeHandler';
import { healthHandler, livenessHandler, readinessHandler } from './health';
import { ActionRequest } from './types/action-levels';
import { getAction, ACTION_REGISTRY } from './rules/action-registry';
import {
  validateRequest,
  ActionRequestSchema,
  ApproveRequestSchema,
  RejectRequestSchema,
  CancelRequestSchema,
  EventSubmissionSchema,
  PaginationQuerySchema,
  ActionStatsQuerySchema,
  ActionNotificationSchema,
} from './schemas';

/**
 * REZ Action Engine
 *
 * Main entry point for the action execution service.
 * Handles:
 * - Action execution based on events
 * - Human-in-loop approvals
 * - Event consumption from rez-event-platform
 */

// Create Express app
const app: Application = express();

// Middleware
app.use(helmet());
// CORS - restrict to known origins
// Security: In production, CORS_ORIGINS must be explicitly set. No fallback allowed.
const corsOriginsEnv = process.env.CORS_ORIGINS;
if (!corsOriginsEnv) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('CORS configuration error: CORS_ORIGINS environment variable is required in production. ' +
      'Set CORS_ORIGINS to a comma-separated list of allowed origins (e.g., CORS_ORIGINS=https://rez.money,https://admin.rez.money). ' +
      'This prevents unauthorized cross-origin requests.');
    process.exit(1);
  }
  // Development: Allow localhost for local testing
  // Remove this fallback once all developers have CORS_ORIGINS configured
  logger.warn('CORS_ORIGINS not set. Allowing localhost origins for development only. ' +
    'Set CORS_ORIGINS for production deployments.');
}
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(',')
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: origin '${origin}' is not allowed`));
  },
  credentials: true,
}));
app.use(compression());
// Request body size limits to prevent DoS attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });
  next();
});

// Initialize services
let actionEngine: ActionEngine;
let approvalQueue: ApprovalQueue;

async function initializeServices(): Promise<void> {
  logger.info('Initializing REZ Action Engine...');

  // Initialize action engine
  actionEngine = ActionEngine.getInstance();
  approvalQueue = actionEngine.getApprovalQueue();

  // Register finance event handlers
  subscribe('user.became_dormant', handleDormantFinanceUser);
  subscribe('loan.emi_due_soon', handleEMIDueReminder);

  // Initialize event consumer
  const eventConsumer = getEventConsumer();
  await eventConsumer.start();

  logger.info('REZ Action Engine initialized successfully');
}

// Health endpoints
app.get('/health', healthHandler);
app.get('/health/live', livenessHandler);
app.get('/health/ready', readinessHandler);

// Action execution endpoints
app.post('/actions/execute',
  validateRequest({ body: ActionRequestSchema }),
  async (req: Request, res: Response) => {
    try {
      const request: ActionRequest = req.body;

      // Validate action exists
      const action = getAction(request.actionId);
      if (!action) {
        res.status(404).json({
          error: `Unknown action: ${request.actionId}`,
          availableActions: Object.keys(ACTION_REGISTRY),
        });
        return;
      }

      const result = await actionEngine.executeAction(request);

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error executing action', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get action info
app.get('/actions/:actionId', (req: Request, res: Response) => {
  const action = getAction(req.params.actionId);

  if (!action) {
    res.status(404).json({
      error: `Action not found: ${req.params.actionId}`,
      availableActions: Object.keys(ACTION_REGISTRY),
    });
    return;
  }

  res.json(action);
});

// List all actions
app.get('/actions', (req: Request, res: Response) => {
  const actions = Object.values(ACTION_REGISTRY);
  res.json({
    count: actions.length,
    actions,
  });
});

// Approval endpoints
const approvalIdParams = require('zod').z.object({
  id: require('zod').z.string().uuid(),
});

app.get('/approvals',
  validateRequest({ query: PaginationQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let approvals;

      if (status) {
        const { ActionStatus } = await import('./types/action-levels');
        approvals = await approvalQueue.getApprovalsByStatus(
          ActionStatus[status as keyof typeof ActionStatus]
        );
      } else {
        approvals = await approvalQueue.getPendingApprovals();
      }

      res.json({
        count: approvals.length,
        approvals,
      });
    } catch (error) {
      logger.error('Error fetching approvals', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.get('/approvals/:id',
  validateRequest({ params: approvalIdParams }),
  async (req: Request, res: Response) => {
    try {
      const approval = await approvalQueue.getApprovalById(req.params.id);

      if (!approval) {
        res.status(404).json({ error: 'Approval not found' });
        return;
      }

      res.json(approval);
    } catch (error) {
      logger.error('Error fetching approval', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.post('/approvals/:id/approve',
  validateRequest({ params: approvalIdParams, body: ApproveRequestSchema }),
  async (req: Request, res: Response) => {
    try {
      const approverId = req.body.approverId || req.headers['x-user-id'] as string || 'system';

      const result = await approvalQueue.approve(req.params.id, approverId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        message: 'Approval granted',
        approval: result.request,
      });
    } catch (error) {
      logger.error('Error approving request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.post('/approvals/:id/reject',
  validateRequest({ params: approvalIdParams, body: RejectRequestSchema }),
  async (req: Request, res: Response) => {
    try {
      const rejectorId = req.body.rejectorId || req.headers['x-user-id'] as string || 'system';
      const reason = req.body.reason;

      const result = await approvalQueue.reject(req.params.id, rejectorId, reason);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        message: 'Request rejected',
        approval: result.request,
      });
    } catch (error) {
      logger.error('Error rejecting request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.post('/approvals/:id/cancel',
  validateRequest({ params: approvalIdParams, body: CancelRequestSchema }),
  async (req: Request, res: Response) => {
    try {
      const cancelledBy = req.body.cancelledBy || req.headers['x-user-id'] as string || 'system';

      const result = await approvalQueue.cancel(req.params.id, cancelledBy);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        message: 'Request cancelled',
        approval: result.request,
      });
    } catch (error) {
      logger.error('Error cancelling request', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Stats endpoint
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const [approvalStats, executionHistory] = await Promise.all([
      approvalQueue.getStats(),
      Promise.resolve(actionEngine.getHistory(100)),
    ]);

    res.json({
      approvals: approvalStats,
      executions: {
        recentCount: executionHistory.length,
        recent: executionHistory,
      },
    });
  } catch (error) {
    logger.error('Error fetching stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Event submission (for webhooks/testing)
app.post('/events',
  validateRequest({ body: EventSubmissionSchema }),
  async (req: Request, res: Response) => {
    try {
      const eventConsumer = getEventConsumer();
      await eventConsumer.submitEvent(req.body);

      res.status(202).json({
        message: 'Event accepted for processing',
        eventId: req.body.id,
      });
    } catch (error) {
      logger.error('Error submitting event', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Action notification endpoint (for support copilot integration)
app.post('/api/action/notification',
  validateRequest({ body: ActionNotificationSchema }),
  async (req: Request, res: Response) => {
    try {
      const { type, notification } = req.body;

      logger.info('Received action notification', { type, actionId: notification?.actionId });

      res.status(200).json({
        success: true,
        received: type,
      });
    } catch (error) {
      logger.error('Error processing action notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Handle payload too large
  if ((err as any).type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request body exceeds the 1MB limit'
    });
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down REZ Action Engine...');

  try {
    const eventConsumer = getEventConsumer();
    await eventConsumer.stop();
    await approvalQueue.close();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await initializeServices();

    app.listen(config.port, () => {
      logger.info(`REZ Action Engine listening on port ${config.port}`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        serviceName: config.serviceName,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

start();

export { app };

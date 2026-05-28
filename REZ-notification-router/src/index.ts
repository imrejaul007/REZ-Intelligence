import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import helmet from 'helmet';

import { logInfo, logError } from './services/logger.js';
import { connectDatabase, disconnectDatabase, pingDatabase } from './services/database.js';
import { requestLoggingMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';
import { createAuthMiddleware } from '@rez/security-middleware';
import { Notification } from './models/index.js';
import { sendToChannel } from './services/channels.js';
import { sendFeedback } from './services/feedback.js';
import {
  SendNotificationInputSchema,
  NotificationQuerySchema,
  NotificationIdParamSchema,
  UserIdParamSchema,
  ApiResponse,
  SendNotificationResponse,
  NotificationStatusResponse,
  NotificationChannel,
  ChannelInfo,
  ChannelStatus,
} from './types/index.js';

const PORT = parseInt(process.env.PORT || '4093', 10);

// Create Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use(requestLoggingMiddleware);

// Request ID middleware
app.use((req, _res, next) => {
  (req as Request & { requestId: string }).requestId =
    (req.headers['x-request-id'] as string) || uuidv4();
  next();
});

// Internal authentication middleware
const internalAuth = createAuthMiddleware();

// Health check endpoint (public)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-notification-router',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Ready check endpoint (public)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbReady = await pingDatabase();
    if (dbReady) {
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not ready', error: 'Database not available' });
    }
  } catch {
    res.status(503).json({ status: 'not ready', error: 'Database check failed' });
  }
});

// Apply auth middleware to API routes
app.use('/api', internalAuth as Parameters<typeof app.use>[1]);

/**
 * POST /api/notify
 * Send notification to user
 */
app.post('/api/notify', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validationResult = SendNotificationInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.issues[0]?.message || 'Invalid input',
          details: validationResult.error.issues.map(issue => ({ path: issue.path, message: issue.message })) as unknown as Record<string, unknown>,
        },
      };
      res.status(400).json(response);
      return;
    }

    const input = validationResult.data;
    const notificationId = `notif_${uuidv4()}`;

    // Create notification record
    const notification = new Notification({
      notificationId,
      userId: input.userId,
      type: input.type,
      content: input.content,
      channels: input.channels.map((channel) => ({
        channel,
        status: 'queued',
      })),
    });

    await notification.save();

    // Send to each channel
    const results: Array<{ channel: NotificationChannel; status: ChannelStatus; id?: string }> = [];

    for (const channelInfo of notification.channels) {
      const result = await sendToChannel(channelInfo.channel, {
        userId: input.userId,
        title: input.content.title,
        body: input.content.body,
        data: input.data,
      });

      // Update channel status
      channelInfo.status = result.status;
      channelInfo.externalId = result.externalId;
      channelInfo.sentAt = new Date();
      if (result.error) channelInfo.error = result.error;

      results.push({
        channel: channelInfo.channel,
        status: result.status,
        id: result.externalId,
      });
    }

    // Save updated notification
    notification.channels = notification.channels.map((c) => ({
      channel: c.channel,
      status: c.status,
      externalId: c.externalId,
      sentAt: c.sentAt,
      error: c.error,
    })) as ChannelInfo[];
    await notification.save();

    // Send feedback to feedback collector
    await sendFeedback('nudge_sent', notificationId, input.userId, input.type, input.data);

    logInfo('Notification sent', {
      notificationId,
      userId: input.userId,
      channels: results.map((r) => r.channel),
    });

    const response: ApiResponse<SendNotificationResponse> = {
      success: true,
      data: {
        notificationId,
        notifications: results,
      },
    };

    res.json(response);
  } catch (error) {
    logError('Notify failed', { error: (error as Error).message });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/notify/:notificationId
 * Get notification status
 */
app.get('/api/notify/:notificationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = NotificationIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid notification ID',
        },
      };
      res.status(400).json(response);
      return;
    }

    const { notificationId } = paramValidation.data;
    const notification = await Notification.findOne({ notificationId });

    if (!notification) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<NotificationStatusResponse> = {
      success: true,
      data: {
        notificationId: notification.notificationId,
        userId: notification.userId,
        type: notification.type,
        channels: notification.channels,
        content: notification.content,
        createdAt: notification.createdAt,
      },
    };

    res.json(response);
  } catch (error) {
    logError('Failed to get notification status', { error: (error as Error).message });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/notifications/:userId
 * Get user notifications
 */
app.get('/api/notifications/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = UserIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user ID',
        },
      };
      res.status(400).json(response);
      return;
    }

    const queryValidation = NotificationQuerySchema.safeParse(req.query);
    const limit = queryValidation.success ? queryValidation.data.limit : 50;
    const unreadOnly = queryValidation.success ? queryValidation.data.unreadOnly === 'true' : false;

    const { userId } = paramValidation.data;
    const query: Record<string, unknown> = { userId };

    if (unreadOnly) {
      query['channels.status'] = { $ne: 'delivered' };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const response: ApiResponse<typeof notifications> = {
      success: true,
      data: notifications,
    };

    res.json(response);
  } catch (error) {
    logError('Failed to get user notifications', { error: (error as Error).message });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/notify/:notificationId/click
 * Track notification click
 */
app.post('/api/notify/:notificationId/click', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramValidation = NotificationIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid notification ID',
        },
      };
      res.status(400).json(response);
      return;
    }

    const { notificationId } = paramValidation.data;
    const notification = await Notification.findOne({ notificationId });

    if (notification) {
      // Update channel status
      for (const channel of notification.channels) {
        if (channel.status === 'sent') {
          channel.deliveredAt = new Date();
          channel.status = 'delivered';
        }
      }
      await notification.save();

      // Send feedback
      await sendFeedback(
        'nudge_clicked',
        notificationId,
        notification.userId || '',
        notification.type,
        notification.content.data
      );
    }

    const response: ApiResponse = { success: true };
    res.json(response);
  } catch (error) {
    logError('Failed to track notification click', { error: (error as Error).message });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      },
    };
    res.status(500).json(response);
  }
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logInfo(`Received ${signal}, shutting down gracefully...`);

  try {
    await disconnectDatabase();
    logInfo('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logError('Error during shutdown', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start server
async function main(): Promise<void> {
  try {
    logInfo('Starting REZ Notification Router...', { port: PORT });

    // Connect to MongoDB
    await connectDatabase();

    const server = app.listen(PORT, () => {
      logInfo(`Notification Router running on port ${PORT}`);
    });

    server.on('error', (error: Error) => {
      logError('Server error', { error: error.message });
      process.exit(1);
    });

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      logError('Unhandled Rejection', { reason });
    });

    process.on('uncaughtException', (error: Error) => {
      logError('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logError('Startup failed', { error: (error as Error).message });
    process.exit(1);
  }
}

main();

// Export for testing
export { app };

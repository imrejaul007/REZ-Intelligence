import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { appService } from '../services/appService';
import { pushService } from '../services/pushService';
import {
  appApiKeyAuth,
  internalServiceAuth,
  combinedAuth,
  validateUserId,
  validateBody,
  rateLimit,
} from '../middleware/auth';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const SendMessageSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SendPushSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string()).optional(),
});

const RegisterDeviceSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

const SendNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  type: z.enum(['info', 'success', 'warning', 'error', 'chat', 'order', 'payment', 'system']).default('info'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  data: z.record(z.unknown()).optional(),
  actionUrl: z.string().url().optional(),
});

const SubscribeTopicSchema = z.object({
  userId: z.string().min(1),
  topic: z.string().min(1).max(100),
});

// Health check (no auth required)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-app-bridge',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/message
 * Send message to orchestrator for processing
 */
router.post(
  '/api/message',
  combinedAuth,
  rateLimit(60, 60000), // 60 requests per minute
  validateBody(SendMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, message, sessionId, metadata } = req.body;

      logger.info('Message received', { userId, sessionId });

      const response = await appService.handleMessage(userId, message);

      if (response.success) {
        res.status(200).json(response);
      } else {
        res.status(500).json(response);
      }
    } catch (error) {
      logger.error('Error in message endpoint', { error });
      res.status(500).json({
        success: false,
        responseId: '',
        error: 'Internal server error',
      });
    }
  }
);

/**
 * POST /api/push
 * Send push notification to user
 */
router.post(
  '/api/push',
  combinedAuth,
  rateLimit(100, 60000), // 100 requests per minute
  validateBody(SendPushSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, title, body, data } = req.body;

      logger.info('Push notification request', { userId, title });

      await pushService.sendPush(userId, title, body, data);

      res.status(200).json({
        success: true,
        message: 'Push notification sent',
      });
    } catch (error) {
      logger.error('Error sending push notification', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to send push notification',
      });
    }
  }
);

/**
 * POST /api/device/register
 * Register device token for push notifications
 */
router.post(
  '/api/device/register',
  combinedAuth,
  rateLimit(20, 60000), // 20 requests per minute
  validateBody(RegisterDeviceSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, token, platform } = req.body;

      logger.info('Device token registration', { userId, platform });

      await pushService.registerDeviceToken(userId, token, platform);

      res.status(200).json({
        success: true,
        message: 'Device registered successfully',
      });
    } catch (error) {
      logger.error('Error registering device', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to register device',
      });
    }
  }
);

/**
 * DELETE /api/device/unregister
 * Unregister device token
 */
router.delete(
  '/api/device/unregister',
  combinedAuth,
  rateLimit(20, 60000),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.query.userId as string;
      const token = req.query.token as string;

      if (!userId || !token) {
        res.status(400).json({
          success: false,
          error: 'userId and token are required',
        });
        return;
      }

      logger.info('Device token unregistration', { userId });

      await pushService.removeDeviceToken(userId, token);

      res.status(200).json({
        success: true,
        message: 'Device unregistered successfully',
      });
    } catch (error) {
      logger.error('Error unregistering device', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to unregister device',
      });
    }
  }
);

/**
 * POST /api/notification
 * Send in-app notification
 */
router.post(
  '/api/notification',
  combinedAuth,
  rateLimit(100, 60000),
  validateBody(SendNotificationSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, title, body, type, priority, data, actionUrl } = req.body;

      logger.info('In-app notification request', { userId, type });

      await appService.sendInAppNotification(userId, {
        userId,
        title,
        body,
        type,
        priority,
        data,
        actionUrl,
      });

      res.status(200).json({
        success: true,
        message: 'Notification sent',
      });
    } catch (error) {
      logger.error('Error sending notification', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to send notification',
      });
    }
  }
);

/**
 * POST /api/topic/subscribe
 * Subscribe user to push notification topic
 */
router.post(
  '/api/topic/subscribe',
  combinedAuth,
  rateLimit(50, 60000),
  validateBody(SubscribeTopicSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, topic } = req.body;

      logger.info('Topic subscription request', { userId, topic });

      await pushService.subscribeToTopic(userId, topic);

      res.status(200).json({
        success: true,
        message: `Subscribed to topic: ${topic}`,
      });
    } catch (error) {
      logger.error('Error subscribing to topic', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe to topic',
      });
    }
  }
);

/**
 * POST /api/topic/unsubscribe
 * Unsubscribe user from push notification topic
 */
router.post(
  '/api/topic/unsubscribe',
  combinedAuth,
  rateLimit(50, 60000),
  validateBody(SubscribeTopicSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, topic } = req.body;

      logger.info('Topic unsubscription request', { userId, topic });

      await pushService.unsubscribeFromTopic(userId, topic);

      res.status(200).json({
        success: true,
        message: `Unsubscribed from topic: ${topic}`,
      });
    } catch (error) {
      logger.error('Error unsubscribing from topic', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe from topic',
      });
    }
  }
);

/**
 * GET /api/context/:userId
 * Get user context from orchestrator
 */
router.get(
  '/api/context/:userId',
  combinedAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const context = await appService.getUserContext(userId);

      if (context) {
        res.status(200).json(context);
      } else {
        res.status(404).json({
          success: false,
          error: 'Context not found',
        });
      }
    } catch (error) {
      logger.error('Error fetching user context', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user context',
      });
    }
  }
);

export default router;

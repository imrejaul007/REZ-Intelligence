/**
 * Subscriptions Routes
 * API endpoints for managing event subscriptions
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, verifyInternalToken, requirePermission, Permission } from '../middleware/auth';
import { subscriberService } from '../services/subscriber';
import { EventValidator } from '../services/eventValidator';
import { SubscriptionCreatePayload, SubscriptionUpdatePayload } from '../models/Subscription';
import { subscriptionLogger } from '../services/logger';

const router = Router();

/**
 * POST /subscriptions
 * Create a new subscription
 */
router.post(
  '/',
  verifyInternalToken,
  requirePermission(Permission.SUBSCRIBE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = req.body as SubscriptionCreatePayload;

      // Validate payload
      EventValidator.validateSubscriptionPayload(payload);

      // Ensure at least one URL field is provided
      if (!payload.url && !payload.webhookUrl && !payload.callbackUrl) {
        res.status(400).json({
          error: 'Bad Request',
          code: 'MISSING_URL',
          message: 'At least one of url, webhookUrl, or callbackUrl is required',
          requestId: req.requestId,
        });
        return;
      }

      // Create subscription
      const subscription = await subscriberService.subscribe(payload);

      subscriptionLogger.info('Subscription created via API', {
        subscriptionId: subscription.subscriptionId,
        subscriberId: subscription.subscriberId,
        eventTypes: subscription.eventTypes,
        requestId: req.requestId,
      });

      res.status(201).json({
        success: true,
        subscription,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to create subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      if (error instanceof Error && error.message.includes('Maximum subscriptions')) {
        res.status(429).json({
          error: 'Too Many Requests',
          code: 'MAX_SUBSCRIPTIONS',
          message: error.message,
          requestId: req.requestId,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'SUBSCRIPTION_FAILED',
        message: 'Failed to create subscription',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /subscriptions
 * List subscriptions
 */
router.get(
  '/',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriberId, eventType, status } = req.query;

      let subscriptions;

      if (subscriberId) {
        subscriptions = subscriberService.getSubscriptionsBySubscriber(subscriberId as string);
      } else if (eventType) {
        subscriptions = subscriberService.getSubscriptionsByEventType(eventType as string);
      } else {
        // Return all subscriptions stats
        const stats = subscriberService.getStats();
        res.json({
          stats,
          requestId: req.requestId,
        });
        return;
      }

      // Filter by status if provided
      if (status) {
        subscriptions = subscriptions.filter((s) => s.status === status);
      }

      res.json({
        subscriptions,
        count: subscriptions.length,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to list subscriptions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'QUERY_FAILED',
        message: 'Failed to list subscriptions',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /subscriptions/:subscriptionId
 * Get specific subscription
 */
router.get(
  '/:subscriptionId',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriptionId } = req.params;

      const subscription = subscriberService.getSubscription(subscriptionId);

      if (!subscription) {
        res.status(404).json({
          error: 'Not Found',
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: `Subscription ${subscriptionId} not found`,
          requestId: req.requestId,
        });
        return;
      }

      res.json({
        subscription,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to get subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'QUERY_FAILED',
        message: 'Failed to get subscription',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * PUT /subscriptions/:subscriptionId
 * Update subscription
 */
router.put(
  '/:subscriptionId',
  verifyInternalToken,
  requirePermission(Permission.SUBSCRIBE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriptionId } = req.params;
      const updates = req.body as SubscriptionUpdatePayload;

      // Validate URL if provided
      if (updates.url || updates.webhookUrl || updates.callbackUrl) {
        const url = updates.url || updates.webhookUrl || updates.callbackUrl;
        try {
          new URL(url!);
        } catch {
          res.status(400).json({
            error: 'Bad Request',
            code: 'INVALID_URL',
            message: 'Invalid URL format',
            requestId: req.requestId,
          });
          return;
        }
      }

      const subscription = await subscriberService.updateSubscription(subscriptionId, updates);

      subscriptionLogger.info('Subscription updated via API', {
        subscriptionId,
        requestId: req.requestId,
      });

      res.json({
        success: true,
        subscription,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to update subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: req.params.subscriptionId,
        requestId: req.requestId,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: error.message,
          requestId: req.requestId,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'UPDATE_FAILED',
        message: 'Failed to update subscription',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * DELETE /subscriptions/:subscriptionId
 * Delete subscription
 */
router.delete(
  '/:subscriptionId',
  verifyInternalToken,
  requirePermission(Permission.SUBSCRIBE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subscriptionId } = req.params;

      await subscriberService.unsubscribe(subscriptionId);

      subscriptionLogger.info('Subscription deleted via API', {
        subscriptionId,
        requestId: req.requestId,
      });

      res.json({
        success: true,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to delete subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId: req.params.subscriptionId,
        requestId: req.requestId,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: error.message,
          requestId: req.requestId,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'DELETE_FAILED',
        message: 'Failed to delete subscription',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /subscriptions/stats
 * Get subscription statistics
 */
router.get(
  '/stats',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = subscriberService.getStats();

      res.json({
        stats,
        requestId: req.requestId,
      });
    } catch (error) {
      subscriptionLogger.error('Failed to get subscription stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'STATS_FAILED',
        message: 'Failed to get statistics',
        requestId: req.requestId,
      });
    }
  }
);

export { router as subscriptionRoutes };

/**
 * Events Routes
 * API endpoints for publishing and querying events
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, verifyInternalToken, requirePermission, Permission } from '../middleware/auth';
import { PublisherService, getPublisherService } from '../services/publisher';
import { EventValidator, ValidationError } from '../services/eventValidator';
import { RedisPubSubService } from '../services/redisPubSub';
import { getValidEventTypes, getEventTypeInfo } from '../services/eventSchema';
import { EventCreatePayload, BatchEventPayload } from '../models/Event';
import { eventLogger } from '../services/logger';

const router = Router();

/**
 * POST /events/publish
 * Publish a single event
 */
router.post(
  '/publish',
  verifyInternalToken,
  requirePermission(Permission.PUBLISH),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = req.body as EventCreatePayload;

      // Validate payload
      EventValidator.validateEventPayload(payload);

      // Get publisher service
      const publisher = getPublisherService();

      // Publish event
      const result = await publisher.publish(payload);

      if (result.success) {
        res.status(201).json({
          success: true,
          eventId: result.eventId,
          eventType: result.eventType,
          channels: result.channels,
          subscriberCount: result.subscriberCount,
          timestamp: result.timestamp,
          requestId: req.requestId,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          eventType: result.eventType,
          requestId: req.requestId,
        });
      }
    } catch (error) {
      eventLogger.error('Publish failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
        body: req.body,
      });

      if (error instanceof ValidationError) {
        res.status(400).json({
          error: 'Validation Error',
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
          requestId: req.requestId,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'PUBLISH_FAILED',
        message: 'Failed to publish event',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * POST /events/publish/batch
 * Publish multiple events
 */
router.post(
  '/publish/batch',
  verifyInternalToken,
  requirePermission(Permission.PUBLISH),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { events, atomic = false } = req.body as BatchEventPayload;

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          code: 'INVALID_BATCH',
          message: 'events must be a non-empty array',
          requestId: req.requestId,
        });
        return;
      }

      // Validate all events first
      const validation = EventValidator.validateBatchPayload(events);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation Error',
          code: 'VALIDATION_ERROR',
          message: 'Some events failed validation',
          errors: validation.errors,
          requestId: req.requestId,
        });
        return;
      }

      // Get publisher service
      const publisher = getPublisherService();

      // Publish batch
      const result = await publisher.publishBatch(events, atomic);

      res.status(result.success ? 201 : 207).json({
        success: result.success,
        total: events.length,
        results: result.results,
        requestId: req.requestId,
      });
    } catch (error) {
      eventLogger.error('Batch publish failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'BATCH_PUBLISH_FAILED',
        message: 'Failed to publish batch',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /events/types
 * Get all valid event types
 */
router.get('/types', async (req: AuthenticatedRequest, res: Response) => {
  const eventTypes = getValidEventTypes();
  const typesInfo = eventTypes.map((type) => ({
    type,
    ...getEventTypeInfo(type),
  }));

  res.json({
    eventTypes,
    count: eventTypes.length,
    typesInfo,
    requestId: req.requestId,
  });
});

/**
 * GET /events/history
 * Get event history
 */
router.get(
  '/history',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventType, limit = '100', offset = '0' } = req.query;

      const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 1000);
      const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      // Get from Redis
      const redisPubSub = req.app.get('redisPubSub') as RedisPubSubService;
      const events = await redisPubSub.getEventHistory(
        eventType as string | undefined,
        parsedLimit,
        parsedOffset
      );

      res.json({
        events,
        count: events.length,
        limit: parsedLimit,
        offset: parsedOffset,
        requestId: req.requestId,
      });
    } catch (error) {
      eventLogger.error('Failed to get event history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'QUERY_FAILED',
        message: 'Failed to get event history',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /events/:eventId
 * Get specific event by ID
 */
router.get(
  '/:eventId',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventId } = req.params;
      const { eventType } = req.query;

      if (!eventType) {
        res.status(400).json({
          error: 'Bad Request',
          code: 'MISSING_PARAMETER',
          message: 'eventType query parameter is required',
          requestId: req.requestId,
        });
        return;
      }

      const redisPubSub = req.app.get('redisPubSub') as RedisPubSubService;
      const event = await redisPubSub.getStoredEvent(eventId, eventType as string);

      if (!event) {
        res.status(404).json({
          error: 'Not Found',
          code: 'EVENT_NOT_FOUND',
          message: `Event ${eventId} not found`,
          requestId: req.requestId,
        });
        return;
      }

      res.json({
        event,
        requestId: req.requestId,
      });
    } catch (error) {
      eventLogger.error('Failed to get event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
      });

      res.status(500).json({
        error: 'Internal Server Error',
        code: 'QUERY_FAILED',
        message: 'Failed to get event',
        requestId: req.requestId,
      });
    }
  }
);

/**
 * GET /events/stats
 * Get event statistics
 */
router.get(
  '/stats',
  verifyInternalToken,
  requirePermission(Permission.READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const publisher = getPublisherService();
      const stats = publisher.getStats();

      res.json({
        stats,
        requestId: req.requestId,
      });
    } catch (error) {
      eventLogger.error('Failed to get stats', {
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

export { router as eventRoutes };

/**
 * Event Routes
 */

import { Router, Request, Response } from 'express';
import { EventBusService } from '../services/EventBusService';
import { verifyInternalToken, AuthenticatedRequest } from '../middleware/auth';
import { publishLimiter, eventBusLimiter } from '../middleware/rateLimit';

const router = Router();
const eventBus = new EventBusService();

// Sanitize event type to prevent Redis key injection
function sanitizeEventType(eventType: string): string {
  // Remove any characters that could be used for Redis key injection
  return eventType.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

/**
 * POST /api/events/publish
 * Publish an event (requires authentication)
 */
router.post('/publish', verifyInternalToken, publishLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const { eventType, userId, merchantId, data, correlationId, idempotencyKey, source, priority } = req.body;

    if (!eventType || !source) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'eventType and source are required'
      });
    }

    // Validate event type length
    if (eventType.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_EVENT_TYPE',
        message: 'eventType must be less than 100 characters'
      });
    }

    // Sanitize event type
    const sanitizedEventType = sanitizeEventType(eventType);

    const eventId = await eventBus.publish({
      eventType: sanitizedEventType,
      userId,
      merchantId,
      data: data || {},
      correlationId,
      idempotencyKey,
      source,
      priority,
    });

    res.json({ success: true, eventId });
  } catch (error) {
    console.error('Error publishing event:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'PUBLISH_FAILED',
      message: 'Failed to publish event'
    });
  }
});

/**
 * GET /api/events/history
 * Get event history (requires authentication)
 */
router.get('/history', verifyInternalToken, eventBusLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const { eventType, userId, limit = '100', offset = '0' } = req.query;

    // Validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 1000);
    const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

    const events = await eventBus.getEventHistory({
      eventType: eventType as string,
      userId: userId as string,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Error getting event history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'QUERY_FAILED',
      message: 'Failed to get event history'
    });
  }
});

/**
 * GET /api/events/:eventType
 * Get events by type (requires authentication)
 */
router.get('/:eventType', verifyInternalToken, eventBusLimiter.middleware(), async (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { userId, limit = '100' } = req.query;

    // Sanitize and validate event type
    const sanitizedEventType = sanitizeEventType(eventType);
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 1000);

    const events = await eventBus.getEventHistory({
      eventType: sanitizedEventType,
      userId: userId as string,
      limit: parsedLimit,
    });

    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'QUERY_FAILED',
      message: 'Failed to get events'
    });
  }
});

export { router as eventRoutes };

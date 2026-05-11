/**
 * Event Routes
 */

import { Router, Request, Response } from 'express';
import { EventBusService } from '../services/EventBusService';

const router = Router();
const eventBus = new EventBusService();

/**
 * POST /api/events/publish
 * Publish an event
 */
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const { eventType, userId, merchantId, data, correlationId, idempotencyKey, source, priority } = req.body;

    if (!eventType || !source) {
      return res.status(400).json({ error: 'eventType and source are required' });
    }

    const eventId = await eventBus.publish({
      eventType,
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
    res.status(500).json({ error: 'Failed to publish event' });
  }
});

/**
 * GET /api/events/history
 * Get event history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { eventType, userId, limit = '100', offset = '0' } = req.query;

    const events = await eventBus.getEventHistory({
      eventType: eventType as string,
      userId: userId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Error getting event history:', error);
    res.status(500).json({ error: 'Failed to get event history' });
  }
});

/**
 * GET /api/events/:eventType
 * Get events by type
 */
router.get('/:eventType', async (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { userId, limit = '100' } = req.query;

    const events = await eventBus.getEventHistory({
      eventType,
      userId: userId as string,
      limit: parseInt(limit as string),
    });

    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

export { router as eventRoutes };

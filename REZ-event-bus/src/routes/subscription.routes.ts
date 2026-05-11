/**
 * Subscription Routes
 */

import { Router, Request, Response } from 'express';
import { EventBusService } from '../services/EventBusService';

const router = Router();
const eventBus = new EventBusService();

/**
 * POST /api/subscriptions
 * Create subscription
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { service, eventType, url, active = true } = req.body;

    if (!service || !eventType || !url) {
      return res.status(400).json({ error: 'service, eventType, and url are required' });
    }

    const subscription = await eventBus.subscribe({
      service,
      eventType,
      url,
      active,
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * GET /api/subscriptions
 * List subscriptions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { service, eventType } = req.query;

    // In production, query from Redis
    const subscriptions: any[] = [];

    if (service) {
      return res.json({ subscriptions: subscriptions.filter((s) => s.service === service) });
    }

    if (eventType) {
      return res.json({ subscriptions: subscriptions.filter((s) => s.eventType === eventType) });
    }

    res.json({ subscriptions });
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

/**
 * DELETE /api/subscriptions/:eventType/:service
 * Delete subscription
 */
router.delete('/:eventType/:service', async (req: Request, res: Response) => {
  try {
    const { eventType, service } = req.params;

    await eventBus.unsubscribe(eventType, service);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

/**
 * PUT /api/subscriptions/:id/activate
 * Activate subscription
 */
router.put('/:id/activate', async (req: Request, res: Response) => {
  try {
    // In production, update in Redis
    res.json({ success: true });
  } catch (error) {
    console.error('Error activating subscription:', error);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
});

/**
 * PUT /api/subscriptions/:id/deactivate
 * Deactivate subscription
 */
router.put('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    // In production, update in Redis
    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating subscription:', error);
    res.status(500).json({ error: 'Failed to deactivate subscription' });
  }
});

export { router as subscriptionRoutes };

/**
 * Webhook Routes
 * API endpoints for webhook management and configuration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChannelType, ApiResponse } from '../types';
import { logger } from '../config/logger';

const webhookRouter = Router();
const webhookLogger = logger.child({ component: 'WebhookRoutes' });

// Webhook event types
interface WebhookEvent {
  id: string;
  channel: ChannelType;
  event: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

// In-memory event store (in production, use Redis or database)
const eventStore: Map<string, WebhookEvent> = new Map();

// Request validation schemas
const registerWebhookSchema = z.object({
  channel: z.enum(['whatsapp', 'voice', 'copilot', 'web']),
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  enabled: z.boolean().default(true),
});

const webhookDeliverySchema = z.object({
  webhookId: z.string(),
  eventId: z.string(),
  deliveryStatus: z.enum(['success', 'failed', 'pending']),
  responseCode: z.number().optional(),
  error: z.string().optional(),
});

// Channel webhook URLs (configured externally)
const registeredWebhooks: Map<ChannelType, {
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
}> = new Map();

/**
 * Register a webhook endpoint
 */
webhookRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerWebhookSchema.parse(req.body);

    webhookLogger.info('Registering webhook', {
      channel: body.channel,
      url: body.url,
    });

    registeredWebhooks.set(body.channel, {
      url: body.url,
      events: body.events || ['message', 'delivery', 'read'],
      secret: body.secret,
      enabled: body.enabled,
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Webhook registered successfully',
        channel: body.channel,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors },
      });
      return;
    }
    next(error);
  }
});

/**
 * Get registered webhooks
 */
webhookRouter.get('/', async (req: Request, res: Response) => {
  const webhooks: Record<string, unknown>[] = [];

  for (const [channel, config] of registeredWebhooks.entries()) {
    webhooks.push({
      channel,
      url: config.url,
      events: config.events,
      enabled: config.enabled,
    });
  }

  res.json({
    success: true,
    data: { webhooks },
  });
});

/**
 * Delete webhook for a channel
 */
webhookRouter.delete('/:channel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = req.params;

    if (!registeredWebhooks.has(channel as ChannelType)) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found for this channel' },
      });
      return;
    }

    registeredWebhooks.delete(channel as ChannelType);

    webhookLogger.info('Webhook deleted', { channel });

    res.json({
      success: true,
      data: { message: 'Webhook deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get webhook events
 */
webhookRouter.get('/events', async (req: Request, res: Response) => {
  const { channel, status, limit = '50' } = req.query;

  let events = Array.from(eventStore.values());

  // Filter by channel
  if (channel) {
    events = events.filter(e => e.channel === channel);
  }

  // Filter by status
  if (status === 'pending') {
    events = events.filter(e => !e.processed);
  } else if (status === 'processed') {
    events = events.filter(e => e.processed);
  }

  // Sort by received date (newest first) and limit
  events = events
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, parseInt(limit as string, 10));

  res.json({
    success: true,
    data: { events },
  });
});

/**
 * Get single webhook event
 */
webhookRouter.get('/events/:eventId', async (req: Request, res: Response) => {
  const event = eventStore.get(req.params.eventId);

  if (!event) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: event,
  });
});

/**
 * Retry failed webhook delivery
 */
webhookRouter.post('/events/:eventId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = eventStore.get(req.params.eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
      return;
    }

    if (event.processed && !event.error) {
      res.status(400).json({
        success: false,
        error: { code: 'ALREADY_PROCESSED', message: 'Event already delivered successfully' },
      });
      return;
    }

    // Retry delivery
    await deliverWebhook(event);

    res.json({
      success: true,
      data: { message: 'Webhook delivery retried' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record webhook delivery status
 */
webhookRouter.post('/delivery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = webhookDeliverySchema.parse(req.body);

    const event = eventStore.get(body.eventId);

    if (!event) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
      return;
    }

    event.processed = body.deliveryStatus === 'success';
    event.processedAt = new Date();
    event.error = body.error;

    webhookLogger.info('Webhook delivery recorded', {
      eventId: body.eventId,
      status: body.deliveryStatus,
    });

    res.json({
      success: true,
      data: { message: 'Delivery status recorded' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors },
      });
      return;
    }
    next(error);
  }
});

/**
 * Webhook health check
 */
webhookRouter.get('/health', async (req: Request, res: Response) => {
  const { channel } = req.query;

  const health: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    registeredWebhooks: registeredWebhooks.size,
    events: {
      total: eventStore.size,
      pending: Array.from(eventStore.values()).filter(e => !e.processed).length,
      failed: Array.from(eventStore.values()).filter(e => e.error).length,
    },
  };

  // Check specific channel webhook health
  if (channel) {
    const webhook = registeredWebhooks.get(channel as ChannelType);
    health.channel = {
      registered: Boolean(webhook),
      enabled: webhook?.enabled,
    };
  }

  res.json({
    success: true,
    data: health,
  });
});

/**
 * Store incoming webhook event
 */
export function recordWebhookEvent(
  channel: ChannelType,
  event: string,
  payload: Record<string, unknown>
): string {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const webhookEvent: WebhookEvent = {
    id: eventId,
    channel,
    event,
    payload,
    receivedAt: new Date(),
    processed: false,
  };

  eventStore.set(eventId, webhookEvent);

  // Keep only last 1000 events
  if (eventStore.size > 1000) {
    const oldestKey = eventStore.keys().next().value;
    if (oldestKey) {
      eventStore.delete(oldestKey);
    }
  }

  webhookLogger.debug('Webhook event recorded', { eventId, channel, event });

  return eventId;
}

/**
 * Deliver webhook to registered endpoint
 */
async function deliverWebhook(event: WebhookEvent): Promise<void> {
  const webhook = registeredWebhooks.get(event.channel);

  if (!webhook || !webhook.enabled) {
    webhookLogger.debug('No webhook registered for channel', { channel: event.channel });
    return;
  }

  try {
    const axios = (await import('axios')).default;

    await axios.post(webhook.url, {
      event,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret || '',
        'X-Webhook-Event': event.id,
      },
      timeout: 10000,
    });

    event.processed = true;
    event.processedAt = new Date();

    webhookLogger.info('Webhook delivered successfully', {
      eventId: event.id,
      channel: event.channel,
    });
  } catch (error) {
    event.error = error instanceof Error ? error.message : 'Delivery failed';
    webhookLogger.error('Webhook delivery failed', {
      eventId: event.id,
      channel: event.channel,
      error: event.error,
    });
  }
}

export { webhookRouter, recordWebhookEvent };

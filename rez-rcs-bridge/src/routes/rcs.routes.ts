import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RCSService } from '../services/rcsService';
import { internalAuthMiddleware, webhookSignatureMiddleware } from '../utils/auth';
import { logger } from '../utils/logger.js';
import {
  RCSCardSchema,
  RCSButtonSchema,
  RCSMessageStatus,
  RCSInboundMessage,
  RCSMessageType,
} from '../models/RCSCard';

const router = Router();
const rcsService = new RCSService();

// Validation schemas for request bodies
const sendRichMessageSchema = z.object({
  to: z.string().min(10).max(15),
  card: RCSCardSchema,
  carrier: z.enum(['jio', 'airtel']).optional(),
  from: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

const sendCarouselSchema = z.object({
  to: z.string().min(10).max(15),
  cards: z.array(RCSCardSchema).min(1).max(10),
  carrier: z.enum(['jio', 'airtel']).optional(),
  from: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

const sendButtonSchema = z.object({
  to: z.string().min(10).max(15),
  text: z.string().min(1).max(500),
  buttons: z.array(RCSButtonSchema).min(1).max(4),
  carrier: z.enum(['jio', 'airtel']).optional(),
  from: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

/**
 * POST /api/rcs/send
 * Send a rich card message
 */
router.post(
  '/send',
  internalAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = sendRichMessageSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.format(),
          },
        });
        return;
      }

      const { to, card, carrier, from, tags } = validation.data;

      // Add message ID to tags for tracking
      const enrichedTags: Record<string, string> = {
        ...(tags || {}),
        messageId: tags?.messageId || uuidv4(),
        serviceName: (req as Request & { serviceName?: string }).serviceName || 'rcs-bridge',
      };

      const result = await rcsService.sendRichMessage(to, card, {
        carrier,
        from,
        tags: enrichedTags,
      });

      const statusCode = result.success ? 200 : 500;

      res.status(statusCode).json({
        success: result.success,
        messageId: result.messageId,
        carrier: result.carrier,
        status: result.status,
        error: result.error,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('RCS route error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/rcs/send-carousel
 * Send a carousel of rich cards
 */
router.post(
  '/send-carousel',
  internalAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = sendCarouselSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.format(),
          },
        });
        return;
      }

      const { to, cards, carrier, from, tags } = validation.data;

      const enrichedTags: Record<string, string> = {
        ...(tags || {}),
        messageId: tags?.messageId || uuidv4(),
        serviceName: 'rcs-bridge',
      };

      const result = await rcsService.sendCarousel(to, cards, {
        carrier,
        from,
        tags: enrichedTags,
      });

      const statusCode = result.success ? 200 : 500;

      res.status(statusCode).json({
        success: result.success,
        messageId: result.messageId,
        carrier: result.carrier,
        status: result.status,
        error: result.error,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('RCS route error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/rcs/send-button
 * Send text message with suggestion buttons
 */
router.post(
  '/send-button',
  internalAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = sendButtonSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.format(),
          },
        });
        return;
      }

      const { to, text, buttons, carrier, from, tags } = validation.data;

      const enrichedTags: Record<string, string> = {
        ...(tags || {}),
        messageId: tags?.messageId || uuidv4(),
        serviceName: 'rcs-bridge',
      };

      const result = await rcsService.sendButton(to, text, buttons, {
        carrier,
        from,
        tags: enrichedTags,
      });

      const statusCode = result.success ? 200 : 500;

      res.status(statusCode).json({
        success: result.success,
        messageId: result.messageId,
        carrier: result.carrier,
        status: result.status,
        error: result.error,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('RCS route error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * GET /api/rcs/status/:messageId
 * Get message delivery status
 */
router.get(
  '/status/:messageId',
  internalAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message ID is required',
          },
        });
        return;
      }

      const status = await rcsService.getMessageStatus(messageId);

      if (status === null) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Message not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        messageId,
        status,
        carrier: rcsService.getActiveCarrier(),
      });
    } catch (error) {
      logger.error('RCS route error', { error: (error as Error).message });
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * GET /api/rcs/carriers
 * Get available carriers and their status
 */
router.get(
  '/carriers',
  internalAuthMiddleware,
  async (_req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      carriers: {
        jio: {
          available: rcsService.isCarrierAvailable('jio'),
          name: 'Jio RCS',
        },
        airtel: {
          available: rcsService.isCarrierAvailable('airtel'),
          name: 'Airtel RCS',
        },
      },
      active: rcsService.getActiveCarrier(),
    });
  }
);

/**
 * POST /webhook/rcs
 * Inbound webhook for RCS status updates and messages
 * Supports both Jio and Airtel webhooks
 */
router.post(
  '/webhook/rcs',
  webhookSignatureMiddleware('jio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Determine carrier from headers or body
      const carrier =
        (req.headers['x-carrier'] as string) || 'jio';

      logger.info('RCS webhook received', {
        carrier,
        body: req.body,
      });

      // Handle different webhook event types
      const event = req.body.event || req.body.type || 'unknown';

      switch (event) {
        case 'message_status':
        case 'status_update':
          await handleStatusUpdate(req.body, carrier);
          break;

        case 'inbound_message':
        case 'received':
          await handleInboundMessage(req.body, carrier);
          break;

        case 'delivered':
          await rcsService.updateMessageStatus(
            req.body.messageId || req.body.correlation_id,
            RCSMessageStatus.DELIVERED
          );
          break;

        case 'read':
          await rcsService.updateMessageStatus(
            req.body.messageId || req.body.correlation_id,
            RCSMessageStatus.READ
          );
          break;

        case 'failed':
          await rcsService.updateMessageStatus(
            req.body.messageId || req.body.correlation_id,
            RCSMessageStatus.FAILED
          );
          break;

        default:
          logger.warn('Unknown RCS webhook event', {
            carrier,
            event,
            body: req.body,
          });
      }

      // Always acknowledge webhook
      res.status(200).json({ success: true, received: true });
    } catch (error) {
      logger.error('RCS webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
      });
      // Still acknowledge to prevent retries
      res.status(200).json({ success: true, received: true });
    }
  }
);

/**
 * Handle status update webhook
 */
async function handleStatusUpdate(
  body: Record<string, unknown>,
  carrier: string
): Promise<void> {
  const messageId = (body.messageId || body.correlation_id) as string;
  const statusStr = (body.status || body.messageStatus) as string;

  if (!messageId) {
    logger.warn('Status update missing messageId', { body });
    return;
  }

  const statusMap: Record<string, RCSMessageStatus> = {
    ACCEPTED: RCSMessageStatus.SENT,
    SENT: RCSMessageStatus.SENT,
    DELIVERED: RCSMessageStatus.DELIVERED,
    READ: RCSMessageStatus.READ,
    FAILED: RCSMessageStatus.FAILED,
    EXPIRED: RCSMessageStatus.EXPIRED,
  };

  const status = statusMap[statusStr?.toUpperCase()] || RCSMessageStatus.PENDING;

  await rcsService.updateMessageStatus(messageId, status);

  logger.info('RCS status updated', {
    messageId,
    status,
    carrier,
  });
}

/**
 * Handle inbound message webhook
 */
async function handleInboundMessage(
  body: Record<string, unknown>,
  carrier: string
): Promise<void> {
  const inboundMessage: RCSInboundMessage = {
    messageId: (body.messageId || body.correlation_id || uuidv4()) as string,
    from: body.from as string || body.msisdn as string,
    to: body.to as string || body.destination as string,
    type: (body.type || RCSMessageType.TEXT) as RCSMessageType,
    content: (body.content || body.text || '') as string,
    timestamp: new Date((body.timestamp as string) || Date.now()),
    carrier: carrier as 'jio' | 'airtel' | 'unknown',
  };

  logger.info('RCS inbound message', {
    messageId: inboundMessage.messageId,
    from: inboundMessage.from,
    carrier: inboundMessage.carrier,
  });

  // Forward to orchestrator for two-way RCS conversations
  try {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8080';
    await fetch(`${orchestratorUrl}/api/rcs/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inboundMessage }),
    });
  } catch (error) {
    logger.error('[RCS] Failed to forward to orchestrator', { error });
  }
}

export default router;

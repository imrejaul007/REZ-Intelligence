import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Redis from 'ioredis';
import { MessageBridge } from '../services/messageBridge';
import { ResponseBridge } from '../services/responseBridge';
import { logger } from '../services/logger';

// Message deduplication Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const DEDUP_WINDOW_SECONDS = 60; // Messages within 60s are duplicates

export interface WebhookRoutesConfig {
  messageBridge: MessageBridge;
  responseBridge: ResponseBridge;
  verifyToken: string;
  appSecret: string;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string; caption?: string };
        audio?: { id: string; mime_type: string; sha256: string };
        document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
        video?: { id: string; mime_type: string; sha256: string };
        sticker?: { id: string; mime_type: string; sha256: string };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
        context?: { from: string; id: string };
        interactive?: Record<string, unknown>;
      }>;
      status?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
        conversation?: {
          id: string;
          expiration_timestamp: string;
          origin?: { type: string };
        };
        pricing?: {
          billable: boolean;
          pricing_model: string;
          category: string;
        };
      }>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export function createWebhookRoutes(config: WebhookRoutesConfig): Router {
  const router = Router();
  const { messageBridge, responseBridge, verifyToken, appSecret } = config;

  /**
   * Verify webhook for Facebook/WhatsApp setup
   * GET /webhook
   */
  router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('Webhook verification request', { mode, token: token ? 'present' : 'missing' });

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('Webhook verification failed', { mode, tokenMatch: token === verifyToken });
    res.status(403).json({ error: 'Forbidden' });
  });

  /**
   * Handle incoming WhatsApp webhook events
   * POST /webhook
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body as WhatsAppWebhookPayload;

    try {
      // Verify webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (appSecret && signature) {
        const expectedSignature = 'sha256=' + crypto
          .createHmac('sha256', appSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (signature !== expectedSignature) {
          logger.warn('Invalid webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Respond to WhatsApp quickly (within 20 seconds)
      res.status(200).json({ status: 'ok' });

      // Process webhook asynchronously
      await processWebhook(payload);

    } catch (error) {
      next(error);
    }
  });

  /**
   * Check if message is a duplicate (WhatsApp delivers at-least-once)
   */
  async function isDuplicateMessage(messageId: string): Promise<boolean> {
    const key = `whatsapp:dedup:${messageId}`;
    const exists = await redis.exists(key);
    if (exists) {
      logger.debug('Duplicate message detected', { messageId });
      return true;
    }
    await redis.setex(key, DEDUP_WINDOW_SECONDS, '1');
    return false;
  }

  /**
   * Process webhook payload
   */
  async function processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      logger.debug('Ignoring non-WhatsApp webhook', { object: payload.object });
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Get phone number ID for this change
        const phoneNumberId = value.metadata?.phone_number_id;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            // Check for duplicate messages (WhatsApp at-least-once delivery)
            if (await isDuplicateMessage(message.id)) {
              logger.info('Skipping duplicate message', { messageId: message.id });
              continue;
            }

            try {
              await handleIncomingMessage(phoneNumberId, entry, change, message);
            } catch (error) {
              logger.error('Error handling incoming message', {
                messageId: message.id,
                from: message.from,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        // Handle status updates
        if (value.status && value.status.length > 0) {
          for (const status of value.status) {
            try {
              await handleStatusUpdate(status);
            } catch (error) {
              logger.error('Error handling status update', {
                statusId: status.id,
                status: status.status,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }
      }
    }
  }

  /**
   * Handle incoming message
   */
  async function handleIncomingMessage(
    phoneNumberId: string,
    entry: WhatsAppWebhookEntry,
    _change: WhatsAppWebhookEntry['changes'][0],
    message: NonNullable<WhatsAppWebhookEntry['changes'][0]['value']['messages']>[0]
  ): Promise<void> {
    logger.info('Incoming WhatsApp message', {
      messageId: message.id,
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
    });

    // Get contact info
    const contact = entry.changes[0]?.value?.contacts?.[0];
    const profileName = contact?.profile?.name;

    // Build message content based on type
    let messageContent = '';
    let messageType: 'text' | 'image' | 'audio' | 'document' | 'video' = 'text';
    let mediaUrl: string | undefined;

    switch (message.type) {
      case 'text':
        messageContent = message.text?.body || '';
        messageType = 'text';
        break;

      case 'image':
        // In production, you would download the media using the WhatsApp API
        messageContent = '[Image]';
        messageType = 'image';
        mediaUrl = message.image?.id ? `https://graph.facebook.com/v18.0/${message.image.id}` : undefined;
        break;

      case 'audio':
        messageContent = '[Audio]';
        messageType = 'audio';
        mediaUrl = message.audio?.id ? `https://graph.facebook.com/v18.0/${message.audio.id}` : undefined;
        break;

      case 'document':
        messageContent = `[Document: ${message.document?.filename || 'file'}]`;
        messageType = 'document';
        mediaUrl = message.document?.id ? `https://graph.facebook.com/v18.0/${message.document.id}` : undefined;
        break;

      case 'video':
        messageContent = '[Video]';
        messageType = 'video';
        mediaUrl = message.video?.id ? `https://graph.facebook.com/v18.0/${message.video.id}` : undefined;
        break;

      case 'sticker':
        messageContent = '[Sticker]';
        messageType = 'image';
        break;

      case 'location':
        messageContent = `[Location: ${message.location?.name || 'shared location'}]`;
        messageType = 'text';
        break;

      case 'interactive':
        // Handle button replies or list replies
        const interactive = message.interactive as Record<string, unknown> | undefined;
        if (interactive?.type === 'button_reply') {
          messageContent = (interactive.button_reply as Record<string, string>)?.title || '';
        } else if (interactive?.type === 'list_reply') {
          messageContent = (interactive.list_reply as Record<string, string>)?.title || '';
        } else {
          messageContent = '[Interactive message]';
        }
        messageType = 'text';
        break;

      default:
        messageContent = `[Unsupported message type: ${message.type}]`;
        messageType = 'text';
    }

    // Skip empty messages
    if (!messageContent.trim() && message.type !== 'sticker' && message.type !== 'location') {
      logger.debug('Skipping empty message', { messageId: message.id });
      return;
    }

    // Send to orchestrator
    try {
      const orchestratorResponse = await messageBridge.sendToOrchestrator(
        {
          type: messageType,
          content: messageContent,
          mediaUrl,
        },
        {
          phoneNumber: message.from,
          whatsappMessageId: message.id,
          timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
          profileName,
        }
      );

      // Queue response for sending back to user
      const context = {
        sessionId: orchestratorResponse.sessionId,
        phoneNumber: message.from,
        userId: orchestratorResponse.sessionId,
        messageId: message.id,
        timestamp: new Date().toISOString(),
        expertName: orchestratorResponse.expert?.name,
      };

      // Process response immediately for better UX
      await responseBridge.processResponse(context, orchestratorResponse);

    } catch (error) {
      logger.error('Failed to process message', {
        messageId: message.id,
        from: message.from,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Send error message to user
      await messageBridge.sendWhatsAppText(
        message.from,
        'Sorry, I encountered an error processing your message. Please try again.'
      );
    }
  }

  /**
   * Handle status updates (delivered, read, etc.)
   */
  async function handleStatusUpdate(
    status: NonNullable<WhatsAppWebhookEntry['changes'][0]['value']['status']>[0]
  ): Promise<void> {
    logger.debug('Status update received', {
      statusId: status.id,
      status: status.status,
      recipientId: status.recipient_id,
      timestamp: status.timestamp,
    });

    // You can store these for analytics, retry logic, etc.
    // In a real implementation, you would store this in Redis or MongoDB
  }

  /**
   * Send test message (for development)
   * POST /webhook/test
   */
  router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        res.status(400).json({ error: 'phoneNumber and message are required' });
        return;
      }

      await messageBridge.sendWhatsAppText(phoneNumber, message);

      res.json({ success: true, sent: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get webhook health status
   * GET /webhook/health
   */
  router.get('/health', async (req: Request, res: Response) => {
    const health = await messageBridge.healthCheck();
    const queueStatus = responseBridge.getQueueStatus();

    res.json({
      ...health,
      queue: queueStatus,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

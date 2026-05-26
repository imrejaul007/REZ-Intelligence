import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import twilio from 'twilio';
import Redis from 'ioredis';
import {
  WebhookEvent,
  WebhookValue,
  MessageType,
  SessionState,
  ApiResponse,
} from '../types/whatsapp';
import { SessionManager } from '../services/sessionManager';
import { CartService } from '../services/cartService';
import { ConversationEngine } from '../services/conversationEngine';
import { OrderService } from '../services/orderService';
import { verifyTwilioWebhook, AuthenticatedRequest, maskPII, validateWebhookPayload } from '../middleware/auth';
import { logger } from '../utils/logger.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_MESSAGE_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TWILIO_RATE_LIMIT_CODE = 20429;
const DEDUP_TTL_SECONDS = 3600; // 1 hour deduplication window

// ============================================
// REDIS CLIENT
// ============================================

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisClient;
}

// ============================================
// IDEMPOTENCY CHECK
// ============================================

async function isDuplicate(messageId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `webhook:twilio:dedup:${messageId}`;
  const result = await redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
  return result !== 'OK';
}

// ============================================
// SETUP
// ============================================

function setupErrorHandlers(): void {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}

setupErrorHandlers();

export function createWebhookRoutes(
  sessionManager: SessionManager,
  cartService: CartService,
  conversationEngine: ConversationEngine,
  orderService: OrderService,
  twilioClient: twilio.Twilio,
  whatsappPhoneNumber: string
): Router {
  const router = Router();

  /**
   * POST /webhook/whatsapp
   * Main webhook endpoint with Redis-based deduplication
   */
  router.post(
    '/whatsapp',
    verifyTwilioWebhook,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Validate payload
      const validation = validateWebhookPayload(req.body);
      if (!validation.valid) {
        logger.warn('Invalid webhook payload', { error: validation.error });
        res.status(400).json({ success: false, error: validation.error });
        return;
      }

      const webhookData: WebhookEvent = req.body;

      try {
        // Respond immediately to WhatsApp (best practice)
        res.status(200).send('OK');

        // Process in background with error handling
        processWebhookEvent(webhookData).catch((error) => {
          logger.error('Webhook processing failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      } catch (error) {
        logger.error('Webhook handler error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).send('Error processing webhook');
      }
    }
  );

  /**
   * POST /webhook/whatsapp/test
   * Test endpoint without Twilio signature
   */
  router.post(
    '/whatsapp/test',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const validation = validateWebhookPayload(req.body);
      if (!validation.valid) {
        res.status(400).json({ success: false, error: validation.error });
        return;
      }

      const webhookData: WebhookEvent = req.body;

      try {
        res.status(200).send('OK');
        await processWebhookEvent(webhookData);
      } catch (error) {
        logger.error('Test webhook failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({ error: 'Test failed' });
      }
    }
  );

  /**
   * GET /webhook/whatsapp
   * Webhook verification endpoint for Twilio
   */
  router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.TWILIO_VERIFY_TOKEN || 'my_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed', { mode });
      res.status(403).send('Forbidden');
    }
  });

  // ============================================
  // PROCESSING FUNCTIONS
  // ============================================

  async function processWebhookEvent(event: WebhookEvent): Promise<void> {
    if (!event.entry || event.entry.length === 0) {
      return;
    }

    for (const entry of event.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          continue;
        }

        const value = change.value as WebhookValue;

        if (value.messages) {
          await processMessages(value);
        }

        if (value.statuses) {
          await processStatuses(value);
        }
      }
    }
  }

  async function processMessages(value: WebhookValue): Promise<void> {
    for (const message of value.messages || []) {
      const messageId = message.id;

      // Redis-based deduplication
      if (await isDuplicate(messageId)) {
        logger.debug('Duplicate message ignored', { messageId: maskPII(messageId) });
        continue;
      }

      try {
        const from = message.from;
        const messageType = message.type;
        const timestamp = new Date(parseInt(message.timestamp) * 1000);

        logger.info('Incoming WhatsApp message', {
          from: maskPII(from),
          type: messageType,
          messageId: maskPII(messageId),
        });

        // Find or create session with distributed lock
        let session = await sessionManager.getSessionByUser(from);

        if (!session) {
          session = await sessionManager.createSession({
            userId: from,
            phoneNumber: from,
            source: 'whatsapp_inbound',
            metadata: {
              contactName: value.contacts?.[0]?.profile?.name,
            },
          });

          // Send welcome message with retry and jitter
          await sendWithRetry(
            from,
            'Hello! Welcome to our store. How can I help you today?',
            0
          );

          continue;
        }

        // Extend session
        await sessionManager.extendSession(session.sessionId);

        // Extract message content
        const content = extractMessageContent(message);

        // Add user message to session with lock
        await sessionManager.addMessage(session.sessionId, 'user', content, messageId);

        // Handle response
        if (messageType === 'interactive') {
          await handleInteractiveResponse(session, message);
        } else {
          const result = await conversationEngine.processTurn(content, session.sessionId);
          await sendResponseMessage(session.sessionId, from, result.response.message, result.response.actions);
        }

        logger.info('Message processed successfully', {
          messageId: maskPII(messageId),
          from: maskPII(from),
          type: messageType,
        });
      } catch (error) {
        logger.error('Failed to process message', {
          messageId: maskPII(messageId),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Send error message with retry
        try {
          await sendWithRetry(
            message.from,
            'Sorry, I encountered an error processing your message. Please try again.',
            0
          );
        } catch (sendError) {
          logger.error('Failed to send error message', {
            error: sendError instanceof Error ? sendError.message : 'Unknown error'
          });
        }
      }
    }
  }

  function extractMessageContent(message: NonNullable<WebhookValue['messages']>[0]): string {
    const messageType = message.type;

    switch (messageType) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return '[Image received]';
      case 'audio':
        return '[Audio received]';
      case 'video':
        return '[Video received]';
      case 'document':
        return `[Document: ${message.document?.filename}]`;
      case 'location':
        return `[Location: ${message.location?.name || 'shared location'}]`;
      case 'interactive':
        if (message.interactive?.button_reply) {
          return message.interactive.button_reply.title;
        } else if (message.interactive?.list_reply) {
          return message.interactive.list_reply.title;
        }
        return '';
      default:
        return `[${messageType} message]`;
    }
  }

  async function handleInteractiveResponse(
    session: Awaited<ReturnType<typeof sessionManager.getSession>>,
    message: NonNullable<NonNullable<WebhookValue['messages']>>[0]
  ): Promise<void> {
    if (!session) return;

    const interactive = message.interactive;

    if (interactive?.button_reply) {
      const buttonId = interactive.button_reply.id;
      const buttonTitle = interactive.button_reply.title;

      switch (buttonId) {
        case 'view_products':
        case 'search':
        case 'view_cart':
        case 'checkout':
        case 'support':
          await sessionManager.updateSessionState(
            session.sessionId,
            buttonId === 'view_cart' || buttonId === 'checkout'
              ? SessionState.CART_REVIEW
              : buttonId === 'support'
              ? SessionState.SUPPORT
              : SessionState.BROWSING
          );

          const result = await conversationEngine.processTurn(buttonTitle, session.sessionId);
          await sendResponseMessage(session.sessionId, message.from, result.response.message, result.response.actions);
          break;

        default:
          await sendResponseMessage(session.sessionId, message.from, `You selected: ${buttonTitle}`, undefined);
      }
    } else if (interactive?.list_reply) {
      const listTitle = interactive.list_reply.title;
      const result = await conversationEngine.processTurn(listTitle, session.sessionId);
      await sendResponseMessage(session.sessionId, message.from, result.response.message, result.response.actions);
    }
  }

  async function sendResponseMessage(
    sessionId: string,
    to: string,
    message: string,
    actions?: Array<{ type: string; title: string; payload?: string }>
  ): Promise<void> {
    await sendWithRetry(to, message, 0);
  }

  /**
   * Send message with retry and jitter to prevent thundering herd
   */
  async function sendWithRetry(
    to: string,
    message: string,
    retryCount: number
  ): Promise<void> {
    try {
      const messageData: Record<string, unknown> = {
        from: `whatsapp:${whatsappPhoneNumber}`,
        to: `whatsapp:${to}`,
        body: message,
      };

      await twilioClient.messages.create(messageData as unknown as Parameters<typeof twilioClient.messages.create>[0]);

      logger.info('Message sent', {
        to: maskPII(to),
        bodyLength: message.length
      });
    } catch (error: unknown) {
      const twilioError = error as { code?: number; message?: string };
      const errorCode = twilioError.code;
      const errorMessage = twilioError.message || '';

      // Rate limit error
      if (errorCode === TWILIO_RATE_LIMIT_CODE ||
          errorMessage.includes('429') ||
          errorMessage.includes('rate limit')) {

        if (retryCount < MAX_MESSAGE_RETRIES) {
          // Exponential backoff with jitter
          const baseDelay = RETRY_DELAY_MS * Math.pow(2, retryCount);
          const jitterBytes = randomBytes(4);
          const jitter = (jitterBytes[0] | (jitterBytes[1] << 8) | (jitterBytes[2] << 16) | (jitterBytes[3] << 24)) / 0xFFFFFFFF * 0.3 * baseDelay;
          const delay = baseDelay + jitter;

          logger.warn('Twilio rate limited, retrying', {
            to: maskPII(to),
            retryCount: retryCount + 1,
            delay
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          return sendWithRetry(to, message, retryCount + 1);
        }

        logger.error('Max retries exceeded for rate limit', {
          to: maskPII(to),
          retryCount,
        });
      }

      logger.error('Failed to send message', {
        to: maskPII(to),
        error: errorMessage,
        errorCode,
        retryCount,
      });
    }
  }

  async function processStatuses(value: WebhookValue): Promise<void> {
    for (const status of value.statuses || []) {
      const messageId = status.id;
      const newStatus = status.status;

      logger.info('Message status update', {
        messageId: maskPII(messageId),
        status: newStatus,
        recipient: maskPII(status.recipient_id),
      });

      // Handle delivery/read notifications
      if (newStatus === 'delivered' || newStatus === 'read') {
        // Update order status if linked
      } else if (newStatus === 'failed') {
        logger.warn('Message delivery failed', {
          messageId: maskPII(messageId),
          recipient: maskPII(status.recipient_id),
          errors: status.errors,
        });
      }
    }
  }

  return router;
}

export default createWebhookRoutes;

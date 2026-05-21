import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import crypto from 'crypto';
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
import { verifyTwilioWebhook, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// In-memory deduplication store (use Redis in production)
const processedMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedMessages.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedMessages.delete(key);
    }
  }
}, 60000);

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
   * Main webhook endpoint for incoming WhatsApp messages
   */
  router.post(
    '/whatsapp',
    verifyTwilioWebhook,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const webhookData: WebhookEvent = req.body;

      try {
        // Respond immediately to WhatsApp
        res.status(200).send('OK');

        // Process in background
        processWebhookEvent(webhookData).catch((error) => {
          logger.error('Webhook processing failed', { error, webhookData });
        });
      } catch (error) {
        logger.error('Webhook handler error', { error });
        res.status(500).send('Error processing webhook');
      }
    }
  );

  /**
   * POST /webhook/whatsapp/test
   * Test endpoint for webhook without Twilio signature
   */
  router.post(
    '/whatsapp/test',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const webhookData: WebhookEvent = req.body;

      try {
        res.status(200).send('OK');
        await processWebhookEvent(webhookData);
      } catch (error) {
        logger.error('Test webhook failed', { error });
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

    // Verify token (should match configured verify token)
    const verifyToken = process.env.TWILIO_VERIFY_TOKEN || 'my_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed', { mode, token });
      res.status(403).send('Forbidden');
    }
  });

  // Process incoming webhook events
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

        // Process incoming messages
        if (value.messages) {
          await processMessages(value);
        }

        // Process status updates
        if (value.statuses) {
          await processStatuses(value);
        }
      }
    }
  }

  async function processMessages(value: WebhookValue): Promise<void> {
    for (const message of value.messages || []) {
      const messageId = message.id;

      // Deduplication check
      if (processedMessages.has(messageId)) {
        logger.debug('Duplicate message ignored', { messageId });
        continue;
      }
      processedMessages.set(messageId, Date.now());

      try {
        const from = message.from;
        const messageType = message.type;
        const timestamp = new Date(parseInt(message.timestamp) * 1000);

        logger.info('Incoming WhatsApp message', {
          from,
          type: messageType,
          messageId,
        });

        // Find or create session
        let session = await sessionManager.getSessionByUser(from);

        if (!session) {
          // Create new session
          session = await sessionManager.createSession({
            userId: from,
            phoneNumber: from,
            source: 'whatsapp_inbound',
            metadata: {
              contactName: value.contacts?.[0]?.profile?.name,
            },
          });

          // Send welcome message
          await twilioClient.messages.create({
            from: `whatsapp:${whatsappPhoneNumber}`,
            to: `whatsapp:${from}`,
            body: 'Hello! Welcome to our store. How can I help you today?',
          });

          continue;
        }

        // Extend session
        await sessionManager.extendSession(session.sessionId);

        // Extract message content
        let content = '';
        switch (messageType) {
          case 'text':
            content = message.text?.body || '';
            break;
          case 'image':
            content = '[Image received]';
            break;
          case 'audio':
            content = '[Audio received]';
            break;
          case 'video':
            content = '[Video received]';
            break;
          case 'document':
            content = `[Document: ${message.document?.filename}]`;
            break;
          case 'location':
            content = `[Location: ${message.location?.name || 'shared location'}]`;
            break;
          case 'interactive':
            if (message.interactive?.button_reply) {
              content = message.interactive.button_reply.title;
            } else if (message.interactive?.list_reply) {
              content = message.interactive.list_reply.title;
            }
            break;
          default:
            content = `[${messageType} message]`;
        }

        // Add user message to session
        await sessionManager.addMessage(session.sessionId, 'user', content, messageId);

        // Handle interactive responses
        if (messageType === 'interactive') {
          await handleInteractiveResponse(session, message);
        } else {
          // Process through conversation engine
          const result = await conversationEngine.processTurn(content, session.sessionId);

          // Send response
          await sendResponseMessage(session.sessionId, from, result.response.message, result.response.actions);
        }

        logger.info('Message processed successfully', {
          messageId,
          from,
          type: messageType,
        });
      } catch (error) {
        logger.error('Failed to process message', {
          messageId,
          error,
        });

        // Send error message to user
        try {
          await twilioClient.messages.create({
            from: `whatsapp:${whatsappPhoneNumber}`,
            to: `whatsapp:${message.from}`,
            body: 'Sorry, I encountered an error processing your message. Please try again.',
          });
        } catch (sendError) {
          logger.error('Failed to send error message', { sendError });
        }
      }
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

      // Route based on button
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
      const listId = interactive.list_reply.id;
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
    try {
      const messageData: Record<string, unknown> = {
        from: `whatsapp:${whatsappPhoneNumber}`,
        to: `whatsapp:${to}`,
        body: message,
      };

      if (actions && actions.length > 0) {
        // Send as interactive list for 3+ actions, buttons for 1-2
        if (actions.length >= 3) {
          messageData.contentSid = 'list_template';
          messageData.contentVariables = JSON.stringify({
            '1': message,
          });
        } else {
          // Use quick reply buttons
          const buttons = actions.slice(0, 3).map((action) => ({
            type: 'reply',
            reply: {
              id: action.payload || action.title.toLowerCase().replace(/\s+/g, '_'),
              title: action.title.substring(0, 25),
            },
          }));

          messageData.content = JSON.stringify({
            type: 'interactive',
            interactive: {
              type: 'buttons',
              header: { type: 'text', text: 'Menu' },
              body: { text: message },
              action: { buttons },
            },
          });
        }
      }

      const sentMessage = await twilioClient.messages.create(messageData as Parameters<typeof twilioClient.messages.create>[0]);

      // Add assistant message to session
      await sessionManager.addMessage(sessionId, 'assistant', message, sentMessage.sid);

      logger.info('Response message sent', {
        sessionId,
        to,
        sid: sentMessage.sid,
      });
    } catch (error) {
      logger.error('Failed to send response message', {
        sessionId,
        to,
        error,
      });
    }
  }

  async function processStatuses(value: WebhookValue): Promise<void> {
    for (const status of value.statuses || []) {
      const messageId = status.id;
      const newStatus = status.status;

      logger.info('Message status update', {
        messageId,
        status: newStatus,
        recipient: status.recipient_id,
      });

      // Update order status if linked to order
      if (newStatus === 'delivered' || newStatus === 'read') {
        // Look up order by message metadata
        // This would integrate with order service to update delivery status
      }

      // Update broadcast results if applicable
      if (newStatus === 'delivered') {
        // Update broadcast delivery stats
      } else if (newStatus === 'read') {
        // Update broadcast read stats
      } else if (newStatus === 'failed') {
        // Log failed message
        logger.warn('Message delivery failed', {
          messageId,
          recipient: status.recipient_id,
          errors: status.errors,
        });
      }
    }
  }

  return router;
}

export default createWebhookRoutes;

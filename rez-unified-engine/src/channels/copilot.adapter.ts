/**
 * Copilot Channel Adapter
 * Handles Microsoft Copilot integration
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { ChannelType, IncomingMessage, OutgoingMessage } from '../types';
import { ChannelAdapter } from '../types';
import { config } from '../config';
import { logger } from '../config/logger';
import { ConversationService } from '../services/conversationLogger';
import { getContextManager } from '../services/contextManager';
import { getIntentProcessor } from '../services/intentProcessor';
import { getAgentRouter } from '../services/agentRouter';
import { getResponseGenerator } from '../services/responseGenerator';
import { Session } from '../models/Session';
import { Conversation } from '../models/Conversation';

const copilotLogger = logger.child({ component: 'CopilotAdapter' });

interface CopilotWebhook {
  message: {
    id: string;
    text: string;
    from: {
      id: string;
      name?: string;
    };
    timestamp: string;
  };
  conversation: {
    id: string;
  };
  channel: 'copilot';
}

interface CopilotActivity {
  type: string;
  id?: string;
  timestamp?: string;
  from?: {
    id: string;
    name?: string;
    aadObjectId?: string;
  };
  conversation?: {
    id: string;
    name?: string;
  };
  attachments?: Array<{
    contentType: string;
    content: Record<string, unknown>;
  }>;
}

export class CopilotAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'copilot';
  private conversationService: ConversationService;
  private contextManager = getContextManager();
  private intentProcessor = getIntentProcessor();
  private agentRouter = getAgentRouter();
  private responseGenerator = getResponseGenerator();

  constructor(conversationService: ConversationService) {
    this.conversationService = conversationService;
  }

  /**
   * Process incoming Copilot message
   */
  async processMessage(payload: IncomingMessage): Promise<OutgoingMessage> {
    const startTime = Date.now();

    copilotLogger.debug('Processing Copilot message', {
      sessionId: payload.sessionId,
    });

    try {
      // Get or create session
      const { session, conversation } = await this.getOrCreateSession(payload);

      // Log incoming message
      const incomingMsg = await this.conversationService.logIncomingMessage(
        payload,
        conversation.conversationId,
        session.sessionId
      );

      // Load context
      const context = await this.contextManager.loadContext(session.sessionId);

      // Detect intent
      const intent = await this.intentProcessor.detectIntent(payload.message, context);

      // Route to agent
      const routing = await this.agentRouter.route(intent, context);

      // Generate response
      const response = await this.responseGenerator.generate(
        payload,
        context,
        intent,
        routing
      );

      // Log outgoing message
      const processingTime = Date.now() - startTime;
      await this.conversationService.logOutgoingMessage(response, incomingMsg.messageId, {
        routingTimeMs: processingTime / 3,
        generationTimeMs: (processingTime / 3) * 2,
      });

      return response;
    } catch (error) {
      copilotLogger.error('Failed to process Copilot message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send message via Copilot
   */
  async sendMessage(message: OutgoingMessage): Promise<string> {
    copilotLogger.debug('Sending Copilot message', {
      messageId: message.messageId,
    });

    // Return message ID - actual sending is handled in formatForChannel
    return message.messageId;
  }

  /**
   * Handle incoming Copilot webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    copilotLogger.debug('Received Copilot webhook', {
      path: req.path,
    });

    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(req)) {
        copilotLogger.warn('Invalid Copilot webhook signature');
        res.status(401).send('Invalid signature');
        return;
      }

      const activity = req.body as CopilotActivity;

      // Handle different activity types
      switch (activity.type) {
        case 'message':
          await this.handleMessageActivity(activity, res);
          break;

        case 'conversationUpdate':
          await this.handleConversationUpdate(activity, res);
          break;

        case 'invoke':
          await this.handleInvokeActivity(activity, res);
          break;

        default:
          copilotLogger.debug('Unhandled activity type', {
            type: activity.type,
          });
          res.status(200).send({});
      }
    } catch (error) {
      copilotLogger.error('Copilot webhook handling failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send({ error: 'Internal error' });
    }
  }

  /**
   * Handle incoming message activity
   */
  private async handleMessageActivity(
    activity: CopilotActivity,
    res: Response
  ): Promise<void> {
    const messageText = this.extractMessageText(activity);

    if (!messageText) {
      res.status(200).send({});
      return;
    }

    const payload: IncomingMessage = {
      message: messageText,
      channel: 'copilot',
      userId: activity.from?.id || 'unknown',
      channelMessageId: activity.id,
      metadata: {
        fromName: activity.from?.name,
        aadObjectId: activity.from?.aadObjectId,
        conversationId: activity.conversation?.id,
      },
    };

    try {
      const response = await this.processMessage(payload);

      // Send response using Bot Framework format
      const responseActivity = this.formatForChannel(response);
      res.status(200).json(responseActivity);
    } catch (error) {
      copilotLogger.error('Failed to process Copilot message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send({ error: 'Failed to process message' });
    }
  }

  /**
   * Handle conversation update (new member, etc.)
   */
  private async handleConversationUpdate(
    activity: CopilotActivity,
    res: Response
  ): Promise<void> {
    copilotLogger.debug('Handling conversation update', {
      conversationId: activity.conversation?.id,
    });

    // Send welcome message
    const welcomeActivity = {
      type: 'message',
      text: 'Hello! I\'m your REZ assistant. How can I help you today?',
      channel: 'copilot',
    };

    res.status(200).json(welcomeActivity);
  }

  /**
   * Handle invoke activity (buttons, cards, etc.)
   */
  private async handleInvokeActivity(
    activity: CopilotActivity,
    res: Response
  ): Promise<void> {
    copilotLogger.debug('Handling invoke activity', {
      name: (activity as any).name,
    });

    // Handle specific invoke types
    const invokeName = (activity as any).name;

    switch (invokeName) {
      case 'quickReply':
        // Handle quick reply selection
        const replyValue = (activity as any).value?.selectedOption?.value;
        if (replyValue) {
          const payload: IncomingMessage = {
            message: replyValue,
            channel: 'copilot',
            userId: activity.from?.id || 'unknown',
          };

          const response = await this.processMessage(payload);
          res.status(200).json(this.formatForChannel(response));
        } else {
          res.status(200).json({});
        }
        break;

      case 'cardAction':
        // Handle card action
        const actionData = (activity as any).value?.action?.data;
        if (actionData) {
          const payload: IncomingMessage = {
            message: actionData,
            channel: 'copilot',
            userId: activity.from?.id || 'unknown',
          };

          const response = await this.processMessage(payload);
          res.status(200).json(this.formatForChannel(response));
        } else {
          res.status(200).json({});
        }
        break;

      default:
        copilotLogger.debug('Unhandled invoke type', { invokeName });
        res.status(200).json({});
    }
  }

  /**
   * Extract message text from activity
   */
  private extractMessageText(activity: CopilotActivity): string | null {
    // Text message
    if ((activity as any).text) {
      return (activity as any).text;
    }

    // Attachment content
    if (activity.attachments?.length) {
      const attachment = activity.attachments[0];
      if (attachment.content?.text) {
        return attachment.content.text as string;
      }
    }

    return null;
  }

  /**
   * Verify Copilot webhook signature
   */
  private verifyWebhookSignature(req: Request): boolean {
    const signature = req.headers['x-ms-signature'] as string;
    const timestamp = req.headers['x-ms-timestamp'] as string;

    if (!signature || !config.channels.copilot.webhookSecret) {
      return config.server.nodeEnv === 'development';
    }

    if (config.server.nodeEnv === 'development') {
      return true;
    }

    // Verify HMAC signature
    const payload = timestamp + JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.channels.copilot.webhookSecret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get or create session for Copilot user
   */
  private async getOrCreateSession(payload: IncomingMessage): Promise<{
    session: InstanceType<typeof Session>;
    conversation: InstanceType<typeof Conversation>;
  }> {
    const userId = payload.userId || 'unknown';

    // Find or create conversation
    let conversation = await Conversation.findOne({
      userId,
      status: 'active',
      primaryChannel: 'copilot',
    });

    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, 'copilot');
    }

    // Find or create session
    const { session, isNew } = await Session.getOrCreateSession({
      conversationId: conversation.conversationId,
      userId,
      channel: 'copilot',
      channelMetadata: {
        platform: 'copilot',
        deviceType: 'web',
      },
    });

    if (isNew) {
      await conversation.addSession(session._id);
      await conversation.save();
    }

    return { session, conversation };
  }

  /**
   * Format message for Copilot channel (Bot Framework format)
   */
  formatForChannel(message: OutgoingMessage): Record<string, unknown> {
    const activity: Record<string, unknown> = {
      type: 'message',
      text: message.content.text,
    };

    // Add HTML if present
    if (message.content.html) {
      (activity as any).html = message.content.html;
    }

    // Add attachments
    if (message.content.attachments?.length) {
      activity.attachments = message.content.attachments.map(att => ({
        contentType: this.getContentType(att.type),
        content: {
          title: att.caption || '',
          text: message.content.text,
          images: att.type === 'image' ? [{ url: att.url }] : [],
        },
      }));
    }

    // Add suggested actions (quick replies)
    if (message.content.quickReplies?.length) {
      activity.suggestedActions = {
        actions: message.content.quickReplies.map(qr => ({
          type: 'messageBack',
          title: qr.text,
          value: qr.payload || qr.text,
          text: qr.text,
        })),
      };
    }

    return activity;
  }

  /**
   * Get content type for attachment
   */
  private getContentType(type: string): string {
    const contentTypes: Record<string, string> = {
      image: 'image/png',
      video: 'video/mp4',
      audio: 'audio/mp3',
      document: 'application/pdf',
    };
    return contentTypes[type] || 'application/octet-stream';
  }
}

export { CopilotAdapter };

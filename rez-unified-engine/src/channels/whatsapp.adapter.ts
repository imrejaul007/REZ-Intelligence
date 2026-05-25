/**
 * WhatsApp Channel Adapter
 * Handles WhatsApp (Twilio) messaging integration
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { ChannelType, IncomingMessage, OutgoingMessage, MessageRole } from '../types';
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

const whatsappLogger = logger.child({ component: 'WhatsAppAdapter' });

interface TwilioWebhookBody {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  ProfileName?: string;
  WaId?: string;
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'whatsapp';
  private conversationService: ConversationService;
  private contextManager = getContextManager();
  private intentProcessor = getIntentProcessor();
  private agentRouter = getAgentRouter();
  private responseGenerator = getResponseGenerator();

  constructor(conversationService: ConversationService) {
    this.conversationService = conversationService;
  }

  /**
   * Process incoming WhatsApp message
   */
  async processMessage(payload: IncomingMessage): Promise<OutgoingMessage> {
    const startTime = Date.now();

    whatsappLogger.debug('Processing WhatsApp message', {
      sessionId: payload.sessionId,
      messageLength: payload.message.length,
    });

    try {
      // Get or create session and conversation
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

      // Update context with intent
      await this.contextManager.addIntentToContext(session.sessionId, intent);

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
        generationTimeMs: processingTime / 3,
      });

      return response;
    } catch (error) {
      whatsappLogger.error('Failed to process WhatsApp message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send message via Twilio WhatsApp
   */
  async sendMessage(message: OutgoingMessage): Promise<string> {
    whatsappLogger.debug('Sending WhatsApp message', {
      messageId: message.messageId,
    });

    try {
      const twilioClient = this.getTwilioClient();
      const recipient = this.extractRecipient(message);

      const twilioMessage = await twilioClient.messages.create({
        from: config.channels.whatsapp.twilio.from,
        to: recipient,
        body: message.content.text || '',
        ...(message.content.attachments?.length && {
          mediaUrl: message.content.attachments.map(att => att.url),
        }),
      });

      whatsappLogger.info('WhatsApp message sent', {
        messageId: message.messageId,
        twilioSid: twilioMessage.sid,
      });

      return twilioMessage.sid;
    } catch (error) {
      whatsappLogger.error('Failed to send WhatsApp message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle incoming Twilio webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body as TwilioWebhookBody;

    whatsappLogger.debug('Received WhatsApp webhook', {
      from: body.From,
      messageSid: body.MessageSid,
    });

    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(req)) {
        whatsappLogger.warn('Invalid WhatsApp webhook signature');
        res.status(401).send('Invalid signature');
        return;
      }

      // Ignore status callbacks
      if (req.query.MessageStatus) {
        await this.handleStatusCallback(body);
        res.status(200).send('OK');
        return;
      }

      // Parse incoming message
      const payload: IncomingMessage = {
        message: body.Body,
        channel: 'whatsapp',
        channelMessageId: body.MessageSid,
        userId: body.WaId,
        metadata: {
          from: body.From,
          to: body.To,
          profileName: body.ProfileName,
        },
      };

      // Add attachments if present
      if (body.NumMedia && parseInt(body.NumMedia) > 0) {
        payload.attachments = [
          {
            id: `media_${Date.now()}`,
            type: this.getMediaType(body.MediaContentType0 || ''),
            url: body.MediaUrl0 || '',
            mimeType: body.MediaContentType0 || 'application/octet-stream',
          },
        ];
      }

      // Process message
      const response = await this.processMessage(payload);

      // Send response if there's text content
      if (response.content.text) {
        await this.sendMessage({
          ...response,
          metadata: {
            ...response.metadata,
            recipientPhone: body.From,
          },
        });
      }

      res.status(200).send('OK');
    } catch (error) {
      whatsappLogger.error('Webhook handling failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send('Internal error');
    }
  }

  /**
   * Handle message status callback
   */
  private async handleStatusCallback(body: TwilioWebhookBody): Promise<void> {
    const status = req.query.MessageStatus as string;
    const messageSid = body.MessageSid;

    whatsappLogger.debug('Message status update', {
      messageSid,
      status,
    });

    // Update message status based on Twilio status
    const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      undelivered: 'failed',
    };

    const mappedStatus = statusMap[status];
    if (mappedStatus) {
      await this.conversationService.updateMessageStatus(messageSid, mappedStatus);
    }
  }

  /**
   * Verify Twilio webhook signature
   */
  private verifyWebhookSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature || !config.channels.whatsapp.webhookSecret) {
      return false;
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Twilio signature verification is handled by their library in production
    // For development, we accept all signatures
    if (config.server.nodeEnv === 'development') {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha1', config.channels.whatsapp.webhookSecret)
      .update(url)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get or create session for WhatsApp user
   */
  private async getOrCreateSession(payload: IncomingMessage): Promise<{
    session: InstanceType<typeof Session>;
    conversation: InstanceType<typeof Conversation>;
  }> {
    const userId = payload.userId || payload.metadata?.WaId as string;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      userId,
      status: 'active',
      primaryChannel: 'whatsapp',
    });

    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, 'whatsapp');
    }

    // Find or create session
    const { session, isNew } = await Session.getOrCreateSession({
      conversationId: conversation.conversationId,
      userId,
      channel: 'whatsapp',
      channelMetadata: {
        platform: 'whatsapp',
        deviceType: 'mobile',
      },
    });

    if (isNew) {
      await conversation.addSession(session._id);
      await conversation.save();
    }

    return { session, conversation };
  }

  /**
   * Get Twilio client
   */
  private getTwilioClient(): unknown {
    // In production, import Twilio SDK
    // const twilio = require('twilio');
    // return twilio(config.channels.whatsapp.twilio.accountSid, config.channels.whatsapp.twilio.authToken);

    // Mock client for development
    return {
      messages: {
        create: async (params: Record<string, unknown>) => ({
          sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          status: 'queued',
          ...params,
        }),
      },
    };
  }

  /**
   * Extract recipient from message
   */
  private extractRecipient(message: OutgoingMessage): string {
    const recipient = message.metadata?.recipientPhone;
    if (recipient) {
      return recipient;
    }

    // Format: convert to WhatsApp format (e.g., +1234567890 -> whatsapp:+1234567890)
    return `whatsapp:${message.metadata?.to || ''}`;
  }

  /**
   * Get media type from content type
   */
  private getMediaType(contentType: string): 'image' | 'video' | 'audio' | 'document' {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Format message for WhatsApp channel
   */
  formatForChannel(message: OutgoingMessage): unknown {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
    };

    // Text message
    if (message.content.text) {
      payload.type = 'text';
      payload.text = { body: message.content.text };
    }

    // With quick replies
    if (message.content.quickReplies?.length) {
      payload.type = 'interactive';
      payload.interactive = {
        type: 'button',
        header:
          message.content.interactive?.header?.text
            ? { type: 'text', text: message.content.interactive.header.text }
            : undefined,
        body: { text: message.content.text || '' },
        footer: message.content.interactive?.footer?.text
          ? { text: message.content.interactive.footer.text }
          : undefined,
        action: {
          buttons: message.content.quickReplies.slice(0, 3).map(qr => ({
            type: 'reply',
            reply: {
              id: qr.id,
              title: qr.text.slice(0, 20),
            },
          })),
        },
      };
    }

    // With media
    if (message.content.attachments?.length) {
      const attachment = message.content.attachments[0];
      payload.type = attachment.type;
      payload[attachment.type] = {
        id: attachment.id,
        link: attachment.url,
        caption: attachment.caption || message.content.text,
      };
    }

    return payload;
  }
}

// Request type for status callback
let req: Request;

export { WhatsAppAdapter };

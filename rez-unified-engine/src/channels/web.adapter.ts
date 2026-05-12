/**
 * Web Channel Adapter
 * Handles web-based chat widget and direct web messaging
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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
import { sessionCache, RedisKeys } from '../config/redis';

const webLogger = logger.child({ component: 'WebAdapter' });

interface WebMessagePayload {
  sessionId?: string;
  message: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
    size: number;
  }>;
  metadata?: Record<string, unknown>;
}

interface WebTypingEvent {
  sessionId: string;
  isTyping: boolean;
}

export class WebAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'web';
  private conversationService: ConversationService;
  private contextManager = getContextManager();
  private intentProcessor = getIntentProcessor();
  private agentRouter = getAgentRouter();
  private responseGenerator = getResponseGenerator();

  constructor(conversationService: ConversationService) {
    this.conversationService = conversationService;
  }

  /**
   * Process incoming web message
   */
  async processMessage(payload: IncomingMessage): Promise<OutgoingMessage> {
    const startTime = Date.now();

    webLogger.debug('Processing web message', {
      sessionId: payload.sessionId,
      messageLength: payload.message.length,
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
        generationTimeMs: (processingTime / 3) * 2,
      });

      return response;
    } catch (error) {
      webLogger.error('Failed to process web message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send message via web channel
   */
  async sendMessage(message: OutgoingMessage): Promise<string> {
    webLogger.debug('Sending web message', {
      messageId: message.messageId,
    });

    // Web messages are sent via Socket.IO or stored for polling
    // Return message ID for confirmation
    return message.messageId;
  }

  /**
   * Handle incoming web request
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const body = req.body as WebMessagePayload;

    webLogger.debug('Received web request', {
      path: req.path,
      hasSessionId: Boolean(body.sessionId),
    });

    try {
      switch (req.path) {
        case '/message':
          await this.handleMessage(body, res);
          break;

        case '/typing':
          await this.handleTyping(body, res);
          break;

        case '/session':
          await this.handleSession(body, res);
          break;

        default:
          res.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      webLogger.error('Web request handling failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Internal error' });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    body: WebMessagePayload,
    res: Response
  ): Promise<void> {
    if (!body.message?.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const payload: IncomingMessage = {
      sessionId: body.sessionId,
      message: body.message,
      channel: 'web',
      userId: body.userId,
      metadata: {
        userName: body.userName,
        userEmail: body.userEmail,
      },
      attachments: body.attachments?.map((att, idx) => ({
        id: `att_${idx}`,
        type: att.type as 'image' | 'video' | 'audio' | 'document',
        url: att.url,
        mimeType: this.getMimeType(att.type),
        size: att.size,
        filename: att.name,
      })),
    };

    try {
      const response = await this.processMessage(payload);

      // Format response for web
      const webResponse = this.formatForChannel(response);

      res.status(200).json({
        success: true,
        response: webResponse,
      });
    } catch (error) {
      webLogger.error('Failed to process web message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to process message',
      });
    }
  }

  /**
   * Handle typing indicator
   */
  private async handleTyping(
    body: WebTypingEvent,
    res: Response
  ): Promise<void> {
    webLogger.debug('Received typing indicator', {
      sessionId: body.sessionId,
      isTyping: body.isTyping,
    });

    // Store typing state in Redis for real-time delivery
    await sessionCache.set(
      `web:typing:${body.sessionId}`,
      { isTyping: body.isTyping, timestamp: Date.now() },
      30 // 30 seconds TTL
    );

    res.status(200).json({ success: true });
  }

  /**
   * Handle session creation/request
   */
  private async handleSession(
    body: WebMessagePayload,
    res: Response
  ): Promise<void> {
    try {
      // If session ID provided, verify it exists
      if (body.sessionId) {
        const session = await Session.findOne({ sessionId: body.sessionId });
        if (session) {
          res.status(200).json({
            success: true,
            session: {
              sessionId: session.sessionId,
              conversationId: session.conversationId,
              status: session.status,
              createdAt: session.createdAt,
            },
          });
          return;
        }
      }

      // Create new session
      const payload: IncomingMessage = {
        message: '',
        channel: 'web',
        userId: body.userId,
        metadata: {
          userName: body.userName,
          userEmail: body.userEmail,
        },
      };

      const { session, conversation } = await this.getOrCreateSession(payload);

      res.status(200).json({
        success: true,
        session: {
          sessionId: session.sessionId,
          conversationId: conversation.conversationId,
          status: session.status,
          createdAt: session.createdAt,
        },
        isNew: true,
      });
    } catch (error) {
      webLogger.error('Failed to handle session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create session',
      });
    }
  }

  /**
   * Get or create session for web user
   */
  private async getOrCreateSession(payload: IncomingMessage): Promise<{
    session: InstanceType<typeof Session>;
    conversation: InstanceType<typeof Conversation>;
  }> {
    const userId = payload.userId || `anon_${uuidv4()}`;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      userId,
      status: 'active',
      primaryChannel: 'web',
    });

    if (!conversation) {
      conversation = await Conversation.findOrCreate(userId, 'web');
    }

    // Find or create session
    const { session, isNew } = await Session.getOrCreateSession({
      conversationId: conversation.conversationId,
      userId,
      channel: 'web',
      channelMetadata: {
        platform: 'web',
        deviceType: 'desktop',
        userAgent: payload.metadata?.userAgent as string,
        ipAddress: payload.metadata?.ipAddress as string,
      },
    });

    if (isNew) {
      await conversation.addSession(session._id);
      await conversation.save();
    }

    return { session, conversation };
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(type: string): string {
    const mimeTypes: Record<string, string> = {
      image: 'image/png',
      video: 'video/mp4',
      audio: 'audio/mpeg',
      document: 'application/pdf',
    };
    return mimeTypes[type] || 'application/octet-stream';
  }

  /**
   * Format message for web channel
   */
  formatForChannel(message: OutgoingMessage): Record<string, unknown> {
    return {
      id: message.messageId,
      type: 'message',
      content: {
        text: message.content.text,
        html: message.content.html,
        attachments: message.content.attachments?.map(att => ({
          id: att.id,
          type: att.type,
          url: att.url,
          name: att.filename,
          mimeType: att.mimeType,
          size: att.size,
        })),
        quickReplies: message.content.quickReplies?.map(qr => ({
          id: qr.id,
          text: qr.text,
          payload: qr.payload,
        })),
        interactive: message.content.interactive,
      },
      sender: {
        id: message.sender.agent?.agentId || 'bot',
        name: message.sender.agent?.name || 'REZ Assistant',
        type: 'agent',
        avatar: message.sender.agent?.name
          ? this.getAvatarUrl(message.sender.agent.name)
          : undefined,
      },
      timestamp: new Date().toISOString(),
      metadata: message.metadata,
    };
  }

  /**
   * Get avatar URL for agent
   */
  private getAvatarUrl(name: string): string {
    // Generate avatar URL based on name
    const initials = name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6366f1&color=fff`;
  }

  /**
   * Get typing state for session
   */
  async getTypingState(sessionId: string): Promise<boolean> {
    const state = await sessionCache.get<{ isTyping: boolean; timestamp: number }>(
      `web:typing:${sessionId}`
    );
    return state?.isTyping || false;
  }

  /**
   * End web session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.conversationService.endSession(sessionId);
    await sessionCache.delete(`web:typing:${sessionId}`);
  }
}

export { WebAdapter };

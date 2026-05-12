/**
 * Conversation Logger Service
 * Logs conversations to MongoDB with support for real-time updates and analytics
 */

import {
  Message,
  IMessage,
  MessageRole,
  MessageStatus,
} from '../models/Message';
import {
  Session,
  SessionStatus,
  ISession,
} from '../models/Session';
import {
  Conversation,
  ConversationStatus,
  IConversation,
} from '../models/Conversation';
import {
  IncomingMessage,
  OutgoingMessage,
  IntentData,
  AgentInfo,
  ChannelType,
  MessageSummary,
} from '../types';
import { config } from '../config';
import { logger } from '../config/logger';
import { sessionCache, RedisKeys } from '../config/redis';

const conversationLogger = logger.child({ component: 'ConversationLogger' });

interface LoggedMessage {
  messageId: string;
  conversationId: string;
  sessionId: string;
  role: MessageRole;
  intent?: IntentData;
  agent?: AgentInfo;
  processingTimeMs?: number;
  timestamp: Date;
}

interface ConversationMetrics {
  totalMessages: number;
  totalSessions: number;
  averageResponseTimeMs: number;
  topIntents: Array<{ intent: string; count: number }>;
  channelDistribution: Record<ChannelType, number>;
}

export class ConversationService {
  /**
   * Log incoming user message
   */
  async logIncomingMessage(
    payload: IncomingMessage,
    conversationId: string,
    sessionId: string
  ): Promise<IMessage> {
    conversationLogger.debug('Logging incoming message', {
      sessionId,
      channel: payload.channel,
    });

    try {
      const message = await Message.createMessage({
        conversationId,
        sessionId,
        sender: {
          role: MessageRole.USER,
          userId: payload.userId,
        },
        channel: payload.channel,
        content: {
          text: payload.message,
          attachments: payload.attachments?.map((att, idx) => ({
            id: att.id || `att_${idx}`,
            type: att.type,
            url: att.url,
            mimeType: att.mimeType,
            size: att.size,
            width: att.width,
            height: att.height,
          })),
        },
        channelMessageId: payload.channelMessageId,
      });

      // Update session metrics
      await Session.updateOne(
        { sessionId },
        {
          $inc: { 'metrics.messageCount': 1, 'metrics.userMessageCount': 1 },
          $set: { lastActivityAt: new Date() },
        }
      );

      // Update conversation metrics
      await Conversation.updateOne(
        { conversationId },
        {
          $inc: { 'metrics.totalMessages': 1 },
          $set: { 'metrics.lastActivityAt': new Date() },
        }
      );

      // Cache message summary for context
      await this.cacheMessageSummary(sessionId, {
        messageId: message.messageId,
        role: MessageRole.USER,
        content: payload.message,
        timestamp: message.createdAt,
      });

      conversationLogger.debug('Incoming message logged', {
        messageId: message.messageId,
      });

      return message;
    } catch (error) {
      conversationLogger.error('Failed to log incoming message', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Log outgoing agent response
   */
  async logOutgoingMessage(
    response: OutgoingMessage,
    incomingMessageId: string,
    processingMetrics?: {
      routingTimeMs?: number;
      generationTimeMs?: number;
    }
  ): Promise<IMessage> {
    conversationLogger.debug('Logging outgoing message', {
      conversationId: response.conversationId,
      sessionId: response.sessionId,
    });

    try {
      const message = await Message.createMessage({
        conversationId: response.conversationId,
        sessionId: response.sessionId,
        sender: {
          role: MessageRole.AGENT,
          userId: response.sender.agent?.agentId,
          name: response.sender.agent?.name,
        },
        channel: response.channel,
        content: {
          text: response.content.text,
          html: response.content.html,
          markdown: response.content.markdown,
          attachments: response.content.attachments?.map(att => ({
            id: att.id,
            type: att.type,
            url: att.url,
            mimeType: att.mimeType,
            size: att.size,
            caption: att.caption,
          })),
          quickReplies: response.content.quickReplies,
          interactive: response.content.interactive,
        },
        parentMessageId: incomingMessageId,
      });

      // Update message with metadata
      message.metadata = {
        intent: response.metadata?.intent,
        agent: response.metadata?.agent,
        routingTimeMs: processingMetrics?.routingTimeMs,
        processingTimeMs: processingMetrics?.generationTimeMs,
        totalProcessingTimeMs:
          (processingMetrics?.routingTimeMs || 0) +
          (processingMetrics?.generationTimeMs || 0),
      };

      await message.save();

      // Update session metrics
      const responseTimeMs = processingMetrics?.totalProcessingTimeMs ||
        ((processingMetrics?.routingTimeMs || 0) + (processingMetrics?.generationTimeMs || 0));

      await Session.updateOne(
        { sessionId: response.sessionId },
        {
          $inc: {
            'metrics.messageCount': 1,
            'metrics.agentMessageCount': 1,
            'metrics.totalResponseTimeMs': responseTimeMs,
          },
          $set: { lastActivityAt: new Date() },
        }
      );

      // Recalculate average response time
      const session = await Session.findOne({ sessionId: response.sessionId });
      if (session && session.metrics.agentMessageCount > 0) {
        const avgResponseTime =
          session.metrics.totalResponseTimeMs / session.metrics.agentMessageCount;
        await Session.updateOne(
          { sessionId: response.sessionId },
          { $set: { 'metrics.averageResponseTimeMs': avgResponseTime } }
        );
      }

      // Update conversation metrics
      await Conversation.updateOne(
        { conversationId: response.conversationId },
        {
          $inc: { 'metrics.totalMessages': 1 },
          $set: { 'metrics.lastActivityAt': new Date() },
        }
      );

      // Cache message summary
      await this.cacheMessageSummary(response.sessionId, {
        messageId: message.messageId,
        role: MessageRole.AGENT,
        content: response.content.text || '',
        timestamp: message.createdAt,
      });

      conversationLogger.debug('Outgoing message logged', {
        messageId: message.messageId,
        responseTimeMs,
      });

      return message;
    } catch (error) {
      conversationLogger.error('Failed to log outgoing message', {
        conversationId: response.conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cache message summary for quick context loading
   */
  private async cacheMessageSummary(
    sessionId: string,
    summary: MessageSummary
  ): Promise<void> {
    try {
      const cacheKey = RedisKeys.sessionMessages(sessionId);
      const existingMessages = await sessionCache.get<MessageSummary[]>(cacheKey) || [];

      // Keep last 50 messages
      const updatedMessages = [...existingMessages, summary].slice(-50);
      await sessionCache.set(cacheKey, updatedMessages, 3600); // 1 hour TTL
    } catch (error) {
      conversationLogger.warn('Failed to cache message summary', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<IConversation | null> {
    return Conversation.findOne({ conversationId });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ISession | null> {
    return Session.findOne({ sessionId });
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<IMessage | null> {
    return Message.findOne({ messageId });
  }

  /**
   * Get messages for conversation
   */
  async getConversationMessages(
    conversationId: string,
    options: { limit?: number; before?: Date } = {}
  ): Promise<IMessage[]> {
    return Message.find({
      conversationId,
      ...(options.before && { createdAt: { $lt: options.before } }),
    })
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  /**
   * Get messages for session
   */
  async getSessionMessages(
    sessionId: string,
    options: { limit?: number } = {}
  ): Promise<IMessage[]> {
    return Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  /**
   * Update message status
   */
  async updateMessageStatus(
    messageId: string,
    status: MessageStatus
  ): Promise<IMessage | null> {
    const updateFields: Record<string, unknown> = { status };

    if (status === MessageStatus.DELIVERED) {
      updateFields.deliveredAt = new Date();
    } else if (status === MessageStatus.READ) {
      updateFields.readAt = new Date();
    } else if (status === MessageStatus.FAILED) {
      updateFields.metadata = { error: 'Message delivery failed' };
    }

    return Message.findOneAndUpdate(
      { messageId },
      { $set: updateFields },
      { new: true }
    );
  }

  /**
   * Create or update session
   */
  async createSession(params: {
    conversationId: string;
    userId: string;
    channel: ChannelType;
    anonymousId?: string;
    channelMetadata?: ISession['channelMetadata'];
  }): Promise<ISession> {
    // Check for existing active session
    const existingSession = await Session.findActiveSession(
      params.userId,
      params.channel
    );

    if (existingSession) {
      // Update activity
      existingSession.recordActivity();
      await existingSession.save();
      return existingSession;
    }

    // Create new session
    const session = await Session.createSession({
      conversationId: params.conversationId,
      userId: params.userId,
      channel: params.channel,
      anonymousId: params.anonymousId,
      channelMetadata: params.channelMetadata,
    });

    // Update conversation
    await Conversation.updateOne(
      { conversationId: params.conversationId },
      {
        $push: { sessionIds: session._id },
        $set: {
          activeSessionId: session._id,
          currentChannel: params.channel,
        },
        $inc: { 'metrics.totalSessions': 1 },
      }
    );

    conversationLogger.info('Session created', {
      sessionId: session.sessionId,
      conversationId: params.conversationId,
    });

    return session;
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.end();
    await session.save();

    // Clear context cache
    await sessionCache.delete(RedisKeys.sessionContext(sessionId));
    await sessionCache.delete(RedisKeys.sessionMessages(sessionId));

    conversationLogger.info('Session ended', { sessionId });
  }

  /**
   * Get conversation metrics
   */
  async getConversationMetrics(
    conversationId: string
  ): Promise<{
    totalMessages: number;
    totalSessions: number;
    averageResponseTimeMs: number;
    lastActivity: Date;
    currentIntent: IntentData | null;
  } | null> {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return null;
    }

    return {
      totalMessages: conversation.metrics.totalMessages,
      totalSessions: conversation.metrics.totalSessions,
      averageResponseTimeMs: conversation.metrics.averageResponseTimeMs,
      lastActivity: conversation.metrics.lastActivityAt,
      currentIntent: conversation.currentIntent,
    };
  }

  /**
   * Get overall conversation metrics
   */
  async getOverallMetrics(): Promise<ConversationMetrics> {
    const [conversationStats, sessionStats, messageStats] = await Promise.all([
      Conversation.getStatistics(),
      Session.getStatistics(),
      Message.getStatistics(),
    ]);

    return {
      totalMessages: messageStats.total,
      totalSessions: sessionStats.total,
      averageResponseTimeMs:
        messageStats.averageProcessingTimeMs > 0
          ? messageStats.averageProcessingTimeMs
          : sessionStats.averageMessagesPerSession > 0
          ? 1000 / sessionStats.averageMessagesPerSession
          : 0,
      topIntents: [], // Would need to aggregate from messages
      channelDistribution: sessionStats.byChannel,
    };
  }

  /**
   * Get message count for session
   */
  async getSessionMessageCount(sessionId: string): Promise<number> {
    const session = await Session.findOne({ sessionId }).lean();
    return session?.metrics.messageCount || 0;
  }

  /**
   * Search messages
   */
  async searchMessages(
    query: string,
    options: {
      conversationId?: string;
      sessionId?: string;
      limit?: number;
    } = {}
  ): Promise<IMessage[]> {
    const searchQuery: Record<string, unknown> = {
      $or: [
        { 'content.text': { $regex: query, $options: 'i' } },
        { 'content.markdown': { $regex: query, $options: 'i' } },
      ],
    };

    if (options.conversationId) {
      searchQuery.conversationId = options.conversationId;
    }

    if (options.sessionId) {
      searchQuery.sessionId = options.sessionId;
    }

    return Message.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(limit: number = 10): Promise<IConversation[]> {
    return Conversation.find({ status: ConversationStatus.ACTIVE })
      .sort({ 'metrics.lastActivityAt': -1 })
      .limit(limit);
  }

  /**
   * Archive old conversations
   */
  async archiveOldConversations(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await Conversation.updateMany(
      {
        status: ConversationStatus.ACTIVE,
        'metrics.lastActivityAt': { $lt: cutoffDate },
      },
      {
        $set: { status: ConversationStatus.ARCHIVED },
      }
    );

    conversationLogger.info('Archived old conversations', {
      count: result.modifiedCount,
      olderThanDays,
    });

    return result.modifiedCount;
  }
}

// Singleton instance
let conversationServiceInstance: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!conversationServiceInstance) {
    conversationServiceInstance = new ConversationService();
  }
  return conversationServiceInstance;
}

export function resetConversationService(): void {
  conversationServiceInstance = null;
}

export { ConversationService };

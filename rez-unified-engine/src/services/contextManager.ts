/**
 * Context Manager Service
 * Loads and manages conversation context from various sources including CDP, Redis, and MongoDB
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  ConversationContext,
  UserProfile,
  IntentData,
  MessageSummary,
  IntentSummary,
  ChannelType,
} from '../types';
import { config } from '../config';
import { logger } from '../config/logger';
import { sessionCache, RedisKeys, SessionCache } from '../config/redis';
import { Message } from '../models/Message';
import { Session } from '../models/Session';
import { Conversation } from '../models/Conversation';

const contextManagerLogger = logger.child({ component: 'ContextManager' });

export class ContextManager {
  private cache: SessionCache;
  private cacheTTL: number;
  private aggregationTimeout: number;

  constructor() {
    this.cache = sessionCache;
    this.cacheTTL = 300; // 5 minutes
    this.aggregationTimeout = config.performance.contextAggregationTimeoutMs;
  }

  /**
   * Load complete context for a session
   */
  async loadContext(sessionId: string): Promise<ConversationContext> {
    const startTime = Date.now();

    contextManagerLogger.debug('Loading context', { sessionId });

    try {
      // Try to get from cache first
      const cachedContext = await this.cache.get<ConversationContext>(
        RedisKeys.sessionContext(sessionId)
      );

      if (cachedContext) {
        contextManagerLogger.debug('Context loaded from cache', {
          sessionId,
          loadTimeMs: Date.now() - startTime,
        });
        return cachedContext;
      }

      // Load from database
      const context = await this.aggregateContext(sessionId);

      // Cache the context
      await this.cache.set(
        RedisKeys.sessionContext(sessionId),
        context,
        this.cacheTTL
      );

      contextManagerLogger.debug('Context aggregated and cached', {
        sessionId,
        loadTimeMs: Date.now() - startTime,
      });

      return context;
    } catch (error) {
      contextManagerLogger.error('Failed to load context', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Aggregate context from multiple sources
   */
  private async aggregateContext(sessionId: string): Promise<ConversationContext> {
    const [session, messages] = await Promise.all([
      Session.findOne({ sessionId }).lean(),
      Message.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Load conversation for additional context
    const conversation = await Conversation.findOne({
      conversationId: session.conversationId,
    }).lean();

    // Load user profile from CDP
    const userProfile = await this.loadUserProfile(session.userId);

    // Aggregate context in parallel with timeout
    const [historyData, intentHistory] = await Promise.all([
      this.aggregateHistory(messages),
      this.aggregateIntentHistory(conversation?.intentHistory || []),
    ]);

    return {
      user: userProfile,
      conversation: {
        conversationId: session.conversationId,
        sessionId: session.sessionId,
        channel: session.channel as ChannelType,
        currentIntent: conversation?.currentIntent || null,
        recentIntents: conversation?.context.recentIntents || [],
        variables: session.context.variables || {},
      },
      session: {
        messageCount: session.metrics.messageCount,
        averageResponseTimeMs: session.metrics.averageResponseTimeMs,
        lastIntent: session.context.lastIntentId
          ? {
              intentId: session.context.lastIntentId,
              name: '',
              confidence: 0,
              entities: {},
              provider: 'intent-graph',
            }
          : null,
        lastAgent: session.context.lastAgentId
          ? {
              agentId: session.context.lastAgentId,
              name: '',
              type: 'bot',
            }
          : null,
      },
      history: {
        messages: historyData,
        intents: intentHistory,
      },
    };
  }

  /**
   * Load user profile from CDP
   */
  private async loadUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const cdpUrl = `${config.services.cdp.url}/api/profiles/${userId}`;
      const response = await axios.get(cdpUrl, {
        timeout: this.aggregationTimeout,
        headers: {
          'X-Internal-Token': config.internalServiceTokens['rez-cdp'] || '',
        },
      });

      if (response.data) {
        return response.data as UserProfile;
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        contextManagerLogger.debug('User profile not found', { userId });
        return null;
      }
      contextManagerLogger.warn('Failed to load user profile from CDP', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Aggregate message history for context
   */
  private aggregateHistory(
    messages: Array<{
      _id: unknown;
      messageId: string;
      sender: { role: string };
      content: { text?: string; markdown?: string };
      createdAt: Date;
    }>
  ): MessageSummary[] {
    return messages
      .map((msg) => ({
        messageId: msg.messageId,
        role: msg.sender.role as MessageSummary['role'],
        content: msg.content.text || msg.content.markdown || '',
        timestamp: msg.createdAt,
      }))
      .reverse();
  }

  /**
   * Aggregate intent history for context
   */
  private aggregateIntentHistory(
    intents: Array<{
      intentId: string;
      name: string;
      confidence: number;
      detectedAt?: Date;
    }>
  ): IntentSummary[] {
    return intents.slice(0, 10).map((intent) => ({
      intentId: intent.intentId,
      name: intent.name,
      confidence: intent.confidence,
      timestamp: intent.detectedAt || new Date(),
    }));
  }

  /**
   * Update context with new data
   */
  async updateContext(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<void> {
    contextManagerLogger.debug('Updating context', { sessionId, updates });

    try {
      // Get current context
      const currentContext = await this.loadContext(sessionId);

      // Merge updates
      const updatedContext: ConversationContext = {
        ...currentContext,
        ...updates,
        conversation: {
          ...currentContext.conversation,
          ...updates.conversation,
        },
        session: {
          ...currentContext.session,
          ...updates.session,
        },
        history: updates.history || currentContext.history,
        user: updates.user || currentContext.user,
      };

      // Update session variables if provided
      if (updates.conversation?.variables) {
        await Session.updateOne(
          { sessionId },
          { $set: { 'context.variables': updates.conversation.variables } }
        );
      }

      // Update conversation context if needed
      if (updates.conversation?.currentIntent) {
        await Conversation.updateOne(
          { sessionIds: (await Session.findOne({ sessionId }))?.sessionId ? {} : undefined },
          { $set: { currentIntent: updates.conversation.currentIntent } }
        ).catch(() => {
          // Ignore if conversation not found
        });
      }

      // Update cache
      await this.cache.set(
        RedisKeys.sessionContext(sessionId),
        updatedContext,
        this.cacheTTL
      );

      contextManagerLogger.debug('Context updated successfully', { sessionId });
    } catch (error) {
      contextManagerLogger.error('Failed to update context', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add intent to context
   */
  async addIntentToContext(
    sessionId: string,
    intent: IntentData
  ): Promise<void> {
    contextManagerLogger.debug('Adding intent to context', {
      sessionId,
      intentId: intent.intentId,
    });

    try {
      // Update session with intent
      await Session.updateOne(
        { sessionId },
        {
          $set: { 'context.lastIntentId': intent.intentId },
        }
      );

      // Update conversation with intent
      const session = await Session.findOne({ sessionId });
      if (session) {
        await Conversation.updateOne(
          { conversationId: session.conversationId },
          {
            $push: {
              'context.recentIntents': {
                $each: [intent],
                $slice: -10,
              },
            },
            $set: {
              currentIntent: intent,
              'context.lastUpdated': new Date(),
            },
          }
        );
      }

      // Invalidate cache
      await this.cache.delete(RedisKeys.sessionContext(sessionId));

      contextManagerLogger.debug('Intent added to context', { sessionId });
    } catch (error) {
      contextManagerLogger.error('Failed to add intent to context', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add message to context history
   */
  async addMessageToHistory(
    sessionId: string,
    message: MessageSummary
  ): Promise<void> {
    try {
      const currentContext = await this.loadContext(sessionId);

      const updatedHistory = {
        messages: [...currentContext.history.messages, message].slice(-50),
      };

      await this.updateContext(sessionId, { history: updatedHistory });
    } catch (error) {
      contextManagerLogger.error('Failed to add message to history', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Set context variable
   */
  async setVariable(
    sessionId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    try {
      await Session.updateOne(
        { sessionId },
        {
          $set: { [`context.variables.${key}`]: value },
        }
      );

      // Invalidate cache to force reload
      await this.cache.delete(RedisKeys.sessionContext(sessionId));
    } catch (error) {
      contextManagerLogger.error('Failed to set variable', {
        sessionId,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get context variable
   */
  async getVariable<T>(sessionId: string, key: string): Promise<T | undefined> {
    try {
      const context = await this.loadContext(sessionId);
      return context.conversation.variables[key] as T | undefined;
    } catch (error) {
      contextManagerLogger.error('Failed to get variable', {
        sessionId,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Clear context cache
   */
  async clearContext(sessionId: string): Promise<void> {
    contextManagerLogger.debug('Clearing context', { sessionId });

    try {
      await this.cache.delete(RedisKeys.sessionContext(sessionId));
      contextManagerLogger.debug('Context cleared', { sessionId });
    } catch (error) {
      contextManagerLogger.error('Failed to clear context', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get context summary for debugging
   */
  async getContextSummary(sessionId: string): Promise<{
    sessionId: string;
    conversationId: string;
    channel: string;
    messageCount: number;
    currentIntent: string | null;
    userId: string | null;
    lastActivity: Date | null;
  }> {
    const session = await Session.findOne({ sessionId }).lean();
    const conversation = session
      ? await Conversation.findOne({ conversationId: session.conversationId }).lean()
      : null;

    return {
      sessionId,
      conversationId: session?.conversationId || 'unknown',
      channel: session?.channel || 'unknown',
      messageCount: session?.metrics.messageCount || 0,
      currentIntent: conversation?.currentIntent?.name || null,
      userId: session?.userId || null,
      lastActivity: session?.lastActivityAt || null,
    };
  }
}

// Singleton instance
let contextManagerInstance: ContextManager | null = null;

export function getContextManager(): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager();
  }
  return contextManagerInstance;
}

export function resetContextManager(): void {
  contextManagerInstance = null;
}

export { ContextManager };

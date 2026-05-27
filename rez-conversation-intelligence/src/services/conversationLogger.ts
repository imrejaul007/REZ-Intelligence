import { v4 as uuidv4 } from 'uuid';
import { ConversationSample, IConversationSample, IMessage } from '../models/index.js';
import { ConversationCreate, MessageCreate, ConversationUpdate } from '../utils/validators.js';
import { getRedisClient } from '../utils/database.js';
import logger from './utils/logger.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { intentExtractor } from './intentExtractor.js';
import { sentimentAnalyzer } from './sentimentAnalyzer.js';
import { config } from '../config/index.js';

const DUPLICATE_KEY_PREFIX = 'conversation:duplicate:';
const DUPLICATE_WINDOW_SECONDS = 300; // 5 minutes

export interface ConversationLoggerOptions {
  extractIntents?: boolean;
  analyzeSentiment?: boolean;
  skipDuplicateCheck?: boolean;
}

export class ConversationLogger {
  private redis = getRedisClient();

  async createConversation(
    data: ConversationCreate,
    options: ConversationLoggerOptions = {}
  ): Promise<IConversationSample> {
    const startTime = Date.now();

    // Check for duplicate conversation
    if (!options.skipDuplicateCheck) {
      const isDuplicate = await this.checkDuplicate(data.sessionId);
      if (isDuplicate) {
        throw new ConflictError(`Conversation with sessionId '${data.sessionId}' already exists`);
      }
    }

    const conversationId = uuidv4();
    const messages: IMessage[] = [];

    // Process messages if provided
    if (data.messages && data.messages.length > 0) {
      for (const msg of data.messages) {
        const processedMessage = await this.processMessage(msg, options);
        messages.push(processedMessage);
      }
    }

    // Aggregate intents and sentiment from messages
    const extractedIntents = this.aggregateIntents(messages);
    const aggregatedSentiment = this.aggregateSentiment(messages);

    const conversation = new ConversationSample({
      conversationId,
      sessionId: data.sessionId,
      channel: data.channel,
      participants: data.participants,
      messages,
      context: data.context || {},
      extractedIntents,
      aggregatedSentiment,
      status: 'active',
      metadata: data.metadata || {},
      isLabeled: false,
    });

    await conversation.save();

    // Mark session as processed
    await this.markProcessed(data.sessionId);

    const duration = Date.now() - startTime;
    logger.info('Conversation created', {
      conversationId,
      sessionId: data.sessionId,
      messageCount: messages.length,
      intentCount: extractedIntents.length,
      duration,
    });

    return conversation;
  }

  async addMessage(
    conversationId: string,
    messageData: MessageCreate,
    options: ConversationLoggerOptions = {}
  ): Promise<IConversationSample> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    const message: IMessage = {
      id: uuidv4(),
      senderId: messageData.senderId,
      senderType: messageData.senderType,
      content: messageData.content,
      timestamp: new Date(),
      metadata: messageData.metadata,
    };

    // Process message for intents and sentiment
    const processedMessage = await this.processMessage(
      {
        id: message.id,
        senderId: message.senderId,
        senderType: message.senderType,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
      },
      options
    );

    conversation.messages.push(processedMessage);

    // Update aggregated values
    conversation.extractedIntents = this.aggregateIntents(conversation.messages);
    conversation.aggregatedSentiment = this.aggregateSentiment(conversation.messages);

    await conversation.save();

    logger.info('Message added to conversation', {
      conversationId,
      messageId: message.id,
    });

    return conversation;
  }

  async getConversation(conversationId: string): Promise<IConversationSample> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    return conversation;
  }

  async listConversations(filters: {
    sessionId?: string;
    channel?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    conversations: IConversationSample[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filters.sessionId) query.sessionId = filters.sessionId;
    if (filters.channel) query.channel = filters.channel;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const [conversations, total] = await Promise.all([
      ConversationSample.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ConversationSample.countDocuments(query),
    ]);

    return {
      conversations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateConversation(
    conversationId: string,
    updates: ConversationUpdate
  ): Promise<IConversationSample> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    if (updates.status) conversation.status = updates.status;
    if (updates.outcome) {
      conversation.outcome = {
        type: updates.outcome,
        success: true,
      };
    }
    if (updates.metadata) {
      conversation.metadata = { ...conversation.metadata, ...updates.metadata };
    }

    await conversation.save();

    logger.info('Conversation updated', { conversationId, updates });

    return conversation;
  }

  async setOutcome(
    conversationId: string,
    outcome: {
      type: string;
      success: boolean;
      resolutionTime?: number;
      satisfaction?: number;
      notes?: string;
    }
  ): Promise<IConversationSample> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    conversation.outcome = outcome;
    await conversation.save();

    logger.info('Outcome set for conversation', { conversationId, outcome });

    return conversation;
  }

  async archiveConversation(conversationId: string): Promise<IConversationSample> {
    return this.updateConversation(conversationId, { status: 'archived' });
  }

  async closeConversation(conversationId: string): Promise<IConversationSample> {
    return this.updateConversation(conversationId, { status: 'closed' });
  }

  private async processMessage(
    msg: {
      id: string;
      senderId: string;
      senderType: string;
      content: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    },
    options: ConversationLoggerOptions
  ): Promise<IMessage> {
    const processedMessage: IMessage = {
      id: msg.id,
      senderId: msg.senderId,
      senderType: msg.senderType as 'user' | 'agent' | 'bot' | 'system',
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: msg.metadata,
    };

    // Extract intents if enabled
    if (config.ENABLE_INTENT_EXTRACTION && options.extractIntents !== false) {
      try {
        processedMessage.intent = await intentExtractor.extract(msg.content);
      } catch (error) {
        logger.warn('Intent extraction failed for message', {
          messageId: msg.id,
          error: (error as Error).message,
        });
      }
    }

    // Analyze sentiment if enabled
    if (config.ENABLE_SENTIMENT_ANALYSIS && options.analyzeSentiment !== false) {
      try {
        processedMessage.sentiment = await sentimentAnalyzer.analyze(msg.content);
      } catch (error) {
        logger.warn('Sentiment analysis failed for message', {
          messageId: msg.id,
          error: (error as Error).message,
        });
      }
    }

    return processedMessage;
  }

  private aggregateIntents(messages: IMessage[]): Array<{
    name: string;
    confidence: number;
    alternatives?: Array<{ name: string; confidence: number }>;
  }> {
    const intentCounts = new Map<string, { confidence: number; count: number }>();

    for (const msg of messages) {
      if (msg.intent) {
        const current = intentCounts.get(msg.intent.name) || { confidence: 0, count: 0 };
        intentCounts.set(msg.intent.name, {
          confidence: Math.max(current.confidence, msg.intent.confidence),
          count: current.count + 1,
        });

        // Store alternatives
        if (msg.intent.alternatives) {
          for (const alt of msg.intent.alternatives) {
            const altCurrent = intentCounts.get(alt.name) || { confidence: 0, count: 0 };
            intentCounts.set(alt.name, {
              confidence: Math.max(altCurrent.confidence, alt.confidence),
              count: altCurrent.count,
            });
          }
        }
      }
    }

    return Array.from(intentCounts.entries())
      .map(([name, data]) => ({ name, confidence: data.confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  private aggregateSentiment(messages: IMessage[]): {
    score: number;
    comparative: number;
    confidence: number;
    label: 'positive' | 'neutral' | 'negative';
    messageCount: number;
  } {
    const sentiments = messages
      .filter((m) => m.sentiment)
      .map((m) => m.sentiment!);

    if (sentiments.length === 0) {
      return {
        score: 0,
        comparative: 0,
        confidence: 0,
        label: 'neutral',
        messageCount: 0,
      };
    }

    const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
    const avgComparative = sentiments.reduce((sum, s) => sum + s.comparative, 0) / sentiments.length;
    const avgConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;

    let label: 'positive' | 'neutral' | 'negative';
    if (avgScore > 0.05) label = 'positive';
    else if (avgScore < -0.05) label = 'negative';
    else label = 'neutral';

    return {
      score: avgScore,
      comparative: avgComparative,
      confidence: avgConfidence,
      label,
      messageCount: sentiments.length,
    };
  }

  private async checkDuplicate(sessionId: string): Promise<boolean> {
    const key = `${DUPLICATE_KEY_PREFIX}${sessionId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  private async markProcessed(sessionId: string): Promise<void> {
    const key = `${DUPLICATE_KEY_PREFIX}${sessionId}`;
    await this.redis.setex(key, DUPLICATE_WINDOW_SECONDS, '1');
  }
}

export const conversationLogger = new ConversationLogger();

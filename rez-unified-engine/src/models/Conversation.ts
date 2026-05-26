/**
 * Conversation Model
 * Represents a conversation entity spanning multiple sessions across channels
 */

import crypto from 'crypto';
import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { ChannelType, MessageRole, IntentConfidence } from '../types';

// Conversation status enum
export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
}

// Intent data embedded in conversation
export interface IConversationIntent {
  intentId: string;
  name: string;
  confidence: number;
  entities: Record<string, unknown>;
  provider: 'intent-graph' | 'agent-os' | 'llm';
}

// Aggregated context from all sessions
export interface IConversationContext {
  userPreferences: Record<string, unknown>;
  purchaseHistory: string[];
  recentIntents: IConversationIntent[];
  unresolvedIssues: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  lastUpdated: Date;
}

// Conversation document interface
export interface IConversation extends Document {
  _id: Types.ObjectId;
  conversationId: string;
  userId: string;

  // Channel management
  primaryChannel: ChannelType;
  activeChannels: ChannelType[];
  currentChannel: ChannelType;

  // Status
  status: ConversationStatus;

  // Related entities
  sessionIds: Types.ObjectId[];
  activeSessionId: Types.ObjectId | null;

  // Aggregated context
  context: IConversationContext;

  // Intent tracking
  currentIntent: IConversationIntent | null;
  intentHistory: IConversationIntent[];

  // Metrics
  metrics: {
    totalMessages: number;
    totalSessions: number;
    averageResponseTimeMs: number;
    lastActivityAt: Date;
    firstMessageAt: Date;
    satisfactionScore?: number;
  };

  // Tags and metadata
  tags: string[];
  metadata: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Conversation schema
const ConversationSchema = new Schema<IConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    primaryChannel: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    activeChannels: {
      type: [String],
      enum: Object.values(ChannelType),
      default: [],
    },
    currentChannel: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.ACTIVE,
      index: true,
    },
    sessionIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Session',
      default: [],
    },
    activeSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    context: {
      userPreferences: {
        type: Schema.Types.Mixed,
        default: {},
      },
      purchaseHistory: {
        type: [String],
        default: [],
      },
      recentIntents: {
        type: [
          {
            intentId: String,
            name: String,
            confidence: Number,
            entities: Schema.Types.Mixed,
            provider: String,
          },
        ],
        default: [],
      },
      unresolvedIssues: {
        type: [String],
        default: [],
      },
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
        default: 'neutral',
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    currentIntent: {
      intentId: String,
      name: String,
      confidence: Number,
      entities: Schema.Types.Mixed,
      provider: String,
    },
    intentHistory: {
      type: [
        {
          intentId: String,
          name: String,
          confidence: Number,
          entities: Schema.Types.Mixed,
          provider: String,
          detectedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    metrics: {
      totalMessages: { type: Number, default: 0 },
      totalSessions: { type: Number, default: 0 },
      averageResponseTimeMs: { type: Number, default: 0 },
      lastActivityAt: { type: Date, default: Date.now },
      firstMessageAt: { type: Date, required: true },
      satisfactionScore: { type: Number, min: 0, max: 5 },
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

// Compound indexes for common queries
ConversationSchema.index({ userId: 1, status: 1 });
ConversationSchema.index({ primaryChannel: 1, status: 1 });
ConversationSchema.index({ 'metrics.lastActivityAt': -1, status: 1 });

// Instance methods
ConversationSchema.methods = {
  /**
   * Add a session to this conversation
   */
  addSession(sessionId: Types.ObjectId): void {
    if (!this.sessionIds.includes(sessionId)) {
      this.sessionIds.push(sessionId);
      this.metrics.totalSessions += 1;
    }
  },

  /**
   * Update the active session
   */
  setActiveSession(sessionId: Types.ObjectId): void {
    this.activeSessionId = sessionId;
  },

  /**
   * Update the current channel
   */
  switchChannel(channel: ChannelType): void {
    if (!this.activeChannels.includes(channel)) {
      this.activeChannels.push(channel);
    }
    this.currentChannel = channel;
  },

  /**
   * Update the current intent
   */
  setCurrentIntent(intent: IConversationIntent): void {
    // Add current to history if exists
    if (this.currentIntent) {
      this.intentHistory.unshift({
        ...this.currentIntent,
        detectedAt: new Date(),
      });
      // Keep only last 20 intents
      if (this.intentHistory.length > 20) {
        this.intentHistory = this.intentHistory.slice(0, 20);
      }
    }

    this.currentIntent = intent;
    this.context.recentIntents.unshift(intent);
    if (this.context.recentIntents.length > 10) {
      this.context.recentIntents = this.context.recentIntents.slice(0, 10);
    }
    this.context.lastUpdated = new Date();
  },

  /**
   * Increment message count and update activity
   */
  recordActivity(): void {
    this.metrics.totalMessages += 1;
    this.metrics.lastActivityAt = new Date();
  },

  /**
   * Update response time metrics
   */
  recordResponseTime(responseTimeMs: number): void {
    const currentAvg = this.metrics.averageResponseTimeMs;
    const totalMessages = this.metrics.totalMessages;

    this.metrics.averageResponseTimeMs =
      currentAvg === 0
        ? responseTimeMs
        : (currentAvg * (totalMessages - 1) + responseTimeMs) / totalMessages;
  },

  /**
   * Archive the conversation
   */
  archive(): void {
    this.status = ConversationStatus.ARCHIVED;
  },

  /**
   * Close the conversation
   */
  close(): void {
    this.status = ConversationStatus.CLOSED;
  },

  /**
   * Add a tag
   */
  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  },

  /**
   * Remove a tag
   */
  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
  },
};

// Static methods
ConversationSchema.statics = {
  /**
   * Find or create a conversation for a user
   */
  async findOrCreate(userId: string, channel: ChannelType): Promise<IConversation> {
    let conversation = await this.findOne({
      userId,
      status: ConversationStatus.ACTIVE,
    });

    if (!conversation) {
      conversation = await this.create({
        conversationId: `conv_${crypto.randomUUID()}`,
        userId,
        primaryChannel: channel,
        activeChannels: [channel],
        currentChannel: channel,
        status: ConversationStatus.ACTIVE,
        metrics: {
          totalMessages: 0,
          totalSessions: 0,
          averageResponseTimeMs: 0,
          lastActivityAt: new Date(),
          firstMessageAt: new Date(),
        },
        context: {
          userPreferences: {},
          purchaseHistory: [],
          recentIntents: [],
          unresolvedIssues: [],
          sentiment: 'neutral',
          lastUpdated: new Date(),
        },
        intentHistory: [],
      });
    }

    return conversation;
  },

  /**
   * Get active conversations by channel
   */
  async getActiveByChannel(channel: ChannelType): Promise<IConversation[]> {
    return this.find({
      currentChannel: channel,
      status: ConversationStatus.ACTIVE,
    }).sort({ 'metrics.lastActivityAt': -1 });
  },

  /**
   * Get stale conversations (no activity in given ms)
   */
  async getStaleConversations(staleMs: number): Promise<IConversation[]> {
    const staleThreshold = new Date(Date.now() - staleMs);
    return this.find({
      'metrics.lastActivityAt': { $lt: staleThreshold },
      status: ConversationStatus.ACTIVE,
    });
  },

  /**
   * Get conversation statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    byChannel: Record<ChannelType, number>;
    averageResponseTime: number;
  }> {
    const [total, activeByChannel] = await Promise.all([
      this.countDocuments(),
      this.aggregate([
        { $match: { status: ConversationStatus.ACTIVE } },
        { $group: { _id: '$currentChannel', count: { $sum: 1 } } },
      ]),
    ]);

    const byChannel = Object.values(ChannelType).reduce(
      (acc, channel) => {
        acc[channel] = 0;
        return acc;
      },
      {} as Record<ChannelType, number>
    );

    for (const item of activeByChannel) {
      byChannel[item._id as ChannelType] = item.count;
    }

    const activeStats = await this.findOne({ status: ConversationStatus.ACTIVE })
      .sort({ 'metrics.averageResponseTimeMs': 1 })
      .select('metrics.averageResponseTimeMs');

    return {
      total,
      active: Object.values(byChannel).reduce((a, b) => a + b, 0),
      byChannel,
      averageResponseTime:
        activeStats?.metrics.averageResponseTimeMs || 0,
    };
  },
};

// Export model
export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

// Export types
export type ConversationDocument = IConversation;
export type ConversationModel = Model<IConversation> & typeof Conversation;

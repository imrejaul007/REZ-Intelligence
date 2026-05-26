/**
 * Session Model
 * Represents a single session within a conversation, scoped to a specific channel
 */

import crypto from 'crypto';
import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { ChannelType } from '../types';

// Session status enum
export enum SessionStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  ENDED = 'ended',
  EXPIRED = 'expired',
}

// Session document interface
export interface ISession extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  conversationId: string;

  // User identification
  userId: string;
  anonymousId?: string;
  externalUserId?: string;

  // Channel information
  channel: ChannelType;
  channelMetadata: {
    platform?: string;
    deviceType?: string;
    userAgent?: string;
    ipAddress?: string;
    location?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
  };

  // Status
  status: SessionStatus;

  // Context for this session
  context: {
    lastMessageId?: string;
    lastIntentId?: string;
    lastAgentId?: string;
    variables: Record<string, unknown>;
    recentMessages: string[]; // Last N message IDs
  };

  // TTL tracking
  expiresAt: Date;
  lastActivityAt: Date;
  idleTimeoutMs: number;

  // Metrics
  metrics: {
    messageCount: number;
    userMessageCount: number;
    agentMessageCount: number;
    averageResponseTimeMs: number;
    totalResponseTimeMs: number;
    handoffsToAgent: number;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

// Session schema
const SessionSchema = new Schema<ISession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    anonymousId: {
      type: String,
      index: true,
    },
    externalUserId: {
      type: String,
    },
    channel: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
      index: true,
    },
    channelMetadata: {
      platform: String,
      deviceType: String,
      userAgent: String,
      ipAddress: String,
      location: {
        country: String,
        city: String,
        timezone: String,
      },
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
      index: true,
    },
    context: {
      lastMessageId: String,
      lastIntentId: String,
      lastAgentId: String,
      variables: {
        type: Schema.Types.Mixed,
        default: {},
      },
      recentMessages: {
        type: [String],
        default: [],
      },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    idleTimeoutMs: {
      type: Number,
      default: 1800000, // 30 minutes
    },
    metrics: {
      messageCount: { type: Number, default: 0 },
      userMessageCount: { type: Number, default: 0 },
      agentMessageCount: { type: Number, default: 0 },
      averageResponseTimeMs: { type: Number, default: 0 },
      totalResponseTimeMs: { type: Number, default: 0 },
      handoffsToAgent: { type: Number, default: 0 },
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'sessions',
  }
);

// Compound indexes
SessionSchema.index({ conversationId: 1, channel: 1 });
SessionSchema.index({ userId: 1, channel: 1 });
SessionSchema.index({ status: 1, expiresAt: 1 });
SessionSchema.index({ lastActivityAt: -1, status: 1 });

// TTL index for automatic expiration (MongoDB handles this)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
SessionSchema.methods = {
  /**
   * Check if session is still valid
   */
  isValid(): boolean {
    return (
      this.status === SessionStatus.ACTIVE ||
      this.status === SessionStatus.IDLE
    ) && this.expiresAt > new Date();
  },

  /**
   * Check if session is idle
   */
  isIdle(): boolean {
    const idleThreshold = new Date(Date.now() - this.idleTimeoutMs);
    return this.lastActivityAt < idleThreshold;
  },

  /**
   * Update activity timestamp
   */
  recordActivity(): void {
    this.lastActivityAt = new Date();
    if (this.status === SessionStatus.IDLE) {
      this.status = SessionStatus.ACTIVE;
    }
  },

  /**
   * Mark session as idle
   */
  markIdle(): void {
    this.status = SessionStatus.IDLE;
  },

  /**
   * End the session
   */
  end(): void {
    this.status = SessionStatus.ENDED;
    this.endedAt = new Date();
  },

  /**
   * Expire the session
   */
  expire(): void {
    this.status = SessionStatus.EXPIRED;
    this.endedAt = new Date();
  },

  /**
   * Record a user message
   */
  recordUserMessage(messageId: string): void {
    this.context.lastMessageId = messageId;
    this.metrics.userMessageCount += 1;
    this.context.recentMessages.push(messageId);
    if (this.context.recentMessages.length > 50) {
      this.context.recentMessages = this.context.recentMessages.slice(-50);
    }
    this.recordActivity();
  },

  /**
   * Record an agent response
   */
  recordAgentMessage(messageId: string, responseTimeMs: number): void {
    this.context.lastMessageId = messageId;
    this.metrics.agentMessageCount += 1;
    this.metrics.totalResponseTimeMs += responseTimeMs;
    this.metrics.averageResponseTimeMs =
      this.metrics.totalResponseTimeMs / this.metrics.agentMessageCount;
    this.context.recentMessages.push(messageId);
    if (this.context.recentMessages.length > 50) {
      this.context.recentMessages = this.context.recentMessages.slice(-50);
    }
  },

  /**
   * Set context variable
   */
  setVariable(key: string, value: unknown): void {
    this.context.variables[key] = value;
  },

  /**
   * Get context variable
   */
  getVariable<T>(key: string): T | undefined {
    return this.context.variables[key] as T | undefined;
  },

  /**
   * Record handoff to human agent
   */
  recordHandoff(): void {
    this.metrics.handoffsToAgent += 1;
  },

  /**
   * Update intent context
   */
  setIntent(intentId: string, agentId?: string): void {
    this.context.lastIntentId = intentId;
    if (agentId) {
      this.context.lastAgentId = agentId;
    }
  },

  /**
   * Extend session expiration
   */
  extend(ttlMs: number): void {
    this.expiresAt = new Date(Date.now() + ttlMs);
  },

  /**
   * Get session duration in milliseconds
   */
  getDurationMs(): number {
    const endTime = this.endedAt || new Date();
    return endTime.getTime() - this.createdAt.getTime();
  },

  /**
   * Get time since last activity in milliseconds
   */
  getIdleTimeMs(): number {
    return Date.now() - this.lastActivityAt.getTime();
  },

  /**
   * Convert to plain object for caching
   */
  toCacheObject(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      conversationId: this.conversationId,
      userId: this.userId,
      channel: this.channel,
      status: this.status,
      context: this.context,
      metrics: this.metrics,
      expiresAt: this.expiresAt.toISOString(),
      lastActivityAt: this.lastActivityAt.toISOString(),
    };
  },
};

// Static methods
SessionSchema.statics = {
  /**
   * Create a new session
   */
  async createSession(params: {
    conversationId: string;
    userId: string;
    channel: ChannelType;
    anonymousId?: string;
    externalUserId?: string;
    channelMetadata?: ISession['channelMetadata'];
    ttlMs?: number;
  }): Promise<ISession> {
    const { config } = await import('../config');
    const ttl = params.ttlMs || config.session.getTTLForChannel(params.channel);

    return this.create({
      sessionId: `sess_${crypto.randomUUID()}`,
      conversationId: params.conversationId,
      userId: params.userId,
      anonymousId: params.anonymousId,
      externalUserId: params.externalUserId,
      channel: params.channel,
      channelMetadata: params.channelMetadata || {},
      status: SessionStatus.ACTIVE,
      context: {
        lastMessageId: undefined,
        lastIntentId: undefined,
        lastAgentId: undefined,
        variables: {},
        recentMessages: [],
      },
      expiresAt: new Date(Date.now() + ttl),
      lastActivityAt: new Date(),
      metrics: {
        messageCount: 0,
        userMessageCount: 0,
        agentMessageCount: 0,
        averageResponseTimeMs: 0,
        totalResponseTimeMs: 0,
        handoffsToAgent: 0,
      },
    });
  },

  /**
   * Find active session for user on channel
   */
  async findActiveSession(
    userId: string,
    channel: ChannelType
  ): Promise<ISession | null> {
    return this.findOne({
      userId,
      channel,
      status: { $in: [SessionStatus.ACTIVE, SessionStatus.IDLE] },
      expiresAt: { $gt: new Date() },
    }).sort({ lastActivityAt: -1 });
  },

  /**
   * Get or create session
   */
  async getOrCreateSession(params: {
    conversationId: string;
    userId: string;
    channel: ChannelType;
    anonymousId?: string;
    externalUserId?: string;
    channelMetadata?: ISession['channelMetadata'];
  }): Promise<{ session: ISession; isNew: boolean }> {
    let session = await this.findActiveSession(params.userId, params.channel);

    if (!session) {
      session = await this.createSession(params);
      return { session, isNew: true };
    }

    return { session, isNew: false };
  },

  /**
   * Find expired sessions
   */
  async findExpiredSessions(): Promise<ISession[]> {
    return this.find({
      status: { $in: [SessionStatus.ACTIVE, SessionStatus.IDLE] },
      expiresAt: { $lte: new Date() },
    });
  },

  /**
   * Find idle sessions
   */
  async findIdleSessions(idleThresholdMs: number): Promise<ISession[]> {
    const idleThreshold = new Date(Date.now() - idleThresholdMs);
    return this.find({
      status: SessionStatus.ACTIVE,
      lastActivityAt: { $lt: idleThreshold },
    });
  },

  /**
   * Get session statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    idle: number;
    byChannel: Record<ChannelType, number>;
    averageMessagesPerSession: number;
  }> {
    const [statusStats, channelStats, messageStats] = await Promise.all([
      this.aggregate([
        { $match: { status: { $in: [SessionStatus.ACTIVE, SessionStatus.IDLE] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.aggregate([
        { $match: { status: { $in: [SessionStatus.ACTIVE, SessionStatus.IDLE] } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      this.aggregate([
        { $match: { status: SessionStatus.ENDED } },
        { $group: { _id: null, totalMessages: { $sum: '$metrics.messageCount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byChannel = Object.values(ChannelType).reduce(
      (acc, channel) => {
        acc[channel] = 0;
        return acc;
      },
      {} as Record<ChannelType, number>
    );

    let active = 0;
    let idle = 0;

    for (const stat of statusStats) {
      if (stat._id === SessionStatus.ACTIVE) active = stat.count;
      if (stat._id === SessionStatus.IDLE) idle = stat.count;
    }

    for (const stat of channelStats) {
      byChannel[stat._id as ChannelType] = stat.count;
    }

    const totalMessages = messageStats[0]?.totalMessages || 0;
    const totalEnded = messageStats[0]?.count || 0;

    return {
      total: active + idle,
      active,
      idle,
      byChannel,
      averageMessagesPerSession: totalEnded > 0 ? totalMessages / totalEnded : 0,
    };
  },
};

// Export model
export const Session = mongoose.model<ISession>('Session', SessionSchema);

// Export types
export type SessionDocument = ISession;
export type SessionModel = Model<ISession> & typeof Session;

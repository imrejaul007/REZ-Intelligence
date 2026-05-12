/**
 * Message Model
 * Represents individual messages within a conversation
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { ChannelType, MessageRole, MessageStatus, IntentData, AgentInfo } from '../types';

// Message document interface
export interface IMessage extends Document {
  _id: Types.ObjectId;
  messageId: string;
  conversationId: string;
  sessionId: string;

  // Content
  content: {
    text?: string;
    html?: string;
    markdown?: string;
    attachments?: IMessageAttachment[];
    quickReplies?: IQuickReply[];
    interactive?: IInteractivePayload;
  };

  // Sender information
  sender: {
    role: MessageRole;
    userId?: string;
    anonymousId?: string;
    name?: string;
    avatar?: string;
  };

  // Channel information
  channel: ChannelType;
  channelMessageId?: string;

  // Message metadata
  metadata: {
    intent?: IntentData;
    agent?: AgentInfo;
    processingTimeMs?: number;
    routingTimeMs?: number;
    totalProcessingTimeMs?: number;
    retryCount?: number;
    error?: string;
  };

  // Status tracking
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;

  // Threading
  parentMessageId?: string;
  threadId?: string;
  isThreadReply: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

// Attachment types
export interface IMessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  url: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  filename?: string;
  caption?: string;
  thumbnailUrl?: string;
}

// Quick reply button
export interface IQuickReply {
  id: string;
  text: string;
  payload?: string;
}

// Interactive message payload (buttons, lists, etc.)
export interface IInteractivePayload {
  type: 'button' | 'list' | 'product' | 'receipt' | 'location';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    url?: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons?: Array<{
      id: string;
      title: string;
      type: 'reply' | 'url' | 'copy';
      url?: string;
      copyCode?: string;
    }>;
    sections?: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

// Message schema
const MessageSchema = new Schema<IMessage>(
  {
    messageId: {
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
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      text: String,
      html: String,
      markdown: String,
      attachments: [
        {
          id: String,
          type: String,
          url: String,
          mimeType: String,
          size: Number,
          width: Number,
          height: Number,
          duration: Number,
          filename: String,
          caption: String,
          thumbnailUrl: String,
        },
      ],
      quickReplies: [
        {
          id: String,
          text: String,
          payload: String,
        },
      ],
      interactive: {
        type: String,
        header: {
          type: String,
          text: String,
          url: String,
        },
        body: {
          text: String,
        },
        footer: {
          text: String,
        },
        action: Schema.Types.Mixed,
      },
    },
    sender: {
      role: {
        type: String,
        enum: Object.values(MessageRole),
        required: true,
      },
      userId: String,
      anonymousId: String,
      name: String,
      avatar: String,
    },
    channel: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    channelMessageId: {
      type: String,
      index: true,
    },
    metadata: {
      intent: Schema.Types.Mixed,
      agent: Schema.Types.Mixed,
      processingTimeMs: Number,
      routingTimeMs: Number,
      totalProcessingTimeMs: Number,
      retryCount: Number,
      error: String,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.PENDING,
      index: true,
    },
    deliveredAt: Date,
    readAt: Date,
    parentMessageId: {
      type: String,
      index: true,
    },
    threadId: {
      type: String,
      index: true,
    },
    isThreadReply: {
      type: Boolean,
      default: false,
    },
    sentAt: Date,
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

// Compound indexes for common queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ sessionId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, threadId: 1, createdAt: 1 });
MessageSchema.index({ 'sender.userId': 1, createdAt: -1 });
MessageSchema.index({ 'metadata.intent.intentId': 1, createdAt: -1 });
MessageSchema.index({ channel: 1, status: 1, createdAt: -1 });

// Text search index
MessageSchema.index({ 'content.text': 'text' });

// Instance methods
MessageSchema.methods = {
  /**
   * Mark message as sent
   */
  markSent(): void {
    this.status = MessageStatus.SENT;
    this.sentAt = new Date();
  },

  /**
   * Mark message as delivered
   */
  markDelivered(): void {
    this.status = MessageStatus.DELIVERED;
    this.deliveredAt = new Date();
  },

  /**
   * Mark message as read
   */
  markRead(): void {
    this.status = MessageStatus.READ;
    this.readAt = new Date();
  },

  /**
   * Mark message as failed
   */
  markFailed(error: string): void {
    this.status = MessageStatus.FAILED;
    this.metadata.error = error;
    this.metadata.retryCount = (this.metadata.retryCount || 0) + 1;
  },

  /**
   * Update processing metrics
   */
  setProcessingMetrics(metrics: {
    processingTimeMs?: number;
    routingTimeMs?: number;
    totalProcessingTimeMs?: number;
  }): void {
    if (metrics.processingTimeMs !== undefined) {
      this.metadata.processingTimeMs = metrics.processingTimeMs;
    }
    if (metrics.routingTimeMs !== undefined) {
      this.metadata.routingTimeMs = metrics.routingTimeMs;
    }
    if (metrics.totalProcessingTimeMs !== undefined) {
      this.metadata.totalProcessingTimeMs = metrics.totalProcessingTimeMs;
    }
  },

  /**
   * Set intent data
   */
  setIntent(intent: IntentData): void {
    this.metadata.intent = intent;
  },

  /**
   * Set agent info
   */
  setAgent(agent: AgentInfo): void {
    this.metadata.agent = agent;
  },

  /**
   * Check if message is from user
   */
  isFromUser(): boolean {
    return this.sender.role === MessageRole.USER;
  },

  /**
   * Check if message is from agent
   */
  isFromAgent(): boolean {
    return this.sender.role === MessageRole.AGENT;
  },

  /**
   * Check if message is from system
   */
  isFromSystem(): boolean {
    return this.sender.role === MessageRole.SYSTEM;
  },

  /**
   * Get text content
   */
  getText(): string {
    return this.content.text || this.content.markdown || '';
  },

  /**
   * Has attachments
   */
  hasAttachments(): boolean {
    return Boolean(this.content.attachments && this.content.attachments.length > 0);
  },

  /**
   * Has quick replies
   */
  hasQuickReplies(): boolean {
    return Boolean(this.content.quickReplies && this.content.quickReplies.length > 0);
  },

  /**
   * Has interactive elements
   */
  hasInteractive(): boolean {
    return Boolean(this.content.interactive);
  },

  /**
   * Convert to channel-specific format
   */
  toChannelFormat(channel: ChannelType): Record<string, unknown> {
    const base = {
      messageId: this.messageId,
      text: this.content.text || this.content.markdown || '',
      attachments: this.content.attachments,
    };

    switch (channel) {
      case 'whatsapp':
        return {
          ...base,
          to: this.channelMessageId,
        };
      case 'voice':
        return {
          ...base,
          twiml: this.generateTwiml(),
        };
      case 'copilot':
        return {
          ...base,
          html: this.content.html,
        };
      case 'web':
        return {
          ...base,
          html: this.content.html,
          quickReplies: this.content.quickReplies,
          interactive: this.content.interactive,
        };
      default:
        return base;
    }
  },

  /**
   * Generate TwiML for voice channel
   */
  generateTwiml(): string {
    const response = this.content.text || 'I apologize, but I could not process your request.';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${this.escapeXml(response)}</Say>
</Response>`;
  },

  /**
   * Escape XML special characters
   */
  escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },
};

// Static methods
MessageSchema.statics = {
  /**
   * Create a message document
   */
  async createMessage(params: {
    conversationId: string;
    sessionId: string;
    sender: IMessage['sender'];
    channel: ChannelType;
    content: IMessage['content'];
    channelMessageId?: string;
    parentMessageId?: string;
    threadId?: string;
  }): Promise<IMessage> {
    return this.create({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      sender: params.sender,
      channel: params.channel,
      content: params.content,
      channelMessageId: params.channelMessageId,
      parentMessageId: params.parentMessageId,
      threadId: params.threadId || params.parentMessageId,
      isThreadReply: Boolean(params.parentMessageId),
      status: MessageStatus.PENDING,
    });
  },

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    options: {
      limit?: number;
      before?: Date;
      after?: Date;
      includeSystem?: boolean;
    } = {}
  ): Promise<IMessage[]> {
    const query: Record<string, unknown> = { conversationId };

    if (!options.includeSystem) {
      query['sender.role'] = { $ne: MessageRole.SYSTEM };
    }

    if (options.before) {
      query.createdAt = { ...query.createdAt, $lt: options.before };
    }
    if (options.after) {
      query.createdAt = { ...query.createdAt, $gt: options.after };
    }

    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  },

  /**
   * Get thread messages
   */
  async getThreadMessages(threadId: string): Promise<IMessage[]> {
    return this.find({ threadId }).sort({ createdAt: 1 });
  },

  /**
   * Get recent messages for context
   */
  async getRecentMessages(
    sessionId: string,
    limit: number = 10
  ): Promise<IMessage[]> {
    return this.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  /**
   * Find messages by intent
   */
  async findByIntent(
    intentId: string,
    options: { limit?: number; before?: Date } = {}
  ): Promise<IMessage[]> {
    const query: Record<string, unknown> = {
      'metadata.intent.intentId': intentId,
    };

    if (options.before) {
      query.createdAt = { $lt: options.before };
    }

    return this.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  },

  /**
   * Get message statistics
   */
  async getStatistics(channel?: ChannelType): Promise<{
    total: number;
    byStatus: Record<MessageStatus, number>;
    byRole: Record<MessageRole, number>;
    averageProcessingTimeMs: number;
  }> {
    const matchStage: Record<string, unknown> = {};
    if (channel) {
      matchStage.channel = channel;
    }

    const [statusStats, roleStats, timeStats] = await Promise.all([
      this.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.aggregate([
        { $match: matchStage },
        { $group: { _id: '$sender.role', count: { $sum: 1 } } },
      ]),
      this.aggregate([
        { $match: { ...matchStage, 'metadata.totalProcessingTimeMs': { $exists: true } } },
        { $group: { _id: null, avgTime: { $avg: '$metadata.totalProcessingTimeMs' } } },
      ]),
    ]);

    const byStatus = Object.values(MessageStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<MessageStatus, number>
    );

    const byRole = Object.values(MessageRole).reduce(
      (acc, role) => {
        acc[role] = 0;
        return acc;
      },
      {} as Record<MessageRole, number>
    );

    for (const stat of statusStats) {
      byStatus[stat._id as MessageStatus] = stat.count;
    }

    for (const stat of roleStats) {
      byRole[stat._id as MessageRole] = stat.count;
    }

    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      byRole,
      averageProcessingTimeMs: timeStats[0]?.avgTime || 0,
    };
  },
};

// Pre-save hook for thread ID
MessageSchema.pre('save', function (next) {
  if (this.parentMessageId && !this.threadId) {
    this.threadId = this.parentMessageId;
    this.isThreadReply = true;
  }
  next();
});

// Export model
export const Message = mongoose.model<IMessage>('Message', MessageSchema);

// Export types
export type MessageDocument = IMessage;
export type MessageModel = Model<IMessage> & typeof Message;

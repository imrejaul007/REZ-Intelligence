import mongoose, { Schema, Document, Model } from 'mongoose';
import { Intent, Message } from '../utils/validators.js';

export interface IMessage {
  id: string;
  senderId: string;
  senderType: 'user' | 'agent' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  intent?: Intent;
  sentiment?: {
    score: number;
    comparative: number;
    confidence: number;
    label: 'positive' | 'neutral' | 'negative';
  };
}

export interface IConversationSample extends Document {
  conversationId: string;
  sessionId: string;
  channel: 'web' | 'mobile' | 'api' | 'phone' | 'email' | 'chat';
  participants: Array<{
    id: string;
    type: 'user' | 'agent' | 'bot';
    role?: string;
  }>;
  messages: IMessage[];
  context: {
    userId?: string;
    appId?: string;
    sessionType?: 'support' | 'sales' | 'onboarding' | 'general';
    metadata?: Record<string, unknown>;
  };
  extractedIntents: Intent[];
  aggregatedSentiment: {
    score: number;
    comparative: number;
    confidence: number;
    label: 'positive' | 'neutral' | 'negative';
    messageCount: number;
  };
  outcome?: {
    type: string;
    success: boolean;
    resolutionTime?: number;
    satisfaction?: number;
    notes?: string;
  };
  status: 'active' | 'closed' | 'archived';
  metadata: Record<string, unknown>;
  processedAt?: Date;
  isLabeled: boolean;
  labelQuality?: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  id: { type: String, required: true },
  senderId: { type: String, required: true, index: true },
  senderType: {
    type: String,
    enum: ['user', 'agent', 'bot', 'system'],
    required: true
  },
  content: { type: String, required: true },
  timestamp: { type: Date, required: true, index: true },
  metadata: { type: Schema.Types.Mixed },
  intent: {
    name: String,
    confidence: Number,
    alternatives: [{
      name: String,
      confidence: Number
    }]
  },
  sentiment: {
    score: Number,
    comparative: Number,
    confidence: Number,
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    }
  }
}, { _id: false });

const ConversationSampleSchema = new Schema<IConversationSample>({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['web', 'mobile', 'api', 'phone', 'email', 'chat'],
    required: true,
    index: true
  },
  participants: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['user', 'agent', 'bot'],
      required: true
    },
    role: String
  }],
  messages: [MessageSchema],
  context: {
    userId: { type: String, index: true },
    appId: { type: String, index: true },
    sessionType: {
      type: String,
      enum: ['support', 'sales', 'onboarding', 'general']
    },
    metadata: Schema.Types.Mixed
  },
  extractedIntents: [{
    name: { type: String, required: true },
    confidence: { type: Number, required: true },
    alternatives: [{
      name: String,
      confidence: Number
    }]
  }],
  aggregatedSentiment: {
    score: { type: Number, default: 0 },
    comparative: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    },
    messageCount: { type: Number, default: 0 }
  },
  outcome: {
    type: { type: String },
    success: { type: Boolean },
    resolutionTime: Number,
    satisfaction: Number,
    notes: String
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active',
    index: true
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
  processedAt: { type: Date },
  isLabeled: { type: Boolean, default: false },
  labelQuality: {
    type: String,
    enum: ['high', 'medium', 'low']
  }
}, {
  timestamps: true
});

// Compound indexes for analytics queries
ConversationSampleSchema.index({ 'aggregatedSentiment.label': 1, createdAt: 1 });
ConversationSampleSchema.index({ 'extractedIntents.name': 1, createdAt: 1 });
ConversationSampleSchema.index({ 'outcome.success': 1, createdAt: 1 });
ConversationSampleSchema.index({ isLabeled: 1, labelQuality: 1 });
ConversationSampleSchema.index({ channel: 1, createdAt: 1 });
ConversationSampleSchema.index({ 'context.appId': 1, createdAt: 1 });

// Text index for content search
ConversationSampleSchema.index({ 'messages.content': 'text' });

// TTL index for automatic cleanup (optional, keeps data for 90 days)
ConversationSampleSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export interface ConversationSampleModel extends Model<IConversationSample> {
  findBySession(sessionId: string): Promise<IConversationSample[]>;
  findByChannel(channel: string, startDate?: Date, endDate?: Date): Promise<IConversationSample[]>;
  findUnprocessed(): Promise<IConversationSample[]>;
  getIntentDistribution(startDate?: Date, endDate?: Date): Promise<Array<{ intent: string; count: number }>>;
  getSentimentTrend(interval: string, startDate?: Date, endDate?: Date): Promise<Array<{ date: Date; avgScore: number; count: number }>>;
}

ConversationSampleSchema.statics.findBySession = function(sessionId: string) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

ConversationSampleSchema.statics.findByChannel = function(
  channel: string,
  startDate?: Date,
  endDate?: Date
) {
  const query: Record<string, unknown> = { channel };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt!.$gte = startDate;
    if (endDate) query.createdAt!.$lte = endDate;
  }
  return this.find(query).sort({ createdAt: -1 });
};

ConversationSampleSchema.statics.findUnprocessed = function() {
  return this.find({
    $or: [
      { processedAt: { $exists: false } },
      { processedAt: null }
    ],
    status: { $ne: 'archived' }
  }).limit(100);
};

ConversationSampleSchema.statics.getIntentDistribution = async function(
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: Record<string, unknown> = { isLabeled: true };
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt!.$gte = startDate;
    if (endDate) matchStage.createdAt!.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$extractedIntents' },
    {
      $group: {
        _id: '$extractedIntents.name',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$extractedIntents.confidence' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 50 }
  ]);
};

ConversationSampleSchema.statics.getSentimentTrend = async function(
  interval: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: Record<string, unknown> = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  let dateFormat: string;
  switch (interval) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00';
      break;
    case 'week':
      dateFormat = '%Y-W%V';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  return this.aggregate([
    { $match: Object.keys(matchStage).length > 0 ? matchStage : {} },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        avgScore: { $avg: '$aggregatedSentiment.score' },
        avgComparative: { $avg: '$aggregatedSentiment.comparative' },
        count: { $sum: 1 },
        positiveCount: {
          $sum: { $cond: [{ $eq: ['$aggregatedSentiment.label', 'positive'] }, 1, 0] }
        },
        negativeCount: {
          $sum: { $cond: [{ $eq: ['$aggregatedSentiment.label', 'negative'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

export const ConversationSample = mongoose.model<IConversationSample, ConversationSampleModel>(
  'ConversationSample',
  ConversationSampleSchema
);

export default ConversationSample;

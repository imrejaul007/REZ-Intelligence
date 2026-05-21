import mongoose, { Schema, Document } from 'mongoose';
import { SessionState, IntentDetection, ConversationTurn } from '../types/whatsapp';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: string;
  sessionId: string;
  userId: string;
  merchantId?: string;
  turns: ConversationTurn[];
  currentState: SessionState;
  lastIntent?: string;
  startedAt: Date;
  endedAt?: Date;
  metadata: Record<string, unknown>;
  addTurn(userMessage: string, assistantResponse: string, intent?: any, action?: string): void;
}

const IntentDetectionSchema = new Schema<IntentDetection>(
  {
    intent: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    entities: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    suggestedActions: { type: [String], default: [] },
  },
  { _id: false }
);

const ConversationTurnSchema = new Schema<ConversationTurn>(
  {
    userMessage: { type: String, required: true },
    assistantResponse: { type: String, required: true },
    intent: { type: IntentDetectionSchema },
    action: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    merchantId: {
      type: String,
      index: true,
    },
    turns: {
      type: [ConversationTurnSchema],
      default: [],
    },
    currentState: {
      type: String,
      enum: Object.values(SessionState),
      default: SessionState.IDLE,
    },
    lastIntent: String,
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: Date,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Indexes
ConversationSchema.index({ userId: 1, startedAt: -1 });
ConversationSchema.index({ merchantId: 1, startedAt: -1 });
ConversationSchema.index({ sessionId: 1, startedAt: -1 });
ConversationSchema.index({ currentState: 1, lastIntent: 1 });

// Instance methods
ConversationSchema.methods.addTurn = function (
  userMessage: string,
  assistantResponse: string,
  intent?: IntentDetection,
  action?: string
): void {
  this.turns.push({
    userMessage,
    assistantResponse,
    intent,
    action,
    timestamp: new Date(),
  });

  if (intent) {
    this.lastIntent = intent.intent;
  }
};

ConversationSchema.methods.endConversation = function (): void {
  this.endedAt = new Date();
};

ConversationSchema.methods.getTurnCount = function (): number {
  return this.turns.length;
};

ConversationSchema.methods.getRecentTurns = function (
  count: number = 5
): ConversationTurn[] {
  return this.turns.slice(-count);
};

ConversationSchema.methods.getContext = function (): {
  recentMessages: string[];
  intents: string[];
  state: SessionState;
} {
  return {
    recentMessages: this.turns.slice(-10).map((t) => t.userMessage),
    intents: this.turns
      .filter((t) => t.intent)
      .map((t) => t.intent!.intent),
    state: this.currentState,
  };
};

// Static methods
ConversationSchema.statics.findActiveBySession = function (
  sessionId: string
): Promise<IConversation | null> {
  return this.findOne({
    sessionId,
    endedAt: { $exists: false },
  });
};

ConversationSchema.statics.findByUser = function (
  userId: string,
  options?: {
    limit?: number;
    skip?: number;
    merchantId?: string;
  }
): Promise<IConversation[]> {
  const query: Record<string, unknown> = { userId };
  if (options?.merchantId) {
    query.merchantId = options.merchantId;
  }

  return this.find(query)
    .sort({ startedAt: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 20);
};

ConversationSchema.statics.getConversationStats = async function (
  merchantId?: string
): Promise<{
  total: number;
  active: number;
  completed: number;
  avgTurns: number;
}> {
  const matchStage: Record<string, unknown> = {};
  if (merchantId) {
    matchStage.merchantId = merchantId;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$endedAt', null] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $ne: ['$endedAt', null] }, 1, 0] },
        },
        avgTurns: { $avg: { $size: '$turns' } },
      },
    },
  ]);

  if (stats.length === 0) {
    return { total: 0, active: 0, completed: 0, avgTurns: 0 };
  }

  return {
    total: stats[0].total,
    active: stats[0].active,
    completed: stats[0].completed,
    avgTurns: Math.round(stats[0].avgTurns || 0),
  };
};

export const Conversation = mongoose.model<IConversation>(
  'Conversation',
  ConversationSchema
);
export default Conversation;

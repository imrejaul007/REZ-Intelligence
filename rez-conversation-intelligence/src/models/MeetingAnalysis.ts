/**
 * REZ Conversation Intelligence - Meeting Analysis Model
 *
 * Stores complete meeting analysis results
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// Types
// ============================================================================

export type MeetingType = 'sales_call' | 'discovery_call' | 'demo' | 'negotiation' | 'check_in' | 'standup' | 'brainstorm' | 'other';

export interface ITopicAnalysis {
  name: string;
  category: string;
  confidence: number;
  keywords: string[];
  duration?: number;
}

export interface IEntity {
  text: string;
  type: 'person' | 'company' | 'product' | 'location' | 'date' | 'money' | 'organization' | 'custom';
  confidence: number;
  metadata?: Record<string, any>;
}

export interface IParticipant {
  name: string;
  email?: string;
  role?: string;
  speakingTime?: number;
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface IMeetingAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;

  // Meeting metadata
  meetingId: string;
  title?: string;
  type: MeetingType;
  duration?: number;

  // Participants
  participants: IParticipant[];

  // Analysis results
  summary: {
    overview: string;
    keyPoints: string[];
    decisions: string[];
    questions: string[];
  };

  // Sentiment
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral';
    score: number; // -100 to 100
    timeline: Array<{
      timestamp: number;
      sentiment: 'positive' | 'negative' | 'neutral';
      score: number;
    }>;
  };

  // Topics
  topics: ITopicAnalysis[];

  // Entities
  entities: IEntity[];

  // Action items (IDs)
  actionItemIds: mongoose.Types.ObjectId[];

  // Engagement metrics
  engagement: {
    avgSentiment: number;
    sentimentVariance: number;
    topicDiversity: number;
    decisionVelocity: number;
  };

  // Outcome
  outcome?: {
    won: boolean;
    probability?: number;
    reason?: string;
  };

  // Raw data reference
  transcriptId?: string;
  recordingUrl?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const TopicAnalysisSchema = new Schema<ITopicAnalysis>({
  name: { type: String, required: true },
  category: { type: String, required: true },
  confidence: { type: Number, required: true },
  keywords: [String],
  duration: Number,
}, { _id: false });

const EntitySchema = new Schema<IEntity>({
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ['person', 'company', 'product', 'location', 'date', 'money', 'organization', 'custom'],
    required: true,
  },
  confidence: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const ParticipantSchema = new Schema<IParticipant>({
  name: { type: String, required: true },
  email: String,
  role: String,
  speakingTime: Number,
  sentiment: {
    positive: Number,
    negative: Number,
    neutral: Number,
  },
}, { _id: false });

const SentimentTimelineSchema = new Schema({
  timestamp: { type: Number, required: true },
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral'] },
  score: { type: Number, required: true },
}, { _id: false });

const MeetingAnalysisSchema = new Schema<IMeetingAnalysis>({
  tenantId: { type: String, required: true, index: true },

  meetingId: { type: String, required: true, unique: true, index: true },
  title: String,
  type: {
    type: String,
    enum: ['sales_call', 'discovery_call', 'demo', 'negotiation', 'check_in', 'standup', 'brainstorm', 'other'],
    default: 'other',
  },
  duration: Number,

  participants: [ParticipantSchema],

  summary: {
    overview: String,
    keyPoints: [String],
    decisions: [String],
    questions: [String],
  },

  sentiment: {
    overall: { type: String, enum: ['positive', 'negative', 'neutral'] },
    score: Number,
    timeline: [SentimentTimelineSchema],
  },

  topics: [TopicAnalysisSchema],

  entities: [EntitySchema],

  actionItemIds: [{ type: Schema.Types.ObjectId, ref: 'ActionItem' }],

  engagement: {
    avgSentiment: Number,
    sentimentVariance: Number,
    topicDiversity: Number,
    decisionVelocity: Number,
  },

  outcome: {
    won: Boolean,
    probability: Number,
    reason: String,
  },

  transcriptId: String,
  recordingUrl: String,
}, {
  timestamps: true,
});

// Indexes
MeetingAnalysisSchema.index({ tenantId: 1, type: 1 });
MeetingAnalysisSchema.index({ tenantId: 1, 'sentiment.overall': 1 });
MeetingAnalysisSchema.index({ tenantId: 1, createdAt: -1 });
MeetingAnalysisSchema.index({ participants: 1 });

// ============================================================================
// Model
// ============================================================================

export const MeetingAnalysisModel: Model<IMeetingAnalysis> = mongoose.model<IMeetingAnalysis>(
  'MeetingAnalysis',
  MeetingAnalysisSchema
);
export default MeetingAnalysisModel;

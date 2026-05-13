import mongoose, { Schema, Document, Model } from 'mongoose';
import { IConfidenceScore } from '../types';

/**
 * Mongoose schema for storing confidence score history
 */
const ConfidenceScoreSchema = new Schema<IConfidenceScore & Document>(
  {
    agentId: {
      type: String,
      required: true,
      index: true,
    },
    intent: {
      type: String,
      required: true,
      index: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    components: {
      intentMatch: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      contextRelevance: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      historyAccuracy: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      loadFactor: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
    },
    context: {
      domain: String,
      urgency: String,
      userId: String,
      sessionId: String,
      metadata: {
        type: Map,
        of: Schema.Types.Mixed,
        default: {},
      },
    },
    taskComplexity: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
    requiredCapabilities: [
      {
        type: String,
      },
    ],
    metadata: {
      processingTimeMs: {
        type: Number,
        required: true,
      },
      cacheHit: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    collection: 'confidence_scores',
  }
);

// Compound indexes for efficient queries
ConfidenceScoreSchema.index({ agentId: 1, intent: 1 });
ConfidenceScoreSchema.index({ agentId: 1, createdAt: -1 });
ConfidenceScoreSchema.index({ intent: 1, createdAt: -1 });
ConfidenceScoreSchema.index({ overallScore: -1, createdAt: -1 });

// TTL index for automatic cleanup of old records
ConfidenceScoreSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days retention
);

/**
 * Get recent scores for an agent
 */
ConfidenceScoreSchema.statics.getRecentScores = async function (
  agentId: string,
  limit: number = 100
): Promise<IConfidenceScore[]> {
  return this.find({ agentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
};

/**
 * Get scores for a specific intent
 */
ConfidenceScoreSchema.statics.getScoresByIntent = async function (
  intent: string,
  startDate: Date,
  endDate: Date
): Promise<IConfidenceScore[]> {
  return this.find({
    intent,
    createdAt: { $gte: startDate, $lte: endDate },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

/**
 * Calculate average score for an agent
 */
ConfidenceScoreSchema.statics.getAgentAverageScore = async function (
  agentId: string,
  hours: number = 24
): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const result = await this.aggregate([
    {
      $match: {
        agentId,
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$agentId',
        averageScore: { $avg: '$overallScore' },
      },
    },
  ]).exec();

  return result.length > 0 ? result[0].averageScore : 0;
};

/**
 * Get top performing agents for an intent
 */
ConfidenceScoreSchema.statics.getTopAgentsForIntent = async function (
  intent: string,
  limit: number = 10
): Promise<Array<{ agentId: string; averageScore: number }>> {
  return this.aggregate([
    {
      $match: { intent },
    },
    {
      $group: {
        _id: '$agentId',
        averageScore: { $avg: '$overallScore' },
        totalScores: { $sum: 1 },
      },
    },
    {
      $sort: { averageScore: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        agentId: '$_id',
        averageScore: 1,
        _id: 0,
      },
    },
  ]).exec();
};

/**
 * ConfidenceScore model interface
 */
export interface ConfidenceScoreDocument extends IConfidenceScore, Document {
  _id: mongoose.Types.ObjectId;
}

export interface ConfidenceScoreModel extends Model<ConfidenceScoreDocument> {
  getRecentScores(agentId: string, limit?: number): Promise<IConfidenceScore[]>;
  getScoresByIntent(
    intent: string,
    startDate: Date,
    endDate: Date
  ): Promise<IConfidenceScore[]>;
  getAgentAverageScore(agentId: string, hours?: number): Promise<number>;
  getTopAgentsForIntent(
    intent: string,
    limit?: number
  ): Promise<Array<{ agentId: string; averageScore: number }>>;
}

// Compile model or use existing one (for hot reloading)
export const ConfidenceScore: ConfidenceScoreModel =
  mongoose.models.ConfidenceScore ||
  mongoose.model<ConfidenceScoreDocument, ConfidenceScoreModel>(
    'ConfidenceScore',
    ConfidenceScoreSchema
  );

export default ConfidenceScore;

import mongoose, { Schema, Model } from 'mongoose';

/**
 * Interface for ConfidenceScore lean documents
 */
export interface IConfidenceScoreLean {
  agentId: string;
  intent: string;
  overallScore: number;
  components: {
    intentMatch: number;
    contextRelevance: number;
    historyAccuracy: number;
    loadFactor: number;
  };
  createdAt: Date;
}

/**
 * Interface for ConfidenceScore static methods
 */
interface IConfidenceScoreModel extends Model<IConfidenceScoreLean> {
  getRecentScores(agentId: string, limit?: number): Promise<IConfidenceScoreLean[]>;
  getScoresByIntent(intent: string, startDate: Date, endDate: Date): Promise<IConfidenceScoreLean[]>;
  getAgentAverageScore(agentId: string, hours?: number): Promise<number>;
  getTopAgentsForIntent(intent: string, limit?: number): Promise<Array<{ agentId: string; averageScore: number }>>;
}

/**
 * Mongoose schema for storing confidence score history
 */
const ConfidenceScoreSchema = new Schema(
  {
    agentId: { type: String, required: true, index: true },
    intent: { type: String, required: true, index: true },
    overallScore: { type: Number, required: true, min: 0, max: 1 },
    components: {
      intentMatch: { type: Number, required: true, min: 0, max: 1 },
      contextRelevance: { type: Number, required: true, min: 0, max: 1 },
      historyAccuracy: { type: Number, required: true, min: 0, max: 1 },
      loadFactor: { type: Number, required: true, min: 0, max: 1 },
    },
    context: {
      domain: String,
      userTier: Number,
      timeOfDay: String,
      previousInteractions: Number,
    },
    metadata: {
      modelVersion: String,
      features: [String],
    },
  },
  { timestamps: true }
);

// Indexes for common queries
ConfidenceScoreSchema.index({ agentId: 1, intent: 1 });
ConfidenceScoreSchema.index({ createdAt: -1 });

// Static methods
ConfidenceScoreSchema.statics.getRecentScores = async function (agentId: string, limit = 10) {
  return this.find({ agentId }).sort({ createdAt: -1 }).limit(limit).lean();
};

ConfidenceScoreSchema.statics.getScoresByIntent = async function (intent: string, startDate: Date, endDate: Date) {
  return this.find({ intent, createdAt: { $gte: startDate, $lte: endDate } })
    .sort({ createdAt: -1 })
    .lean();
};

ConfidenceScoreSchema.statics.getAgentAverageScore = async function (agentId: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const result = await this.aggregate([
    { $match: { agentId, createdAt: { $gte: since } } },
    { $group: { _id: '$agentId', avgScore: { $avg: '$overallScore' } } },
  ]).exec();
  return result.length > 0 ? result[0].avgScore : 0;
};

ConfidenceScoreSchema.statics.getTopAgentsForIntent = async function (intent: string, limit = 5) {
  return this.aggregate([
    { $match: { intent } },
    { $group: { _id: '$agentId', averageScore: { $avg: '$overallScore' } } },
    { $sort: { averageScore: -1 } },
    { $limit: limit },
    { $project: { _id: 0, agentId: '$_id', averageScore: 1 } },
  ]).exec();
};

// Export the model with proper typing
export const ConfidenceScore = (mongoose.models.ConfidenceScore as IConfidenceScoreModel) ||
  mongoose.model<IConfidenceScoreLean, IConfidenceScoreModel>('ConfidenceScore', ConfidenceScoreSchema);
export default ConfidenceScore;

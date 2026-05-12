import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITrainingBatch extends Document {
  batchId: string;
  versionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'jsonl' | 'csv';
  filters: {
    channels?: string[];
    intents?: string[];
    sentiment?: string[];
    minConfidence?: number;
    hasOutcome?: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  sampleCount: number;
  filePath?: string;
  fileSize?: number;
  checksum?: string;
  statistics: {
    totalConversations: number;
    totalMessages: number;
    intentDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
    channelDistribution: Record<string, number>;
    outcomeDistribution: Record<string, number>;
  };
  error?: {
    message: string;
    stack?: string;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingBatchSchema = new Schema<ITrainingBatch>({
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  versionId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  format: {
    type: String,
    enum: ['json', 'jsonl', 'csv'],
    default: 'jsonl'
  },
  filters: {
    channels: [String],
    intents: [String],
    sentiment: [String],
    minConfidence: Number,
    hasOutcome: Boolean,
    startDate: Date,
    endDate: Date
  },
  sampleCount: {
    type: Number,
    default: 0
  },
  filePath: String,
  fileSize: Number,
  checksum: String,
  statistics: {
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    intentDistribution: { type: Schema.Types.Mixed, default: {} },
    sentimentDistribution: { type: Schema.Types.Mixed, default: {} },
    channelDistribution: { type: Schema.Types.Mixed, default: {} },
    outcomeDistribution: { type: Schema.Types.Mixed, default: {} }
  },
  error: {
    message: String,
    stack: String
  },
  completedAt: Date
}, {
  timestamps: true
});

// Indexes
TrainingBatchSchema.index({ status: 1, createdAt: 1 });
TrainingBatchSchema.index({ versionId: 1, status: 1 });

export interface TrainingBatchModel extends Model<ITrainingBatch> {
  findByVersion(versionId: string): Promise<ITrainingBatch[]>;
  findCompleted(): Promise<ITrainingBatch[]>;
  getRecentBatches(limit?: number): Promise<ITrainingBatch[]>;
}

TrainingBatchSchema.statics.findByVersion = function(versionId: string) {
  return this.find({ versionId }).sort({ createdAt: -1 });
};

TrainingBatchSchema.statics.findCompleted = function() {
  return this.find({ status: 'completed' }).sort({ createdAt: -1 });
};

TrainingBatchSchema.statics.getRecentBatches = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const TrainingBatch = mongoose.model<ITrainingBatch, TrainingBatchModel>(
  'TrainingBatch',
  TrainingBatchSchema
);

export default TrainingBatch;

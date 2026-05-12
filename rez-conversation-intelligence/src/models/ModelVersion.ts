import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IModelVersion extends Document {
  versionId: string;
  versionNumber: string;
  description: string;
  trainingData: {
    startDate: Date;
    endDate: Date;
    sampleCount: number;
    conversationCount: number;
    uniqueIntents: number;
    uniqueEntities: number;
  };
  performance: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    confusionMatrix?: Record<string, Record<string, number>>;
  };
  validation: {
    splitRatio: number;
    testAccuracy?: number;
    crossValidationScore?: number;
  };
  status: 'draft' | 'training' | 'validated' | 'published' | 'archived';
  previousVersionId?: string;
  metadata: Record<string, unknown>;
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ModelVersionSchema = new Schema<IModelVersion>({
  versionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  versionNumber: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  trainingData: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    sampleCount: { type: Number, default: 0 },
    conversationCount: { type: Number, default: 0 },
    uniqueIntents: { type: Number, default: 0 },
    uniqueEntities: { type: Number, default: 0 }
  },
  performance: {
    accuracy: Number,
    precision: Number,
    recall: Number,
    f1Score: Number,
    confusionMatrix: { type: Schema.Types.Mixed }
  },
  validation: {
    splitRatio: { type: Number, default: 0.2 },
    testAccuracy: Number,
    crossValidationScore: Number
  },
  status: {
    type: String,
    enum: ['draft', 'training', 'validated', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  previousVersionId: {
    type: String,
    index: true
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
  publishedAt: Date,
  archivedAt: Date
}, {
  timestamps: true
});

// Indexes
ModelVersionSchema.index({ status: 1, createdAt: -1 });
ModelVersionSchema.index({ versionNumber: 1 }, { unique: true });

export interface ModelVersionModel extends Model<IModelVersion> {
  findLatest(): Promise<IModelVersion | null>;
  findPublished(): Promise<IModelVersion[]>;
  findByStatus(status: string): Promise<IModelVersion[]>;
  getVersionHistory(limit?: number): Promise<IModelVersion[]>;
  incrementVersion(): Promise<string>;
}

ModelVersionSchema.statics.findLatest = function() {
  return this.findOne({ status: 'published' })
    .sort({ publishedAt: -1 });
};

ModelVersionSchema.statics.findPublished = function() {
  return this.find({ status: 'published' })
    .sort({ publishedAt: -1 });
};

ModelVersionSchema.statics.findByStatus = function(status: string) {
  return this.find({ status })
    .sort({ createdAt: -1 });
};

ModelVersionSchema.statics.getVersionHistory = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit);
};

ModelVersionSchema.statics.incrementVersion = async function(): Promise<string> {
  const config = await import('../config/index.js');
  const prefix = config.config.MODEL_VERSION_PREFIX || 'v';

  const latest = await this.findOne()
    .sort({ createdAt: -1 });

  let nextNumber = 1;
  if (latest) {
    const match = latest.versionNumber.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber}`;
};

export const ModelVersion = mongoose.model<IModelVersion, ModelVersionModel>(
  'ModelVersion',
  ModelVersionSchema
);

export default ModelVersion;

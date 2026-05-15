import mongoose, { Schema, Document } from 'mongoose';
import { PredictionType, AnyPrediction, PredictionStatus } from '../types';

export interface IPredictionCache extends Document {
  userId: string;
  type: PredictionType;
  prediction: AnyPrediction;
  status: PredictionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PredictionCacheSchema = new Schema<IPredictionCache>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['churn', 'ltv', 'revisit', 'conversion'],
      index: true
    },
    prediction: {
      type: Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed'
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'prediction_cache'
  }
);

// Compound unique index to ensure only one prediction per user per type
PredictionCacheSchema.index({ userId: 1, type: 1 }, { unique: true });

// TTL index for automatic expiration
PredictionCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for querying at-risk users
PredictionCacheSchema.index({ type: 1, 'prediction.result.risk': 1 });
PredictionCacheSchema.index({ type: 1, 'prediction.result.tier': 1 });

export const PredictionCache = mongoose.model<IPredictionCache>('PredictionCache', PredictionCacheSchema);

// Batch prediction job tracking
export interface IBatchPredictionJob extends Document {
  jobId: string;
  userIds: string[];
  types: PredictionType[];
  status: PredictionStatus;
  totalRequested: number;
  completed: number;
  failed: number;
  results: AnyPrediction[];
  jobErrors: Array<{ userId: string; error: string }>;
  estimatedCompletionTime?: Date;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BatchPredictionJobSchema = new Schema<IBatchPredictionJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userIds: {
      type: [String],
      required: true
    },
    types: {
      type: [String],
      enum: ['churn', 'ltv', 'revisit', 'conversion'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    totalRequested: {
      type: Number,
      required: true
    },
    completed: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    results: {
      type: Schema.Types.Mixed,
      default: []
    },
    jobErrors: {
      type: [
        {
          userId: String,
          error: String
        }
      ],
      default: []
    },
    estimatedCompletionTime: Date,
    startedAt: Date,
    completedAt: Date
  },
  {
    timestamps: true,
    collection: 'batch_prediction_jobs'
  }
);

// Index for querying active jobs
BatchPredictionJobSchema.index({ status: 1, createdAt: -1 });

export const BatchPredictionJob = mongoose.model<IBatchPredictionJob>(
  'BatchPredictionJob',
  BatchPredictionJobSchema
);

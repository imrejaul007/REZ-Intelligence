import mongoose, { Schema, Model } from 'mongoose';
import {
  IExperiment,
  IAssignment,
  Variant,
  Target,
  Audience,
  ExperimentStats,
} from '../types/index.js';

// ============================================================================
// Experiment Schema
// ============================================================================

const VariantSchema = new Schema<Variant>(
  {
    variantId: { type: String, required: true },
    name: { type: String, required: true },
    weight: { type: Number, default: 50 },
    config: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const TargetSchema = new Schema<Target>(
  {
    metric: { type: String, required: true },
    goal: { type: String },
    minimumDetectableEffect: { type: Number },
  },
  { _id: false }
);

const AudienceSchema = new Schema<Audience>(
  {
    userSegments: [{ type: String }],
    apps: [{ type: String }],
    percentage: { type: Number, default: 100 },
  },
  { _id: false }
);

const ExperimentStatsSchema = new Schema<ExperimentStats>(
  {
    startDate: { type: Date },
    endDate: { type: Date },
    sampleSize: { type: Number },
    confidence: { type: Number, default: 0.95 },
  },
  { _id: false }
);

const VariantResultSchema = new Schema(
  {
    variantId: { type: String },
    name: { type: String },
    users: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    uplift: { type: Number },
    pValue: { type: Number },
    significant: { type: Boolean },
  },
  { _id: false }
);

const experimentSchema = new Schema<IExperiment>(
  {
    experimentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['draft', 'running', 'paused', 'completed'],
      default: 'draft',
    },
    hypothesis: { type: String },
    variants: [VariantSchema],
    target: TargetSchema,
    audience: AudienceSchema,
    stats: { type: ExperimentStatsSchema, default: () => ({ confidence: 0.95 }) },
    results: {
      control: {
        users: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        rate: { type: Number, default: 0 },
      },
      variants: [VariantResultSchema],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Experiment: Model<IExperiment> = mongoose.model<IExperiment>(
  'Experiment',
  experimentSchema
);

// ============================================================================
// Assignment Schema
// ============================================================================

const assignmentSchema = new Schema<IAssignment>(
  {
    assignmentId: { type: String, required: true, unique: true },
    experimentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    variantId: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
    converted: { type: Boolean, default: false },
    convertedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for user-experiment uniqueness
assignmentSchema.index({ experimentId: 1, userId: 1 }, { unique: true });

export const Assignment: Model<IAssignment> = mongoose.model<IAssignment>(
  'Assignment',
  assignmentSchema
);

// ============================================================================
// Export all models
// ============================================================================

export const models = {
  Experiment,
  Assignment,
};

export default models;

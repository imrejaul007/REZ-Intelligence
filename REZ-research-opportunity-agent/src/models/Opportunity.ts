import mongoose, { Schema, Model, Document } from 'mongoose';
import {
  OpportunityType,
  OpportunityStatus,
  ExpectedImpact,
  Channel,
  Recommendation,
} from '../types/index.js';

// Recommendation subdocument schema
const RecommendationSchema = new Schema<Recommendation>(
  {
    action: { type: String, required: true },
    channel: {
      type: String,
      enum: Object.values(Channel),
      required: true,
    },
    targetSegment: { type: String, required: true },
    timing: { type: String, required: true },
    estimatedReach: { type: Number, required: true, min: 0 },
    estimatedConversion: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

// Opportunity document interface
export interface IOpportunityDocument extends Document {
  _id: mongoose.Types.ObjectId;
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  expectedImpact: ExpectedImpact;
  confidence: number;
  data: Record<string, unknown>;
  recommendations: Recommendation[];
  status: OpportunityStatus;
  createdAt: Date;
  updatedAt: Date;
  executedAt?: Date;
  archivedAt?: Date;
  approve(): void;
  execute(): void;
  archive(): void;
}

// Static methods interface
export interface IOpportunityModel extends Model<IOpportunityDocument> {
  findByStatus(status: OpportunityStatus): mongoose.Query<IOpportunityDocument[], IOpportunityDocument>;
  findByType(type: OpportunityType): mongoose.Query<IOpportunityDocument[], IOpportunityDocument>;
  findActiveOpportunities(): mongoose.Query<IOpportunityDocument[], IOpportunityDocument>;
  findHighImpactOpportunities(): mongoose.Query<IOpportunityDocument[], IOpportunityDocument>;
}

// Mongoose schema
const OpportunitySchema = new Schema<IOpportunityDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(OpportunityType),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
    },
    expectedImpact: {
      type: String,
      enum: Object.values(ExpectedImpact),
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    recommendations: {
      type: [RecommendationSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(OpportunityStatus),
      required: true,
      default: OpportunityStatus.IDENTIFIED,
      index: true,
    },
    executedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'opportunities',
  }
);

// Indexes
OpportunitySchema.index({ status: 1, createdAt: -1 });
OpportunitySchema.index({ type: 1, status: 1 });
OpportunitySchema.index({ confidence: -1, expectedImpact: 1 });
OpportunitySchema.index({ 'recommendations.channel': 1 });

// Instance methods
OpportunitySchema.methods.approve = function (this: IOpportunityDocument): void {
  this.status = OpportunityStatus.APPROVED;
  this.updatedAt = new Date();
};

OpportunitySchema.methods.execute = function (this: IOpportunityDocument): void {
  this.status = OpportunityStatus.EXECUTED;
  this.executedAt = new Date();
  this.updatedAt = new Date();
};

OpportunitySchema.methods.archive = function (this: IOpportunityDocument): void {
  this.status = OpportunityStatus.ARCHIVED;
  this.archivedAt = new Date();
  this.updatedAt = new Date();
};

// Static methods
OpportunitySchema.statics.findByStatus = function (
  status: OpportunityStatus
): mongoose.Query<IOpportunityDocument[], IOpportunityDocument> {
  return this.find({ status }).sort({ confidence: -1, createdAt: -1 });
};

OpportunitySchema.statics.findByType = function (
  type: OpportunityType
): mongoose.Query<IOpportunityDocument[], IOpportunityDocument> {
  return this.find({ type }).sort({ confidence: -1, createdAt: -1 });
};

OpportunitySchema.statics.findActiveOpportunities = function (): mongoose.Query<IOpportunityDocument[], IOpportunityDocument> {
  return this.find({
    status: { $in: [OpportunityStatus.IDENTIFIED, OpportunityStatus.RECOMMENDED] },
  }).sort({ confidence: -1, createdAt: -1 });
};

OpportunitySchema.statics.findHighImpactOpportunities = function (): mongoose.Query<IOpportunityDocument[], IOpportunityDocument> {
  return this.find({
    status: { $in: [OpportunityStatus.IDENTIFIED, OpportunityStatus.RECOMMENDED] },
    expectedImpact: ExpectedImpact.HIGH,
    confidence: { $gte: 60 },
  }).sort({ confidence: -1 });
};

// Transform for JSON output
OpportunitySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const { _id, __v, ...rest } = ret;
    return rest;
  },
});

// Export model with extended interface
export const OpportunityModel = mongoose.model<IOpportunityDocument, IOpportunityModel>(
  'Opportunity',
  OpportunitySchema
);

export default OpportunityModel;

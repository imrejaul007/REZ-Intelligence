import mongoose, { Schema, Document } from 'mongoose';

// Segment Definition Schema
export interface ISegmentDefinition extends Document {
  segmentId: string;
  name: string;
  description: string;
  rules: Array<{
    field: string;
    operator: string;
    value: unknown;
    logic?: string;
  }>;
  refreshInterval: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentDefinitionSchema = new Schema<ISegmentDefinition>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    rules: {
      type: [
        {
          field: { type: String, required: true },
          operator: { type: String, required: true, enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains'] },
          value: { type: Schema.Types.Mixed, required: true },
          logic: { type: String, enum: ['AND', 'OR'], default: 'AND' }
        }
      ],
      required: true
    },
    refreshInterval: { type: Number, default: 60 },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

SegmentDefinitionSchema.index({ isActive: 1 });

export const SegmentDefinitionModel = mongoose.model<ISegmentDefinition>(
  'SegmentDefinition',
  SegmentDefinitionSchema
);

// User Segment Membership Schema
export interface IUserSegmentMembership extends Document {
  userId: string;
  segmentId: string;
  segmentName: string;
  enteredAt: Date;
  exitedAt: Date | null;
  isActive: boolean;
  lastEvaluatedAt: Date;
}

const UserSegmentMembershipSchema = new Schema<IUserSegmentMembership>(
  {
    userId: { type: String, required: true, index: true },
    segmentId: { type: String, required: true, index: true },
    segmentName: { type: String, required: true },
    enteredAt: { type: Date, required: true },
    exitedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    lastEvaluatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient lookups
UserSegmentMembershipSchema.index({ userId: 1, segmentId: 1 }, { unique: true });
UserSegmentMembershipSchema.index({ segmentId: 1, isActive: 1 });
UserSegmentMembershipSchema.index({ userId: 1, isActive: 1 });

export const UserSegmentMembershipModel = mongoose.model<IUserSegmentMembership>(
  'UserSegmentMembership',
  UserSegmentMembershipSchema
);

// Segment Evaluation Job Schema
export interface ISegmentEvaluationJob extends Document {
  jobId: string;
  segmentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  usersProcessed: number;
  usersMatched: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentEvaluationJobSchema = new Schema<ISegmentEvaluationJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    segmentId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    usersProcessed: { type: Number, default: 0 },
    usersMatched: { type: Number, default: 0 },
    error: { type: String, default: null }
  },
  {
    timestamps: true
  }
);

SegmentEvaluationJobSchema.index({ status: 1, createdAt: -1 });
SegmentEvaluationJobSchema.index({ segmentId: 1, status: 1 });

export const SegmentEvaluationJobModel = mongoose.model<ISegmentEvaluationJob>(
  'SegmentEvaluationJob',
  SegmentEvaluationJobSchema
);

// Segment Stats Schema (cached aggregates)
export interface ISegmentStats extends Document {
  segmentId: string;
  segmentName: string;
  totalMembers: number;
  newMembersToday: number;
  churnedMembersToday: number;
  avgMembershipDurationDays: number;
  lastRefreshed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SegmentStatsSchema = new Schema<ISegmentStats>(
  {
    segmentId: { type: String, required: true, unique: true, index: true },
    segmentName: { type: String, required: true },
    totalMembers: { type: Number, default: 0 },
    newMembersToday: { type: Number, default: 0 },
    churnedMembersToday: { type: Number, default: 0 },
    avgMembershipDurationDays: { type: Number, default: 0 },
    lastRefreshed: { type: Date, required: true }
  },
  {
    timestamps: true
  }
);

export const SegmentStatsModel = mongoose.model<ISegmentStats>(
  'SegmentStats',
  SegmentStatsSchema
);

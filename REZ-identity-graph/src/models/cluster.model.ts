import mongoose, { Document, Schema } from 'mongoose';

export enum ClusterStatus {
  ACTIVE = 'active',
  MERGED = 'merged',
  ARCHIVED = 'archived'
}

export enum ClusterConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFERRED = 'inferred'
}

export interface IIdentityLink {
  identityId: string;
  linkType: string;
  confidence: ClusterConfidence;
  linkedAt: Date;
  linkedBy?: string;
}

export interface ICluster extends Document {
  clusterId: string;
  primaryIdentityId: string;
  status: ClusterStatus;
  identityCount: number;
  identityLinks: IIdentityLink[];
  mergedFromClusters: string[];
  mergedToClusterId?: string;
  confidence: ClusterConfidence;
  mergeReason?: string;
  metadata: {
    firstActivityAt?: Date;
    lastActivityAt?: Date;
    totalSessions?: number;
    preferredChannel?: string;
    predictedUserId?: string;
  };
  privacySettings: {
    allowCrossChannelTracking: boolean;
    allowPersonalization: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const IdentityLinkSchema = new Schema<IIdentityLink>(
  {
    identityId: { type: String, required: true },
    linkType: { type: String, required: true },
    confidence: {
      type: String,
      enum: Object.values(ClusterConfidence),
      default: ClusterConfidence.INFERRED
    },
    linkedAt: { type: Date, default: Date.now },
    linkedBy: { type: String }
  },
  { _id: false }
);

const ClusterSchema = new Schema<ICluster>(
  {
    clusterId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    primaryIdentityId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ClusterStatus),
      default: ClusterStatus.ACTIVE,
      index: true
    },
    identityCount: {
      type: Number,
      default: 1
    },
    identityLinks: [IdentityLinkSchema],
    mergedFromClusters: [{
      type: String,
      index: true
    }],
    mergedToClusterId: {
      type: String,
      index: true
    },
    confidence: {
      type: String,
      enum: Object.values(ClusterConfidence),
      default: ClusterConfidence.INFERRED
    },
    mergeReason: {
      type: String
    },
    metadata: {
      firstActivityAt: { type: Date },
      lastActivityAt: { type: Date },
      totalSessions: { type: Number, default: 0 },
      preferredChannel: { type: String },
      predictedUserId: { type: String }
    },
    privacySettings: {
      allowCrossChannelTracking: { type: Boolean, default: true },
      allowPersonalization: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true,
    collection: 'clusters'
  }
);

ClusterSchema.index({ clusterId: 1, status: 1 });
ClusterSchema.index({ primaryIdentityId: 1 });
ClusterSchema.index({ 'metadata.lastActivityAt': -1 });

export const Cluster = mongoose.model<ICluster>('Cluster', ClusterSchema);

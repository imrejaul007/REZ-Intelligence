import mongoose, { Document, Schema } from 'mongoose';
import { CompanyId } from './customer';

// Link types
export type LinkType = 'phone' | 'email' | 'device' | 'social' | 'manual' | 'transaction';

// Link status
export type LinkStatus = 'pending' | 'verified' | 'confirmed' | 'rejected' | 'expired';

// Confidence level
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Link evidence for confidence scoring
export interface ILinkEvidence {
  type: 'same_device' | 'same_ip' | 'same_location' | 'transaction' | 'manual_verification' | 'social';
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Link record interface
export interface ILink extends Document {
  // Internal link ID
  linkId: string;

  // The unified customer IDs being linked
  sourceCustomerId: string;
  targetCustomerId: string;

  // Type of link
  linkType: LinkType;

  // Link metadata
  identifiers: {
    type: 'phone' | 'email' | 'device_id' | 'external_id';
    sourceValue: string;
    targetValue: string;
  };

  // Status and confidence
  status: LinkStatus;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;

  // Evidence supporting the link
  evidence: ILinkEvidence[];

  // Resolution details
  resolution: {
    resolvedBy: 'system' | 'manual';
    resolvedByUserId?: string;
    resolvedAt?: Date;
    resolution?: 'merged' | 'linked' | 'rejected';
    notes?: string;
  };

  // Company context
  companyContext: {
    initiatedBy: CompanyId;
    sourceCompany: CompanyId;
    targetCompany: CompanyId;
  };

  // Audit
  requestedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schema definitions
const LinkEvidenceSchema = new Schema<ILinkEvidence>(
  {
    type: {
      type: String,
      enum: ['same_device', 'same_ip', 'same_location', 'transaction', 'manual_verification', 'social'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const LinkIdentifiersSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['phone', 'email', 'device_id', 'external_id'],
      required: true,
    },
    sourceValue: {
      type: String,
      required: true,
    },
    targetValue: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ResolutionSchema = new Schema(
  {
    resolvedBy: {
      type: String,
      enum: ['system', 'manual'],
      required: true,
    },
    resolvedByUserId: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    resolution: {
      type: String,
      enum: ['merged', 'linked', 'rejected'],
    },
    notes: {
      type: String,
    },
  },
  { _id: false }
);

const CompanyContextSchema = new Schema(
  {
    initiatedBy: {
      type: String,
      enum: [
        'rez-merchant',
        'rez-consumer',
        'rez-media',
        'rabtul-technologies',
        'stayown-hospitality',
        'corpperks',
        'rtnm-group',
      ],
      required: true,
    },
    sourceCompany: {
      type: String,
      enum: [
        'rez-merchant',
        'rez-consumer',
        'rez-media',
        'rabtul-technologies',
        'stayown-hospitality',
        'corpperks',
        'rtnm-group',
      ],
      required: true,
    },
    targetCompany: {
      type: String,
      enum: [
        'rez-merchant',
        'rez-consumer',
        'rez-media',
        'rabtul-technologies',
        'stayown-hospitality',
        'corpperks',
        'rtnm-group',
      ],
      required: true,
    },
  },
  { _id: false }
);

const LinkSchema = new Schema<ILink>(
  {
    linkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sourceCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    targetCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    linkType: {
      type: String,
      enum: ['phone', 'email', 'device', 'social', 'manual', 'transaction'],
      required: true,
    },
    identifiers: {
      type: LinkIdentifiersSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'confirmed', 'rejected', 'expired'],
      default: 'pending',
    },
    confidenceLevel: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    evidence: [LinkEvidenceSchema],
    resolution: {
      type: ResolutionSchema,
    },
    companyContext: {
      type: CompanyContextSchema,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'links',
  }
);

// Compound indexes
LinkSchema.index({ sourceCustomerId: 1, targetCustomerId: 1 });
LinkSchema.index({ status: 1, expiresAt: 1 });
LinkSchema.index({ 'identifiers.type': 1, 'identifiers.sourceValue': 1 });
LinkSchema.index({ 'identifiers.type': 1, 'identifiers.targetValue': 1 });
LinkSchema.index({ 'companyContext.initiatedBy': 1, status: 1 });

// Pre-save hook to generate linkId if not present
LinkSchema.pre('save', function (next: (err?: Error) => void) {
  if (!this.linkId) {
    const { v4: uuidv4 } = require('uuid');
    this.linkId = `LNK-${uuidv4()}`;
  }
  next();
});

// Methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LinkSchema.methods as any).addEvidence = function (this: ILink, evidence: ILinkEvidence): void {
  this.evidence.push(evidence);
  // Recalculate confidence inline
  const evidenceScores: Record<string, number> = {
    manual_verification: 100,
    transaction: 90,
    same_device: 80,
    social: 70,
    same_location: 50,
    same_ip: 40,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const ev of this.evidence) {
    const score = evidenceScores[ev.type] || 50;
    const recency = Math.max(0, 1 - (Date.now() - ev.timestamp.getTime()) / (365 * 24 * 60 * 60 * 1000));
    const weight = recency * this.evidence.length;
    totalScore += score * weight;
    totalWeight += weight;
  }

  this.confidenceScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

  if (this.confidenceScore >= 80) {
    this.confidenceLevel = 'high';
  } else if (this.confidenceScore >= 50) {
    this.confidenceLevel = 'medium';
  } else {
    this.confidenceLevel = 'low';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LinkSchema.methods as any).recalculateConfidence = function (this: ILink): void {
  // Base scores by evidence type
  const evidenceScores: Record<string, number> = {
    manual_verification: 100,
    transaction: 90,
    same_device: 80,
    social: 70,
    same_location: 50,
    same_ip: 40,
  };

  // Calculate weighted average
  let totalScore = 0;
  let totalWeight = 0;

  for (const evidence of this.evidence) {
    const score = evidenceScores[evidence.type] || 50;
    const recency = Math.max(0, 1 - (Date.now() - evidence.timestamp.getTime()) / (365 * 24 * 60 * 60 * 1000));
    const weight = recency * this.evidence.length;

    totalScore += score * weight;
    totalWeight += weight;
  }

  this.confidenceScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

  // Update confidence level
  if (this.confidenceScore >= 80) {
    this.confidenceLevel = 'high';
  } else if (this.confidenceScore >= 50) {
    this.confidenceLevel = 'medium';
  } else {
    this.confidenceLevel = 'low';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LinkSchema.methods as any).confirm = function (
  this: ILink,
  resolvedBy: 'system' | 'manual',
  resolvedByUserId?: string,
  notes?: string
): void {
  this.status = 'confirmed';
  this.resolution = {
    resolvedBy,
    resolvedByUserId,
    resolvedAt: new Date(),
    resolution: 'linked',
    notes,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LinkSchema.methods as any).reject = function (
  this: ILink,
  resolvedBy: 'system' | 'manual',
  resolvedByUserId?: string,
  notes?: string
): void {
  this.status = 'rejected';
  this.resolution = {
    resolvedBy,
    resolvedByUserId,
    resolvedAt: new Date(),
    resolution: 'rejected',
    notes,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(LinkSchema.methods as any).expire = function (this: ILink): void {
  this.status = 'expired';
};

export const Link = mongoose.model<ILink>('Link', LinkSchema);

export default Link;

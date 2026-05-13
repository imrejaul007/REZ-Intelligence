import mongoose, { Document, Schema } from 'mongoose';

export enum FraudCaseStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONFIRMED = 'CONFIRMED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export enum FraudCaseSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IFraudPatternMatch {
  patternType: string;
  patternName: string;
  matchedAt: Date;
  score: number;
  evidence: Record<string, unknown>;
}

export interface IFraudCase extends Document {
  caseId: string;
  userId?: string;
  accountId?: string;
  transactionId?: string;
  orderId?: string;

  // Case Details
  status: FraudCaseStatus;
  severity: FraudCaseSeverity;
  riskScore: number;

  // Detection Info
  detectedPatterns: IFraudPatternMatch[];
  riskFactors: string[];
  indicators: Record<string, unknown>;

  // Evidence
  evidence: {
    transactions: Array<Record<string, unknown>>;
    deviceInfo?: Record<string, unknown>;
    locationInfo?: Record<string, unknown>;
    behavioralData?: Record<string, unknown>;
    sessionData?: Record<string, unknown>;
  };

  // Timeline
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;

  // Assignment
  assignedTo?: string;
  reviewedBy?: string;
  reviewNotes?: string;

  // Actions taken
  actionsTaken: Array<{
    action: string;
    timestamp: Date;
    performedBy?: string;
    details?: string;
  }>;

  // Prevention
  blockedAmount?: number;
  preventedLoss?: number;

  // Metadata
  source: 'AUTOMATED' | 'MANUAL' | 'EXTERNAL';
  externalReference?: string;
}

const FraudPatternMatchSchema = new Schema<IFraudPatternMatch>(
  {
    patternType: { type: String, required: true },
    patternName: { type: String, required: true },
    matchedAt: { type: Date, default: Date.now },
    score: { type: Number, required: true },
    evidence: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const FraudCaseSchema = new Schema<IFraudCase>(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    accountId: {
      type: String,
      index: true,
    },
    transactionId: {
      type: String,
      index: true,
    },
    orderId: {
      type: String,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(FraudCaseStatus),
      default: FraudCaseStatus.OPEN,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(FraudCaseSeverity),
      default: FraudCaseSeverity.MEDIUM,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },

    detectedPatterns: [FraudPatternMatchSchema],
    riskFactors: [String],
    indicators: {
      type: Schema.Types.Mixed,
      default: {},
    },

    evidence: {
      transactions: [Schema.Types.Mixed],
      deviceInfo: Schema.Types.Mixed,
      locationInfo: Schema.Types.Mixed,
      behavioralData: Schema.Types.Mixed,
      sessionData: Schema.Types.Mixed,
    },

    resolvedAt: Date,

    assignedTo: String,
    reviewedBy: String,
    reviewNotes: String,

    actionsTaken: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        performedBy: String,
        details: String,
        _id: false,
      },
    ],

    blockedAmount: Number,
    preventedLoss: Number,

    source: {
      type: String,
      enum: ['AUTOMATED', 'MANUAL', 'EXTERNAL'],
      default: 'AUTOMATED',
    },
    externalReference: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
FraudCaseSchema.index({ status: 1, severity: 1 });
FraudCaseSchema.index({ userId: 1, status: 1 });
FraudCaseSchema.index({ createdAt: -1, status: 1 });
FraudCaseSchema.index({ riskScore: -1, status: 1 });

// TTL index for old resolved cases (optional, uncomment if needed)
// FraudCaseSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

export const FraudCase = mongoose.model<IFraudCase>('FraudCase', FraudCaseSchema);

// Helper function to generate case ID
export function generateFraudCaseId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `FRC-${timestamp}-${random}`.toUpperCase();
}

import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export enum RiskLevel {
  TRUSTED = 'TRUSTED',
  NORMAL = 'NORMAL',
  ELEVATED = 'ELEVATED',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AccountStanding {
  GOOD = 'GOOD',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

export interface ITransactionHistory {
  transactionId: string;
  amount: number;
  timestamp: Date;
  merchantCategory: string;
  riskScore: number;
  status: string;
}

export interface ILoginHistory {
  ipAddress: string;
  deviceFingerprint: string;
  userAgent: string;
  location: {
    country: string;
    city?: string;
    coordinates?: [number, number];
  };
  timestamp: Date;
  successful: boolean;
}

export interface IRiskProfile extends Document {
  profileId: string;
  userId: string;
  accountId?: string;

  // Risk Classification
  riskLevel: RiskLevel;
  riskScore: number;
  accountStanding: AccountStanding;

  // Historical Data
  transactionHistory: ITransactionHistory[];
  loginHistory: ILoginHistory[];

  // Behavioral Analysis
  averageTransactionAmount: number;
  maxTransactionAmount: number;
  usualMerchantCategories: string[];
  usualLocations: Array<{
    country: string;
    city?: string;
    frequency: number;
  }>;
  usualDevices: string[];
  usualIPAddresses: string[];

  // Fraud Metrics
  totalTransactions: number;
  failedTransactionCount: number;
  chargebackCount: number;
  refundCount: number;
  fraudCaseCount: number;

  // Time-based Patterns
  usualTransactionHours: number[]; // 0-23
  averageSessionDuration: number; // seconds

  // Known Signals
  isKnownFraudster: boolean;
  isVerifiedAccount: boolean;
  twoFactorEnabled: boolean;
  hasPaymentMethodOnFile: boolean;

  // Last Activity
  lastTransactionAt?: Date;
  lastLoginAt?: Date;
  lastRiskAssessmentAt?: Date;

  // Flags and Notes
  riskFlags: string[];
  notes: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const TransactionHistorySchema = new Schema<ITransactionHistory>(
  {
    transactionId: { type: String, required: true },
    amount: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    merchantCategory: { type: String, required: true },
    riskScore: { type: Number, required: true },
    status: { type: String, required: true },
  },
  { _id: false }
);

const LoginHistorySchema = new Schema<ILoginHistory>(
  {
    ipAddress: { type: String, required: true },
    deviceFingerprint: { type: String, required: true },
    userAgent: { type: String, required: true },
    location: {
      country: { type: String, required: true },
      city: String,
      coordinates: [Number],
    },
    timestamp: { type: Date, required: true },
    successful: { type: Boolean, default: true },
  },
  { _id: false }
);

const UsualLocationSchema = new Schema(
  {
    country: { type: String, required: true },
    city: String,
    frequency: { type: Number, default: 1 },
  },
  { _id: false }
);

const RiskProfileSchema = new Schema<IRiskProfile>(
  {
    profileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountId: String,

    riskLevel: {
      type: String,
      enum: Object.values(RiskLevel),
      default: RiskLevel.NORMAL,
      index: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    accountStanding: {
      type: String,
      enum: Object.values(AccountStanding),
      default: AccountStanding.GOOD,
    },

    transactionHistory: [TransactionHistorySchema],
    loginHistory: [LoginHistorySchema],

    averageTransactionAmount: { type: Number, default: 0 },
    maxTransactionAmount: { type: Number, default: 0 },
    usualMerchantCategories: [String],
    usualLocations: [UsualLocationSchema],
    usualDevices: [String],
    usualIPAddresses: [String],

    totalTransactions: { type: Number, default: 0 },
    failedTransactionCount: { type: Number, default: 0 },
    chargebackCount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
    fraudCaseCount: { type: Number, default: 0 },

    usualTransactionHours: [Number],
    averageSessionDuration: { type: Number, default: 0 },

    isKnownFraudster: { type: Boolean, default: false },
    isVerifiedAccount: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    hasPaymentMethodOnFile: { type: Boolean, default: false },

    lastTransactionAt: Date,
    lastLoginAt: Date,
    lastRiskAssessmentAt: Date,

    riskFlags: [String],
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Indexes
RiskProfileSchema.index({ riskLevel: 1, riskScore: -1 });
RiskProfileSchema.index({ 'usualLocations.country': 1 });
RiskProfileSchema.index({ isKnownFraudster: 1 });

// Virtual for fraud rate
RiskProfileSchema.virtual('fraudRate').get(function () {
  if (this.totalTransactions === 0) return 0;
  return (this.fraudCaseCount / this.totalTransactions) * 100;
});

// Method to update risk level based on score
RiskProfileSchema.methods.updateRiskLevel = function (): void {
  if (this.riskScore >= 90) {
    this.riskLevel = RiskLevel.CRITICAL;
  } else if (this.riskScore >= 75) {
    this.riskLevel = RiskLevel.HIGH;
  } else if (this.riskScore >= 50) {
    this.riskLevel = RiskLevel.ELEVATED;
  } else if (this.riskScore >= 25) {
    this.riskLevel = RiskLevel.NORMAL;
  } else {
    this.riskLevel = RiskLevel.TRUSTED;
  }
};

export const RiskProfile = mongoose.model<IRiskProfile>('RiskProfile', RiskProfileSchema);

export function generateProfileId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
  return `RP-${timestamp}-${random}`.toUpperCase();
}

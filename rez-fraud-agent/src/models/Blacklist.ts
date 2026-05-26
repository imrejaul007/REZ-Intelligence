import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export enum BlacklistType {
  IP_ADDRESS = 'IP_ADDRESS',
  DEVICE_FINGERPRINT = 'DEVICE_FINGERPRINT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  CARD_HASH = 'CARD_HASH',
  IBAN = 'IBAN',
  ACCOUNT = 'ACCOUNT',
  USER = 'USER',
  MERCHANT = 'MERCHANT',
  VELOCITY_GROUP = 'VELOCITY_GROUP',
}

export enum BlacklistReason {
  FRAUD_CONFIRMED = 'FRAUD_CONFIRMED',
  CHARGEBACK = 'CHARGEBACK',
  REFUND_ABUSE = 'REFUND_ABUSE',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  VELOCITY_VIOLATION = 'VELOCITY_VIOLATION',
  CARD_TESTING = 'CARD_TESTING',
  BOT_ACTIVITY = 'BOT_ACTIVITY',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  ACCOUNT_TAKEOVER = 'ACCOUNT_TAKEOVER',
  TEST_ACCOUNT = 'TEST_ACCOUNT',
  OTHER = 'OTHER',
}

export enum BlacklistSeverity {
  WARN = 'WARN',
  BLOCK = 'BLOCK',
  INVESTIGATE = 'INVESTIGATE',
}

export interface IBlacklistEntry extends Document {
  entryId: string;
  type: BlacklistType;
  value: string;

  // Classification
  reason: BlacklistReason;
  severity: BlacklistSeverity;

  // Context
  userId?: string;
  transactionId?: string;
  orderId?: string;
  fraudCaseId?: string;

  // Details
  details: {
    description?: string;
    evidence?: Record<string, unknown>;
    relatedEntries?: string[];
    firstOccurrence?: Date;
    occurrenceCount?: number;
  };

  // Duration
  expiresAt?: Date;
  isPermanent: boolean;

  // Audit
  addedBy: string;
  addedAt: Date;
  updatedAt: Date;

  // Last activity
  lastMatchedAt?: Date;
  matchCount: number;

  // Status
  isActive: boolean;
  notes?: string;

  // Instance methods
  recordMatch(): Promise<void>;
}

const BlacklistEntrySchema = new Schema<IBlacklistEntry>(
  {
    entryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(BlacklistType),
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    reason: {
      type: String,
      enum: Object.values(BlacklistReason),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(BlacklistSeverity),
      default: BlacklistSeverity.BLOCK,
    },

    userId: {
      type: String,
      index: true,
    },
    transactionId: String,
    orderId: String,
    fraudCaseId: String,

    details: {
      description: String,
      evidence: Schema.Types.Mixed,
      relatedEntries: [String],
      firstOccurrence: Date,
      occurrenceCount: Number,
    },

    expiresAt: {
      type: Date,
      index: true,
    },
    isPermanent: {
      type: Boolean,
      default: false,
    },

    addedBy: {
      type: String,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },

    lastMatchedAt: Date,
    matchCount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
BlacklistEntrySchema.index({ type: 1, value: 1 }, { unique: true });
BlacklistEntrySchema.index({ type: 1, isActive: 1 });
BlacklistEntrySchema.index({ userId: 1, isActive: 1 });
BlacklistEntrySchema.index({ expiresAt: 1 }, { sparse: true });

// TTL index for temporary entries
BlacklistEntrySchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { isPermanent: false },
  }
);

// Static method to check if a value is blacklisted
BlacklistEntrySchema.statics.isBlacklisted = async function (
  type: BlacklistType,
  value: string
): Promise<{ isBlacklisted: boolean; entry?: IBlacklistEntry }> {
  const normalizedValue = value.toLowerCase().trim();

  const entry = await this.findOne({
    type,
    value: normalizedValue,
    isActive: true,
    $or: [
      { isPermanent: true },
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  return {
    isBlacklisted: !!entry,
    entry: entry || undefined,
  };
};

// Static method to add entry to blacklist
BlacklistEntrySchema.statics.addToBlacklist = async function (data: {
  type: BlacklistType;
  value: string;
  reason: BlacklistReason;
  severity?: BlacklistSeverity;
  userId?: string;
  transactionId?: string;
  orderId?: string;
  fraudCaseId?: string;
  addedBy: string;
  isPermanent?: boolean;
  expiresAt?: Date;
  notes?: string;
}): Promise<IBlacklistEntry> {
  const entryId = generateBlacklistEntryId();

  const entry = await this.create({
    entryId,
    type: data.type,
    value: data.value.toLowerCase().trim(),
    reason: data.reason,
    severity: data.severity || BlacklistSeverity.BLOCK,
    userId: data.userId,
    transactionId: data.transactionId,
    orderId: data.orderId,
    fraudCaseId: data.fraudCaseId,
    addedBy: data.addedBy,
    isPermanent: data.isPermanent ?? true,
    expiresAt: data.expiresAt,
    notes: data.notes,
    details: {
      firstOccurrence: new Date(),
      occurrenceCount: 1,
    },
  });

  return entry;
};

// Static method for pagination
BlacklistEntrySchema.statics.paginate = async function (query: {
  type?: BlacklistType;
  reason?: BlacklistReason;
  severity?: BlacklistSeverity;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  docs: IBlacklistEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.reason) filter.reason = query.reason;
  if (query.severity) filter.severity = query.severity;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const [docs, total] = await Promise.all([
    this.find(filter).sort({ addedAt: -1 }).skip(skip).limit(limit).lean(),
    this.countDocuments(filter),
  ]);

  return {
    docs: docs as unknown as IBlacklistEntry[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
};

// Method to record a match
BlacklistEntrySchema.methods.recordMatch = async function (): Promise<void> {
  this.matchCount += 1;
  this.lastMatchedAt = new Date();
  await this.save();
};

// Interface for static methods
interface IBlacklistEntryModel extends mongoose.Model<IBlacklistEntry> {
  isBlacklisted(
    type: BlacklistType,
    value: string
  ): Promise<{ isBlacklisted: boolean; entry?: IBlacklistEntry }>;
  addToBlacklist(data: {
    type: BlacklistType;
    value: string;
    reason: BlacklistReason;
    severity?: BlacklistSeverity;
    userId?: string;
    transactionId?: string;
    orderId?: string;
    fraudCaseId?: string;
    addedBy: string;
    isPermanent?: boolean;
    expiresAt?: Date;
    notes?: string;
  }): Promise<IBlacklistEntry>;
  paginate(query: {
    type?: BlacklistType;
    reason?: BlacklistReason;
    severity?: BlacklistSeverity;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    docs: IBlacklistEntry[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>;
}

export const BlacklistEntry = mongoose.model<IBlacklistEntry, IBlacklistEntryModel>(
  'BlacklistEntry',
  BlacklistEntrySchema
);

export function generateBlacklistEntryId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
  return `BL-${timestamp}-${random}`.toUpperCase();
}

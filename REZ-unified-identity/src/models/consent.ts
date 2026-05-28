import mongoose, { Document, Schema } from 'mongoose';
import { CompanyId } from './customer';

// Consent purpose types
export type ConsentPurpose =
  | 'marketing'
  | 'analytics'
  | 'personalization'
  | 'third_party_sharing'
  | 'profiling'
  | 'data_portability'
  | 'essential';

// Consent channel
export type ConsentChannel = 'sms' | 'email' | 'push' | 'whatsapp' | 'in_app' | 'phone';

// Consent status
export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'expired' | 'pending';

// Consent record interface
export interface IConsent extends Document {
  // Internal consent ID
  consentId: string;

  // Reference to unified customer
  unifiedCustomerId: string;

  // Consent details
  purpose: ConsentPurpose;
  channel?: ConsentChannel;
  status: ConsentStatus;

  // Consent data
  consentData: {
    grantedAt?: Date;
    deniedAt?: Date;
    withdrawnAt?: Date;
    expiresAt?: Date;
    source: 'web' | 'mobile' | 'phone' | 'in_store' | 'api' | 'form';
    ipAddress?: string;
    userAgent?: string;
  };

  // Policy version
  policy: {
    version: string;
    policyUrl?: string;
    acceptedVersion?: string;
  };

  // Company context
  companyId: CompanyId;
  companyName?: string;

  // Legal basis (GDPR/DPDP)
  legalBasis?: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';

  // Audit
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Data processing record (for GDPR Article 30)
export interface IDataProcessingRecord extends Document {
  recordId: string;

  // Processing activity
  activity: {
    name: string;
    description: string;
    purpose: string;
  };

  // Data categories
  dataCategories: string[];

  // Data subjects
  dataSubjects: string[];

  // Retention period
  retention: {
    period: number; // days
    criteria: string;
  };

  // Recipients
  recipients: {
    companyId: CompanyId;
    companyName: string;
    purpose: string;
  }[];

  // Transfers
  transfers: {
    country: string;
    safeguards?: string;
  }[];

  // Security measures
  securityMeasures: string[];

  // Company
  companyId: CompanyId;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// Consent log for audit trail
export interface IConsentLog extends Document {
  logId: string;

  // Reference
  unifiedCustomerId: string;
  consentId?: string;

  // Action
  action: 'granted' | 'denied' | 'withdrawn' | 'updated' | 'exported' | 'deleted';
  purpose: ConsentPurpose;

  // Details
  details: {
    previousStatus?: ConsentStatus;
    newStatus?: ConsentStatus;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  };

  // Requester
  requestedBy: {
    type: 'user' | 'system' | 'admin';
    userId?: string;
    companyId: CompanyId;
  };

  // Audit
  timestamp: Date;
  createdAt: Date;
}

// Schema definitions
const ConsentDataSchema = new Schema(
  {
    grantedAt: { type: Date },
    deniedAt: { type: Date },
    withdrawnAt: { type: Date },
    expiresAt: { type: Date },
    source: {
      type: String,
      enum: ['web', 'mobile', 'phone', 'in_store', 'api', 'form'],
      required: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { _id: false }
);

const PolicySchema = new Schema(
  {
    version: { type: String, required: true },
    policyUrl: { type: String },
    acceptedVersion: { type: String },
  },
  { _id: false }
);

const ConsentSchema = new Schema<IConsent>(
  {
    consentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    unifiedCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        'marketing',
        'analytics',
        'personalization',
        'third_party_sharing',
        'profiling',
        'data_portability',
        'essential',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'email', 'push', 'whatsapp', 'in_app', 'phone'],
    },
    status: {
      type: String,
      enum: ['granted', 'denied', 'withdrawn', 'expired', 'pending'],
      default: 'pending',
    },
    consentData: {
      type: ConsentDataSchema,
      required: true,
    },
    policy: {
      type: PolicySchema,
      required: true,
    },
    companyId: {
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
    companyName: { type: String },
    legalBasis: {
      type: String,
      enum: ['consent', 'legitimate_interest', 'contract', 'legal_obligation'],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'consents',
  }
);

// Indexes
ConsentSchema.index({ unifiedCustomerId: 1, purpose: 1 });
ConsentSchema.index({ status: 1, 'consentData.expiresAt': 1 });
ConsentSchema.index({ companyId: 1, purpose: 1 });

// Pre-save hook
ConsentSchema.pre('save', function (next: (err?: Error) => void) {
  if (!this.consentId) {
    const { v4: uuidv4 } = require('uuid');
    this.consentId = `CNS-${uuidv4()}`;
  }
  next();
});

// Consent methods
ConsentSchema.methods.grant = function (metadata?: Record<string, unknown>): void {
  this.status = 'granted';
  this.consentData.grantedAt = new Date();
  if (metadata) {
    Object.assign(this.consentData, metadata);
  }
};

ConsentSchema.methods.deny = function (metadata?: Record<string, unknown>): void {
  this.status = 'denied';
  this.consentData.deniedAt = new Date();
  if (metadata) {
    Object.assign(this.consentData, metadata);
  }
};

ConsentSchema.methods.withdraw = function (metadata?: Record<string, unknown>): void {
  this.status = 'withdrawn';
  this.consentData.withdrawnAt = new Date();
  if (metadata) {
    Object.assign(this.consentData, metadata);
  }
};

ConsentSchema.methods.expire = function (): void {
  this.status = 'expired';
  this.consentData.expiresAt = new Date();
};

// Data Processing Record Schema
const RecipientsSchema = new Schema(
  {
    companyId: {
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
    companyName: { type: String, required: true },
    purpose: { type: String, required: true },
  },
  { _id: false }
);

const TransfersSchema = new Schema(
  {
    country: { type: String, required: true },
    safeguards: { type: String },
  },
  { _id: false }
);

const DataProcessingRecordSchema = new Schema<IDataProcessingRecord>(
  {
    recordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    activity: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      purpose: { type: String, required: true },
    },
    dataCategories: [{ type: String }],
    dataSubjects: [{ type: String }],
    retention: {
      period: { type: Number, required: true },
      criteria: { type: String, required: true },
    },
    recipients: [RecipientsSchema],
    transfers: [TransfersSchema],
    securityMeasures: [{ type: String }],
    companyId: {
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
  {
    timestamps: true,
    collection: 'data_processing_records',
  }
);

// Consent Log Schema
const ConsentLogSchema = new Schema<IConsentLog>(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    unifiedCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    consentId: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      enum: ['granted', 'denied', 'withdrawn', 'updated', 'exported', 'deleted'],
      required: true,
    },
    purpose: {
      type: String,
      enum: [
        'marketing',
        'analytics',
        'personalization',
        'third_party_sharing',
        'profiling',
        'data_portability',
        'essential',
      ],
      required: true,
    },
    details: {
      previousStatus: { type: String },
      newStatus: { type: String },
      reason: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
      metadata: { type: Schema.Types.Mixed },
    },
    requestedBy: {
      type: { type: String, enum: ['user', 'system', 'admin'], required: true },
      userId: { type: String },
      companyId: {
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
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'consent_logs',
  }
);

// Indexes
ConsentLogSchema.index({ unifiedCustomerId: 1, timestamp: -1 });
ConsentLogSchema.index({ action: 1, timestamp: -1 });

// Pre-save hook
ConsentLogSchema.pre('save', function (next: (err?: Error) => void) {
  if (!this.logId) {
    const { v4: uuidv4 } = require('uuid');
    this.logId = `LOG-${uuidv4()}`;
  }
  next();
});

// Export models
export const Consent = mongoose.model<IConsent>('Consent', ConsentSchema);
export const DataProcessingRecord = mongoose.model<IDataProcessingRecord>(
  'DataProcessingRecord',
  DataProcessingRecordSchema
);
export const ConsentLog = mongoose.model<IConsentLog>('ConsentLog', ConsentLogSchema);

export default {
  Consent,
  DataProcessingRecord,
  ConsentLog,
};

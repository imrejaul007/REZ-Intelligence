import mongoose, { Document, Schema } from 'mongoose';

export enum IdentityType {
  APP_USER = 'app_user',
  WHATSAPP_USER = 'whatsapp_user',
  WEB_USER = 'web_user',
  QR_USER = 'qr_user',
  EMAIL = 'email',
  PHONE = 'phone',
  DEVICE = 'device',
  ANONYMOUS = 'anonymous'
}

export enum IdentityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MERGED = 'merged',
  DELETED = 'deleted'
}

export interface IIdentity extends Document {
  identityId: string;
  type: IdentityType;
  identifier: string;
  hashIdentifier: string;
  clusterId: string;
  status: IdentityStatus;
  metadata: {
    source?: string;
    userAgent?: string;
    ipAddress?: string;
    platform?: string;
    appVersion?: string;
    firstSeenAt?: Date;
    lastSeenAt?: Date;
    sessionCount?: number;
    traits?: Record<string, unknown>;
  };
  privacySettings: {
    trackingEnabled: boolean;
    dataRetentionDays: number;
    marketingConsent: boolean;
    analyticsConsent: boolean;
    thirdPartySharing: boolean;
  };
  gdpr: {
    consentGivenAt?: Date;
    consentWithdrawnAt?: Date;
    erasureRequestedAt?: Date;
    erasureCompletedAt?: Date;
    dataExportRequestedAt?: Date;
    dataExportCompletedAt?: Date;
    exportedDataUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const IdentitySchema = new Schema<IIdentity>(
  {
    identityId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(IdentityType),
      required: true,
      index: true
    },
    identifier: {
      type: String,
      required: true,
      index: true
    },
    hashIdentifier: {
      type: String,
      required: true,
      index: true
    },
    clusterId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(IdentityStatus),
      default: IdentityStatus.ACTIVE,
      index: true
    },
    metadata: {
      source: { type: String },
      userAgent: { type: String },
      ipAddress: { type: String },
      platform: { type: String },
      appVersion: { type: String },
      firstSeenAt: { type: Date },
      lastSeenAt: { type: Date },
      sessionCount: { type: Number, default: 0 },
      traits: { type: Schema.Types.Mixed }
    },
    privacySettings: {
      trackingEnabled: { type: Boolean, default: true },
      dataRetentionDays: { type: Number, default: 365 },
      marketingConsent: { type: Boolean, default: false },
      analyticsConsent: { type: Boolean, default: true },
      thirdPartySharing: { type: Boolean, default: false }
    },
    gdpr: {
      consentGivenAt: { type: Date },
      consentWithdrawnAt: { type: Date },
      erasureRequestedAt: { type: Date },
      erasureCompletedAt: { type: Date },
      dataExportRequestedAt: { type: Date },
      dataExportCompletedAt: { type: Date },
      exportedDataUrl: { type: String }
    }
  },
  {
    timestamps: true,
    collection: 'identities'
  }
);

IdentitySchema.index({ identityId: 1, type: 1 }, { unique: true });
IdentitySchema.index({ clusterId: 1, status: 1 });
IdentitySchema.index({ 'metadata.lastSeenAt': -1 });
IdentitySchema.index({ 'gdpr.erasureRequestedAt': 1, status: 1 });

export const Identity = mongoose.model<IIdentity>('Identity', IdentitySchema);

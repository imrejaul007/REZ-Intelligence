import mongoose, { Document, Schema } from 'mongoose';

export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  WEB = 'web',
  UNKNOWN = 'unknown'
}

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked'
}

export interface IDeviceFingerprint {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  colorDepth?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  touchPoints?: number;
  webGLVendor?: string;
  webGLRenderer?: string;
}

export interface IDevice extends Document {
  deviceId: string;
  fingerprintHash: string;
  type: DeviceType;
  status: DeviceStatus;
  clusterId?: string;
  fingerprints: IDeviceFingerprint[];
  metadata: {
    firstSeenAt?: Date;
    lastSeenAt?: Date;
    sessionCount?: number;
    lastIpAddress?: string;
    lastUserAgent?: string;
    osVersion?: string;
    appVersion?: string;
    manufacturer?: string;
    model?: string;
  };
  linkedIdentities: {
    identityId: string;
    linkedAt: Date;
    linkType: string;
  }[];
  privacySettings: {
    trackingEnabled: boolean;
  };
  riskScore?: number;
  riskFlags: string[];
  mergedInto?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceFingerprintSchema = new Schema<IDeviceFingerprint>(
  {
    userAgent: { type: String, required: true },
    screenResolution: { type: String },
    timezone: { type: String },
    language: { type: String },
    platform: { type: String },
    colorDepth: { type: Number },
    deviceMemory: { type: Number },
    hardwareConcurrency: { type: Number },
    touchPoints: { type: Number },
    webGLVendor: { type: String },
    webGLRenderer: { type: String }
  },
  { _id: false }
);

const LinkedIdentitySchema = new Schema(
  {
    identityId: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
    linkType: { type: String, required: true }
  },
  { _id: false }
);

const DeviceSchema = new Schema<IDevice>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    fingerprintHash: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(DeviceType),
      default: DeviceType.UNKNOWN,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(DeviceStatus),
      default: DeviceStatus.ACTIVE,
      index: true
    },
    clusterId: {
      type: String,
      index: true
    },
    fingerprints: [DeviceFingerprintSchema],
    metadata: {
      firstSeenAt: { type: Date },
      lastSeenAt: { type: Date },
      sessionCount: { type: Number, default: 0 },
      lastIpAddress: { type: String },
      lastUserAgent: { type: String },
      osVersion: { type: String },
      appVersion: { type: String },
      manufacturer: { type: String },
      model: { type: String }
    },
    linkedIdentities: [LinkedIdentitySchema],
    privacySettings: {
      trackingEnabled: { type: Boolean, default: true }
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    riskFlags: [{
      type: String
    }],
    mergedInto: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'devices'
  }
);

DeviceSchema.index({ deviceId: 1, fingerprintHash: 1 }, { unique: true });
DeviceSchema.index({ clusterId: 1, status: 1 });
DeviceSchema.index({ 'metadata.lastSeenAt': -1 });
DeviceSchema.index({ riskScore: 1 });

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);

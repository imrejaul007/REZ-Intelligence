import mongoose, { Document, Schema } from 'mongoose';

export enum ActivityType {
  PAGE_VIEW = 'page_view',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  CLICK = 'click',
  SEARCH = 'search',
  PURCHASE = 'purchase',
  SIGNUP = 'signup',
  LOGIN = 'login',
  LOGOUT = 'logout',
  IDENTITY_LINK = 'identity_link',
  IDENTITY_UNLINK = 'identity_unlink',
  PROFILE_UPDATE = 'profile_update',
  CONSENT_UPDATE = 'consent_update'
}

export interface IActivity extends Document {
  activityId: string;
  identityId: string;
  clusterId: string;
  deviceId?: string;
  type: ActivityType;
  channel: string;
  timestamp: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    pageUrl?: string;
    pageTitle?: string;
    referrer?: string;
    queryParams?: Record<string, string>;
    eventData?: Record<string, unknown>;
  };
  privacy: {
    personallyIdentifiable: boolean;
    sensitiveData: boolean;
    thirdPartySharingAllowed: boolean;
  };
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    activityId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    identityId: {
      type: String,
      required: true,
      index: true
    },
    clusterId: {
      type: String,
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
      index: true
    },
    channel: {
      type: String,
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
      sessionId: { type: String },
      pageUrl: { type: String },
      pageTitle: { type: String },
      referrer: { type: String },
      queryParams: { type: Schema.Types.Mixed },
      eventData: { type: Schema.Types.Mixed }
    },
    privacy: {
      personallyIdentifiable: { type: Boolean, default: false },
      sensitiveData: { type: Boolean, default: false },
      thirdPartySharingAllowed: { type: Boolean, default: false }
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'activities'
  }
);

ActivitySchema.index({ identityId: 1, timestamp: -1 });
ActivitySchema.index({ clusterId: 1, timestamp: -1 });
ActivitySchema.index({ deviceId: 1, timestamp: -1 });
ActivitySchema.index({ type: 1, timestamp: -1 });
ActivitySchema.index({ channel: 1, timestamp: -1 });
ActivitySchema.index({ timestamp: -1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);

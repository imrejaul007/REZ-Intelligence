import mongoose, { Schema, Model } from 'mongoose';
import {
  INotification,
  NotificationType,
  NotificationChannel,
  ChannelStatus,
  ChannelInfo,
  NotificationContent,
} from '../types/index.js';

// ============================================================================
// Notification Schema
// ============================================================================

const ChannelInfoSchema = new Schema<ChannelInfo>(
  {
    channel: {
      type: String,
      enum: ['push', 'sms', 'email', 'in_app'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'failed'],
      default: 'queued',
    },
    externalId: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    error: { type: String },
  },
  { _id: false }
);

const NotificationContentSchema = new Schema<NotificationContent>(
  {
    title: { type: String },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const notificationSchema = new Schema<INotification>(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String },
    type: {
      type: String,
      enum: ['reorder_nudge', 'offer', 'alert', 'reminder', 'marketing'],
      required: true,
    },
    channels: [ChannelInfoSchema],
    content: NotificationContentSchema,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ 'channels.channel': 1, 'channels.status': 1 });

export const Notification: Model<INotification> = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);

export default { Notification };

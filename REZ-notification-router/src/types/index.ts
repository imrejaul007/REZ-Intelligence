import mongoose, { Document } from 'mongoose';
import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const NotificationType = z.enum(['reorder_nudge', 'offer', 'alert', 'reminder', 'marketing']);
export type NotificationType = z.infer<typeof NotificationType>;

export const NotificationChannel = z.enum(['push', 'sms', 'email', 'in_app']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const ChannelStatus = z.enum(['queued', 'sent', 'delivered', 'failed']);
export type ChannelStatus = z.infer<typeof ChannelStatus>;

// ============================================================================
// Input Schemas (Zod)
// ============================================================================

export const NotificationContentSchema = z.object({
  title: z.string().optional(),
  body: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const SendNotificationInputSchema = z.object({
  userId: z.string(),
  type: NotificationType,
  channels: z.array(NotificationChannel).default(['push']),
  content: NotificationContentSchema,
  data: z.record(z.unknown()).optional(),
});

export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

export const NotificationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  unreadOnly: z.enum(['true', 'false']).optional(),
});

export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;

export const NotificationIdParamSchema = z.object({
  notificationId: z.string(),
});

export const UserIdParamSchema = z.object({
  userId: z.string(),
});

// ============================================================================
// Domain Types
// ============================================================================

export interface ChannelInfo {
  channel: NotificationChannel;
  status: ChannelStatus;
  externalId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

export interface NotificationContent {
  title?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationDocument {
  notificationId: string;
  userId?: string;
  type: NotificationType;
  channels: ChannelInfo[];
  content: NotificationContent;
  createdAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface SendNotificationResponse {
  notificationId: string;
  notifications: ChannelResult[];
}

export interface ChannelResult {
  channel: NotificationChannel;
  status: ChannelStatus;
  id?: string;
}

export interface NotificationStatusResponse {
  notificationId: string;
  userId?: string;
  type: NotificationType;
  channels: ChannelInfo[];
  content: NotificationContent;
  createdAt: Date;
}

// ============================================================================
// MongoDB Document Types
// ============================================================================

export interface INotification extends Document {
  notificationId: string;
  userId?: string;
  type: NotificationType;
  channels: ChannelInfo[];
  content: NotificationContent;
  createdAt: Date;
}

// ============================================================================
// Channel Payload Types
// ============================================================================

export interface ChannelPayload {
  userId: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ChannelResultPayload {
  status: ChannelStatus;
  externalId?: string;
  error?: string;
}

// ============================================================================
// Feedback Types
// ============================================================================

export interface FeedbackPayload {
  nudgeId: string;
  userId: string;
  appId: string;
  event: string;
  metadata?: {
    type?: NotificationType;
    data?: Record<string, unknown>;
  };
}

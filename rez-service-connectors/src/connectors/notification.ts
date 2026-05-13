/**
 * Notification Service Connector
 *
 * Connects to rez-notifications-service (Port 4023) for sending
 * push notifications, SMS, email, and in-app messages.
 */

import { ServiceClient, ClientConfig } from '../utils/client';
import type {
  SendNotificationRequest,
  NotificationResponse,
  NotificationChannel,
  NotificationPriority,
  ServiceResponse,
  PaginationParams,
  PaginatedResponse,
} from '../types';

/**
 * Notification Connector Configuration
 */
interface NotificationConfig extends ClientConfig {
  baseUrl: string;
  internalToken: string;
}

const DEFAULT_CONFIG: Partial<NotificationConfig> = {
  timeout: 30000,
  maxRetries: 3,
};

export interface NotificationRecord {
  notificationId: string;
  userId: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  priority: NotificationPriority;
  readAt?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
}

export interface BulkNotificationRequest {
  notifications: Omit<SendNotificationRequest, 'userId'>[];
  userIds: string[];
}

export interface ScheduledNotificationRequest extends SendNotificationRequest {
  scheduledFor: string;
  timezone?: string;
}

/**
 * Notification Connector
 *
 * Provides methods to interact with the notification service:
 * - Send individual notifications
 * - Send bulk notifications
 * - Schedule notifications
 * - Get notification history
 * - Manage notification preferences
 */
export class NotificationConnector extends ServiceClient {
  private config: NotificationConfig;

  constructor(config: Partial<NotificationConfig> = {}) {
    const notificationUrl = config.baseUrl || process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4023';
    const internalToken = config.internalToken || getInternalToken();

    const mergedConfig: NotificationConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      baseUrl: notificationUrl,
      internalToken,
      serviceName: 'notification-service',
    };

    super(mergedConfig);
    this.config = mergedConfig;
  }

  /**
   * Send a notification
   *
   * Sends a notification to a user via the specified channel.
   *
   * @param request - Notification parameters
   * @returns Created notification details
   */
  async send(request: SendNotificationRequest): Promise<NotificationResponse> {
    return this.safeRequest<NotificationResponse>({
      method: 'POST',
      url: '/api/v1/notifications/send',
      data: {
        userId: request.userId,
        type: request.type,
        channel: request.channel,
        title: request.title,
        body: request.body,
        data: request.data,
        priority: request.priority || 'normal',
        metadata: {
          sentBy: 'orchestrator',
          sentAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Send bulk notifications
   *
   * Sends the same notification to multiple users.
   * More efficient than sending individually.
   *
   * @param request - Bulk notification parameters
   * @returns Bulk send result
   */
  async sendBulk(request: BulkNotificationRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/v1/notifications/send-bulk',
      data: {
        userIds: request.userIds,
        notification: request.notifications[0],
        metadata: {
          sentBy: 'orchestrator',
          sentAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Schedule a notification
   *
   * Schedules a notification to be sent at a future time.
   *
   * @param request - Scheduled notification parameters
   * @returns Scheduled notification details
   */
  async schedule(request: ScheduledNotificationRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'POST',
      url: '/api/v1/notifications/schedule',
      data: {
        userId: request.userId,
        type: request.type,
        channel: request.channel,
        title: request.title,
        body: request.body,
        data: request.data,
        priority: request.priority,
        scheduledFor: request.scheduledFor,
        timezone: request.timezone || 'Asia/Kolkata',
        metadata: {
          scheduledBy: 'orchestrator',
          scheduledAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Cancel a scheduled notification
   *
   * Cancels a notification that was scheduled but not yet sent.
   *
   * @param notificationId - The notification ID
   * @returns Cancellation result
   */
  async cancelScheduled(notificationId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'DELETE',
      url: `/api/v1/notifications/scheduled/${notificationId}`,
    });
  }

  /**
   * Get user notifications
   *
   * Returns notification history for a user.
   *
   * @param userId - The user ID
   * @param params - Pagination and filter parameters
   * @returns Paginated notification list
   */
  async getUserNotifications(
    userId: string,
    params: PaginationParams & { unreadOnly?: boolean } = {}
  ): Promise<PaginatedResponse<NotificationRecord>> {
    return this.safeRequest<PaginatedResponse<NotificationRecord>>({
      method: 'GET',
      url: `/api/v1/notifications/${userId}`,
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        offset: params.offset,
        unreadOnly: params.unreadOnly,
      },
    });
  }

  /**
   * Mark notification as read
   *
   * @param notificationId - The notification ID
   * @returns Updated notification
   */
  async markAsRead(notificationId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'PUT',
      url: `/api/v1/notifications/${notificationId}/read`,
    });
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - The user ID
   * @returns Update result
   */
  async markAllAsRead(userId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'PUT',
      url: `/api/v1/notifications/${userId}/read-all`,
    });
  }

  /**
   * Delete a notification
   *
   * @param notificationId - The notification ID
   * @returns Deletion result
   */
  async delete(notificationId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'DELETE',
      url: `/api/v1/notifications/${notificationId}`,
    });
  }

  /**
   * Get notification preferences
   *
   * Returns user notification preferences.
   *
   * @param userId - The user ID
   * @returns User preferences
   */
  async getPreferences(userId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'GET',
      url: `/api/v1/notifications/preferences/${userId}`,
    });
  }

  /**
   * Update notification preferences
   *
   * @param userId - The user ID
   * @param preferences - New preferences
   * @returns Updated preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Record<string, boolean>
  ): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
      method: 'PUT',
      url: `/api/v1/notifications/preferences/${userId}`,
      data: preferences,
    });
  }

  /**
   * Get unread count
   *
   * Returns the count of unread notifications for a user.
   *
   * @param userId - The user ID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    return this.safeRequest<{ count: number }>({
      method: 'GET',
      url: `/api/v1/notifications/${userId}/unread-count`,
    });
  }

  /**
   * Send push notification
   *
   * Convenience method for push notifications.
   *
   * @param userId - The user ID
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Optional data payload
   * @param priority - Message priority
   * @returns Created notification
   */
  async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
    priority: NotificationPriority = 'normal'
  ): Promise<NotificationResponse> {
    return this.send({
      userId,
      type: 'push',
      channel: 'push',
      title,
      body,
      data,
      priority,
    });
  }

  /**
   * Send email notification
   *
   * Convenience method for email notifications.
   *
   * @param userId - The user ID
   * @param title - Email subject
   * @param body - Email body
   * @param data - Optional data payload
   * @returns Created notification
   */
  async sendEmail(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<NotificationResponse> {
    return this.send({
      userId,
      type: 'email',
      channel: 'email',
      title,
      body,
      data,
      priority: 'normal',
    });
  }

  /**
   * Send SMS notification
   *
   * Convenience method for SMS notifications.
   *
   * @param userId - The user ID
   * @param body - SMS body
   * @param data - Optional data payload
   * @returns Created notification
   */
  async sendSMS(
    userId: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<NotificationResponse> {
    return this.send({
      userId,
      type: 'sms',
      channel: 'sms',
      title: '',
      body,
      data,
      priority: 'normal',
    });
  }

  /**
   * Health check for notification service
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health');
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}

/**
 * Get internal token from environment
 */
function getInternalToken(): string {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    const tokens = JSON.parse(tokensJson);
    return tokens.orchestrator || tokens.notification || '';
  } catch {
    console.warn('[NotificationConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return '';
  }
}

// Singleton instance
let notificationInstance: NotificationConnector | null = null;

export function getNotificationConnector(config?: Partial<NotificationConfig>): NotificationConnector {
  if (!notificationInstance) {
    notificationInstance = new NotificationConnector(config);
  }
  return notificationInstance;
}

export default NotificationConnector;

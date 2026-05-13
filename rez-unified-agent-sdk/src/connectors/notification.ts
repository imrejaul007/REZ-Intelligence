import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  SendNotificationRequest,
  NotificationResult,
  HttpResponse,
} from '../types';

// ============================================================================
// Notification Service Types
// ============================================================================

export interface SendNotificationOptions {
  userId: string;
  template: string;
  channel?: string | string[];
  data?: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationListResult {
  notifications: NotificationResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotificationTemplateInfo {
  name: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  channels: string[];
}

export interface UserPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  frequency: 'realtime' | 'daily' | 'weekly';
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

// ============================================================================
// Notification Connector
// ============================================================================

export class NotificationConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('notification-service', baseUrl, authToken, options);
  }

  /**
   * Send notification
   */
  async send(request: SendNotificationOptions): Promise<NotificationResult> {
    this.logger.info('Sending notification', {
      userId: request.userId,
      template: request.template,
      channel: request.channel,
    });

    const fullRequest: SendNotificationRequest = {
      userId: request.userId,
      template: request.template as SendNotificationRequest['template'],
      channel: Array.isArray(request.channel)
        ? (request.channel as SendNotificationRequest['channel'])
        : (request.channel as SendNotificationRequest['channel']) || 'email',
      data: request.data || {},
      priority: request.priority || 'normal',
      scheduledAt: request.scheduledAt,
      metadata: request.metadata,
    };

    const response = await this.post<NotificationResult>('/notifications', fullRequest);
    this.logger.info('Notification sent', {
      notificationId: response.data.notificationId,
      userId: request.userId,
    });
    return response.data;
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(
    notifications: SendNotificationOptions[],
  ): Promise<{
    results: NotificationResult[];
    successful: number;
    failed: number;
    failedNotifications: { index: number; error: string }[];
  }> {
    this.logger.info('Sending bulk notifications', {
      count: notifications.length,
    });

    const response = await this.post<{
      results: NotificationResult[];
      successful: number;
      failed: number;
      failedNotifications: { index: number; error: string }[];
    }>('/notifications/bulk', { notifications });
    this.logger.info('Bulk notifications sent', {
      successful: response.data.successful,
      failed: response.data.failed,
    });
    return response.data;
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<NotificationResult> {
    this.logger.debug('Getting notification', { notificationId });

    const response = await this.get<NotificationResult>(`/notifications/${notificationId}`);
    return response.data;
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
      channel?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<NotificationListResult> {
    this.logger.debug('Getting user notifications', { userId, options });

    const params: Record<string, string> = {};

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.channel) params.channel = options.channel;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;

    const response = await this.get<NotificationListResult>(
      `/notifications/user/${userId}`,
      params,
    );
    return response.data;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    this.logger.debug('Getting unread notification count', { userId });

    const response = await this.get<{ count: number }>(
      `/notifications/user/${userId}/unread-count`,
    );
    return response.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<NotificationResult> {
    this.logger.debug('Marking notification as read', { notificationId });

    const response = await this.post<NotificationResult>(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<{ markedCount: number }> {
    this.logger.debug('Marking all notifications as read', { userId });

    const response = await this.post<{ markedCount: number }>(
      `/notifications/user/${userId}/read-all`,
    );
    return response.data;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    this.logger.debug('Deleting notification', { notificationId });

    await this.delete(`/notifications/${notificationId}`);
  }

  /**
   * Get available templates
   */
  async getTemplates(): Promise<NotificationTemplateInfo[]> {
    this.logger.debug('Getting notification templates');

    const response = await this.get<NotificationTemplateInfo[]>('/templates');
    return response.data;
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string): Promise<NotificationTemplateInfo> {
    this.logger.debug('Getting notification template', { templateName });

    const response = await this.get<NotificationTemplateInfo>(`/templates/${templateName}`);
    return response.data;
  }

  /**
   * Preview notification with template
   */
  async previewNotification(
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<{ preview: string; subject?: string }> {
    this.logger.debug('Previewing notification', { templateName });

    const response = await this.post<{ preview: string; subject?: string }>(
      '/notifications/preview',
      { templateName, data },
    );
    return response.data;
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    this.logger.debug('Getting user notification preferences', { userId });

    const response = await this.get<UserPreferences>(`/preferences/${userId}`);
    return response.data;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    this.logger.info('Updating user notification preferences', { userId });

    const response = await this.put<UserPreferences>(`/preferences/${userId}`, preferences);
    return response.data;
  }

  /**
   * Send OTP
   */
  async sendOTP(
    userId: string,
    phone?: string,
    email?: string,
    channel: 'sms' | 'email' = 'sms',
    purpose: 'verification' | 'login' | 'transaction' = 'verification',
  ): Promise<{ otpId: string; expiresAt: string }> {
    this.logger.info('Sending OTP', { userId, channel, purpose });

    const response = await this.post<{ otpId: string; expiresAt: string }>('/otp/send', {
      userId,
      phone,
      email,
      channel,
      purpose,
    });
    return response.data;
  }

  /**
   * Verify OTP
   */
  async verifyOTP(
    otpId: string,
    otp: string,
  ): Promise<{ valid: boolean; attemptsRemaining?: number }> {
    this.logger.debug('Verifying OTP', { otpId });

    const response = await this.post<{ valid: boolean; attemptsRemaining?: number }>(
      '/otp/verify',
      { otpId, otp },
    );
    return response.data;
  }

  /**
   * Cancel scheduled notification
   */
  async cancelScheduled(notificationId: string): Promise<void> {
    this.logger.info('Cancelling scheduled notification', { notificationId });

    await this.post(`/notifications/${notificationId}/cancel`);
  }

  /**
   * Retry failed notification
   */
  async retryFailed(notificationId: string): Promise<NotificationResult> {
    this.logger.info('Retrying failed notification', { notificationId });

    const response = await this.post<NotificationResult>(
      `/notifications/${notificationId}/retry`,
    );
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createNotificationConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): NotificationConnector {
  return new NotificationConnector(baseUrl, authToken, options);
}

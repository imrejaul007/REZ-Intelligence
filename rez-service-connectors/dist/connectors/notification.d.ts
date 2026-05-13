/**
 * Notification Service Connector
 *
 * Connects to rez-notifications-service (Port 4023) for sending
 * push notifications, SMS, email, and in-app messages.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { SendNotificationRequest, NotificationResponse, NotificationChannel, NotificationPriority, ServiceResponse, PaginationParams, PaginatedResponse } from '../types';
/**
 * Notification Connector Configuration
 */
interface NotificationConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
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
export declare class NotificationConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<NotificationConfig>);
    /**
     * Send a notification
     *
     * Sends a notification to a user via the specified channel.
     *
     * @param request - Notification parameters
     * @returns Created notification details
     */
    send(request: SendNotificationRequest): Promise<NotificationResponse>;
    /**
     * Send bulk notifications
     *
     * Sends the same notification to multiple users.
     * More efficient than sending individually.
     *
     * @param request - Bulk notification parameters
     * @returns Bulk send result
     */
    sendBulk(request: BulkNotificationRequest): Promise<ServiceResponse>;
    /**
     * Schedule a notification
     *
     * Schedules a notification to be sent at a future time.
     *
     * @param request - Scheduled notification parameters
     * @returns Scheduled notification details
     */
    schedule(request: ScheduledNotificationRequest): Promise<ServiceResponse>;
    /**
     * Cancel a scheduled notification
     *
     * Cancels a notification that was scheduled but not yet sent.
     *
     * @param notificationId - The notification ID
     * @returns Cancellation result
     */
    cancelScheduled(notificationId: string): Promise<ServiceResponse>;
    /**
     * Get user notifications
     *
     * Returns notification history for a user.
     *
     * @param userId - The user ID
     * @param params - Pagination and filter parameters
     * @returns Paginated notification list
     */
    getUserNotifications(userId: string, params?: PaginationParams & {
        unreadOnly?: boolean;
    }): Promise<PaginatedResponse<NotificationRecord>>;
    /**
     * Mark notification as read
     *
     * @param notificationId - The notification ID
     * @returns Updated notification
     */
    markAsRead(notificationId: string): Promise<ServiceResponse>;
    /**
     * Mark all notifications as read for a user
     *
     * @param userId - The user ID
     * @returns Update result
     */
    markAllAsRead(userId: string): Promise<ServiceResponse>;
    /**
     * Delete a notification
     *
     * @param notificationId - The notification ID
     * @returns Deletion result
     */
    delete(notificationId: string): Promise<ServiceResponse>;
    /**
     * Get notification preferences
     *
     * Returns user notification preferences.
     *
     * @param userId - The user ID
     * @returns User preferences
     */
    getPreferences(userId: string): Promise<ServiceResponse>;
    /**
     * Update notification preferences
     *
     * @param userId - The user ID
     * @param preferences - New preferences
     * @returns Updated preferences
     */
    updatePreferences(userId: string, preferences: Record<string, boolean>): Promise<ServiceResponse>;
    /**
     * Get unread count
     *
     * Returns the count of unread notifications for a user.
     *
     * @param userId - The user ID
     * @returns Unread count
     */
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
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
    sendPush(userId: string, title: string, body: string, data?: Record<string, unknown>, priority?: NotificationPriority): Promise<NotificationResponse>;
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
    sendEmail(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<NotificationResponse>;
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
    sendSMS(userId: string, body: string, data?: Record<string, unknown>): Promise<NotificationResponse>;
    /**
     * Health check for notification service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getNotificationConnector(config?: Partial<NotificationConfig>): NotificationConnector;
export default NotificationConnector;
//# sourceMappingURL=notification.d.ts.map
import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, NotificationResult } from '../types';
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
export declare class NotificationConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Send notification
     */
    send(request: SendNotificationOptions): Promise<NotificationResult>;
    /**
     * Send bulk notifications
     */
    sendBulk(notifications: SendNotificationOptions[]): Promise<{
        results: NotificationResult[];
        successful: number;
        failed: number;
        failedNotifications: {
            index: number;
            error: string;
        }[];
    }>;
    /**
     * Get notification by ID
     */
    getNotification(notificationId: string): Promise<NotificationResult>;
    /**
     * Get notifications for a user
     */
    getUserNotifications(userId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        channel?: string;
        fromDate?: string;
        toDate?: string;
    }): Promise<NotificationListResult>;
    /**
     * Get unread notification count
     */
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    /**
     * Mark notification as read
     */
    markAsRead(notificationId: string): Promise<NotificationResult>;
    /**
     * Mark all notifications as read for user
     */
    markAllAsRead(userId: string): Promise<{
        markedCount: number;
    }>;
    /**
     * Delete notification
     */
    deleteNotification(notificationId: string): Promise<void>;
    /**
     * Get available templates
     */
    getTemplates(): Promise<NotificationTemplateInfo[]>;
    /**
     * Get template by name
     */
    getTemplate(templateName: string): Promise<NotificationTemplateInfo>;
    /**
     * Preview notification with template
     */
    previewNotification(templateName: string, data: Record<string, unknown>): Promise<{
        preview: string;
        subject?: string;
    }>;
    /**
     * Get user notification preferences
     */
    getUserPreferences(userId: string): Promise<UserPreferences>;
    /**
     * Update user notification preferences
     */
    updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
    /**
     * Send OTP
     */
    sendOTP(userId: string, phone?: string, email?: string, channel?: 'sms' | 'email', purpose?: 'verification' | 'login' | 'transaction'): Promise<{
        otpId: string;
        expiresAt: string;
    }>;
    /**
     * Verify OTP
     */
    verifyOTP(otpId: string, otp: string): Promise<{
        valid: boolean;
        attemptsRemaining?: number;
    }>;
    /**
     * Cancel scheduled notification
     */
    cancelScheduled(notificationId: string): Promise<void>;
    /**
     * Retry failed notification
     */
    retryFailed(notificationId: string): Promise<NotificationResult>;
}
export declare function createNotificationConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): NotificationConnector;
//# sourceMappingURL=notification.d.ts.map
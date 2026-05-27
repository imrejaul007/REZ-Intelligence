import * as admin from 'firebase-admin';
import { getMessaging } from '../config/firebase';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android';
  createdAt: Date;
  updatedAt: Date;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  clickAction?: string;
}

export class PushService {
  private deviceTokens: Map<string, DeviceToken[]> = new Map();

  /**
   * Send push notification to a specific user
   */
  async sendPush(userId: string, title: string, body: string, data?: object): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Push notification skipped: Firebase not configured', { userId });
      return;
    }

    const tokens = this.deviceTokens.get(userId) || [];

    if (tokens.length === 0) {
      logger.debug('No device tokens found for user', { userId });
      return;
    }

    const payload: PushPayload = {
      title,
      body,
      data: data as Record<string, string>,
      sound: 'default',
    };

    try {
      // Send to all user's devices
      const tokenStrings = tokens.map(t => t.token);

      const message: admin.messaging.MulticastMessage = {
        tokens: tokenStrings,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        webpush: {
          fcmOptions: {
            link: payload.data?.link as string || `${process.env.APP_DEEP_LINK || 'rez://app'}`,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || 'default',
              badge: payload.badge || 1,
            },
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);

      // Log results
      logger.info('Push notification sent', {
        userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      // Handle failures - remove invalid tokens
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          const error = resp.error;
          if (error?.code === 'messaging/registration-token-not-registered' ||
              error?.code === 'messaging/invalid-argument') {
            const invalidToken = tokens[index];
            this.removeDeviceToken(userId, invalidToken.token);
            logger.warn('Removed invalid device token', { userId, token: invalidToken.token });
          }
        }
      });
    } catch (error) {
      logger.error('Failed to send push notification', { userId, error });
      throw error;
    }
  }

  /**
   * Subscribe a user to a Firebase Cloud Messaging topic
   */
  async subscribeToTopic(userId: string, topic: string): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Topic subscription skipped: Firebase not configured', { userId, topic });
      return;
    }

    const tokens = this.deviceTokens.get(userId) || [];

    if (tokens.length === 0) {
      logger.warn('Cannot subscribe to topic: no device tokens found', { userId, topic });
      return;
    }

    try {
      const tokenStrings = tokens.map(t => t.token);
      await messaging.subscribeToTopic(tokenStrings, topic);

      logger.info('User subscribed to topic', { userId, topic, tokenCount: tokens.length });
    } catch (error) {
      logger.error('Failed to subscribe to topic', { userId, topic, error });
      throw error;
    }
  }

  /**
   * Unsubscribe a user from a Firebase Cloud Messaging topic
   */
  async unsubscribeFromTopic(userId: string, topic: string): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Topic unsubscription skipped: Firebase not configured', { userId, topic });
      return;
    }

    const tokens = this.deviceTokens.get(userId) || [];

    if (tokens.length === 0) {
      logger.warn('Cannot unsubscribe from topic: no device tokens found', { userId, topic });
      return;
    }

    try {
      const tokenStrings = tokens.map(t => t.token);
      await messaging.unsubscribeFromTopic(tokenStrings, topic);

      logger.info('User unsubscribed from topic', { userId, topic, tokenCount: tokens.length });
    } catch (error) {
      logger.error('Failed to unsubscribe from topic', { userId, topic, error });
      throw error;
    }
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android'
  ): Promise<void> {
    const existingTokens = this.deviceTokens.get(userId) || [];

    // Check if token already exists
    const existingIndex = existingTokens.findIndex(t => t.token === token);

    if (existingIndex >= 0) {
      // Update existing token
      existingTokens[existingIndex].updatedAt = new Date();
      logger.debug('Updated existing device token', { userId, platform });
    } else {
      // Add new token
      const newToken: DeviceToken = {
        userId,
        token,
        platform,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      existingTokens.push(newToken);
      logger.info('Registered new device token', { userId, platform });
    }

    this.deviceTokens.set(userId, existingTokens);
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    const tokens = this.deviceTokens.get(userId) || [];
    const filteredTokens = tokens.filter(t => t.token !== token);

    if (filteredTokens.length === 0) {
      this.deviceTokens.delete(userId);
    } else {
      this.deviceTokens.set(userId, filteredTokens);
    }

    logger.info('Removed device token', { userId });
  }

  /**
   * Send notification to a topic (e.g., all users, a specific group)
   */
  async sendToTopic(topic: string, title: string, body: string, data?: object): Promise<void> {
    const messaging = getMessaging();

    if (!messaging) {
      logger.warn('Topic notification skipped: Firebase not configured', { topic });
      return;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title,
          body,
        },
        data: data as Record<string, string>,
        webpush: {
          fcmOptions: {
            link: (data as Record<string, string>)?.link || `${process.env.APP_DEEP_LINK || 'rez://app'}`,
          },
        },
      };

      await messaging.send(message);
      logger.info('Notification sent to topic', { topic, title });
    } catch (error) {
      logger.error('Failed to send topic notification', { topic, error });
      throw error;
    }
  }
}

export const pushService = new PushService();

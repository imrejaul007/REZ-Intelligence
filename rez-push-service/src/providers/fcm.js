const admin = require('firebase-admin');
const BaseProvider = require('./base');
const logger = require('../utils/logger');

class FCMProvider extends BaseProvider {
  constructor(config) {
    super('fcm', config);
    this.app = null;
  }

  async _init() {
    if (!this.config.projectId || !this.config.privateKey || !this.config.clientEmail) {
      logger.warn('FCM: Missing configuration, provider will be disabled');
      return;
    }

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.projectId,
          privateKey: this.config.privateKey,
          clientEmail: this.config.clientEmail,
        }),
      });
      logger.info('FCM provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FCM provider:', error);
      throw error;
    }
  }

  async send(notification, user, content) {
    if (!this.app) {
      return this.formatResult(false, null, { message: 'FCM provider not initialized' });
    }

    const activeDevice = user.devices.find(d => d.isActive && d.fcmToken);
    if (!activeDevice) {
      return this.formatResult(false, null, { message: 'No active FCM token found' });
    }

    const { title, body, image, icon, clickAction, data } = content;

    const message = {
      token: activeDevice.fcmToken,
      notification: {
        title: title || 'ReZ App',
        body: body,
      },
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          icon: icon || 'ic_notification',
          color: '#FF6B35',
          imageUrl: image,
          clickAction: clickAction || 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      data: {
        notificationId: notification.notificationId,
        category: notification.category,
        ...(data || {}),
      },
    };

    if (image) {
      message.android.notification.imageUrl = image;
    }

    if (clickAction) {
      message.android.notification.clickAction = clickAction;
    }

    try {
      const response = await admin.messaging().send(message);
      logger.info(`FCM: Message sent successfully to user ${user.userId}`, {
        messageId: response,
        notificationId: notification.notificationId,
      });
      return this.formatResult(true, response);
    } catch (error) {
      logger.error(`FCM: Failed to send message to user ${user.userId}:`, error);

      if (error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-argument') {
        activeDevice.isActive = false;
        activeDevice.fcmToken = null;
        await user.save();
      }

      return this.formatResult(false, null, error);
    }
  }

  async sendMultiple(notification, users, content) {
    if (!this.app) {
      return this.formatResult(false, null, { message: 'FCM provider not initialized' });
    }

    const tokens = users
      .flatMap(user => user.devices)
      .filter(d => d.isActive && d.fcmToken)
      .map(d => d.fcmToken);

    if (tokens.length === 0) {
      return this.formatResult(false, null, { message: 'No valid FCM tokens found' });
    }

    const { title, body, image, data } = content;

    const message = {
      tokens,
      notification: {
        title: title || 'ReZ App',
        body: body,
      },
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          color: '#FF6B35',
          imageUrl: image,
        },
      },
      data: {
        notificationId: notification.notificationId,
        category: notification.category,
        ...(data || {}),
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`FCM: Multicast sent to ${tokens.length} tokens`, {
        successCount: response.successCount,
        failureCount: response.failureCount,
        notificationId: notification.notificationId,
      });
      return this.formatResult(true, response.responses);
    } catch (error) {
      logger.error('FCM: Failed to send multicast:', error);
      return this.formatResult(false, null, error);
    }
  }

  async validateConfig() {
    return !!(this.config.projectId && this.config.privateKey && this.config.clientEmail);
  }

  async shutdown() {
    if (this.app) {
      admin.deleteApp(this.app);
      this.app = null;
      this.isInitialized = false;
    }
  }
}

const fcmProvider = new FCMProvider(require('../config').fcm);

module.exports = fcmProvider;

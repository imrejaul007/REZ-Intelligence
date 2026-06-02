const BaseProvider = require('./base');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class InAppProvider extends BaseProvider {
  constructor(config) {
    super('inapp', config);
    this.subscribers = new Map();
  }

  async _init() {
    logger.info('InApp provider initialized successfully');
    this.isInitialized = true;
  }

  async send(notification, user, content) {
    const { title, body, image, actionUrl, actionText, duration, position } = content;

    const inAppNotification = {
      notificationId: notification.notificationId,
      userId: user.userId,
      category: notification.category,
      title: title || 'ReZ App',
      body,
      image,
      actionUrl,
      actionText,
      duration: duration || 5000,
      position: position || 'top',
      read: false,
      createdAt: new Date(),
      expiresAt: notification.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    try {
      await Notification.findOneAndUpdate(
        {
          notificationId: notification.notificationId,
          userId: user.userId,
        },
        {
          $set: {
            'content.inapp': inAppNotification,
            'channelStatuses.inapp': {
              status: 'sent',
              attempts: 1,
              lastAttemptAt: new Date(),
            },
          },
        },
        { upsert: true }
      );

      this.notifySubscriber(user.userId, inAppNotification);

      logger.info(`InApp: Notification stored for user ${user.userId}`, {
        notificationId: notification.notificationId,
      });

      return this.formatResult(true, notification.notificationId);
    } catch (error) {
      logger.error(`InApp: Failed to store notification for user ${user.userId}:`, error);
      return this.formatResult(false, null, error);
    }
  }

  subscribe(userId, callback) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId).add(callback);

    return () => {
      const userSubs = this.subscribers.get(userId);
      if (userSubs) {
        userSubs.delete(callback);
        if (userSubs.size === 0) {
          this.subscribers.delete(userId);
        }
      }
    };
  }

  notifySubscriber(userId, notification) {
    const userSubs = this.subscribers.get(userId);
    if (userSubs) {
      for (const callback of userSubs) {
        try {
          callback(notification);
        } catch (error) {
          logger.error(`InApp: Error notifying subscriber for user ${userId}:`, error);
        }
      }
    }
  }

  async getUnreadNotifications(userId, limit = 50) {
    try {
      const notifications = await Notification.find({
        userId,
        'content.inapp': { $exists: true },
        'channelStatuses.inapp.status': { $in: ['sent', 'delivered'] },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return notifications
        .filter(n => n.content?.inapp && !n.content.inapp.read)
        .map(n => ({
          notificationId: n.notificationId,
          title: n.content.inapp.title,
          body: n.content.inapp.body,
          image: n.content.inapp.image,
          actionUrl: n.content.inapp.actionUrl,
          actionText: n.content.inapp.actionText,
          position: n.content.inapp.position,
          createdAt: n.createdAt,
        }));
    } catch (error) {
      logger.error(`InApp: Failed to get unread notifications for user ${userId}:`, error);
      return [];
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await Notification.updateOne(
        {
          notificationId,
          userId,
          'content.inapp': { $exists: true },
        },
        {
          $set: {
            'content.inapp.read': true,
            readAt: new Date(),
          },
        }
      );

      return true;
    } catch (error) {
      logger.error(`InApp: Failed to mark notification ${notificationId} as read:`, error);
      return false;
    }
  }

  async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        {
          userId,
          'content.inapp': { $exists: true },
          'content.inapp.read': { $ne: true },
        },
        {
          $set: {
            'content.inapp.read': true,
            readAt: new Date(),
          },
        }
      );

      return true;
    } catch (error) {
      logger.error(`InApp: Failed to mark all notifications as read for user ${userId}:`, error);
      return false;
    }
  }

  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        userId,
        'content.inapp': { $exists: true },
        'content.inapp.read': { $ne: true },
        'channelStatuses.inapp.status': { $in: ['sent', 'delivered'] },
      });
    } catch (error) {
      logger.error(`InApp: Failed to get unread count for user ${userId}:`, error);
      return 0;
    }
  }

  async validateConfig() {
    return true;
  }

  async shutdown() {
    this.subscribers.clear();
    this.isInitialized = false;
  }
}

const inAppProvider = new InAppProvider({});

module.exports = inAppProvider;

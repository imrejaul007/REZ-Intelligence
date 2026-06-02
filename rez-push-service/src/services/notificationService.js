const { v4: uuidv4 } = require('uuid');
const { User, Notification, Template } = require('../models');
const { getProvider, getAllProviders } = require('../providers');
const templateEngine = require('./templateEngine');
const preferenceService = require('./preferenceService');
const { rateLimiter, deduplicator, queueManager } = require('../queue');
const logger = require('../utils/logger');

class NotificationService {
  async sendToUser(userId, options) {
    const {
      templateId,
      category,
      channels = ['fcm'],
      data = {},
      variables = {},
      priority = 'normal',
      scheduledFor = null,
      idempotencyKey = null,
      metadata = {},
    } = options;

    let template = null;
    if (templateId) {
      template = await templateEngine.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
    }

    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (idempotencyKey) {
      const isDuplicate = await deduplicator.isDuplicate(idempotencyKey);
      if (isDuplicate) {
        logger.info(`Duplicate notification skipped: ${idempotencyKey}`);
        return { status: 'deduplicated', notificationId: idempotencyKey };
      }
    }

    const notificationId = `notif_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const enabledChannels = template?.channels || channels;
    const targetChannels = enabledChannels.filter(channel =>
      user.isReachableByChannel(channel)
    );

    if (targetChannels.length === 0) {
      throw new Error('No reachable channels for user');
    }

    const notification = new Notification({
      notificationId,
      userId,
      templateId,
      templateVariantId: template?.selectRandomVariant()?.variantId,
      category: category || template?.category || 'system',
      channels: targetChannels,
      channelsAttempted: [],
      status: scheduledFor ? 'pending' : 'queued',
      priority,
      data,
      variables,
      scheduledFor,
      idempotencyKey,
      metadata,
      maxRetries: 3,
    });

    await notification.save();

    if (scheduledFor) {
      return {
        status: 'scheduled',
        notificationId,
        scheduledFor,
        channels: targetChannels,
      };
    }

    await this.processNotification(notification, user, template, variables);

    return {
      status: notification.status,
      notificationId,
      channels: notification.channels,
      channelStatuses: Object.fromEntries(notification.channelStatuses),
    };
  }

  async processNotification(notification, user, template, variables = {}) {
    notification.status = 'processing';
    notification.sentAt = new Date();
    await notification.save();

    const results = [];

    for (const channel of notification.channels) {
      const result = await this.sendViaChannel(
        notification,
        user,
        channel,
        template,
        variables
      );
      results.push(result);
    }

    notification.updateOverallStatus();
    await notification.save();

    return results;
  }

  async sendViaChannel(notification, user, channel, template, variables) {
    const provider = getProvider(channel);
    if (!provider?.isInitialized) {
      notification.markChannelFailed(channel, 'PROVIDER_DISABLED', 'Channel provider not available');
      await notification.save();
      return { channel, success: false, error: 'Provider not available' };
    }

    const prefCheck = await preferenceService.canSendNotification(
      notification.userId,
      notification.category,
      channel
    );

    if (!prefCheck.allowed) {
      notification.markChannelFailed(channel, prefCheck.reason.toUpperCase(), prefCheck.reason);
      await notification.save();
      return { channel, success: false, error: prefCheck.reason };
    }

    const rateCheck = await rateLimiter.checkUserLimit(notification.userId, channel);
    if (!rateCheck.allowed) {
      notification.setChannelStatus(channel, 'rate_limited', {
        errorCode: 'RATE_LIMITED',
        errorMessage: `Rate limit exceeded. Retry after ${new Date(rateCheck.resetAt).toISOString()}`,
      });
      await notification.save();
      return { channel, success: false, error: 'rate_limited' };
    }

    const content = templateEngine.renderForChannel(template, user, channel, {
      ...variables,
      ...Object.fromEntries(notification.variables || new Map()),
    });

    if (!content) {
      notification.markChannelFailed(channel, 'NO_CONTENT', 'No content available for channel');
      await notification.save();
      return { channel, success: false, error: 'No content' };
    }

    try {
      const result = await provider.send(notification, user, content);

      if (result.success) {
        notification.markChannelSent(channel, result.messageId);
        await rateLimiter.recordUserSent(notification.userId, channel);
        await rateLimiter.recordChannelSent(channel);
      } else {
        const error = result.error || {};
        notification.markChannelFailed(channel, error.code || 'SEND_FAILED', error.message);

        if (error.retryable && notification.retryCount < notification.maxRetries) {
          await queueManager.addRetryJob({
            notificationId: notification.notificationId,
            channel,
            userId: notification.userId,
            templateId: notification.templateId,
            category: notification.category,
            data: notification.data,
            variables: variables,
            retryCount: notification.retryCount + 1,
            handler: async (jobData) => {
              const notif = await Notification.findOne({ notificationId: jobData.notificationId });
              const usr = await User.findOne({ userId: jobData.userId });
              const tmpl = await Template.findOne({ templateId: jobData.templateId });
              if (notif && usr) {
                await this.sendViaChannel(notif, usr, jobData.channel, tmpl, jobData.variables);
              }
            },
          });
        }
      }

      await notification.save();
      return { channel, ...result };
    } catch (error) {
      logger.error(`Error sending via ${channel}:`, error);
      notification.markChannelFailed(channel, 'EXCEPTION', error.message);
      await notification.save();
      return { channel, success: false, error: error.message };
    }
  }

  async broadcast(options) {
    const {
      templateId,
      category,
      channels = ['fcm'],
      data = {},
      variables = {},
      priority = 'normal',
      scheduledFor = null,
      filters = {},
      metadata = {},
    } = options;

    const broadcastId = `broadcast_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const query = { status: 'active' };
    if (filters.status) query.status = filters.status;

    const users = await User.find(query).lean();
    const totalUsers = users.length;

    logger.info(`Starting broadcast ${broadcastId} to ${totalUsers} users`);

    const jobs = users.map(user => ({
      data: {
        userId: user.userId,
        templateId,
        category,
        channels,
        data,
        variables,
        priority,
        broadcastId,
        metadata,
        handler: async (jobData) => {
          try {
            const result = await this.sendToUser(jobData.userId, {
              templateId: jobData.templateId,
              category: jobData.category,
              channels: jobData.channels,
              data: jobData.data,
              variables: jobData.variables,
              priority: jobData.priority,
              metadata: { ...jobData.metadata, broadcastId: jobData.broadcastId },
            });
            return result;
          } catch (error) {
            logger.error(`Broadcast error for user ${jobData.userId}:`, error);
            throw error;
          }
        },
      },
    }));

    if (scheduledFor) {
      return {
        status: 'scheduled',
        broadcastId,
        scheduledFor,
        totalUsers,
      };
    }

    const chunks = this.chunkArray(jobs, 100);
    for (const chunk of chunks) {
      await queueManager.addBulkNotificationJobs(chunk);
    }

    return {
      status: 'queued',
      broadcastId,
      totalUsers,
      queuedJobs: jobs.length,
    };
  }

  async sendToSegment(segmentId, options) {
    const {
      templateId,
      category,
      channels = ['fcm'],
      data = {},
      variables = {},
      priority = 'normal',
      scheduledFor = null,
      segmentQuery = {},
      metadata = {},
    } = options;

    const batchId = `segment_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const users = await User.find(segmentQuery).lean();
    const totalUsers = users.length;

    logger.info(`Sending to segment ${segmentId} with ${totalUsers} users`);

    const jobs = users.map(user => ({
      data: {
        userId: user.userId,
        templateId,
        category,
        channels,
        data,
        variables,
        priority,
        batchId,
        segmentId,
        metadata,
        handler: async (jobData) => {
          try {
            const result = await this.sendToUser(jobData.userId, {
              templateId: jobData.templateId,
              category: jobData.category,
              channels: jobData.channels,
              data: jobData.data,
              variables: jobData.variables,
              priority: jobData.priority,
              metadata: { ...jobData.metadata, segmentId: jobData.segmentId },
            });
            return result;
          } catch (error) {
            logger.error(`Segment send error for user ${jobData.userId}:`, error);
            throw error;
          }
        },
      },
    }));

    if (scheduledFor) {
      return {
        status: 'scheduled',
        segmentId,
        batchId,
        scheduledFor,
        totalUsers,
      };
    }

    const chunks = this.chunkArray(jobs, 100);
    for (const chunk of chunks) {
      await queueManager.addBulkNotificationJobs(chunk);
    }

    return {
      status: 'queued',
      segmentId,
      batchId,
      totalUsers,
      queuedJobs: jobs.length,
    };
  }

  async getNotificationStatus(notificationId) {
    const notification = await Notification.findOne({ notificationId }).lean();
    if (!notification) {
      return null;
    }

    return {
      notificationId: notification.notificationId,
      userId: notification.userId,
      category: notification.category,
      channels: notification.channels,
      channelStatuses: Object.fromEntries(notification.channelStatuses),
      status: notification.status,
      createdAt: notification.createdAt,
      sentAt: notification.sentAt,
      deliveredAt: notification.deliveredAt,
      readAt: notification.readAt,
    };
  }

  async getUserNotifications(userId, options = {}) {
    const { limit = 50, skip = 0, category = null, status = null } = options;

    const query = { userId };
    if (category) query.category = category;
    if (status) query.status = status;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return notifications.map(n => ({
      notificationId: n.notificationId,
      category: n.category,
      channels: n.channels,
      status: n.status,
      createdAt: n.createdAt,
      sentAt: n.sentAt,
    }));
  }

  async markAsDelivered(notificationId, channel = null) {
    const notification = await Notification.findOne({ notificationId });
    if (!notification) return null;

    if (channel) {
      notification.setChannelStatus(channel, 'delivered');
      notification.deliveryLogs.push({
        channel,
        status: 'delivered',
        deliveredAt: new Date(),
      });
    } else {
      notification.status = 'delivered';
      notification.deliveredAt = new Date();
    }

    await notification.save();
    return notification;
  }

  async markAsRead(notificationId) {
    const notification = await Notification.findOneAndUpdate(
      { notificationId },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
        },
      },
      { new: true }
    );
    return notification;
  }

  async getStats(options = {}) {
    const { startDate = null, endDate = null, category = null } = options;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    if (category) matchStage.category = category;

    const stats = await Notification.aggregate([
      { $match: matchStage },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                sent: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['sent', 'delivered', 'read']] },
                      1,
                      0,
                    ],
                  },
                },
                delivered: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['delivered', 'read']] },
                      1,
                      0,
                    ],
                  },
                },
                read: {
                  $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] },
                },
                failed: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
                  },
                },
              },
            },
          ],
          byChannel: [
            { $unwind: '$channels' },
            {
              $group: {
                _id: '$channels',
                total: { $sum: 1 },
                sent: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $ifNull: [{ $getField: { field: 'status', input: { $objectToArray: '$channelStatuses' } } }, 'pending'] },
                          ['sent', 'delivered', 'read'],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                failed: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          { $ifNull: [{ $getField: { field: 'status', input: { $objectToArray: '$channelStatuses' } } }, 'pending'] },
                          'failed',
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: '$category',
                total: { $sum: 1 },
                sent: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['sent', 'delivered', 'read']] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byDay: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                total: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
          ],
        },
      },
    ]);

    return {
      overall: stats[0].overall[0] || {
        total: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      },
      byChannel: stats[0].byChannel,
      byCategory: stats[0].byCategory,
      byDay: stats[0].byDay,
    };
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;

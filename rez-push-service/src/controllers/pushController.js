const { notificationService } = require('../services');
const logger = require('../utils/logger');

class PushController {
  async send(req, res) {
    try {
      const result = await notificationService.sendToUser(req.userId, req.validatedBody);

      logger.info(`Push notification sent to user ${req.userId}`, {
        notificationId: result.notificationId,
        status: result.status,
      });

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error sending push notification:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('No reachable channels')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send notification',
        message: error.message,
      });
    }
  }

  async broadcast(req, res) {
    try {
      const result = await notificationService.broadcast(req.validatedBody);

      logger.info(`Broadcast started`, {
        broadcastId: result.broadcastId,
        totalUsers: result.totalUsers,
      });

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error starting broadcast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start broadcast',
        message: error.message,
      });
    }
  }

  async sendToSegment(req, res) {
    try {
      const { segmentId, ...options } = req.validatedBody;
      const result = await notificationService.sendToSegment(segmentId, options);

      logger.info(`Segment notification started`, {
        segmentId,
        batchId: result.batchId,
        totalUsers: result.totalUsers,
      });

      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error sending to segment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send to segment',
        message: error.message,
      });
    }
  }

  async getNotificationStatus(req, res) {
    try {
      const { notificationId } = req.params;
      const status = await notificationService.getNotificationStatus(notificationId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error getting notification status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notification status',
      });
    }
  }

  async getUserNotifications(req, res) {
    try {
      const { userId } = req.params;
      const { limit, skip, category, status } = req.validatedQuery;

      const notifications = await notificationService.getUserNotifications(userId, {
        limit: parseInt(limit) || 50,
        skip: parseInt(skip) || 0,
        category,
        status,
      });

      res.json({
        success: true,
        data: notifications,
        count: notifications.length,
      });
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications',
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await notificationService.markAsRead(notificationId);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      res.json({
        success: true,
        data: { notificationId, read: true },
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark as read',
      });
    }
  }
}

const pushController = new PushController();

module.exports = pushController;

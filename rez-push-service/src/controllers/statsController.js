const { notificationService } = require('../services');
const { queueManager } = require('../queue');
const { rateLimiter, deduplicator } = require('../queue');
const { getAllProviders } = require('../providers');
const logger = require('../utils/logger');

class StatsController {
  async getStats(req, res) {
    try {
      const { startDate, endDate, category } = req.validatedQuery || req.query;

      const stats = await notificationService.getStats({
        startDate,
        endDate,
        category,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  }

  async getQueueStats(req, res) {
    try {
      const queueStats = await queueManager.getQueueStats();

      res.json({
        success: true,
        data: queueStats,
      });
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue stats',
      });
    }
  }

  async getProviderStats(req, res) {
    try {
      const providers = getAllProviders();
      const stats = {};

      for (const [name, provider] of Object.entries(providers)) {
        stats[name] = {
          initialized: provider.isInitialized,
          channel: provider.channel,
        };
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting provider stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get provider stats',
      });
    }
  }

  async getRateLimitStats(req, res) {
    try {
      const { userId } = req.query;

      let userStats = null;
      if (userId) {
        userStats = await rateLimiter.getUserStats(userId);
      }

      res.json({
        success: true,
        data: {
          user: userStats,
          defaults: {
            perUser: 10,
            perChannel: 50,
            windowMs: 60000,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting rate limit stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit stats',
      });
    }
  }

  async getDeduplicationStats(req, res) {
    try {
      const stats = await deduplicator.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting deduplication stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get deduplication stats',
      });
    }
  }

  async getHealth(req, res) {
    try {
      const providers = getAllProviders();
      const providerHealth = {};

      for (const [name, provider] of Object.entries(providers)) {
        providerHealth[name] = provider.isInitialized;
      }

      const queueStats = await queueManager.getJobCounts('notification');

      res.json({
        success: true,
        data: {
          status: 'healthy',
          providers: providerHealth,
          queue: queueStats,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health',
      });
    }
  }
}

const statsController = new StatsController();

module.exports = statsController;

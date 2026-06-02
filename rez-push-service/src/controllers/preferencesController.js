const { preferenceService } = require('../services');
const logger = require('../utils/logger');

class PreferencesController {
  async getPreferences(req, res) {
    try {
      const { userId } = req.params;
      const preferences = await preferenceService.getPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Error getting preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get preferences',
      });
    }
  }

  async updatePreferences(req, res) {
    try {
      const { userId } = req.params;
      const preferences = await preferenceService.updatePreferences(userId, req.validatedBody);

      logger.info(`Preferences updated for user ${userId}`);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
        message: error.message,
      });
    }
  }

  async setChannelEnabled(req, res) {
    try {
      const { userId } = req.params;
      const { channel, enabled } = req.body;

      if (!channel || typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Channel and enabled status are required',
        });
      }

      const preferences = await preferenceService.setChannelEnabled(userId, channel, enabled);

      res.json({
        success: true,
        data: preferences,
        message: `Channel ${channel} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logger.error('Error setting channel enabled:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update channel preference',
      });
    }
  }

  async setCategoryEnabled(req, res) {
    try {
      const { userId } = req.params;
      const { category, enabled, channels } = req.body;

      if (!category || typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Category and enabled status are required',
        });
      }

      const preferences = await preferenceService.setCategoryEnabled(userId, category, enabled, channels);

      res.json({
        success: true,
        data: preferences,
        message: `Category ${category} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logger.error('Error setting category enabled:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category preference',
      });
    }
  }

  async setQuietHours(req, res) {
    try {
      const { userId } = req.params;
      const preferences = await preferenceService.setQuietHours(userId, req.body);

      res.json({
        success: true,
        data: preferences,
        message: 'Quiet hours updated',
      });
    } catch (error) {
      logger.error('Error setting quiet hours:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update quiet hours',
      });
    }
  }

  async setFrequencyCap(req, res) {
    try {
      const { userId } = req.params;
      const { channel, ...caps } = req.body;

      if (!channel) {
        return res.status(400).json({
          success: false,
          error: 'Channel is required',
        });
      }

      const preferences = await preferenceService.setFrequencyCap(userId, channel, caps);

      res.json({
        success: true,
        data: preferences,
        message: `Frequency cap updated for ${channel}`,
      });
    } catch (error) {
      logger.error('Error setting frequency cap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update frequency cap',
      });
    }
  }

  async optOut(req, res) {
    try {
      const { userId } = req.params;
      const { category, templateId } = req.body;

      const preferences = await preferenceService.optOut(userId, category, templateId);

      res.json({
        success: true,
        data: preferences,
        message: 'Opt-out registered',
      });
    } catch (error) {
      logger.error('Error opting out:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to opt out',
      });
    }
  }

  async optIn(req, res) {
    try {
      const { userId } = req.params;
      const { category, templateId } = req.body;

      const preferences = await preferenceService.optIn(userId, category, templateId);

      res.json({
        success: true,
        data: preferences,
        message: 'Opt-in registered',
      });
    } catch (error) {
      logger.error('Error opting in:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to opt in',
      });
    }
  }

  async setGlobalOptOut(req, res) {
    try {
      const { userId } = req.params;
      const { optOut } = req.body;

      if (typeof optOut !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'optOut boolean is required',
        });
      }

      const preferences = await preferenceService.setGlobalOptOut(userId, optOut);

      res.json({
        success: true,
        data: preferences,
        message: `Global opt-out ${optOut ? 'set' : 'removed'}`,
      });
    } catch (error) {
      logger.error('Error setting global opt-out:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update global opt-out',
      });
    }
  }

  async getFrequencyCap(req, res) {
    try {
      const { userId } = req.params;
      const { channel = 'all' } = req.query;

      const capInfo = await preferenceService.checkFrequencyCap(userId, channel);

      res.json({
        success: true,
        data: capInfo,
      });
    } catch (error) {
      logger.error('Error getting frequency cap:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get frequency cap',
      });
    }
  }
}

const preferencesController = new PreferencesController();

module.exports = preferencesController;

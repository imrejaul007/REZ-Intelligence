const UserPreference = require('../models/UserPreference');
const Notification = require('../models/Notification');
const config = require('../config');
const logger = require('../utils/logger');

class PreferenceService {
  async getOrCreatePreferences(userId) {
    let preferences = await UserPreference.findOne({ userId });

    if (!preferences) {
      preferences = new UserPreference({
        userId,
        quietHours: {
          enabled: false,
          startHour: config.quietHours.defaultStart,
          startMinute: 0,
          endHour: config.quietHours.defaultEnd,
          endMinute: 0,
          timezone: 'UTC',
        },
      });
      await preferences.save();
      logger.info(`Created preferences for user ${userId}`);
    }

    return preferences;
  }

  async getPreferences(userId) {
    const preferences = await this.getOrCreatePreferences(userId);
    return preferences.toJSON();
  }

  async updatePreferences(userId, updates) {
    const preferences = await this.getOrCreatePreferences(userId);

    if (updates.channelPreferences) {
      for (const [channel, prefs] of Object.entries(updates.channelPreferences)) {
        const existing = preferences.channelPreferences.get(channel) || {};
        preferences.channelPreferences.set(channel, {
          ...existing,
          ...prefs,
        });
      }
      delete updates.channelPreferences;
    }

    if (updates.categoryPreferences) {
      for (const [category, prefs] of Object.entries(updates.categoryPreferences)) {
        const existing = preferences.categoryPreferences.get(category) || {};
        preferences.categoryPreferences.set(category, {
          enabled: prefs.enabled ?? existing.enabled ?? true,
          channels: prefs.channels ?? existing.channels ?? [],
        });
      }
      delete updates.categoryPreferences;
    }

    if (updates.frequencyCaps) {
      for (const [channel, caps] of Object.entries(updates.frequencyCaps)) {
        const existing = preferences.frequencyCaps.get(channel) || {};
        preferences.frequencyCaps.set(channel, {
          maxPerDay: caps.maxPerDay ?? existing.maxPerDay ?? 10,
          maxPerWeek: caps.maxPerWeek ?? existing.maxPerWeek ?? 50,
          maxPerMonth: caps.maxPerMonth ?? existing.maxPerMonth ?? 200,
        });
      }
      delete updates.frequencyCaps;
    }

    if (updates.quietHours) {
      preferences.quietHours = {
        ...preferences.quietHours,
        ...updates.quietHours,
      };
      delete updates.quietHours;
    }

    Object.assign(preferences, updates);

    await preferences.save();
    logger.info(`Updated preferences for user ${userId}`);

    return preferences.toJSON();
  }

  async setChannelEnabled(userId, channel, enabled) {
    const preferences = await this.getOrCreatePreferences(userId);
    const existing = preferences.channelPreferences.get(channel) || {};
    preferences.channelPreferences.set(channel, {
      ...existing,
      enabled,
    });
    await preferences.save();

    logger.info(`Channel ${channel} ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
    return preferences.toJSON();
  }

  async setCategoryEnabled(userId, category, enabled, channels = null) {
    const preferences = await this.getOrCreatePreferences(userId);
    const existing = preferences.categoryPreferences.get(category) || {};
    preferences.categoryPreferences.set(category, {
      enabled,
      channels: channels ?? existing.channels ?? [],
    });
    await preferences.save();

    logger.info(`Category ${category} ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
    return preferences.toJSON();
  }

  async setQuietHours(userId, quietHours) {
    const preferences = await this.getOrCreatePreferences(userId);
    preferences.quietHours = {
      ...preferences.quietHours,
      ...quietHours,
      enabled: quietHours.enabled ?? preferences.quietHours.enabled,
    };
    await preferences.save();

    logger.info(`Quiet hours updated for user ${userId}`);
    return preferences.toJSON();
  }

  async setFrequencyCap(userId, channel, caps) {
    const preferences = await this.getOrCreatePreferences(userId);
    const existing = preferences.frequencyCaps.get(channel) || {};
    preferences.frequencyCaps.set(channel, {
      maxPerDay: caps.maxPerDay ?? existing.maxPerDay ?? 10,
      maxPerWeek: caps.maxPerWeek ?? existing.maxPerWeek ?? 50,
      maxPerMonth: caps.maxPerMonth ?? existing.maxPerMonth ?? 200,
    });
    await preferences.save();

    logger.info(`Frequency cap updated for user ${userId}, channel ${channel}`);
    return preferences.toJSON();
  }

  async optOut(userId, category = null, templateId = null) {
    const preferences = await this.getOrCreatePreferences(userId);

    if (category) {
      if (!preferences.optOutCategories.includes(category)) {
        preferences.optOutCategories.push(category);
      }
    }

    if (templateId) {
      if (!preferences.optOutTemplates.includes(templateId)) {
        preferences.optOutTemplates.push(templateId);
      }
    }

    await preferences.save();
    logger.info(`Opt-out registered for user ${userId}`, { category, templateId });

    return preferences.toJSON();
  }

  async optIn(userId, category = null, templateId = null) {
    const preferences = await this.getOrCreatePreferences(userId);

    if (category) {
      preferences.optOutCategories = preferences.optOutCategories.filter(c => c !== category);
    }

    if (templateId) {
      preferences.optOutTemplates = preferences.optOutTemplates.filter(t => t !== templateId);
    }

    await preferences.save();
    logger.info(`Opt-in registered for user ${userId}`, { category, templateId });

    return preferences.toJSON();
  }

  async setGlobalOptOut(userId, optOut) {
    const preferences = await this.getOrCreatePreferences(userId);
    preferences.globalOptOut = optOut;
    await preferences.save();

    logger.info(`Global opt-out ${optOut ? 'set' : 'removed'} for user ${userId}`);
    return preferences.toJSON();
  }

  async checkFrequencyCap(userId, channel = 'all') {
    const preferences = await this.getOrCreatePreferences(userId);
    const cap = preferences.getFrequencyCap(channel);
    const stats = await this.getUserNotificationStats(userId, channel);

    return {
      allowed: {
        perDay: stats.perDay < cap.maxPerDay,
        perWeek: stats.perWeek < cap.maxPerWeek,
        perMonth: stats.perMonth < cap.maxPerMonth,
      },
      stats,
      cap,
    };
  }

  async getUserNotificationStats(userId, channel = null) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const matchStage = { userId };

    if (channel) {
      matchStage[`channelStatuses.${channel}.status`] = {
        $in: ['sent', 'delivered', 'read'],
      };
    } else {
      matchStage['status'] = {
        $in: ['sent', 'delivered', 'read'],
      };
    }

    const stats = await Notification.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          perDay: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', oneDayAgo] }, 1, 0],
            },
          },
          perWeek: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', oneWeekAgo] }, 1, 0],
            },
          },
          perMonth: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', oneMonthAgo] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
    ]);

    return stats[0] || { perDay: 0, perWeek: 0, perMonth: 0, total: 0 };
  }

  async canSendNotification(userId, category, channel) {
    const preferences = await this.getOrCreatePreferences(userId);

    if (!preferences.canReceiveNotification(category, channel)) {
      return {
        allowed: false,
        reason: this.getRejectionReason(preferences, category, channel),
      };
    }

    const freqCheck = await this.checkFrequencyCap(userId, channel);
    if (!freqCheck.allowed.perDay) {
      return {
        allowed: false,
        reason: 'daily_frequency_cap_exceeded',
      };
    }

    return {
      allowed: true,
      preferences,
    };
  }

  getRejectionReason(preferences, category, channel) {
    if (preferences.globalOptOut) return 'global_opt_out';
    if (preferences.optOutCategories.includes(category)) return 'category_opt_out';
    if (preferences.isInQuietHours(channel)) return 'quiet_hours';
    if (!preferences.isChannelEnabled(channel)) return 'channel_disabled';
    if (!preferences.isCategoryEnabled(category, channel)) return 'category_disabled';
    return 'unknown';
  }

  async validatePreferences(preferences) {
    const errors = [];

    if (preferences.quietHours) {
      const { startHour, startMinute, endHour, endMinute } = preferences.quietHours;

      if (startHour < 0 || startHour > 23) {
        errors.push('quietHours.startHour must be between 0 and 23');
      }
      if (endHour < 0 || endHour > 23) {
        errors.push('quietHours.endHour must be between 0 and 23');
      }
      if (startMinute < 0 || startMinute > 59) {
        errors.push('quietHours.startMinute must be between 0 and 59');
      }
      if (endMinute < 0 || endMinute > 59) {
        errors.push('quietHours.endMinute must be between 0 and 59');
      }
    }

    if (preferences.frequencyCaps) {
      for (const [channel, caps] of Object.entries(preferences.frequencyCaps)) {
        if (caps.maxPerDay !== undefined && (caps.maxPerDay < 0 || caps.maxPerDay > 1000)) {
          errors.push(`frequencyCaps.${channel}.maxPerDay must be between 0 and 1000`);
        }
        if (caps.maxPerWeek !== undefined && (caps.maxPerWeek < 0 || caps.maxPerWeek > 10000)) {
          errors.push(`frequencyCaps.${channel}.maxPerWeek must be between 0 and 10000`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

const preferenceService = new PreferenceService();

module.exports = preferenceService;

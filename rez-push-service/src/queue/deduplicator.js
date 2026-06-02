const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class Deduplicator {
  constructor() {
    this.redis = null;
    this.isInitialized = false;
    this.windowMs = config.queue.dedupWindowMs || 300000;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const redisConfig = config.redis.url
        ? config.redis.url
        : {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password || undefined,
            maxRetriesPerRequest: null,
          };

      this.redis = new Redis(redisConfig);
      await this.redis.ping();
      this.isInitialized = true;
      logger.info('Deduplicator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize deduplicator:', error);
      this.isInitialized = true;
    }
  }

  getKey(identifier) {
    return `dedup:${identifier}`;
  }

  async isDuplicate(identifier, data = null) {
    if (!this.redis) return false;

    const key = this.getKey(identifier);

    try {
      const exists = await this.redis.exists(key);

      if (exists) {
        logger.debug(`Duplicate detected: ${identifier}`);
        return true;
      }

      await this.set(identifier, data);
      return false;
    } catch (error) {
      logger.error('Deduplicator check error:', error);
      return false;
    }
  }

  async set(identifier, data = null) {
    if (!this.redis) return;

    const key = this.getKey(identifier);

    try {
      if (data) {
        await this.redis.setex(key, Math.ceil(this.windowMs / 1000), JSON.stringify(data));
      } else {
        await this.redis.setex(key, Math.ceil(this.windowMs / 1000), '1');
      }
    } catch (error) {
      logger.error('Deduplicator set error:', error);
    }
  }

  async remove(identifier) {
    if (!this.redis) return;

    const key = this.getKey(identifier);

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Deduplicator remove error:', error);
      return false;
    }
  }

  async checkAndSet(identifier, data = null) {
    const isDuplicate = await this.isDuplicate(identifier, data);
    return !isDuplicate;
  }

  generateIdempotencyKey(userId, templateId, category, channel, variables = {}) {
    const varHash = Object.keys(variables)
      .sort()
      .map(k => `${k}:${variables[k]}`)
      .join('|');

    const base = `${userId}:${templateId}:${category}:${channel}`;
    return varHash ? `${base}:${varHash}` : base;
  }

  async isNotificationDuplicate(userId, templateId, category, channel, variables = {}) {
    const key = this.generateIdempotencyKey(userId, templateId, category, channel, variables);
    return this.isDuplicate(key);
  }

  async markNotificationSent(userId, templateId, category, channel, variables = {}) {
    const key = this.generateIdempotencyKey(userId, templateId, category, channel, variables);
    await this.set(key, {
      userId,
      templateId,
      category,
      channel,
      variables,
      sentAt: new Date().toISOString(),
    });
  }

  async bulkCheckDuplicates(items) {
    if (!this.redis) {
      return items.map(() => false);
    }

    const keys = items.map(item =>
      this.getKey(this.generateIdempotencyKey(
        item.userId,
        item.templateId,
        item.category,
        item.channel,
        item.variables || {}
      ))
    );

    try {
      const exists = await this.redis.exists(...keys);
      const results = keys.map(() => !!exists);

      for (let i = 0; i < items.length; i++) {
        if (!results[i]) {
          await this.set(items[i]);
        }
      }

      return results;
    } catch (error) {
      logger.error('Deduplicator bulk check error:', error);
      return items.map(() => false);
    }
  }

  async getStats() {
    if (!this.redis) {
      return { tracked: 0 };
    }

    try {
      const info = await this.redis.info('keyspace');
      const match = info.match(/keys=(\d+)/);
      return {
        tracked: match ? parseInt(match[1], 10) : 0,
      };
    } catch (error) {
      logger.error('Deduplicator stats error:', error);
      return { tracked: 0 };
    }
  }

  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isInitialized = false;
    }
  }
}

const deduplicator = new Deduplicator();

module.exports = deduplicator;

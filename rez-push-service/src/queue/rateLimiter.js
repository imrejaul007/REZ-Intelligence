const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.redis = null;
    this.isInitialized = false;
    this.defaults = {
      perUser: config.rateLimit.perUserMax || 10,
      perChannel: config.rateLimit.perChannelMax || 50,
      windowMs: config.rateLimit.windowMs || 60000,
    };
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
      logger.info('Rate limiter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize rate limiter:', error);
      this.isInitialized = true;
    }
  }

  getKey(type, identifier, window = 'minute') {
    const timestamp = Math.floor(Date.now() / (window === 'minute' ? 60000 : window === 'hour' ? 3600000 : 86400000));
    return `ratelimit:${type}:${identifier}:${timestamp}`;
  }

  async checkLimit(type, identifier, limit, windowMs = this.defaults.windowMs) {
    if (!this.redis) {
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
    }

    const window = windowMs <= 60000 ? 'minute' : windowMs <= 3600000 ? 'hour' : 'day';
    const key = this.getKey(type, identifier, window);
    const windowSeconds = windowMs / 1000;

    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.pttl(key);
      const results = await multi.exec();

      const count = results[0][1];
      const ttl = results[1][1];

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = ttl > 0 ? Date.now() + ttl : Date.now() + windowMs;

      if (!allowed) {
        logger.warn(`Rate limit exceeded for ${type}:${identifier}`, {
          count,
          limit,
          windowMs,
        });
      }

      return { allowed, remaining, resetAt, current: count, limit };
    } catch (error) {
      logger.error('Rate limiter error:', error);
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
    }
  }

  async checkUserLimit(userId, channel = null) {
    const type = channel ? `user:${channel}` : 'user';
    return this.checkLimit(type, userId, this.defaults.perUser);
  }

  async checkChannelLimit(channel) {
    return this.checkLimit(`channel:${channel}`, 'global', this.defaults.perChannel);
  }

  async checkApiLimit(ip) {
    return this.checkLimit('api', ip, config.rateLimit.maxRequests);
  }

  async recordSent(type, identifier, count = 1) {
    if (!this.redis) return;

    const key = this.getKey(type, identifier, 'minute');

    try {
      const multi = this.redis.multi();
      multi.incrby(key, count);
      multi.pexpire(key, 60000);
      await multi.exec();
    } catch (error) {
      logger.error('Failed to record sent notification:', error);
    }
  }

  async recordUserSent(userId, channel = null) {
    const type = channel ? `sent:${channel}` : 'sent:all';
    await this.recordSent(type, userId);
  }

  async recordChannelSent(channel) {
    await this.recordSent('channel', channel);
  }

  async getUserStats(userId) {
    if (!this.redis) {
      return { perMinute: 0, perHour: 0, perDay: 0 };
    }

    try {
      const keys = [
        this.getKey('sent:all', userId, 'minute'),
        this.getKey('sent:all', userId, 'hour'),
        this.getKey('sent:all', userId, 'day'),
      ];

      const values = await this.redis.mget(...keys);

      return {
        perMinute: parseInt(values[0] || 0, 10),
        perHour: parseInt(values[1] || 0, 10),
        perDay: parseInt(values[2] || 0, 10),
      };
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      return { perMinute: 0, perHour: 0, perDay: 0 };
    }
  }

  async resetLimit(type, identifier) {
    if (!this.redis) return false;

    const keys = [
      this.getKey(type, identifier, 'minute'),
      this.getKey(type, identifier, 'hour'),
      this.getKey(type, identifier, 'day'),
    ];

    try {
      await this.redis.del(...keys);
      return true;
    } catch (error) {
      logger.error('Failed to reset limit:', error);
      return false;
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

const rateLimiter = new RateLimiter();

module.exports = rateLimiter;

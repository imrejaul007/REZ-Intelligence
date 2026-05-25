import logger from './utils/logger';

/**
 * Redis Cloud Connection Manager
 * Handles Redis Cloud (or Upstash) connections with clustering support
 */
const { createClient, RedisErrorType } = require('redis');

class RedisConnection {
  constructor(config = {}) {
    this.config = {
      // Redis Cloud URL (or Upstash)
      url: process.env.REDIS_URL || 'redis://default:your-password@your-redis.cloud:6379',

      // For Upstash: REST API
      upstashUrl: process.env.UPSTASH_REDIS_REST_URL || null,
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || null,

      // Connection options
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Max retries reached');
          }
          return Math.min(retries * 100, 3000);
        }
      },

      // Performance options
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,

      // For clustering
      clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES
        ? JSON.parse(process.env.REDIS_CLUSTER_NODES)
        : null
    };

    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        url: this.config.url,
        socket: this.config.socket,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        enableReadyCheck: this.config.enableReadyCheck
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err.message);
        if (err.type === RedisErrorType.CONNECTION_CLOSED_ERROR) {
          this.isConnected = false;
        }
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (err) {
      console.error('Failed to connect to Redis:', err.message);
      throw err;
    }
  }

  async connectSubscriber() {
    // Create separate connection for pub/sub
    this.subscriber = this.client.duplicate();
    await this.subscriber.connect();
    return this.subscriber;
  }

  async disconnect() {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.client) {
      await this.client.quit();
    }
    this.isConnected = false;
  }

  // Cache helpers
  async cache(key, value, ttlSeconds = 3600) {
    const data = typeof value === 'object' ? JSON.stringify(value) : value;
    await this.client.setEx(key, ttlSeconds, data);
  }

  async getCache(key) {
    const data = await this.client.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  async deleteCache(key) {
    await this.client.del(key);
  }

  async cacheHash(key, field, value) {
    await this.client.hSet(key, field, typeof value === 'object' ? JSON.stringify(value) : value);
  }

  async getHash(key, field) {
    const data = await this.client.hGet(key, field);
    if (!data) return null;

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  async getAllHash(key) {
    const data = await this.client.hGetAll(key);
    const result = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        result[k] = JSON.parse(v);
      } catch {
        result[k] = v;
      }
    }
    return result;
  }

  // Pub/Sub helpers
  async publish(channel, message) {
    await this.client.publish(channel, typeof message === 'object' ? JSON.stringify(message) : message);
  }

  async subscribe(channel, callback) {
    if (!this.subscriber) {
      await this.connectSubscriber();
    }

    await this.subscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch {
        callback(message);
      }
    });
  }

  // Rate limiting
  async rateLimit(key, maxRequests, windowSeconds) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Remove old entries
    await this.client.zRemRangeByScore(key, 0, now - windowMs);

    // Add current request
    await this.client.zAdd(key, { score: now, value: now.toString() });

    // Count requests in window
    const count = await this.client.zCard(key);

    // Set expiry
    await this.client.expire(key, windowSeconds);

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt: new Date(now + windowMs)
    };
  }

  // Session management
  async createSession(sessionId, data, ttlSeconds = 86400) {
    await this.client.hSet(`session:${sessionId}`, {
      data: JSON.stringify(data),
      createdAt: Date.now().toString()
    });
    await this.client.expire(`session:${sessionId}`, ttlSeconds);
  }

  async getSession(sessionId) {
    const session = await this.client.hGetAll(`session:${sessionId}`);
    if (!session || !session.data) return null;

    return {
      ...JSON.parse(session.data),
      createdAt: parseInt(session.createdAt)
    };
  }

  async updateSession(sessionId, data) {
    const existing = await this.getSession(sessionId);
    if (existing) {
      await this.client.hSet(`session:${sessionId}`, 'data', JSON.stringify({
        ...existing,
        ...data,
        updatedAt: Date.now()
      }));
    }
  }

  async deleteSession(sessionId) {
    await this.client.del(`session:${sessionId}`);
  }

  // Health check
  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async getInfo() {
    try {
      const info = await this.client.info();
      return info;
    } catch {
      return null;
    }
  }
}

module.exports = new RedisConnection();

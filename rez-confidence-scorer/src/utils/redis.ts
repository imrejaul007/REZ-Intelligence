import Redis from 'ioredis';
import config from '../config';
import { logger } from './logger';

/**
 * Redis client singleton
 */
class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;

  constructor() {
    this.maxReconnectAttempts = config.redis.retryStrategy.maxRetries;
    this.reconnectDelay = config.redis.retryStrategy.retryDelayMs;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.client && this.isConnected) {
      return;
    }

    try {
      this.client = new Redis(config.redis.url, {
        retryStrategy: (times: number) => {
          if (times > this.maxReconnectAttempts) {
            logger.error('Redis: Max reconnection attempts reached');
            return null; // Stop retrying
          }

          const delay = Math.min(
            times * this.reconnectDelay,
            5000 // Max 5 seconds between retries
          );
          logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: true,
        connectTimeout: 10000,
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis: Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis: Ready');
      });

      this.client.on('error', (error) => {
        logger.error('Redis: Error', { error: error.message });
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis: Connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.info(`Redis: Reconnecting (attempt ${this.reconnectAttempts})`);
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Redis: Failed to connect', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get Redis client
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis: Disconnected');
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.get(key);
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }

    if (ttlSeconds) {
      await this.client!.setex(key, ttlSeconds, value);
    } else {
      await this.client!.set(key, value);
    }
  }

  /**
   * Set key with expiration (alias for set with TTL)
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    await this.client!.setex(key, seconds, value);
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    await this.client!.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    const result = await this.client!.exists(key);
    return result === 1;
  }

  /**
   * Increment value
   */
  async incr(key: string): Promise<number> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.incr(key);
  }

  /**
   * Get keys with pattern
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.keys(pattern);
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }

    const keys = await this.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    return this.client!.del(...keys);
  }

  /**
   * Hash operations
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    await this.client!.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.hgetall(key);
  }

  /**
   * Set operations
   */
  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    await this.client!.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    return this.client!.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Redis client not ready');
    }
    const result = await this.client!.sismember(key, member);
    return result === 1;
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
export default redisClient;

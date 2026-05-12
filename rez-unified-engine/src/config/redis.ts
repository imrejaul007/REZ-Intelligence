/**
 * Redis Configuration
 * Connection management for caching, sessions, and pub/sub
 */

import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

const redisLogger = logger.child({ component: 'Redis' });

// Redis client instance
let redisClient: Redis | null = null;
let isConnected = false;

// Event subscriptions
const subscriberClients: Redis[] = [];

// Create Redis client with configuration
function createRedisClient(name: string = 'main'): Redis {
  const options: Redis.RedisOptions = {
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        redisLogger.error('Redis max retry attempts reached');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  };

  const url = new URL(config.redis.url);
  if (config.redis.password) {
    url.password = config.redis.password;
  }

  const client = new Redis(url.toString(), {
    ...options,
    keyPrefix: config.redis.keyPrefix,
  });

  // Event handlers
  client.on('connect', () => {
    redisLogger.debug(`Redis client (${name}) connecting`);
  });

  client.on('ready', () => {
    redisLogger.info(`Redis client (${name}) ready`);
    if (name === 'main') {
      isConnected = true;
    }
  });

  client.on('error', (error: Error) => {
    redisLogger.error(`Redis client (${name}) error`, { error: error.message });
  });

  client.on('close', () => {
    redisLogger.warn(`Redis client (${name}) connection closed`);
    if (name === 'main') {
      isConnected = false;
    }
  });

  client.on('reconnecting', () => {
    redisLogger.info(`Redis client (${name}) reconnecting`);
  });

  return client;
}

export async function connectRedis(): Promise<Redis> {
  if (redisClient && isConnected) {
    redisLogger.debug('Already connected to Redis');
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createRedisClient('main');
  }

  try {
    await redisClient.connect();
    isConnected = true;
    redisLogger.info('Connected to Redis successfully');
    return redisClient;
  } catch (error) {
    redisLogger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  const clients = [redisClient, ...subscriberClients].filter(Boolean) as Redis[];

  for (const client of clients) {
    try {
      await client.quit();
      redisLogger.debug('Redis client disconnected');
    } catch (error) {
      redisLogger.error('Error disconnecting Redis client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  redisClient = null;
  subscriberClients.length = 0;
  isConnected = false;
  redisLogger.info('All Redis connections closed');
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('main');
  }
  return redisClient;
}

// Create a separate subscriber client for pub/sub
export async function createSubscriberClient(): Promise<Redis> {
  const subscriber = createRedisClient(`subscriber-${subscriberClients.length}`);

  subscriber.on('message', (channel: string, message: string) => {
    redisLogger.debug(`Received message on channel ${channel}`, { message });
  });

  subscriberClients.push(subscriber);
  return subscriber;
}

// Redis key patterns
export const RedisKeys = {
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  sessionMessages: (sessionId: string) => `session:${sessionId}:messages`,
  sessionContext: (sessionId: string) => `session:${sessionId}:context`,
  sessionLock: (sessionId: string) => `session:${sessionId}:lock`,

  // Rate limiting
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,

  // Conversation locks
  conversationLock: (conversationId: string) => `conversation:lock:${conversationId}`,

  // Processing queue
  processingQueue: 'queue:processing',
  processingSet: 'set:processing',

  // Deduplication
  deduplication: (id: string) => `dedup:${id}`,

  // Webhook events
  webhookEvent: (eventId: string) => `webhook:${eventId}`,
} as const;

// Session cache operations
export class SessionCache {
  private client: Redis;

  constructor(client?: Redis) {
    this.client = client || getRedisClient();
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async setWithLock(key: string, value: unknown, ttlSeconds: number, lockTTLMs: number): Promise<boolean> {
    const lockKey = `${key}:lock`;
    const lockValue = Date.now().toString();

    // Try to acquire lock
    const acquired = await this.client.set(lockKey, lockValue, 'PX', lockTTLMs, 'NX');
    if (!acquired) return false;

    try {
      // Set the value
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } finally {
      // Release lock
      await this.client.del(lockKey);
    }
  }
}

export const sessionCache = new SessionCache();

// Connection state
export function isRedisConnected(): boolean {
  return isConnected;
}

export default getRedisClient;

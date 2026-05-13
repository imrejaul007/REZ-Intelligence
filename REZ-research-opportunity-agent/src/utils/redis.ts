import { createClient, RedisClientType } from 'redis';
import config from '../config/index.js';
import logger from './logger.js';

const redisLogger = logger.child({ context: 'Redis' });

let client: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  if (client && client.isOpen) {
    return client;
  }

  try {
    redisLogger.info('Connecting to Redis...');

    client = createClient({
      url: config.redis.url,
    });

    client.on('error', (err) => {
      redisLogger.error('Redis client error', { error: err.message });
    });

    client.on('connect', () => {
      redisLogger.info('Redis client connected');
    });

    client.on('ready', () => {
      redisLogger.info('Redis client ready');
    });

    client.on('reconnecting', () => {
      redisLogger.warn('Redis client reconnecting');
    });

    await client.connect();
    return client;
  } catch (error) {
    const err = error as Error;
    redisLogger.error('Failed to connect to Redis', { error: err.message });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    redisLogger.info('Redis disconnected');
    client = null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return client;
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!client || !client.isOpen) {
    return null;
  }

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) as T : null;
  } catch (error) {
    redisLogger.error('Cache get error', { key, error: (error as Error).message });
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    redisLogger.error('Cache set error', { key, error: (error as Error).message });
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    redisLogger.error('Cache delete error', { key, error: (error as Error).message });
    return false;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!client || !client.isOpen) {
    return 0;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      return await client.del(keys);
    }
    return 0;
  } catch (error) {
    redisLogger.error('Cache delete pattern error', { pattern, error: (error as Error).message });
    return 0;
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    return (await client.exists(key)) === 1;
  } catch (error) {
    redisLogger.error('Cache exists error', { key, error: (error as Error).message });
    return false;
  }
}

// Lock helpers for distributed locking
export async function acquireLock(
  key: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    const result = await client.setNX(key, Date.now().toString());
    if (result) {
      await client.expire(key, ttlSeconds);
      return true;
    }
    return false;
  } catch (error) {
    redisLogger.error('Acquire lock error', { key, error: (error as Error).message });
    return false;
  }
}

export async function releaseLock(key: string): Promise<boolean> {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    redisLogger.error('Release lock error', { key, error: (error as Error).message });
    return false;
  }
}

export default {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheExists,
  acquireLock,
  releaseLock,
};

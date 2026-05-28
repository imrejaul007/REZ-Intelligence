import { Redis, type Redis as RedisType } from 'ioredis';
import { logInfo, logWarn, logError } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: RedisType | null = null;

export async function connectRedis(): Promise<RedisType | null> {
  try {
    const client = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    client.on('error', (err: Error) => {
      logError('Redis error', { error: err.message });
    });

    client.on('connect', () => {
      logInfo('Redis client connecting');
    });

    client.on('ready', () => {
      logInfo('Redis client ready');
    });

    client.on('end', () => {
      logInfo('Redis client disconnected');
    });

    await client.connect();
    logInfo('Connected to Redis');

    redisClient = client;
    return redisClient;
  } catch (error) {
    const err = error as Error;
    logWarn('Redis connection failed, continuing without cache', { error: err.message });
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logInfo('Redis connection closed');
    } catch (error) {
      const err = error as Error;
      logError('Error closing Redis connection', { error: err.message });
    }
  }
}

export function getRedisClient(): RedisType | null {
  return redisClient;
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logError('Cache set failed', { key, error: (error as Error).message });
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
  } catch (error) {
    logError('Cache delete failed', { key, error: (error as Error).message });
  }
}

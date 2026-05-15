import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'rez:identity:';

let redisClient: Redis | null = null;

export interface RedisConfig {
  url: string;
  keyPrefix: string;
}

export const createRedisClient = (): Redis => {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (error) => {
    logger.error('Redis client error', { error: error.message });
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  return client;
};

export const getRedisClient = async (): Promise<Redis> => {
  if (!redisClient) {
    redisClient = createRedisClient();
    await redisClient.connect();
  }

  if (redisClient.status === 'ready') {
    return redisClient;
  }

  return new Promise((resolve, reject) => {
    if (!redisClient) {
      reject(new Error('Redis client not initialized'));
      return;
    }

    redisClient.once('ready', () => {
      resolve(redisClient!);
    });

    redisClient.once('error', (error) => {
      reject(error);
    });
  });
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected gracefully');
  }
};

export const getKey = (key: string): string => {
  return `${KEY_PREFIX}${key}`;
};

// Cache utilities
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const client = await getRedisClient();
  const data = await client.get(getKey(key));
  if (data) {
    return JSON.parse(data) as T;
  }
  return null;
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> => {
  const client = await getRedisClient();
  const serialized = JSON.stringify(value);

  if (ttlSeconds) {
    await client.setex(getKey(key), ttlSeconds, serialized);
  } else {
    await client.set(getKey(key), serialized);
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  const client = await getRedisClient();
  await client.del(getKey(key));
};

export const cacheExists = async (key: string): Promise<boolean> => {
  const client = await getRedisClient();
  const exists = await client.exists(getKey(key));
  return exists === 1;
};

export const cachePatternDelete = async (pattern: string): Promise<number> => {
  const client = await getRedisClient();
  const keys = await client.keys(getKey(pattern));
  if (keys.length > 0) {
    return await client.del(...keys);
  }
  return 0;
};

export default {
  getRedisClient,
  disconnectRedis,
  getKey,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheExists,
  cachePatternDelete,
};

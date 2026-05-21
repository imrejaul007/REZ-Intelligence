/**
 * REZ Memory Layer - Redis Configuration
 */

import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'rez:memory:';

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('Redis connected and ready');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error:', error);
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();

  if (isConnected) {
    logger.info('Redis already connected');
    return;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout'));
    }, 10000);

    client.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis disconnected');
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}

export async function checkRedisHealth(): Promise<{ status: string; latency?: number }> {
  const start = Date.now();

  try {
    const client = getRedisClient();
    await client.ping();
    const latency = Date.now() - start;
    return { status: 'up', latency };
  } catch (error) {
    return { status: 'down' };
  }
}

// Key generation helpers
export function getTimelineKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}timeline:${userId}`;
}

export function getSegmentsKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}segments:${userId}`;
}

export function getPreferencesKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}preferences:${userId}`;
}

export function getUserIndexKey(): string {
  return `${REDIS_KEY_PREFIX}user_index`;
}

export function getEventCountKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}event_count:${userId}`;
}

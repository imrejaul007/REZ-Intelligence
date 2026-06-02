/**
 * Redis Configuration
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
});

export const subscriber = new Redis(REDIS_URL);

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function connectRedis(): Promise<void> {
  await redis.ping();
}

export const CACHE_TTL = 300; // 5 minutes
export const CACHE_PREFIX = 'profile:';

export function getCacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

/**
 * Redis Cache Service
 * Simple caching utility for REZ Intelligence services
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Cache helper - gets from cache or executes function and caches result
 */
export async function cache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}

/**
 * Cache invalidation
 */
export async function invalidate(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length) {
    await redis.del(...keys);
  }
}

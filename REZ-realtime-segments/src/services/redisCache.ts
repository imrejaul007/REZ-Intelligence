import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

import Redis from 'ioredis';
import config from '../config/index.js';
import type { CachedEvaluation, SegmentEvaluationResult } from '../types/index.js';

let redisClient: Redis | null = null;
let isConnected = false;

// Cache key prefixes
const CACHE_KEYS = {
  EVALUATION: 'seg:eval',
  USER_SEGMENTS: 'seg:user',
  SEGMENT_MEMBERS: 'seg:members',
  SEGMENT_STATS: 'seg:stats',
  LOCK: 'seg:lock'
} as const;

export async function connectRedis(): Promise<void> {
  if (redisClient && isConnected) {
    return;
  }

  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5000
    });

    await redisClient.connect();
    isConnected = true;
    logger.info(`Redis connected to ${config.redis.url}`);

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis disconnected');
  } catch (error) {
    console.error('Error disconnecting from Redis:', error);
    throw error;
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

// Generate cache key
function getCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

// Set evaluation result in cache
export async function cacheEvaluation(
  userId: string,
  segmentId: string,
  result: SegmentEvaluationResult
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.EVALUATION, userId, segmentId);
  const cached: CachedEvaluation = {
    userId,
    segmentId,
    result,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + config.redis.cacheTtl * 1000).toISOString()
  };

  await redisClient.setex(key, config.redis.cacheTtl, JSON.stringify(cached));
}

// Get cached evaluation
export async function getCachedEvaluation(
  userId: string,
  segmentId: string
): Promise<CachedEvaluation | null> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.EVALUATION, userId, segmentId);
  const data = await redisClient.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as CachedEvaluation;
  } catch {
    // Invalid cache data, delete it
    await redisClient.del(key);
    return null;
  }
}

// Invalidate user's evaluation cache for a segment
export async function invalidateEvaluation(
  userId: string,
  segmentId?: string
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  if (segmentId) {
    const key = getCacheKey(CACHE_KEYS.EVALUATION, userId, segmentId);
    await redisClient.del(key);
  } else {
    // Invalidate all evaluations for this user
    const pattern = getCacheKey(CACHE_KEYS.EVALUATION, userId, '*');
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  }
}

// Add user to segment membership set
export async function addUserToSegment(
  userId: string,
  segmentId: string
): Promise<boolean> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_MEMBERS, segmentId);
  const result = await redisClient.sadd(key, userId);
  return result === 1;
}

// Remove user from segment membership set
export async function removeUserFromSegment(
  userId: string,
  segmentId: string
): Promise<boolean> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_MEMBERS, segmentId);
  const result = await redisClient.srem(key, userId);
  return result === 1;
}

// Check if user is in segment (fast lookup)
export async function isUserInSegment(
  userId: string,
  segmentId: string
): Promise<boolean> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_MEMBERS, segmentId);
  const result = await redisClient.sismember(key, userId);
  return result === 1;
}

// Get segment member count
export async function getSegmentMemberCount(segmentId: string): Promise<number> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_MEMBERS, segmentId);
  return await redisClient.scard(key);
}

// Get all members of a segment
export async function getSegmentMembers(
  segmentId: string,
  offset = 0,
  limit = 100
): Promise<string[]> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_MEMBERS, segmentId);
  return await redisClient.srandmember(key, limit, offset);
}

// Get user's segments (fast lookup)
export async function getUserSegments(userId: string): Promise<string[]> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.USER_SEGMENTS, userId);
  return await redisClient.smembers(key);
}

// Set user's segments
export async function setUserSegments(
  userId: string,
  segmentIds: string[]
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.USER_SEGMENTS, userId);

  // Use pipeline for atomic operations
  const pipeline = redisClient.pipeline();
  pipeline.del(key);

  if (segmentIds.length > 0) {
    pipeline.sadd(key, ...segmentIds);
    pipeline.expire(key, config.redis.cacheTtl);
  }

  await pipeline.exec();
}

// Add segment to user's segment set
export async function addSegmentToUser(
  userId: string,
  segmentId: string
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.USER_SEGMENTS, userId);
  await redisClient.sadd(key, segmentId);
  await redisClient.expire(key, config.redis.cacheTtl);
}

// Remove segment from user's segment set
export async function removeSegmentFromUser(
  userId: string,
  segmentId: string
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.USER_SEGMENTS, userId);
  await redisClient.srem(key, segmentId);
}

// Acquire distributed lock
export async function acquireLock(
  resource: string,
  ttlSeconds = 30
): Promise<string | null> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const lockKey = getCacheKey(CACHE_KEYS.LOCK, resource);
  // Use crypto UUID for secure lock values
  const lockValue = `${Date.now()}-${randomUUID()}`;

  // Try to set the lock with NX (only if not exists) and EX (expiry)
  const result = await redisClient.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');

  if (result === 'OK') {
    return lockValue;
  }

  return null;
}

// Release distributed lock
export async function releaseLock(
  resource: string,
  lockValue: string
): Promise<boolean> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const lockKey = getCacheKey(CACHE_KEYS.LOCK, resource);

  // Lua script for atomic check-and-delete
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redisClient.eval(script, 1, lockKey, lockValue);
  return result === 1;
}

// Cache segment stats
export async function cacheSegmentStats(
  segmentId: string,
  stats: { totalMembers: number; newMembers: number; churned: number }
): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_STATS, segmentId);
  await redisClient.setex(key, 60, JSON.stringify(stats)); // 1 minute TTL
}

// Get cached segment stats
export async function getCachedSegmentStats(
  segmentId: string
): Promise<{ totalMembers: number; newMembers: number; churned: number } | null> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const key = getCacheKey(CACHE_KEYS.SEGMENT_STATS, segmentId);
  const data = await redisClient.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Health check
export async function redisHealthCheck(): Promise<boolean> {
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  isRedisConnected,
  cacheEvaluation,
  getCachedEvaluation,
  invalidateEvaluation,
  addUserToSegment,
  removeUserFromSegment,
  isUserInSegment,
  getSegmentMemberCount,
  getSegmentMembers,
  getUserSegments,
  setUserSegments,
  addSegmentToUser,
  removeSegmentFromUser,
  acquireLock,
  releaseLock,
  cacheSegmentStats,
  getCachedSegmentStats,
  redisHealthCheck
};

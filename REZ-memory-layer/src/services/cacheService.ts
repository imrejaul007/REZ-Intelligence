/**
 * REZ Memory Layer - Cache Service
 * Redis caching for timelines, segments, and preferences
 */

import { getRedisClient, getTimelineKey, getSegmentsKey, getPreferencesKey, getUserIndexKey, getEventCountKey } from '../config/redis';
import {
  TimelineEntry,
  ComputedSegment,
  ComputedPreferences,
  TimelineEvent
} from '../types/timeline';
import { logger } from '../config/logger';

const TIMELINE_CACHE_TTL = parseInt(process.env.TIMELINE_CACHE_TTL || '86400', 10); // 24 hours
const SEGMENTS_CACHE_TTL = parseInt(process.env.SEGMENTS_CACHE_TTL || '3600', 10); // 1 hour
const PREFERENCES_CACHE_TTL = parseInt(process.env.PREFERENCES_CACHE_TTL || '1800', 10); // 30 minutes

export class CacheService {
  private redis = getRedisClient();
  private readonly logger = logger;

  /**
   * Cache recent timeline entries for a user
   */
  async cacheTimeline(
    userId: string,
    entries: TimelineEntry[]
  ): Promise<void> {
    try {
      const key = getTimelineKey(userId);
      const data = JSON.stringify(entries);

      await this.redis.setex(key, TIMELINE_CACHE_TTL, data);

      // Add user to recent users index
      await this.redis.zadd(getUserIndexKey(), Date.now(), userId);

      this.logger.debug(`Cached timeline for user ${userId}`, {
        entryCount: entries.length
      });
    } catch (error) {
      this.logger.error(`Failed to cache timeline for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get cached timeline for a user
   */
  async getCachedTimeline(userId: string): Promise<TimelineEntry[] | null> {
    try {
      const key = getTimelineKey(userId);
      const data = await this.redis.get(key);

      if (data) {
        return JSON.parse(data) as TimelineEntry[];
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached timeline for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Add a single event to the cached timeline
   */
  async addToCachedTimeline(userId: string, entry: TimelineEntry): Promise<void> {
    try {
      const key = getTimelineKey(userId);
      const exists = await this.redis.exists(key);

      if (exists) {
        // Add to beginning of list (most recent first)
        await this.redis.lpush(key, JSON.stringify(entry));
        // Trim to keep only recent events (keep 1000 events)
        await this.redis.ltrim(key, 0, 999);
        // Refresh TTL
        await this.redis.expire(key, TIMELINE_CACHE_TTL);
      }
    } catch (error) {
      this.logger.error(`Failed to add to cached timeline for user ${userId}:`, error);
    }
  }

  /**
   * Cache computed segments for a user
   */
  async cacheSegments(userId: string, segments: ComputedSegment[]): Promise<void> {
    try {
      const key = getSegmentsKey(userId);
      const data = JSON.stringify(segments);

      await this.redis.setex(key, SEGMENTS_CACHE_TTL, data);

      this.logger.debug(`Cached segments for user ${userId}`, {
        segmentCount: segments.length
      });
    } catch (error) {
      this.logger.error(`Failed to cache segments for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get cached segments for a user
   */
  async getCachedSegments(userId: string): Promise<ComputedSegment[] | null> {
    try {
      const key = getSegmentsKey(userId);
      const data = await this.redis.get(key);

      if (data) {
        return JSON.parse(data) as ComputedSegment[];
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached segments for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Cache computed preferences for a user
   */
  async cachePreferences(userId: string, preferences: ComputedPreferences): Promise<void> {
    try {
      const key = getPreferencesKey(userId);
      const data = JSON.stringify(preferences);

      await this.redis.setex(key, PREFERENCES_CACHE_TTL, data);

      this.logger.debug(`Cached preferences for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to cache preferences for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get cached preferences for a user
   */
  async getCachedPreferences(userId: string): Promise<ComputedPreferences | null> {
    try {
      const key = getPreferencesKey(userId);
      const data = await this.redis.get(key);

      if (data) {
        return JSON.parse(data) as ComputedPreferences;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get cached preferences for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Invalidate all caches for a user (called on new events)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const keys = [
        getTimelineKey(userId),
        getSegmentsKey(userId),
        getPreferencesKey(userId)
      ];

      await this.redis.del(...keys);

      this.logger.debug(`Invalidated cache for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for user ${userId}:`, error);
    }
  }

  /**
   * Increment event count for a user
   */
  async incrementEventCount(userId: string): Promise<number> {
    try {
      const key = getEventCountKey(userId);
      const count = await this.redis.incr(key);

      // Set TTL if this is a new key (expires after 7 days of inactivity)
      if (count === 1) {
        await this.redis.expire(key, 7 * 24 * 60 * 60);
      }

      return count;
    } catch (error) {
      this.logger.error(`Failed to increment event count for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get event count for a user
   */
  async getEventCount(userId: string): Promise<number> {
    try {
      const key = getEventCountKey(userId);
      const count = await this.redis.get(key);

      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error(`Failed to get event count for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get recent users who have had activity
   */
  async getRecentUsers(limit: number = 100): Promise<string[]> {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      // Get users active in the last 24 hours
      const users = await this.redis.zrangebyscore(
        getUserIndexKey(),
        oneDayAgo,
        now,
        'LIMIT',
        0,
        limit
      );

      return users;
    } catch (error) {
      this.logger.error('Failed to get recent users:', error);
      return [];
    }
  }

  /**
   * Update user activity timestamp
   */
  async updateUserActivity(userId: string): Promise<void> {
    try {
      await this.redis.zadd(getUserIndexKey(), Date.now(), userId);
    } catch (error) {
      this.logger.error(`Failed to update user activity for ${userId}:`, error);
    }
  }

  /**
   * Batch cache timelines for multiple users
   */
  async batchCacheTimelines(
    timelines: Map<string, TimelineEntry[]>
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      for (const [userId, entries] of timelines) {
        const key = getTimelineKey(userId);
        pipeline.setex(key, TIMELINE_CACHE_TTL, JSON.stringify(entries));
        pipeline.zadd(getUserIndexKey(), Date.now(), userId);
      }

      await pipeline.exec();
      this.logger.debug(`Batch cached ${timelines.size} timelines`);
    } catch (error) {
      this.logger.error('Failed to batch cache timelines:', error);
      throw error;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAllCache(): Promise<void> {
    try {
      const pattern = `${process.env.REDIS_KEY_PREFIX || 'rez:memory:'}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info(`Cleared ${keys.length} cache keys`);
      }
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }
}

export const cacheService = new CacheService();

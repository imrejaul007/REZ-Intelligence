import { redisClient } from './redisClient';
import {
  RateLimitConfig,
  RateLimitKey,
  RateLimitResult,
  SlidingWindowRecord,
  EndpointLimit,
  UserLimit,
  IpLimit,
} from '../types';
import { config, endpointConfigs, defaultLimitConfigs } from '../config';

export class RateLimitService {
  private static instance: RateLimitService;

  private constructor() {}

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Generate a Redis key for rate limiting
   */
  private generateKey(key: RateLimitKey): string {
    const parts = ['rl', key.type];
    if (key.endpoint) {
      parts.push(key.endpoint.replace(/\//g, '_'));
    }
    parts.push(key.identifier);
    return parts.join(':');
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getCurrentTime(): number {
    return Date.now();
  }

  /**
   * Get the appropriate limit config for an endpoint
   */
  private getEndpointConfig(endpoint: string): RateLimitConfig {
    const customConfig = endpointConfigs[endpoint];
    if (customConfig) {
      return {
        windowSizeMs: customConfig.windowSizeMs,
        maxRequests: customConfig.maxRequests,
        burstLimit: defaultLimitConfigs.endpoint.burstLimit,
        burstWindowMs: defaultLimitConfigs.endpoint.burstWindowMs,
      };
    }
    return {
      ...defaultLimitConfigs.endpoint,
    };
  }

  /**
   * Sliding Window Rate Limiting Algorithm
   * Uses Redis sorted sets for precise sliding window calculation
   *
   * Algorithm:
   * 1. Remove all entries older than windowSizeMs
   * 2. Count remaining entries
   * 3. If under limit, add new entry
   * 4. Return result
   */
  async checkSlidingWindowRateLimit(
    key: RateLimitKey,
    limitConfig: RateLimitConfig
  ): Promise<RateLimitResult> {
    const client = redisClient.getClient();
    if (!client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.generateKey(key);
    const now = this.getCurrentTime();
    const windowStart = now - limitConfig.windowSizeMs;

    // Use Redis transaction for atomic operations
    const pipeline = client.pipeline();

    // Remove expired entries (older than window)
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // Count current entries in window
    pipeline.zcard(redisKey);

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number || 0;

    const allowed = currentCount < limitConfig.maxRequests;
    const remaining = Math.max(0, limitConfig.maxRequests - currentCount - 1);
    const resetAt = now + limitConfig.windowSizeMs;

    if (allowed) {
      // Add new request to the sorted set
      // Score is timestamp, member is unique request ID
      const requestId = `${now}:${Math.random().toString(36).substring(2, 9)}`;
      await client.zadd(redisKey, now, requestId);

      // Set expiry on the key to auto-cleanup
      await client.expire(redisKey, Math.ceil(limitConfig.windowSizeMs / 1000) + 60);
    }

    return {
      allowed,
      current: currentCount + (allowed ? 1 : 0),
      limit: limitConfig.maxRequests,
      remaining: allowed ? remaining : 0,
      resetAt,
      retryAfterMs: allowed ? undefined : this.calculateRetryAfter(key, limitConfig),
    };
  }

  /**
   * Burst Protection
   * Tracks rapid consecutive requests within a short window
   *
   * Burst detection works by:
   * 1. Tracking requests in a small time window
   * 2. Checking if requests exceed burst threshold
   * 3. Rejecting requests that appear to be bursts
   */
  async checkBurstProtection(
    key: RateLimitKey,
    limitConfig: RateLimitConfig
  ): Promise<{ allowed: boolean; isBurst: boolean }> {
    if (!limitConfig.burstLimit || !limitConfig.burstWindowMs) {
      return { allowed: true, isBurst: false };
    }

    const client = redisClient.getClient();
    if (!client) {
      throw new Error('Redis client not initialized');
    }

    const burstKey = `${this.generateKey(key)}:burst`;
    const now = this.getCurrentTime();
    const burstWindowStart = now - limitConfig.burstWindowMs;

    // Remove old burst entries
    await client.zremrangebyscore(burstKey, 0, burstWindowStart);

    // Count recent requests
    const recentCount = await client.zcard(burstKey);

    const isBurst = recentCount >= limitConfig.burstLimit;

    if (!isBurst) {
      // Add to burst tracking
      const requestId = `${now}:${Math.random().toString(36).substring(2, 9)}`;
      await client.zadd(burstKey, now, requestId);
      await client.expire(burstKey, Math.ceil(limitConfig.burstWindowMs / 1000) + 60);
    }

    return {
      allowed: !isBurst,
      isBurst,
    };
  }

  /**
   * Calculate when a client can retry
   */
  private calculateRetryAfter(key: RateLimitKey, limitConfig: RateLimitConfig): number {
    // Return a reasonable retry delay based on the window size
    return Math.min(limitConfig.windowSizeMs, 5000);
  }

  /**
   * Check rate limit for a user
   */
  async checkUserLimit(userId: string, endpoint?: string): Promise<RateLimitResult> {
    const userKey: RateLimitKey = {
      type: 'user',
      identifier: userId,
      endpoint,
    };

    const userConfig: RateLimitConfig = {
      ...defaultLimitConfigs.user,
    };

    // Check burst protection first
    const burstCheck = await this.checkBurstProtection(userKey, userConfig);
    if (!burstCheck.allowed) {
      return {
        allowed: false,
        current: userConfig.burstLimit!,
        limit: userConfig.maxRequests,
        remaining: 0,
        resetAt: this.getCurrentTime() + (userConfig.burstWindowMs || 5000),
        retryAfterMs: userConfig.burstWindowMs,
      };
    }

    return this.checkSlidingWindowRateLimit(userKey, userConfig);
  }

  /**
   * Check rate limit for an IP address
   */
  async checkIpLimit(ip: string, endpoint?: string): Promise<RateLimitResult> {
    const ipKey: RateLimitKey = {
      type: 'ip',
      identifier: ip,
      endpoint,
    };

    const ipConfig: RateLimitConfig = {
      ...defaultLimitConfigs.ip,
    };

    // Check burst protection first
    const burstCheck = await this.checkBurstProtection(ipKey, ipConfig);
    if (!burstCheck.allowed) {
      return {
        allowed: false,
        current: ipConfig.burstLimit!,
        limit: ipConfig.maxRequests,
        remaining: 0,
        resetAt: this.getCurrentTime() + (ipConfig.burstWindowMs || 5000),
        retryAfterMs: ipConfig.burstWindowMs,
      };
    }

    return this.checkSlidingWindowRateLimit(ipKey, ipConfig);
  }

  /**
   * Check rate limit for an endpoint
   */
  async checkEndpointLimit(endpoint: string): Promise<RateLimitResult> {
    const endpointKey: RateLimitKey = {
      type: 'endpoint',
      identifier: 'global',
      endpoint,
    };

    const endpointConfig = this.getEndpointConfig(endpoint);

    // Check burst protection first
    const burstCheck = await this.checkBurstProtection(endpointKey, endpointConfig);
    if (!burstCheck.allowed) {
      return {
        allowed: false,
        current: endpointConfig.burstLimit!,
        limit: endpointConfig.maxRequests,
        remaining: 0,
        resetAt: this.getCurrentTime() + (endpointConfig.burstWindowMs || 5000),
        retryAfterMs: endpointConfig.burstWindowMs,
      };
    }

    return this.checkSlidingWindowRateLimit(endpointKey, endpointConfig);
  }

  /**
   * Combined rate limit check (user + IP + endpoint)
   */
  async checkAllLimits(
    userId: string | undefined,
    ip: string,
    endpoint: string
  ): Promise<{
    user?: RateLimitResult;
    ip?: RateLimitResult;
    endpoint: RateLimitResult;
    allowed: boolean;
    blockedBy?: 'user' | 'ip' | 'endpoint';
  }> {
    const results: {
      user?: RateLimitResult;
      ip?: RateLimitResult;
      endpoint: RateLimitResult;
      allowed: boolean;
      blockedBy?: 'user' | 'ip' | 'endpoint';
    } = {
      allowed: true,
      endpoint: {
        allowed: true,
        current: 0,
        limit: 0,
        remaining: 0,
        resetAt: 0,
      },
    };

    // Check endpoint limit first (most specific)
    results.endpoint = await this.checkEndpointLimit(endpoint);
    if (!results.endpoint.allowed) {
      results.allowed = false;
      results.blockedBy = 'endpoint';
      return results;
    }

    // Check IP limit
    results.ip = await this.checkIpLimit(ip, endpoint);
    if (!results.ip.allowed) {
      results.allowed = false;
      results.blockedBy = 'ip';
      return results;
    }

    // Check user limit if userId is provided
    if (userId) {
      results.user = await this.checkUserLimit(userId, endpoint);
      if (!results.user.allowed) {
        results.allowed = false;
        results.blockedBy = 'user';
        return results;
      }
    }

    return results;
  }

  /**
   * Get current usage for a specific key
   */
  async getCurrentUsage(key: RateLimitKey, windowSizeMs: number): Promise<number> {
    const client = redisClient.getClient();
    if (!client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.generateKey(key);
    const now = this.getCurrentTime();
    const windowStart = now - windowSizeMs;

    // Remove expired entries and count
    await client.zremrangebyscore(redisKey, 0, windowStart);
    return client.zcard(redisKey);
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetLimit(key: RateLimitKey): Promise<boolean> {
    const client = redisClient.getClient();
    if (!client) {
      throw new Error('Redis client not initialized');
    }

    const redisKey = this.generateKey(key);
    await client.del(redisKey);
    await client.del(`${redisKey}:burst`);
    return true;
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
  }> {
    const client = redisClient.getClient();
    if (!client) {
      throw new Error('Redis client not initialized');
    }

    const info = await client.info('memory');
    const keyCount = await client.dbsize();

    return {
      totalKeys: keyCount,
      memoryUsage: info,
    };
  }
}

export const rateLimitService = RateLimitService.getInstance();

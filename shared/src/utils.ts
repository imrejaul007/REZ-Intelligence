/**
 * REZ Shared Utilities
 * Production-ready utilities for all REZ services
 */

import Redis from 'ioredis';
import { randomUUID } from 'crypto';

// ==================== DISTRIBUTED LOCK ====================

export interface LockOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface Lock {
  key: string;
  token: string;
  release: () => Promise<boolean>;
}

const DEFAULT_LOCK_OPTIONS: Required<LockOptions> = {
  ttlMs: 30000,
  retryCount: 3,
  retryDelayMs: 100
};

/**
 * Acquire a distributed lock using Redis SET NX PX
 */
export async function acquireLock(
  redis: Redis,
  key: string,
  options: LockOptions = {}
): Promise<Lock | null> {
  const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };
  const token = `${Date.now()}-${randomUUID().replace(/-/g, '')}`;

  for (let i = 0; i < opts.retryCount; i++) {
    const result = await redis.set(
      `lock:${key}`,
      token,
      'PX',
      opts.ttlMs,
      'NX'
    );

    if (result === 'OK') {
      return {
        key,
        token,
        release: async () => releaseLock(redis, key, token)
      };
    }

    if (i < opts.retryCount - 1) {
      await sleep(opts.retryDelayMs * Math.pow(2, i)); // Exponential backoff
    }
  }

  return null;
}

/**
 * Release a lock only if we own it (Lua script for atomicity)
 */
export async function releaseLock(
  redis: Redis,
  key: string,
  token: string
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, 1, `lock:${key}`, token);
  return result === 1;
}

// ==================== SCAN UTILITIES ====================

/**
 * Async generator to scan Redis keys without blocking
 */
export async function* scanKeys(
  redis: Redis,
  pattern: string,
  count: number = 1000
): AsyncGenerator<string[]> {
  let cursor = '0';

  do {
    const [newCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      count
    );
    cursor = newCursor;

    if (keys.length > 0) {
      yield keys;
    }
  } while (cursor !== '0');
}

/**
 * Get all keys matching a pattern using SCAN (non-blocking)
 */
export async function getAllKeys(
  redis: Redis,
  pattern: string,
  count: number = 1000
): Promise<string[]> {
  const allKeys: string[] = [];

  for await (const keys of scanKeys(redis, pattern, count)) {
    allKeys.push(...keys);
  }

  return allKeys;
}

// ==================== SLIDING WINDOW RATE LIMIT ====================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

/**
 * Sliding window rate limiter using Redis sorted sets
 */
export async function slidingWindowRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zcard(key);
  multi.zadd(key, now.toString(), `${now}-${randomUUID()}`);
  multi.expire(key, windowSeconds);
  multi.zcard(key);

  const results = await multi.exec();
  const currentCount = (results![1][1] as number) || 0;
  const newCount = (results![4][1] as number) || 0;

  return {
    allowed: currentCount < limit,
    remaining: Math.max(0, limit - currentCount - 1),
    resetAt: now + (windowSeconds * 1000),
    total: limit
  };
}

// ==================== CACHE UTILITIES ====================

/**
 * Single-flight pattern to prevent cache stampede
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  has(key: string): boolean {
    return this.inFlight.has(key);
  }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T = unknown>(
  data: string,
  fallback: T | null = null
): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

/**
 * Cache with version-based invalidation
 */
export class VersionedCache {
  constructor(
    private redis: Redis,
    private prefix: string,
    private defaultTtl: number = 3600
  ) {}

  async get<T>(userId: string): Promise<{ data: T | null; version: number }> {
    const [data, version] = await Promise.all([
      this.redis.get(`${this.prefix}:${userId}`),
      this.redis.get(`${this.prefix}:version:${userId}`)
    ]);

    return {
      data: data ? safeJsonParse(data) as T : null,
      version: version ? parseInt(version, 10) : 0
    };
  }

  async set<T>(userId: string, data: T, ttl?: number): Promise<number> {
    const newVersion = await this.redis.incr(`${this.prefix}:version:${userId}`);

    const pipeline = this.redis.multi();
    pipeline.setex(
      `${this.prefix}:${userId}`,
      ttl || this.defaultTtl,
      JSON.stringify(data)
    );
    pipeline.setex(
      `${this.prefix}:version:${userId}`,
      ttl || this.defaultTtl,
      newVersion.toString()
    );

    await pipeline.exec();
    return newVersion;
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(
      `${this.prefix}:${userId}`,
      `${this.prefix}:version:${userId}`
    );
  }
}

// ==================== IDEMPOTENCY ====================

/**
 * Redis-based idempotency key store
 */
export class IdempotencyStore {
  constructor(
    private redis: Redis,
    private ttlSeconds: number = 86400
  ) {}

  async check(key: string): Promise<{ exists: boolean; value?: unknown }> {
    const data = await this.redis.get(`idem:${key}`);

    if (data) {
      return { exists: true, value: safeJsonParse(data) };
    }

    return { exists: false };
  }

  async store(key: string, value: unknown): Promise<void> {
    await this.redis.setex(
      `idem:${key}`,
      this.ttlSeconds,
      JSON.stringify(value)
    );
  }

  async markProcessing(key: string, ttlSeconds: number = 300): Promise<boolean> {
    const result = await this.redis.set(`idem:${key}:lock`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseProcessing(key: string): Promise<void> {
    await this.redis.del(`idem:${key}:lock`);
  }
}

// ==================== MISC UTILITIES ====================

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const jitter = (randomInt(0, 300) / 1000) * delay;
      const actualDelay = Math.min(delay + jitter, maxDelayMs);

      await sleep(actualDelay);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError || new Error('Max retries reached');
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Semaphore for concurrency control
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(errorMessage || `Timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Mask PII for logging
 */
export function maskPII(value: string): string {
  if (!value) return value;

  // Email
  if (value.includes('@')) {
    return value.replace(/(.{2}).*(@.*)/, '$1***$2');
  }

  // Phone number
  if (/^\+?[0-9]{10,}$/.test(value.replace(/\s/g, ''))) {
    return value.replace(/(.{3}).*(.{4})$/, '$1****$2');
  }

  // Default mask
  if (value.length > 6) {
    return value.slice(0, 3) + '***' + value.slice(-3);
  }

  return '***';
}

/**
 * Process-wide error handlers
 */
export function setupErrorHandlers(logger: {
  error: (message: string, meta?: Record<string, unknown>) => void;
}): void {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}

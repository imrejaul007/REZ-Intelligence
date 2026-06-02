import IORedis, { type RedisOptions } from 'ioredis';
import { logger } from './logger';
import { randomInt } from 'crypto';

// SECURITY FIX: Fail at startup instead of silently falling back to localhost
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required');
}

function parsedUrl(): URL {
  try {
    return new URL(redisUrl as string);
  } catch {
    throw new Error(`Invalid REDIS_URL: ${redisUrl}`);
  }
}

const u = parsedUrl();

/**
 * NTF-013 FIX: Typed Redis connection replacing the previous `bullmqRedis: any` cast.
 * IORedis.Redis is the instance type. This eliminates all `any` casts across
 * the codebase for Redis operations.
 */
export const bullmqRedis: IORedis = new IORedis({
  host: u.hostname || 'localhost',
  port: parseInt(u.port || '6379', 10),
  password: u.password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  retryStrategy: (times: number): number | null => {
    const base = Math.min(Math.pow(2, times) * 200, 15000);
    return base + randomInt(0, 1000);
  },
  reconnectOnError: (err: Error): boolean => {
    return err.message.includes('ECONNRESET') || err.message.includes('EPIPE') || err.message.includes('READONLY');
  },
  lazyConnect: false,
  tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
});

bullmqRedis.on('connect', () => logger.info('[Redis] Connection established'));
bullmqRedis.on('ready', () => logger.info('[Redis] Connection ready'));
bullmqRedis.on('reconnecting', () => logger.warn('[Redis] Reconnecting...'));
bullmqRedis.on('error', (err: Error) => logger.error('[Redis] Error: ' + err.message));
bullmqRedis.on('end', () => logger.error('[Redis] Connection closed'));

// Separate connection for pub/sub operations (BullMQ events)
// This prevents "Connection in subscriber mode" errors when using
// bullmqRedis for regular commands (rate limiting, dedup) inside job handlers
export const bullmqSubscriber: IORedis = new IORedis({
  host: u.hostname || 'localhost',
  port: parseInt(u.port || '6379', 10),
  password: u.password || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  retryStrategy: (times: number): number | null => {
    const base = Math.min(Math.pow(2, times) * 200, 15000);
    return base + randomInt(0, 1000);
  },
  reconnectOnError: (err: Error): boolean => {
    return err.message.includes('ECONNRESET') || err.message.includes('EPIPE') || err.message.includes('READONLY');
  },
  lazyConnect: false,
  tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
});

bullmqSubscriber.on('connect', () => logger.info('[Redis-Subscriber] Connection established'));
bullmqSubscriber.on('ready', () => logger.info('[Redis-Subscriber] Connection ready'));
bullmqSubscriber.on('reconnecting', () => logger.warn('[Redis-Subscriber] Reconnecting...'));
bullmqSubscriber.on('error', (err: Error) => logger.error('[Redis-Subscriber] Error: ' + err.message));
bullmqSubscriber.on('end', () => logger.error('[Redis-Subscriber] Connection closed'));

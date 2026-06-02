/**
 * Idempotency Middleware
 *
 * Ensures that requests with the same idempotency key return the same response.
 * Prevents duplicate operations from network retries.
 *
 * Usage:
 * ```typescript
 * app.use(idempotencyMiddleware(redis));
 * router.patch('/orders/:id/status', idempotencyMiddleware(redis), updateStatus);
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('idempotency-middleware');

const IDEMPOTENCY_TTL = 3600; // 1 hour in seconds

/**
 * Idempotency middleware
 *
 * Checks if a request with the same idempotency key has been processed.
 * If yes, returns cached response. If no, caches the response for future requests.
 */
export function idempotencyMiddleware(redis: Redis) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to mutation operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Get idempotency key from header
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // If no key provided, continue without idempotency protection
    if (!idempotencyKey) {
      return next();
    }

    // Validate UUID format
    if (!isValidUUID(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Invalid idempotency key format (must be UUID v4)',
          statusCode: 400,
        },
      });
    }

    try {
      // Build cache key: include user/merchant + operation + key
      const userId = (req as any).userId;
      const merchantId = (req as any).merchantId;
      const cacheKeyPrefix = userId || merchantId || req.ip;
      const cacheKey = `idempotency:${cacheKeyPrefix}:${idempotencyKey}`;
      const lockKey = `idempotency:lock:${cacheKey}`;

      // Check if request has been processed
      let cached = await redis.get(cacheKey);
      if (cached) {
        // Return cached response with safe JSON parsing
        try {
          const cachedData = JSON.parse(cached);
          return res.status(cachedData.statusCode).json(cachedData.body);
        } catch (parseError: any) {
          // Malformed cache entry — skip cache and process normally
          logger.error('Malformed cache entry, skipping:', parseError.message);
          // Continue to process request if cache is corrupted
        }
      }

      // Acquire lock using SETNX to prevent concurrent execution
      const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

      if (!lockAcquired) {
        // Wait briefly and try to get cached response again
        await new Promise(resolve => setTimeout(resolve, 100));
        cached = await redis.get(cacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            return res.status(cachedData.statusCode).json(cachedData.body);
          } catch (parseError) {
            logger.error('Malformed cache entry after lock wait, skipping:', parseError);
          }
        }
        // If cached response is still not available after waiting, another request is
        // actively processing this idempotency key. Return 409 so the client retries later.
        return res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Request with this idempotency key is currently being processed. Please retry.',
            statusCode: 409,
          },
        });
      }

      // Helper to cache the response
      const cacheResponse = async (statusCode: number, body: any) => {
        try {
          if (statusCode >= 200 && statusCode < 400) {
            const responseData = { statusCode, body };
            await redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(responseData));
          }
          await redis.del(lockKey);
        } catch (err: unknown) {
          logger.error('Failed to cache response or release lock', { cacheKey, lockKey, error: err });
        }
      };

      // Intercept response to cache it — both send() and json()
      const originalSend = res.send;
      const originalJson = res.json;

      res.send = function (data) {
        cacheResponse(res.statusCode, typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return data; } })() : data);
        return originalSend.call(this, data);
      };

      res.json = function (data) {
        cacheResponse(res.statusCode, data);
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error:', error);
      next();
    }
  };
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Clear idempotency cache (for testing or manual cleanup)
 */
export async function clearIdempotencyKey(redis: Redis, idempotencyKey: string): Promise<void> {
  const pattern = `idempotency:*:${idempotencyKey}`;
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Helper to add idempotency key to outgoing requests
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}

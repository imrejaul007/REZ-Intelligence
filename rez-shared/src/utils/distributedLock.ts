import Redis from 'ioredis';

export class DistributedLock {
  private redis: Redis;
  private locks = new Map<string, boolean>();

  constructor(redis?: Redis) {
    this.redis = redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async acquire(
    key: string,
    ttlMs: number = 10000
  ): Promise<() => Promise<void>> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}:${Math.random()}`;

    // Try to acquire lock
    const acquired = await this.redis.set(
      lockKey,
      lockValue,
      'PX',
      ttlMs,
      'NX'
    );

    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${key}`);
    }

    this.locks.set(key, true);

    // Return release function
    return async () => {
      // Use Lua script for atomic unlock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      await this.redis.eval(script, 1, lockKey, lockValue);
      this.locks.delete(key);
    };
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 10000
  ): Promise<T> {
    const release = await this.acquire(key, ttlMs);
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const exists = await this.redis.exists(`lock:${key}`);
    return exists === 1;
  }
}

export const distributedLock = new DistributedLock();

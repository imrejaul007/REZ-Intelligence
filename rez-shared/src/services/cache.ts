import Redis from 'ioredis';

const DEFAULT_TTL = 300; // 5 minutes

export class CacheService {
  private redis: Redis;
  private static instance: CacheService;

  private constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    return this.redis.incrby(key, amount);
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.redis.decrby(key, amount);
  }

  async setHash(key: string, field: string, value: any): Promise<void> {
    await this.redis.hset(key, field, JSON.stringify(value));
  }

  async getHash(key: string, field: string): Promise<any> {
    const value = await this.redis.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  async getAllHash(key: string): Promise<Record<string, any>> {
    const data = await this.redis.hgetall(key);
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = JSON.parse(v);
    }
    return result;
  }
}

export const cache = CacheService.getInstance();

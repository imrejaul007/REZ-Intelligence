import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

export const IDEMPOTENCY_KEY_HEADER = 'X-Idempotency-Key';
export const IDEMPOTENCY_KEY_TTL = 86400; // 24 hours

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(`idempotency:${key}`);
  }

  async set(key: string, value: string, ttl = IDEMPOTENCY_KEY_TTL): Promise<void> {
    await this.redis.setex(`idempotency:${key}`, ttl, value);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(`idempotency:${key}`);
    return result === 1;
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl = IDEMPOTENCY_KEY_TTL): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
}

export function generateIdempotencyKey(): string {
  return uuidv4();
}

export async function ensureIdempotency(
  store: IdempotencyStore,
  key: string,
  operation: () => Promise<string>,
): Promise<string> {
  const existing = await store.get(key);
  if (existing) {
    return existing;
  }

  const result = await operation();
  await store.set(key, result);
  return result;
}

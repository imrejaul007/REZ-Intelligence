import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

describe('Intent Service Integration', () => {
  let userId: string;
  let intentId: string;

  beforeAll(async () => {
    await redis.ping();
  });

  afterAll(async () => {
    await redis.quit();
  });

  test('capture signal', async () => {
    userId = `test-${Date.now()}`;

    const signal = await fetch('http://localhost:4009/api/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        appType: 'restaurant',
        eventType: 'search',
        category: 'DINING',
        intentKey: 'pizza'
      })
    });

    expect(signal.ok).toBeTruthy();
  });

  test('get active intents', async () => {
    const intents = await fetch(`http://localhost:4009/api/signals/active/${userId}`);
    expect(intents.ok).toBeTruthy();
  });

  test('dormancy detection', async () => {
    const response = await fetch('http://localhost:4009/api/dormant/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 7 })
    });
    expect(response.ok).toBeTruthy();
  });
});

/**
 * Intent Service Integration Tests
 * Tests all 8 event types and ML scoring
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const BASE_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4009';
let testUserId: string;

describe('Signal Capture', () => {
  beforeAll(async () => {
    testUserId = `test-${Date.now()}`;
  });

  test('should capture search event', async () => {
    const response = await fetch(`${BASE_URL}/api/signals/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        appType: 'restaurant',
        eventType: 'search',
        category: 'DINING',
        intentKey: 'pizza'
      })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.signal).toBeDefined();
    expect(data.data.signal.eventType).toBe('search');
  });

  test('should capture view event', async () => {
    const response = await fetch(`${BASE_URL}/api/signals/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        appType: 'restaurant',
        eventType: 'view',
        category: 'DINING',
        intentKey: 'margherita pizza'
      })
    });

    expect(response.ok).toBeTruthy();
  });

  test('should capture cart_add event', async () => {
    const response = await fetch(`${BASE_URL}/api/signals/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        appType: 'restaurant',
        eventType: 'cart_add',
        category: 'DINING',
        intentKey: 'pizza combo'
      })
    });

    expect(response.ok).toBeTruthy();
  });

  test('should capture all 8 event types', async () => {
    const eventTypes = [
      'search', 'view', 'wishlist', 'cart_add',
      'hold', 'checkout_start', 'fulfilled', 'abandoned'
    ];

    for (const eventType of eventTypes) {
      const response = await fetch(`${BASE_URL}/api/signals/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          appType: 'restaurant',
          eventType,
          category: 'DINING',
          intentKey: `test-${eventType}`
        })
      });

      expect(response.ok).toBeTruthy();
    }
  });

  test('should get active intents', async () => {
    const response = await fetch(`${BASE_URL}/api/signals/active/${testUserId}`);
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should find similar intents', async () => {
    const response = await fetch(
      `${BASE_URL}/api/signals/similar/${testUserId}?intentKey=pizza&category=DINING`
    );
    expect(response.ok).toBeTruthy();
  });
});

describe('Dormancy Detection', () => {
  test('should detect dormant intents', async () => {
    const response = await fetch(`${BASE_URL}/api/dormant/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 7 })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should calculate revival score', async () => {
    const response = await fetch(`${BASE_URL}/api/dormant/score/test-intent-1`);
    expect(response.ok).toBeTruthy();
  });

  test('should trigger revival', async () => {
    const response = await fetch(`${BASE_URL}/api/dormant/trigger/test-intent-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerType: 'price_drop' })
    });

    expect(response.ok).toBeTruthy();
  });
});

describe('Profiles', () => {
  test('should get user profile', async () => {
    const response = await fetch(`${BASE_URL}/api/profiles/${testUserId}`);
    expect(response.ok).toBeTruthy();
  });

  test('should calculate scores', async () => {
    const response = await fetch(`${BASE_URL}/api/profiles/${testUserId}/scores`, {
      method: 'POST'
    });
    expect(response.ok).toBeTruthy();
  });

  test('should get recommendations', async () => {
    const response = await fetch(
      `${BASE_URL}/api/profiles/${testUserId}/recommendations?limit=10`
    );
    expect(response.ok).toBeTruthy();
  });

  test('should get segments', async () => {
    const response = await fetch(`${BASE_URL}/api/profiles/${testUserId}/segments`);
    expect(response.ok).toBeTruthy();
  });
});

describe('AI Agents', () => {
  test('should get agent status', async () => {
    const response = await fetch(`${BASE_URL}/api/agents/status`);
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should run individual agent', async () => {
    const response = await fetch(`${BASE_URL}/api/agents/run/demandSignal`, {
      method: 'POST'
    });
    expect(response.ok).toBeTruthy();
  });
});

describe('ML Scoring', () => {
  test('should calculate confidence score', async () => {
    const response = await fetch(`${BASE_URL}/api/signals/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        appType: 'restaurant',
        eventType: 'checkout_start',
        category: 'DINING',
        intentKey: 'premium pizza'
      })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.data.signal.confidence).toBeGreaterThan(0);
  });

  test('should apply recency multiplier', async () => {
    // Rapid signals should have velocity bonus
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/api/signals/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          appType: 'restaurant',
          eventType: 'view',
          category: 'DINING',
          intentKey: 'rapid-test'
        })
      });
    }

    const intents = await fetch(`${BASE_URL}/api/signals/active/${testUserId}`);
    const data = await intents.json();
    const rapidIntent = data.data.find((i: any) => i.intentKey === 'rapid-test');

    expect(rapidIntent).toBeDefined();
    expect(rapidIntent.velocityBonus).toBeGreaterThan(0);
  });
});

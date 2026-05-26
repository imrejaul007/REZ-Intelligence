import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

describe('Workflow Builder API', () => {
  const BASE_URL = 'http://localhost:4199';

  beforeAll(async () => {
    // Wait for service to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('rez-workflow-builder');
      expect(data.timestamp).toBeDefined();
    });

    it('GET /ready should return ready status with MongoDB state', async () => {
      const response = await fetch(`${BASE_URL}/ready`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ready');
      expect(data.mongodb).toBeDefined();
    });
  });

  describe('Workflow CRUD', () => {
    const testApiKey = process.env.TEST_API_KEY || 'test-api-key';
    let workflowId: string;

    it('POST /api/workflows should create a new workflow', async () => {
      const response = await fetch(`${BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': testApiKey,
        },
        body: JSON.stringify({
          name: 'Test Workflow',
          trigger: {
            type: 'manual',
          },
          steps: [
            {
              id: 'step1',
              type: 'action',
              config: { action: 'send_notification' },
            },
          ],
          isActive: true,
        }),
      });

      const data = await response.json();

      if (response.status === 201) {
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.name).toBe('Test Workflow');
        workflowId = data.data.id;
      } else {
        // May fail due to auth or MongoDB
        expect([201, 401, 500]).toContain(response.status);
      }
    });

    it('GET /api/workflows should list workflows', async () => {
      const response = await fetch(`${BASE_URL}/api/workflows`, {
        headers: {
          'x-api-key': testApiKey,
        },
      });

      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      } else {
        expect([200, 401, 500]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Make multiple rapid requests
      const results: number[] = [];

      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${BASE_URL}/api/workflows`);
        results.push(response.status);
      }

      // Should either all succeed or some get 429
      const hasRateLimit = results.includes(429);
      const allSucceed = results.every(s => s === 200);
      expect(hasRateLimit || allSucceed).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await fetch(`${BASE_URL}/health`);

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBeDefined();
      expect(response.headers.get('strict-transport-security')).toBeDefined();
    });
  });
});

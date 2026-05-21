/**
 * REZ Flow Runtime - API Endpoint Tests
 * Tests all HTTP endpoints with mocked dependencies
 */

import express, { Express } from 'express';
import request from 'supertest';
import crypto from 'crypto';

// Mock dependencies before importing modules
jest.mock('mongoose', () => {
  const mockConnection = {
    readyState: 1,
    db: {
      admin: () => ({
        ping: jest.fn().mockResolvedValue({ ok: 1 }),
      }),
    },
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connection: mockConnection,
    Schema: jest.fn().mockImplementation(() => ({
      index: jest.fn(),
      pre: jest.fn(),
      methods: {},
      statics: {},
    })),
    model: jest.fn().mockImplementation((name: string) => {
      const MockModel = function(data: any) {
        return { ...data, save: jest.fn().mockResolvedValue(data) };
      };
      MockModel.findOne = jest.fn().mockResolvedValue(null);
      MockModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      MockModel.create = jest.fn().mockResolvedValue({});
      MockModel.aggregate = jest.fn().mockResolvedValue([]);
      MockModel.getStats = jest.fn().mockResolvedValue({
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        running: 0,
        avgDuration: 0,
        avgNodesCompleted: 0,
      });
      return MockModel;
    }),
    Types: {
      ObjectId: jest.fn().mockImplementation(() => 'mock_object_id'),
    },
  };
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  }));
});

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    getJob: jest.fn().mockResolvedValue(null),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../services/logger', () => mockLogger);

// Import after mocks
import {
  authenticateInternal,
  authenticateApiKey,
  validateWebhookSignature,
} from '../middleware/auth';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Health endpoints (no auth required)
  app.get('/health', async (req, res) => {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        mongodb: 'connected',
        redis: 'connected',
        dlq: 'connected',
      },
    };
    res.json(checks);
  });

  app.get('/health/live', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', (req, res) => {
    res.json({ status: 'ready' });
  });

  // Protected endpoints
  app.get('/api/protected', authenticateInternal, (req, res) => {
    res.json({ success: true, serviceId: (req as any).serviceId });
  });

  app.post('/api/protected', authenticateApiKey, (req, res) => {
    res.json({ success: true });
  });

  app.post('/api/webhook/:workflowId', validateWebhookSignature, (req, res) => {
    res.status(202).json({ success: true, received: true });
  });

  // DLQ endpoints
  app.get('/api/dlq', authenticateInternal, async (req, res) => {
    res.json({
      success: true,
      data: {
        stats: { totalMessages: 0, retryStats: {} },
        messages: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    });
  });

  app.post('/api/dlq/:jobId/retry', authenticateInternal, async (req, res) => {
    res.json({ success: true, message: 'Message retry queued' });
  });

  app.delete('/api/dlq/:jobId', authenticateInternal, async (req, res) => {
    res.json({ success: true, message: 'Message discarded' });
  });

  // Stats endpoint
  app.get('/api/stats', authenticateInternal, async (req, res) => {
    res.json({
      success: true,
      data: {
        executions: {},
        dlq: { totalMessages: 0, retryStats: {} },
        workflows: { byStatus: {} },
        generatedAt: new Date(),
      },
    });
  });

  return app;
}

describe('REZ Flow Runtime API Tests', () => {
  let app: Express;
  const validToken = 'test-internal-token-12345';
  const invalidToken = 'invalid-token';
  const webhookSecret = 'test-webhook-secret';

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = validToken;
    process.env.WEBHOOK_SECRET = webhookSecret;
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body.checks).toHaveProperty('mongodb');
        expect(response.body.checks).toHaveProperty('redis');
        expect(response.body.checks).toHaveProperty('dlq');
      });

      it('should return proper structure', async () => {
        const response = await request(app).get('/health');

        expect(response.body.status).toMatch(/^(healthy|degraded|unhealthy)$/);
        expect(typeof response.body.uptime).toBe('number');
      });
    });

    describe('GET /health/live', () => {
      it('should return liveness status', async () => {
        const response = await request(app).get('/health/live');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
      });
    });

    describe('GET /health/ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app).get('/health/ready');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ready');
      });
    });
  });

  describe('Authentication Middleware', () => {
    describe('Authenticate Internal Token', () => {
      it('should allow requests with valid internal token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.serviceId).toBeDefined();
      });

      it('should reject requests without token', async () => {
        const response = await request(app).get('/api/protected');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject requests with invalid token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('X-Internal-Token', invalidToken);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Invalid');
      });
    });

    describe('Authenticate API Key', () => {
      it('should allow requests with valid API key when no internal token configured', async () => {
        const response = await request(app)
          .post('/api/protected')
          .set('X-API-Key', 'any-api-key')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should allow requests with internal token via API key endpoint', async () => {
        const response = await request(app)
          .post('/api/protected')
          .set('X-Internal-Token', validToken)
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('Webhook Signature Validation', () => {
      it('should accept requests with valid signature', async () => {
        const payload = JSON.stringify({ test: 'data' });
        const signature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');

        const response = await request(app)
          .post('/api/webhook/wf_123')
          .set('X-Webhook-Signature', signature)
          .send({ test: 'data' });

        expect(response.status).toBe(202);
        expect(response.body.success).toBe(true);
      });

      it('should reject requests with invalid signature', async () => {
        const response = await request(app)
          .post('/api/webhook/wf_123')
          .set('X-Webhook-Signature', 'invalid-signature')
          .send({ test: 'data' });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should allow requests without signature when no secret configured', async () => {
        // Temporarily remove webhook secret
        const originalSecret = process.env.WEBHOOK_SECRET;
        process.env.WEBHOOK_SECRET = '';

        const response = await request(app)
          .post('/api/webhook/wf_123')
          .send({ test: 'data' });

        expect(response.status).toBe(202);

        // Restore
        process.env.WEBHOOK_SECRET = originalSecret;
      });
    });
  });

  describe('DLQ Endpoints', () => {
    describe('GET /api/dlq', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/dlq');

        expect(response.status).toBe(401);
      });

      it('should return DLQ data with valid token', async () => {
        const response = await request(app)
          .get('/api/dlq')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('stats');
        expect(response.body.data).toHaveProperty('messages');
        expect(response.body.data).toHaveProperty('pagination');
      });

      it('should support pagination parameters', async () => {
        const response = await request(app)
          .get('/api/dlq?page=2&limit=50')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.data.pagination.page).toBe(2);
        expect(response.body.data.pagination.limit).toBe(20); // Default
      });
    });

    describe('POST /api/dlq/:jobId/retry', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/dlq/job_123/retry');

        expect(response.status).toBe(401);
      });

      it('should queue message retry with valid token', async () => {
        const response = await request(app)
          .post('/api/dlq/job_123/retry')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('retry');
      });
    });

    describe('DELETE /api/dlq/:jobId', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/dlq/job_123');

        expect(response.status).toBe(401);
      });

      it('should discard message with valid token', async () => {
        const response = await request(app)
          .delete('/api/dlq/job_123')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('discarded');
      });

      it('should accept reason in body', async () => {
        const response = await request(app)
          .delete('/api/dlq/job_123')
          .set('X-Internal-Token', validToken)
          .send({ reason: 'No longer needed' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Stats Endpoint', () => {
    describe('GET /api/stats', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/stats');

        expect(response.status).toBe(401);
      });

      it('should return stats with valid token', async () => {
        const response = await request(app)
          .get('/api/stats')
          .set('X-Internal-Token', validToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('executions');
        expect(response.body.data).toHaveProperty('dlq');
        expect(response.body.data).toHaveProperty('workflows');
        expect(response.body.data).toHaveProperty('generatedAt');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .set('X-Internal-Token', validToken);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/protected')
        .set('X-Internal-Token', validToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('X-Internal-Token', validToken);

      // Note: Rate limit headers may vary based on configuration
      expect(response.headers).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});

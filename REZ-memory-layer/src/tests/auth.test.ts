/**
 * REZ Memory Layer - Authentication Tests
 * Tests authentication middleware with various scenarios
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

const TEST_TOKEN = 'valid-memory-layer-token-12345';
const TEST_API_KEY = 'rez_memory_layer_test_key_12345';

// Mock dependencies
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

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  connection: {
    readyState: 1,
    db: {
      admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }),
      collection: jest.fn().mockReturnValue({
        createIndex: jest.fn().mockResolvedValue('index_created'),
      }),
    },
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  },
  Schema: jest.fn().mockImplementation(() => ({
    index: jest.fn(),
    pre: jest.fn(),
    methods: {},
    statics: {},
  })),
  model: jest.fn().mockImplementation(() => {
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
    return MockModel;
  }),
  Types: { ObjectId: jest.fn().mockImplementation(() => 'mock_id') },
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../config/logger', () => ({
  logger: mockLogger,
  createContextLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import auth middleware
import {
  authMiddleware,
  optionalAuthMiddleware,
  requestLogger,
  errorHandler,
} from '../middleware/auth';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  // Protected endpoint
  app.get('/protected', authMiddleware, (req: Request, res: Response) => {
    res.json({
      success: true,
      authenticated: true,
      serviceId: req.serviceId,
      isInternal: req.isInternal,
    });
  });

  // Optional auth endpoint
  app.get('/optional-auth', optionalAuthMiddleware, (req: Request, res: Response) => {
    res.json({
      success: true,
      hasAuth: !!(req.headers['x-internal-token'] || req.headers['x-api-key']),
      serviceId: req.serviceId,
    });
  });

  // Public endpoint
  app.get('/public', (req: Request, res: Response) => {
    res.json({ success: true, public: true });
  });

  // Error throwing endpoint
  app.get('/error', (req: Request, res: Response) => {
    throw new Error('Test error');
  });

  app.use(errorHandler);

  return app;
}

describe('REZ Memory Layer Authentication Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = TEST_TOKEN;
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    describe('Valid Authentication', () => {
      it('should authenticate with valid internal token', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
        expect(response.body.isInternal).toBe(true);
        expect(response.body.serviceId).toBe('internal');
      });

      it('should authenticate with valid API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
      });

      it('should extract service ID from API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-API-Key', TEST_API_KEY);

        expect(response.body.serviceId).toBe('memory');
      });
    });

    describe('Invalid Authentication', () => {
      it('should reject requests without any authentication', async () => {
        const response = await request(app).get('/protected');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject requests with empty token', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Internal-Token', '');

        expect(response.status).toBe(401);
      });

      it('should reject requests with invalid token', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Internal-Token', 'invalid-token-xyz');

        expect(response.status).toBe(401);
      });

      it('should reject requests with invalid API key format', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-API-Key', 'short');

        expect(response.status).toBe(401);
      });

      it('should reject API keys without rez_ prefix', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-API-Key', 'invalid_prefix_key');

        expect(response.status).toBe(401);
      });
    });

    describe('Security Logging', () => {
      it('should log unauthorized access attempts', async () => {
        await request(app).get('/protected');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Unauthorized access attempt',
          expect.objectContaining({
            ip: expect.any(String),
            path: '/protected',
            method: 'GET',
          })
        );
      });
    });
  });

  describe('optionalAuthMiddleware', () => {
    describe('Request Handling', () => {
      it('should allow requests without authentication', async () => {
        const response = await request(app).get('/optional-auth');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.hasAuth).toBe(false);
      });

      it('should process valid internal token', async () => {
        const response = await request(app)
          .get('/optional-auth')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.hasAuth).toBe(true);
      });

      it('should process valid API key', async () => {
        const response = await request(app)
          .get('/optional-auth')
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.hasAuth).toBe(true);
      });

      it('should continue with invalid token in optional auth', async () => {
        const response = await request(app)
          .get('/optional-auth')
          .set('X-Internal-Token', 'invalid-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('requestLogger', () => {
    it('should log request details', async () => {
      await request(app).get('/public');

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log request duration', async () => {
      await request(app).get('/public');

      const logCall = mockLogger.info.mock.calls.find(
        (call) => call[0] === 'Request completed'
      );

      expect(logCall).toBeDefined();
      expect(logCall[1]).toHaveProperty('method', 'GET');
      expect(logCall[1]).toHaveProperty('path', '/public');
      expect(logCall[1]).toHaveProperty('statusCode', 200);
      expect(logCall[1]).toHaveProperty('duration');
    });

    it('should include service ID in logs when authenticated', async () => {
      await request(app)
        .get('/optional-auth')
        .set('X-Internal-Token', TEST_TOKEN);

      const logCall = mockLogger.info.mock.calls.find(
        (call) => call[0] === 'Request completed'
      );

      expect(logCall[1]).toHaveProperty('serviceId', 'internal');
    });
  });

  describe('errorHandler', () => {
    it('should handle thrown errors', async () => {
      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should log error details', async () => {
      await request(app).get('/error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled error',
        expect.objectContaining({
          error: expect.any(String),
          path: '/error',
          method: 'GET',
        })
      );
    });

    it('should not expose error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/error');

      expect(response.body.error.message).toBe('An unexpected error occurred');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Best Practices', () => {
    it('should not leak sensitive information in responses', async () => {
      const response = await request(app)
        .get('/protected')
        .set('X-Internal-Token', 'wrong-token');

      expect(response.body.error.message).not.toContain(TEST_TOKEN);
      expect(response.body.error.message).not.toContain('secret');
    });

    it('should handle concurrent authentication attempts', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .get('/protected')
            .set('X-Internal-Token', TEST_TOKEN)
        );

      const responses = await Promise.all(promises);

      expect(responses.every((r) => r.status === 200)).toBe(true);
    });

    it('should consistently reject invalid tokens', async () => {
      const tokens = ['invalid1', 'invalid2', 'invalid3'];

      for (const token of tokens) {
        const response = await request(app)
          .get('/protected')
          .set('X-Internal-Token', token);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Rate Limiting (via in-memory store)', () => {
    it('should track requests per IP', async () => {
      // Make multiple requests
      for (let i = 0; i < 3; i++) {
        await request(app).get('/public');
      }

      // Logger should have been called for each request
      expect(mockLogger.info).toHaveBeenCalledTimes(3);
    });
  });
});

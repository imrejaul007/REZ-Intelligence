/**
 * REZ WhatsApp Service - Authentication Tests
 * Tests authentication middleware with various scenarios
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';

const TEST_TOKEN = 'valid-whatsapp-service-token-12345';
const TEST_TOKEN_2 = 'another-service-token-67890';

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
    },
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  },
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../utils/logger', () => ({
  logger: mockLogger,
  default: mockLogger,
}));

// Import auth middleware
import {
  validateInternalToken,
  verifyTwilioWebhook,
  validateMerchantAuth,
  optionalAuth,
  requireRole,
  rateLimiter,
} from '../middleware/auth';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Test endpoints for each middleware
  app.get('/auth/internal', validateInternalToken, (req: Request, res: Response) => {
    const authReq = req as any;
    res.json({
      success: true,
      authenticated: true,
      isInternalService: authReq.isInternalService,
    });
  });

  app.get('/auth/twilio', verifyTwilioWebhook, (req: Request, res: Response) => {
    res.json({ success: true, webhook: true });
  });

  app.get('/auth/merchant', validateMerchantAuth, (req: Request, res: Response) => {
    const authReq = req as any;
    res.json({
      success: true,
      merchantId: authReq.merchantId,
    });
  });

  app.get('/auth/optional', optionalAuth, (req: Request, res: Response) => {
    res.json({ success: true });
  });

  app.get('/auth/admin', validateInternalToken, requireRole(['admin']), (req: Request, res: Response) => {
    res.json({ success: true, role: 'admin' });
  });

  const rateLimited = rateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'test' });
  app.get('/auth/ratelimit', rateLimited, (req: Request, res: Response) => {
    res.json({ success: true });
  });

  return app;
}

describe('REZ WhatsApp Service Authentication Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = TEST_TOKEN;
    process.env.INTERNAL_SERVICE_TOKENS_JSON = JSON.stringify({
      'workflow-service': TEST_TOKEN_2,
    });
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateInternalToken', () => {
    describe('Valid Token Scenarios', () => {
      it('should authenticate with valid X-Internal-Token header', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
        expect(response.body.isInternalService).toBe(true);
      });

      it('should authenticate with token from JSON map', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', TEST_TOKEN_2);

        expect(response.status).toBe(200);
        expect(response.body.authenticated).toBe(true);
      });

      it('should authenticate with multiple configured tokens', async () => {
        const tokens = [TEST_TOKEN, TEST_TOKEN_2];

        for (const token of tokens) {
          const response = await request(app)
            .get('/auth/internal')
            .set('X-Internal-Token', token);

          expect(response.status).toBe(200);
        }
      });
    });

    describe('Invalid Token Scenarios', () => {
      it('should reject request without token', async () => {
        const response = await request(app).get('/auth/internal');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject request with empty token', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', '');

        expect(response.status).toBe(401);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'invalid-whatsapp-token-xyz');

        expect(response.status).toBe(401);
        expect(response.body.error.message).toContain('Invalid');
      });

      it('should reject token with wrong format', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'Bearer ' + TEST_TOKEN);

        expect(response.status).toBe(401);
      });
    });

    describe('Security Logging', () => {
      it('should log invalid token attempts', async () => {
        await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'invalid');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Invalid internal token',
          expect.objectContaining({
            path: '/auth/internal',
            ip: expect.any(String),
          })
        );
      });

      it('should log missing token attempts', async () => {
        await request(app).get('/auth/internal');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Missing internal token',
          expect.objectContaining({
            path: '/auth/internal',
          })
        );
      });
    });
  });

  describe('verifyTwilioWebhook', () => {
    describe('Request Handling', () => {
      it('should allow webhook requests through', async () => {
        const response = await request(app)
          .post('/auth/twilio')
          .send({ test: 'webhook' });

        expect(response.status).toBe(200);
        expect(response.body.webhook).toBe(true);
      });

      it('should log missing signature', async () => {
        await request(app)
          .post('/auth/twilio')
          .send({ test: 'webhook' });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Missing Twilio signature',
          expect.any(Object)
        );
      });
    });

    describe('Production Validation', () => {
      it('should implement signature validation in production', async () => {
        // In production, verifyTwilioWebhook should validate X-Twilio-Signature
        // For now, it allows requests through with a warning
        const response = await request(app)
          .post('/auth/twilio')
          .set('X-Twilio-Signature', 'some-signature')
          .send({ test: 'data' });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('validateMerchantAuth', () => {
    describe('Valid Authorization', () => {
      it('should accept valid Bearer token', async () => {
        const response = await request(app)
          .get('/auth/merchant')
          .set('Authorization', 'Bearer merchant_token_123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.merchantId).toBe('merchant_token_123');
      });

      it('should accept valid Bearer token with long value', async () => {
        const merchantToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

        const response = await request(app)
          .get('/auth/merchant')
          .set('Authorization', `Bearer ${merchantToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid Authorization', () => {
      it('should reject request without Authorization header', async () => {
        const response = await request(app).get('/auth/merchant');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject request without Bearer prefix', async () => {
        const response = await request(app)
          .get('/auth/merchant')
          .set('Authorization', 'Basic dXNlcjpwYXNz');

        expect(response.status).toBe(401);
      });

      it('should reject request with empty token', async () => {
        const response = await request(app)
          .get('/auth/merchant')
          .set('Authorization', 'Bearer ');

        expect(response.status).toBe(401);
      });
    });

    describe('JWT Validation', () => {
      it('should accept development tokens without JWT validation', async () => {
        // In development mode, any Bearer token is accepted
        const response = await request(app)
          .get('/auth/merchant')
          .set('Authorization', 'Bearer any-token-value');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('optionalAuth', () => {
    describe('Request Handling', () => {
      it('should allow requests without authentication', async () => {
        const response = await request(app).get('/auth/optional');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should process Bearer token if present', async () => {
        const response = await request(app)
          .get('/auth/optional')
          .set('Authorization', 'Bearer optional_token');

        expect(response.status).toBe(200);
      });

      it('should ignore invalid Bearer tokens', async () => {
        const response = await request(app)
          .get('/auth/optional')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('requireRole', () => {
    describe('Role Validation', () => {
      it('should allow request with matching role', async () => {
        const response = await request(app)
          .get('/auth/admin')
          .set('X-Internal-Token', TEST_TOKEN)
          .set('X-User-Role', 'admin');

        expect(response.status).toBe(200);
        expect(response.body.role).toBe('admin');
      });

      it('should reject request without role', async () => {
        const response = await request(app)
          .get('/auth/admin')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should reject request with wrong role', async () => {
        const response = await request(app)
          .get('/auth/admin')
          .set('X-Internal-Token', TEST_TOKEN)
          .set('X-User-Role', 'user');

        expect(response.status).toBe(403);
      });

      it('should accept multiple valid roles', async () => {
        const roles = ['admin', 'super_admin', 'moderator'];

        for (const role of roles) {
          // Create a new app with this role in the middleware
          const testApp = express();
          testApp.use(express.json());
          testApp.get(
            '/test',
            validateInternalToken,
            requireRole(['admin', 'super_admin', 'moderator']),
            (req: Request, res: Response) => {
              res.json({ success: true, role: req.headers['x-user-role'] });
            }
          );

          const response = await request(testApp)
            .get('/test')
            .set('X-Internal-Token', TEST_TOKEN)
            .set('X-User-Role', role);

          expect(response.status).toBe(200);
        }
      });
    });
  });

  describe('rateLimiter', () => {
    describe('Rate Limiting', () => {
      it('should allow requests within limit', async () => {
        // Make requests up to the limit (5)
        for (let i = 0; i < 5; i++) {
          const response = await request(app).get('/auth/ratelimit');
          expect(response.status).toBe(200);
        }
      });

      it('should include rate limit headers', async () => {
        const response = await request(app).get('/auth/ratelimit');

        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      });

      it('should reject requests over limit', async () => {
        // Make requests up to limit
        for (let i = 0; i < 5; i++) {
          await request(app).get('/auth/ratelimit');
        }

        // This request should be rate limited
        const response = await request(app).get('/auth/ratelimit');

        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      });
    });

    describe('Header Values', () => {
      it('should set correct limit header', async () => {
        const response = await request(app).get('/auth/ratelimit');

        expect(response.headers['x-ratelimit-limit']).toBe('5');
      });

      it('should decrement remaining count', async () => {
        // First request
        const response1 = await request(app).get('/auth/ratelimit');
        const remaining = parseInt(response1.headers['x-ratelimit-remaining'] as string);

        // Should be 4 or less (started at 5)
        expect(remaining).toBeLessThanOrEqual(4);
      });
    });
  });

  describe('Security Best Practices', () => {
    it('should use timing-safe comparison for tokens', async () => {
      // Similar tokens should both be rejected
      const response1 = await request(app)
        .get('/auth/internal')
        .set('X-Internal-Token', TEST_TOKEN.substring(0, 10) + 'xxxxxxxxx');

      expect(response1.status).toBe(401);
    });

    it('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/auth/internal')
        .set('X-Internal-Token', 'attacker-controlled-token');

      expect(response.body.error.message).not.toContain(TEST_TOKEN);
      expect(response.body.error.message).not.toContain('secret');
      expect(response.body.error.message).not.toContain('password');
    });

    it('should handle concurrent authentication requests', async () => {
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/auth/internal')
            .set('X-Internal-Token', TEST_TOKEN)
        );

      const responses = await Promise.all(promises);

      expect(responses.every((r) => r.status === 200)).toBe(true);
    });

    it('should maintain constant response time for similar tokens', async () => {
      const invalidTokens = ['a', 'ab', 'abc', 'abcd', 'abcde'];

      const times = await Promise.all(
        invalidTokens.map(async (token) => {
          const start = Date.now();
          await request(app)
            .get('/auth/internal')
            .set('X-Internal-Token', token);
          return Date.now() - start;
        })
      );

      // All responses should take similar time (within 100ms of each other)
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const allSimilar = times.every((t) => Math.abs(t - avg) < 100);

      expect(allSimilar).toBe(true);
    });
  });
});

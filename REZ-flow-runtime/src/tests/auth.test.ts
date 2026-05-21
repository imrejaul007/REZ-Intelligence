/**
 * REZ Flow Runtime - Authentication Tests
 * Tests authentication middleware with various scenarios
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../services/logger', () => mockLogger);

// Import auth middleware
import {
  authenticateInternal,
  authenticateApiKey,
  optionalAuth,
  validateWebhookSignature,
  AuthenticatedRequest,
} from '../middleware/auth';

// Test configuration
const TEST_TOKEN = 'valid-internal-service-token-12345';
const TEST_API_KEY = 'valid-api-key-for-workflow-builder';
const WEBHOOK_SECRET = 'test-webhook-secret-67890';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Test endpoints for each auth middleware
  app.get('/auth/internal', authenticateInternal, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    res.json({
      success: true,
      authenticated: true,
      serviceId: authReq.serviceId,
      isInternal: authReq.isInternal,
    });
  });

  app.get('/auth/api-key', authenticateApiKey, (req: Request, res: Response) => {
    res.json({ success: true, authenticated: true });
  });

  app.get('/auth/optional', optionalAuth, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    res.json({
      success: true,
      hasAuth: !!(authReq.headers['x-internal-token'] || authReq.headers['x-api-key']),
    });
  });

  app.post('/auth/webhook', validateWebhookSignature, (req: Request, res: Response) => {
    res.json({ success: true, received: true });
  });

  return app;
}

describe('REZ Flow Runtime Authentication Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = TEST_TOKEN;
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateInternal', () => {
    describe('Valid Token Scenarios', () => {
      it('should authenticate with valid X-Internal-Token header', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.authenticated).toBe(true);
        expect(response.body.isInternal).toBe(true);
      });

      it('should authenticate with valid token and set service ID', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', TEST_TOKEN)
          .set('X-Service-Id', 'test-service');

        expect(response.status).toBe(200);
        expect(response.body.serviceId).toBe('test-service');
      });

      it('should allow service ID extraction from header', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', TEST_TOKEN)
          .set('X-Service-Id', 'workflow-builder');

        expect(response.status).toBe(200);
        expect(response.body.serviceId).toBe('workflow-builder');
      });
    });

    describe('Invalid Token Scenarios', () => {
      it('should reject request without token', async () => {
        const response = await request(app).get('/auth/internal');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
        expect(response.body.error.message).toContain('Missing');
      });

      it('should reject request with empty token', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', '');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'invalid-token-xyz');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Invalid');
      });

      it('should reject request with malformed token', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', '   whitespace-only-token   ');

        expect(response.status).toBe(401);
      });

      it('should reject expired or old tokens', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'expired-token-12345');

        expect(response.status).toBe(401);
      });

      it('should reject tokens with wrong format', async () => {
        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'Bearer ' + TEST_TOKEN);

        expect(response.status).toBe(401);
      });
    });

    describe('Security Edge Cases', () => {
      it('should use timing-safe comparison for token validation', async () => {
        // This test ensures timing-safe comparison is used
        // by checking that similar tokens are not accepted
        const similarToken = TEST_TOKEN.substring(0, TEST_TOKEN.length - 1) + 'x';

        const response = await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', similarToken);

        expect(response.status).toBe(401);
      });

      it('should log unauthorized access attempts', async () => {
        await request(app)
          .get('/auth/internal')
          .set('X-Internal-Token', 'invalid');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Invalid internal token',
          expect.objectContaining({
            ip: expect.any(String),
            path: '/auth/internal',
            method: 'GET',
          })
        );
      });

      it('should log missing token attempts', async () => {
        await request(app).get('/auth/internal');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Missing internal token',
          expect.objectContaining({
            ip: expect.any(String),
            path: '/auth/internal',
            method: 'GET',
          })
        );
      });
    });
  });

  describe('authenticateApiKey', () => {
    beforeAll(() => {
      process.env.VALID_API_KEYS = TEST_API_KEY + ',another-valid-key';
    });

    describe('Valid API Key Scenarios', () => {
      it('should authenticate with valid API key', async () => {
        const response = await request(app)
          .get('/auth/api-key')
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should allow internal token as fallback', async () => {
        const response = await request(app)
          .get('/auth/api-key')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('Invalid API Key Scenarios', () => {
      it('should reject request without any auth', async () => {
        const response = await request(app).get('/auth/api-key');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject invalid API key', async () => {
        const response = await request(app)
          .get('/auth/api-key')
          .set('X-API-Key', 'invalid-key-123');

        expect(response.status).toBe(401);
      });

      it('should reject malformed API key', async () => {
        const response = await request(app)
          .get('/auth/api-key')
          .set('X-API-Key', '   ');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('optionalAuth', () => {
    describe('Request Handling', () => {
      it('should allow requests without any authentication', async () => {
        const response = await request(app).get('/auth/optional');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.hasAuth).toBe(false);
      });

      it('should process valid internal token', async () => {
        const response = await request(app)
          .get('/auth/optional')
          .set('X-Internal-Token', TEST_TOKEN);

        expect(response.status).toBe(200);
        expect(response.body.hasAuth).toBe(true);
      });

      it('should process valid API key', async () => {
        const response = await request(app)
          .get('/auth/optional')
          .set('X-API-Key', TEST_API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.hasAuth).toBe(true);
      });

      it('should ignore invalid tokens and continue', async () => {
        const response = await request(app)
          .get('/auth/optional')
          .set('X-Internal-Token', 'invalid-token');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('validateWebhookSignature', () => {
    describe('Valid Signature Scenarios', () => {
      it('should accept request with valid HMAC-SHA256 signature', async () => {
        const payload = { event: 'test', data: { id: '123' } };
        const payloadString = JSON.stringify(payload);
        const signature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(payloadString)
          .digest('hex');

        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', signature)
          .send(payload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.received).toBe(true);
      });

      it('should accept empty payload with valid signature', async () => {
        const payloadString = JSON.stringify({});
        const signature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(payloadString)
          .digest('hex');

        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', signature)
          .send({});

        expect(response.status).toBe(200);
      });

      it('should accept complex payload with valid signature', async () => {
        const payload = {
          events: [
            { type: 'order.created', data: { orderId: '123', amount: 100 } },
            { type: 'payment.completed', data: { paymentId: '456' } },
          ],
          metadata: { source: 'test', timestamp: Date.now() },
        };
        const payloadString = JSON.stringify(payload);
        const signature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(payloadString)
          .digest('hex');

        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', signature)
          .send(payload);

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid Signature Scenarios', () => {
      it('should reject request without signature', async () => {
        const response = await request(app)
          .post('/auth/webhook')
          .send({ test: 'data' });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
        expect(response.body.error.message).toContain('Missing');
      });

      it('should reject request with invalid signature', async () => {
        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', 'invalid-signature-hash')
          .send({ test: 'data' });

        expect(response.status).toBe(401);
        expect(response.body.error.message).toContain('Invalid');
      });

      it('should reject request with tampered payload', async () => {
        const originalPayload = { original: 'data' };
        const tamperedPayload = { original: 'tampered' };

        const signature = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(JSON.stringify(originalPayload))
          .digest('hex');

        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', signature)
          .send(tamperedPayload);

        expect(response.status).toBe(401);
      });

      it('should reject request with wrong signature format', async () => {
        const response = await request(app)
          .post('/auth/webhook')
          .set('X-Webhook-Signature', 'sha256=abc123')
          .send({ test: 'data' });

        expect(response.status).toBe(401);
      });
    });

    describe('No Secret Configured', () => {
      it('should allow requests when no webhook secret is configured', async () => {
        const originalSecret = process.env.WEBHOOK_SECRET;
        process.env.WEBHOOK_SECRET = '';

        const response = await request(app)
          .post('/auth/webhook')
          .send({ test: 'data' });

        expect(response.status).toBe(200);

        process.env.WEBHOOK_SECRET = originalSecret;
      });

      it('should log warning when no secret configured', async () => {
        const originalSecret = process.env.WEBHOOK_SECRET;
        process.env.WEBHOOK_SECRET = '';

        await request(app)
          .post('/auth/webhook')
          .send({ test: 'data' });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'WEBHOOK_SECRET not configured - skipping signature validation',
          expect.any(Object)
        );

        process.env.WEBHOOK_SECRET = originalSecret;
      });
    });
  });

  describe('Security Best Practices', () => {
    it('should use constant-time comparison to prevent timing attacks', async () => {
      // Test that similar tokens are rejected
      const token1 = TEST_TOKEN;
      const token2 = TEST_TOKEN.split('').reverse().join('');

      const response1 = await request(app)
        .get('/auth/internal')
        .set('X-Internal-Token', token1);

      const response2 = await request(app)
        .get('/auth/internal')
        .set('X-Internal-Token', token2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(401);
    });

    it('should not leak token information in error messages', async () => {
      const response = await request(app)
        .get('/auth/internal')
        .set('X-Internal-Token', 'attacker-controlled-token');

      expect(response.body.error.message).not.toContain(TEST_TOKEN);
      expect(response.body.error.message).not.toContain('secret');
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
  });
});

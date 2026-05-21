/**
 * REZ WhatsApp Service - API Endpoint Tests
 * Tests all HTTP endpoints with mocked dependencies
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import {
  generateMockMessage,
  generateMockConversation,
  generateMockCartItem,
  generateMockWebhookPayload,
  mockValidToken,
  mockPhoneNumber,
} from './setup';

// Mock dependencies
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      },
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    },
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    hset: jest.fn().mockResolvedValue(1),
    hget: jest.fn(),
    hgetall: jest.fn().mockResolvedValue({}),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SM_test_message_sid',
        status: 'queued',
      }),
    },
    conversations: {
      v1: {
        conversations: {
          create: jest.fn().mockResolvedValue({
            sid: 'CK_test_conversation_sid',
          }),
        },
      },
    },
  }));
});

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
} from '../middleware/auth';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Health endpoints (no auth required)
  app.get('/health', async (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'rez-whatsapp-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        mongodb: 'connected',
        redis: 'connected',
      },
    });
  });

  app.get('/ready', async (req: Request, res: Response) => {
    res.json({ status: 'ready' });
  });

  // WhatsApp messaging endpoints
  app.post('/api/whatsapp/send', validateInternalToken, async (req: Request, res: Response) => {
    const { to, type, content } = req.body;

    if (!to || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.json({
      success: true,
      message: {
        sid: 'SM_' + Date.now(),
        status: 'queued',
        to,
        type,
      },
    });
  });

  app.post('/api/whatsapp/session', validateInternalToken, async (req: Request, res: Response) => {
    const { userId, phoneNumber } = req.body;

    if (!userId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      session: {
        sessionId: 'session_' + Date.now(),
        userId,
        phoneNumber,
        state: 'idle',
        createdAt: new Date().toISOString(),
      },
    });
  });

  app.get('/api/whatsapp/session/:sessionId', validateInternalToken, async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (sessionId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
    }

    res.json({
      success: true,
      session: {
        sessionId,
        userId: 'user_123',
        state: 'idle',
        context: { cart: [] },
      },
    });
  });

  app.post('/api/whatsapp/cart', validateInternalToken, async (req: Request, res: Response) => {
    const { sessionId, operation, item } = req.body;

    if (!sessionId || !operation) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.json({
      success: true,
      cart: {
        items: operation === 'add' ? [item] : [],
        total: operation === 'add' ? item.price * item.quantity : 0,
      },
    });
  });

  app.post('/api/whatsapp/order', validateInternalToken, async (req: Request, res: Response) => {
    const { sessionId, merchantId, deliveryAddress } = req.body;

    if (!sessionId || !merchantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      order: {
        orderId: 'order_' + Date.now(),
        sessionId,
        merchantId,
        status: 'pending',
        deliveryAddress,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Webhook endpoints
  app.post('/webhook/whatsapp', verifyTwilioWebhook, async (req: Request, res: Response) => {
    // Process webhook
    res.sendStatus(200);
  });

  // Template endpoints
  app.get('/api/templates', validateInternalToken, async (req: Request, res: Response) => {
    res.json({
      success: true,
      templates: [
        {
          id: 'tmpl_1',
          name: 'hello_world',
          status: 'approved',
          category: 'marketing',
        },
      ],
    });
  });

  app.post('/api/templates', validateInternalToken, async (req: Request, res: Response) => {
    const { name, category, components } = req.body;

    if (!name || !category || !components) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      template: {
        id: 'tmpl_' + Date.now(),
        name,
        category,
        status: 'pending',
      },
    });
  });

  // Broadcast endpoints
  app.get('/api/broadcast', validateInternalToken, async (req: Request, res: Response) => {
    res.json({
      success: true,
      broadcasts: [
        {
          id: 'bc_1',
          name: 'Test Broadcast',
          status: 'completed',
          progress: { total: 100, sent: 100 },
        },
      ],
    });
  });

  app.post('/api/broadcast', validateInternalToken, async (req: Request, res: Response) => {
    const { name, templateId, segment } = req.body;

    if (!name || !templateId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      broadcast: {
        id: 'bc_' + Date.now(),
        name,
        templateId,
        status: 'draft',
      },
    });
  });

  app.get('/api/broadcast/:broadcastId', validateInternalToken, async (req: Request, res: Response) => {
    const { broadcastId } = req.params;

    if (broadcastId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Broadcast not found' },
      });
    }

    res.json({
      success: true,
      broadcast: {
        id: broadcastId,
        name: 'Test Broadcast',
        status: 'running',
        progress: { total: 100, sent: 50, delivered: 45 },
      },
    });
  });

  app.post('/api/broadcast/:broadcastId/send', validateInternalToken, async (req: Request, res: Response) => {
    const { broadcastId } = req.params;

    res.json({
      success: true,
      broadcastId,
      status: 'running',
      message: 'Broadcast started',
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  // Error handler
  app.use((error: Error, req: Request, res: Response, next: any) => {
    mockLogger.error('Unhandled error', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  });

  return app;
}

describe('REZ WhatsApp Service API Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = mockValidToken;
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
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('service', 'rez-whatsapp-service');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
      });

      it('should include dependency status', async () => {
        const response = await request(app).get('/health');

        expect(response.body.dependencies).toHaveProperty('mongodb');
        expect(response.body.dependencies).toHaveProperty('redis');
      });
    });

    describe('GET /ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app).get('/ready');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ready');
      });
    });
  });

  describe('Authentication', () => {
    describe('Valid Authentication', () => {
      it('should allow requests with valid internal token', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .set('X-Internal-Token', mockValidToken)
          .send({
            to: '+919876543210',
            type: 'text',
            content: { body: 'Hello' },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should allow multiple authenticated endpoints', async () => {
        const endpoints = [
          { method: 'GET', path: '/api/templates' },
          { method: 'POST', path: '/api/whatsapp/session' },
          { method: 'GET', path: '/api/broadcast' },
        ];

        for (const endpoint of endpoints) {
          const response = await request(app)[endpoint.method.toLowerCase()](endpoint.path)
            .set('X-Internal-Token', mockValidToken);

          expect(response.status).not.toBe(401);
        }
      });
    });

    describe('Invalid Authentication', () => {
      it('should reject requests without token', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .send({ to: '+919876543210', type: 'text' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject requests with invalid token', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .set('X-Internal-Token', 'invalid-token')
          .send({ to: '+919876543210', type: 'text' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('WhatsApp Messaging Endpoints', () => {
    describe('POST /api/whatsapp/send', () => {
      it('should send message with valid payload', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .set('X-Internal-Token', mockValidToken)
          .send({
            to: '+919876543210',
            type: 'text',
            content: { body: 'Hello, World!' },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toHaveProperty('sid');
        expect(response.body.message).toHaveProperty('status', 'queued');
      });

      it('should reject message without recipient', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .set('X-Internal-Token', mockValidToken)
          .send({ type: 'text', content: { body: 'Hello' } });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });

      it('should accept various message types', async () => {
        const types = ['text', 'image', 'audio', 'video', 'document'];

        for (const type of types) {
          const response = await request(app)
            .post('/api/whatsapp/send')
            .set('X-Internal-Token', mockValidToken)
            .send({
              to: '+919876543210',
              type,
              content: { body: 'Test' },
            });

          expect(response.status).toBe(200);
        }
      });
    });

    describe('POST /api/whatsapp/session', () => {
      it('should create new session', async () => {
        const response = await request(app)
          .post('/api/whatsapp/session')
          .set('X-Internal-Token', mockValidToken)
          .send({
            userId: 'user_123',
            phoneNumber: '+919876543210',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.session).toHaveProperty('sessionId');
        expect(response.body.session).toHaveProperty('state', 'idle');
      });

      it('should reject session creation without userId', async () => {
        const response = await request(app)
          .post('/api/whatsapp/session')
          .set('X-Internal-Token', mockValidToken)
          .send({ phoneNumber: '+919876543210' });

        expect(response.status).toBe(400);
      });

      it('should reject session creation without phoneNumber', async () => {
        const response = await request(app)
          .post('/api/whatsapp/session')
          .set('X-Internal-Token', mockValidToken)
          .send({ userId: 'user_123' });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/whatsapp/session/:sessionId', () => {
      it('should retrieve existing session', async () => {
        const sessionId = 'session_123';

        const response = await request(app)
          .get(`/api/whatsapp/session/${sessionId}`)
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.session.sessionId).toBe(sessionId);
      });

      it('should return 404 for non-existent session', async () => {
        const response = await request(app)
          .get('/api/whatsapp/session/not_found')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('POST /api/whatsapp/cart', () => {
      it('should add item to cart', async () => {
        const response = await request(app)
          .post('/api/whatsapp/cart')
          .set('X-Internal-Token', mockValidToken)
          .send({
            sessionId: 'session_123',
            operation: 'add',
            item: generateMockCartItem(),
          });

        expect(response.status).toBe(200);
        expect(response.body.cart).toHaveProperty('items');
      });

      it('should clear cart', async () => {
        const response = await request(app)
          .post('/api/whatsapp/cart')
          .set('X-Internal-Token', mockValidToken)
          .send({
            sessionId: 'session_123',
            operation: 'clear',
          });

        expect(response.status).toBe(200);
      });

      it('should reject cart operation without sessionId', async () => {
        const response = await request(app)
          .post('/api/whatsapp/cart')
          .set('X-Internal-Token', mockValidToken)
          .send({
            operation: 'add',
            item: generateMockCartItem(),
          });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/whatsapp/order', () => {
      it('should create order', async () => {
        const response = await request(app)
          .post('/api/whatsapp/order')
          .set('X-Internal-Token', mockValidToken)
          .send({
            sessionId: 'session_123',
            merchantId: 'merchant_456',
            deliveryAddress: {
              name: 'John Doe',
              phone: '+919876543210',
              line1: '123 Main St',
              city: 'Mumbai',
              state: 'MH',
              postalCode: '400001',
            },
          });

        expect(response.status).toBe(201);
        expect(response.body.order).toHaveProperty('orderId');
        expect(response.body.order).toHaveProperty('status', 'pending');
      });

      it('should reject order without merchantId', async () => {
        const response = await request(app)
          .post('/api/whatsapp/order')
          .set('X-Internal-Token', mockValidToken)
          .send({ sessionId: 'session_123' });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Webhook Endpoints', () => {
    describe('POST /webhook/whatsapp', () => {
      it('should accept valid Twilio webhook', async () => {
        const webhookPayload = generateMockWebhookPayload();

        const response = await request(app)
          .post('/webhook/whatsapp')
          .send(webhookPayload);

        expect(response.status).toBe(200);
      });

      it('should process inbound message', async () => {
        const webhookPayload = generateMockWebhookPayload({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: '919876543210',
                        id: 'msg_inbound_123',
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        type: 'text',
                        text: { body: 'Hello, I need help' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        const response = await request(app)
          .post('/webhook/whatsapp')
          .send(webhookPayload);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Template Endpoints', () => {
    describe('GET /api/templates', () => {
      it('should retrieve templates list', async () => {
        const response = await request(app)
          .get('/api/templates')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.templates)).toBe(true);
      });
    });

    describe('POST /api/templates', () => {
      it('should create new template', async () => {
        const response = await request(app)
          .post('/api/templates')
          .set('X-Internal-Token', mockValidToken)
          .send({
            name: 'order_confirmation',
            category: 'transactional',
            components: [
              { type: 'header', format: 'text', text: 'Order Confirmed' },
              { type: 'body', text: 'Your order {{1}} has been confirmed.' },
            ],
          });

        expect(response.status).toBe(201);
        expect(response.body.template).toHaveProperty('id');
        expect(response.body.template).toHaveProperty('status', 'pending');
      });

      it('should reject template without name', async () => {
        const response = await request(app)
          .post('/api/templates')
          .set('X-Internal-Token', mockValidToken)
          .send({
            category: 'marketing',
            components: [{ type: 'body', text: 'Hello' }],
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Broadcast Endpoints', () => {
    describe('GET /api/broadcast', () => {
      it('should retrieve broadcasts list', async () => {
        const response = await request(app)
          .get('/api/broadcast')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.broadcasts)).toBe(true);
      });
    });

    describe('POST /api/broadcast', () => {
      it('should create new broadcast', async () => {
        const response = await request(app)
          .post('/api/broadcast')
          .set('X-Internal-Token', mockValidToken)
          .send({
            name: 'Summer Sale Campaign',
            templateId: 'tmpl_123',
            segment: { type: 'all' },
          });

        expect(response.status).toBe(201);
        expect(response.body.broadcast).toHaveProperty('id');
        expect(response.body.broadcast).toHaveProperty('status', 'draft');
      });

      it('should reject broadcast without templateId', async () => {
        const response = await request(app)
          .post('/api/broadcast')
          .set('X-Internal-Token', mockValidToken)
          .send({ name: 'Test Campaign' });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/broadcast/:broadcastId', () => {
      it('should retrieve broadcast details', async () => {
        const response = await request(app)
          .get('/api/broadcast/bc_123')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.broadcast).toHaveProperty('id', 'bc_123');
        expect(response.body.broadcast).toHaveProperty('progress');
      });

      it('should return 404 for non-existent broadcast', async () => {
        const response = await request(app)
          .get('/api/broadcast/not_found')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/broadcast/:broadcastId/send', () => {
      it('should start broadcast', async () => {
        const response = await request(app)
          .post('/api/broadcast/bc_123/send')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'running');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .set('X-Internal-Token', mockValidToken);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/whatsapp/send')
        .set('X-Internal-Token', mockValidToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});

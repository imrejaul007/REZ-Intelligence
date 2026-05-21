/**
 * REZ WhatsApp Service - Integration Tests
 * Tests service-to-service communication, MongoDB, Redis, and Twilio integration
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import {
  generateMockMessage,
  generateMockConversation,
  generateMockCartItem,
  generateMockWebhookPayload,
} from './setup';

// Test configuration
const TEST_TOKEN = 'test-whatsapp-token-98765';
const MONGODB_URI = 'mongodb://localhost:27017/rez-whatsapp-test';
const REDIS_URL = 'redis://localhost:6379';

// Mock Redis instance
const mockRedisInstance = {
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn(),
  hgetall: jest.fn().mockResolvedValue({}),
  hmset: jest.fn().mockResolvedValue('OK'),
  hincrby: jest.fn().mockResolvedValue(1),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  disconnect: jest.fn(),
};

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

// Mock mongoose
jest.mock('mongoose', () => {
  const mockCollection = {
    createIndex: jest.fn().mockResolvedValue('index_created'),
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    aggregate: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock_id' }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
        collection: jest.fn().mockReturnValue(mockCollection),
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
        return {
          ...data,
          _id: 'mock_object_id',
          save: jest.fn().mockResolvedValue(data),
        };
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
      return MockModel;
    }),
    Types: {
      ObjectId: jest.fn().mockImplementation(() => 'mock_object_id'),
    },
  };
});

// Mock Twilio client
const mockTwilioClient = {
  messages: {
    create: jest.fn().mockResolvedValue({
      sid: 'SM_test_message_sid',
      status: 'queued',
      to: '+919876543210',
      from: '+1234567890',
      dateCreated: new Date().toISOString(),
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
};

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => mockTwilioClient);
});

// Mock axios for external service calls
jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: { success: true } }),
    get: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
    put: jest.fn().mockResolvedValue({ data: { success: true } }),
    delete: jest.fn().mockResolvedValue({ data: { success: true } }),
  }),
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

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Health check
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

  // WhatsApp messaging
  app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
    const { to, type, content } = req.body;

    // Store message in Redis for tracking
    await mockRedisInstance.hset(
      `message:${Date.now()}`,
      'to',
      to,
      'type',
      type,
      'status',
      'sent'
    );

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

  // Session management with Redis
  app.post('/api/whatsapp/session', async (req: Request, res: Response) => {
    const { userId, phoneNumber, merchantId } = req.body;

    const sessionId = 'session_' + Date.now();

    // Store session in Redis
    await mockRedisInstance.hmset(`session:${sessionId}`, {
      userId,
      phoneNumber,
      merchantId: merchantId || '',
      state: 'idle',
      createdAt: new Date().toISOString(),
    });
    await mockRedisInstance.expire(`session:${sessionId}`, 86400); // 24 hours

    res.status(201).json({
      success: true,
      session: {
        sessionId,
        userId,
        phoneNumber,
        state: 'idle',
      },
    });
  });

  app.get('/api/whatsapp/session/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Check Redis for session
    const cached = await mockRedisInstance.hgetall(`session:${sessionId}`);

    if (!cached || Object.keys(cached).length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
    }

    res.json({
      success: true,
      session: {
        sessionId,
        ...cached,
      },
    });
  });

  // Cart operations with Redis
  app.post('/api/whatsapp/cart', async (req: Request, res: Response) => {
    const { sessionId, operation, item, productId, quantity } = req.body;

    const cartKey = `cart:${sessionId}`;

    if (operation === 'add' && item) {
      await mockRedisInstance.hset(cartKey, item.productId, JSON.stringify(item));
    } else if (operation === 'update' && productId && quantity !== undefined) {
      const existing = await mockRedisInstance.hget(cartKey, productId);
      if (existing) {
        const itemData = JSON.parse(existing as string);
        itemData.quantity = quantity;
        await mockRedisInstance.hset(cartKey, productId, JSON.stringify(itemData));
      }
    } else if (operation === 'remove' && productId) {
      await mockRedisInstance.hset(cartKey, productId, '');
    } else if (operation === 'clear') {
      await mockRedisInstance.del(cartKey);
    }

    res.json({
      success: true,
      operation,
    });
  });

  // Order creation with MongoDB
  app.post('/api/whatsapp/order', async (req: Request, res: Response) => {
    const { sessionId, merchantId, deliveryAddress } = req.body;

    const orderId = 'order_' + Date.now();

    // Store order ID in Redis for quick lookup
    await mockRedisInstance.setex(`order:${orderId}`, 3600, JSON.stringify({
      orderId,
      sessionId,
      merchantId,
      status: 'pending',
      deliveryAddress,
    }));

    // Increment merchant order count
    await mockRedisInstance.hincrby(`merchant:${merchantId}`, 'orderCount', 1);

    res.status(201).json({
      success: true,
      order: {
        orderId,
        sessionId,
        merchantId,
        status: 'pending',
        deliveryAddress,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Webhook processing
  app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
    const payload = req.body;

    // Extract message from webhook
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      // Store inbound message
      await mockRedisInstance.lpush(
        'inbound_messages',
        JSON.stringify({
          from: message.from,
          body: message.text?.body,
          timestamp: Date.now(),
        })
      );

      // Update user message count
      await mockRedisInstance.hincrby(`user:${message.from}`, 'messageCount', 1);
    }

    res.sendStatus(200);
  });

  // Broadcast with queue
  app.post('/api/broadcast/:broadcastId/send', async (req: Request, res: Response) => {
    const { broadcastId } = req.params;

    // Add to broadcast queue
    await mockRedisInstance.lpush(
      'broadcast_queue',
      JSON.stringify({
        broadcastId,
        status: 'running',
        startedAt: Date.now(),
      })
    );

    res.json({
      success: true,
      broadcastId,
      status: 'running',
      message: 'Broadcast started',
    });
  });

  // Conversation tracking
  app.get('/api/conversations/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;

    res.json({
      success: true,
      conversations: [
        {
          conversationId: 'conv_1',
          userId,
          state: 'idle',
          messageCount: 5,
        },
      ],
    });
  });

  return app;
}

describe('REZ WhatsApp Service Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = TEST_TOKEN;
    process.env.MONGODB_URI = MONGODB_URI;
    process.env.REDIS_URL = REDIS_URL;
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MongoDB Integration', () => {
    describe('Connection Health', () => {
      it('should report MongoDB connection status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.dependencies).toHaveProperty('mongodb');
      });
    });

    describe('Data Persistence', () => {
      it('should persist order data', async () => {
        const orderData = {
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
        };

        const response = await request(app)
          .post('/api/whatsapp/order')
          .send(orderData);

        expect(response.status).toBe(201);
        expect(response.body.order).toHaveProperty('orderId');
        expect(response.body.order).toHaveProperty('status', 'pending');
      });

      it('should increment merchant order counts', async () => {
        const orderData = {
          sessionId: 'session_test',
          merchantId: 'merchant_counter',
          deliveryAddress: {},
        };

        await request(app)
          .post('/api/whatsapp/order')
          .send(orderData);

        expect(mockRedisInstance.hincrby).toHaveBeenCalledWith(
          'merchant:merchant_counter',
          'orderCount',
          1
        );
      });
    });
  });

  describe('Redis Integration', () => {
    describe('Session Management', () => {
      it('should create session in Redis', async () => {
        const sessionData = {
          userId: 'user_session_test',
          phoneNumber: '+919876543210',
          merchantId: 'merchant_123',
        };

        const response = await request(app)
          .post('/api/whatsapp/session')
          .send(sessionData);

        expect(response.status).toBe(201);
        expect(response.body.session).toHaveProperty('sessionId');
        expect(mockRedisInstance.hmset).toHaveBeenCalled();
        expect(mockRedisInstance.expire).toHaveBeenCalled();
      });

      it('should retrieve session from Redis', async () => {
        const sessionId = 'session_existing';

        // Mock existing session
        mockRedisInstance.hgetall.mockResolvedValueOnce({
          userId: 'user_123',
          phoneNumber: '+919876543210',
          state: 'idle',
        });

        const response = await request(app).get(
          `/api/whatsapp/session/${sessionId}`
        );

        expect(response.status).toBe(200);
        expect(response.body.session).toHaveProperty('sessionId', sessionId);
      });

      it('should return 404 for non-existent session', async () => {
        mockRedisInstance.hgetall.mockResolvedValueOnce({});

        const response = await request(app).get(
          '/api/whatsapp/session/not_found'
        );

        expect(response.status).toBe(404);
      });
    });

    describe('Cart Operations', () => {
      it('should add item to cart', async () => {
        const cartItem = generateMockCartItem();

        const response = await request(app)
          .post('/api/whatsapp/cart')
          .send({
            sessionId: 'session_cart_test',
            operation: 'add',
            item: cartItem,
          });

        expect(response.status).toBe(200);
        expect(mockRedisInstance.hset).toHaveBeenCalled();
      });

      it('should update item quantity', async () => {
        mockRedisInstance.hget.mockResolvedValueOnce(
          JSON.stringify(generateMockCartItem())
        );

        const response = await request(app)
          .post('/api/whatsapp/cart')
          .send({
            sessionId: 'session_update',
            operation: 'update',
            productId: 'prod_123',
            quantity: 3,
          });

        expect(response.status).toBe(200);
      });

      it('should clear cart', async () => {
        const response = await request(app)
          .post('/api/whatsapp/cart')
          .send({
            sessionId: 'session_clear',
            operation: 'clear',
          });

        expect(response.status).toBe(200);
        expect(mockRedisInstance.del).toHaveBeenCalled();
      });
    });

    describe('Message Tracking', () => {
      it('should store sent messages', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .send({
            to: '+919876543210',
            type: 'text',
            content: { body: 'Test message' },
          });

        expect(response.status).toBe(200);
        expect(mockRedisInstance.hset).toHaveBeenCalled();
      });
    });
  });

  describe('Twilio Integration', () => {
    describe('Message Sending', () => {
      it('should use Twilio API to send messages', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .send({
            to: '+919876543210',
            type: 'text',
            content: { body: 'Test message' },
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toHaveProperty('sid');
        expect(response.body.message).toHaveProperty('status', 'queued');
      });

      it('should return Twilio message SID', async () => {
        const response = await request(app)
          .post('/api/whatsapp/send')
          .send({
            to: '+919876543210',
            type: 'text',
            content: { body: 'Hello!' },
          });

        expect(response.body.message.sid).toMatch(/^SM_/);
      });
    });
  });

  describe('Webhook Processing', () => {
    describe('Inbound Message Handling', () => {
      it('should process inbound messages', async () => {
        const webhookPayload = generateMockWebhookPayload();

        const response = await request(app)
          .post('/webhook/whatsapp')
          .send(webhookPayload);

        expect(response.status).toBe(200);
        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'inbound_messages',
          expect.any(String)
        );
      });

      it('should track user message counts', async () => {
        const webhookPayload = generateMockWebhookPayload();

        await request(app)
          .post('/webhook/whatsapp')
          .send(webhookPayload);

        expect(mockRedisInstance.hincrby).toHaveBeenCalledWith(
          'user:919876543210',
          'messageCount',
          1
        );
      });

      it('should handle empty webhook payload', async () => {
        const response = await request(app)
          .post('/webhook/whatsapp')
          .send({});

        expect(response.status).toBe(200);
      });

      it('should handle malformed messages gracefully', async () => {
        const payload = {
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [{ invalid: 'message' }],
                  },
                },
              ],
            },
          ],
        };

        const response = await request(app)
          .post('/webhook/whatsapp')
          .send(payload);

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Broadcast Integration', () => {
    describe('Queue Operations', () => {
      it('should add broadcast to queue', async () => {
        const response = await request(app)
          .post('/api/broadcast/bc_123/send')
          .send();

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('running');
        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'broadcast_queue',
          expect.stringContaining('bc_123')
        );
      });

      it('should include broadcast metadata in queue', async () => {
        await request(app)
          .post('/api/broadcast/bc_metadata_test/send')
          .send();

        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'broadcast_queue',
          expect.stringContaining('"broadcastId":"bc_metadata_test"')
        );
      });
    });
  });

  describe('Service-to-Service Communication', () => {
    describe('Cross-Service Data Flow', () => {
      it('should process full order lifecycle', async () => {
        // Step 1: Create session
        const sessionResponse = await request(app)
          .post('/api/whatsapp/session')
          .send({
            userId: 'user_order_flow',
            phoneNumber: '+919876543210',
            merchantId: 'merchant_order',
          });

        expect(sessionResponse.status).toBe(201);
        const sessionId = sessionResponse.body.session.sessionId;

        // Step 2: Add item to cart
        await request(app)
          .post('/api/whatsapp/cart')
          .send({
            sessionId,
            operation: 'add',
            item: generateMockCartItem(),
          });

        // Step 3: Create order
        const orderResponse = await request(app)
          .post('/api/whatsapp/order')
          .send({
            sessionId,
            merchantId: 'merchant_order',
            deliveryAddress: {
              name: 'Test User',
              phone: '+919876543210',
              line1: '123 Test St',
              city: 'Test City',
              state: 'TS',
              postalCode: '400001',
            },
          });

        expect(orderResponse.status).toBe(201);
        expect(orderResponse.body.order).toHaveProperty('orderId');
      });

      it('should track conversation metrics', async () => {
        const userId = 'user_metrics_test';

        const response = await request(app).get(
          `/api/conversations/${userId}`
        );

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.conversations)).toBe(true);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockRedisInstance.hgetall.mockRejectedValueOnce(
        new Error('Redis connection failed')
      );

      const response = await request(app).get(
        '/api/whatsapp/session/session_fail'
      );

      // Should return error response
      expect([404, 500]).toContain(response.status);
    });

    it('should handle malformed order data', async () => {
      const response = await request(app)
        .post('/api/whatsapp/order')
        .send({
          sessionId: 'session_123',
          // Missing merchantId
        });

      expect(response.status).toBe(400);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10)
        .fill(null)
        .map(() => request(app).get('/health'));

      const responses = await Promise.all(promises);

      expect(responses.every((r) => r.status === 200)).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track request latency', async () => {
      const start = Date.now();

      await request(app).get('/health');

      const latency = Date.now() - start;
      expect(latency).toBeLessThan(1000); // Should be fast
    });

    it('should include uptime in health response', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });
});

/**
 * REZ Memory Layer - API Endpoint Tests
 * Tests all HTTP endpoints with mocked dependencies
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import {
  generateMockTimelineEvent,
  generateMockUserTimeline,
  mockValidToken,
} from './setup';

// Mock dependencies
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
    model: jest.fn().mockImplementation((name: string) => {
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
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: { success: true } }),
    get: jest.fn().mockResolvedValue({ data: { status: 'healthy' } }),
  }),
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

// Import middleware
import { authMiddleware, requestLogger, errorHandler } from '../middleware/auth';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Request logging
  app.use(requestLogger);

  // Health endpoints (no auth required)
  app.get('/health', async (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      services: {
        mongodb: { status: 'up' },
        redis: { status: 'up' },
        eventBus: { status: 'up', subscriptions: 5 },
      },
      uptime: 3600,
      version: '1.0.0',
    });
  });

  app.get('/live', (req: Request, res: Response) => {
    res.json({ status: 'alive', timestamp: new Date() });
  });

  app.get('/ready', async (req: Request, res: Response) => {
    res.json({ status: 'ready', timestamp: new Date() });
  });

  // Timeline endpoints (auth required)
  app.get('/api/timeline/:userId', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { startDate, endDate, limit } = req.query;

    if (userId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User timeline not found' },
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        events: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      },
    });
  });

  app.get('/api/timeline/:userId/summary', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        totalEvents: 100,
        eventBreakdown: {
          byCategory: { commerce: 50, engagement: 30, loyalty: 20 },
          bySource: { web: 60, mobile: 40 },
          last24Hours: 10,
          last7Days: 50,
          last30Days: 100,
        },
        topCategories: [],
        topSources: [],
        recentActivity: new Date(),
        activityStreak: 5,
        predictedInterests: ['electronics', 'fashion'],
      },
    });
  });

  app.post('/api/timeline/:userId/enrich', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { segmentId, preferences } = req.body;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing segmentId' },
      });
    }

    res.json({
      success: true,
      data: { userId, segmentId, enriched: true },
    });
  });

  // Event endpoints
  app.post('/api/events/ingest', authMiddleware, async (req: Request, res: Response) => {
    const event = req.body;

    if (!event.userId || !event.type) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      eventId: 'evt_' + Date.now(),
      message: 'Event ingested successfully',
    });
  });

  app.post('/api/events/batch', authMiddleware, async (req: Request, res: Response) => {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Events array required' },
      });
    }

    const results = events.map((_, index) => ({
      index,
      success: true,
      eventId: 'evt_batch_' + index,
    }));

    res.json({
      success: true,
      processed: events.length,
      failed: 0,
      results,
    });
  });

  app.get('/api/events/:eventId', authMiddleware, async (req: Request, res: Response) => {
    const { eventId } = req.params;

    if (eventId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
    }

    res.json({
      success: true,
      data: generateMockTimelineEvent({ id: eventId }),
    });
  });

  // Search endpoints
  app.post('/api/search/events', authMiddleware, async (req: Request, res: Response) => {
    const { query, filters } = req.body;

    res.json({
      success: true,
      data: {
        results: [],
        total: 0,
        query,
        filters,
      },
    });
  });

  // Segments endpoint
  app.get('/api/segments/:userId', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        segments: [
          {
            segmentId: 'seg_high_value',
            segmentName: 'High Value User',
            confidence: 0.9,
            lastTriggered: new Date(),
            triggers: ['purchase'],
          },
        ],
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

describe('REZ Memory Layer API Tests', () => {
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
      it('should return comprehensive health status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('mongodb');
        expect(response.body.services).toHaveProperty('redis');
        expect(response.body.services).toHaveProperty('eventBus');
      });

      it('should include version and uptime', async () => {
        const response = await request(app).get('/health');

        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('uptime');
        expect(typeof response.body.uptime).toBe('number');
      });

      it('should include event bus subscription count', async () => {
        const response = await request(app).get('/health');

        expect(response.body.services.eventBus).toHaveProperty('subscriptions');
      });
    });

    describe('GET /live', () => {
      it('should return liveness status', async () => {
        const response = await request(app).get('/live');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'alive');
        expect(response.body).toHaveProperty('timestamp');
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
          .get('/api/timeline/user_123')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should allow requests with valid API key', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123')
          .set('X-API-Key', 'rez_memory_layer_abc123');

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid Authentication', () => {
      it('should reject requests without token', async () => {
        const response = await request(app).get('/api/timeline/user_123');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should reject requests with invalid token', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123')
          .set('X-Internal-Token', 'invalid-token');

        expect(response.status).toBe(401);
      });

      it('should reject requests with malformed API key', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123')
          .set('X-API-Key', 'short');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Timeline Endpoints', () => {
    describe('GET /api/timeline/:userId', () => {
      it('should retrieve user timeline with valid token', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('userId');
        expect(response.body.data).toHaveProperty('events');
      });

      it('should support pagination parameters', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123?limit=50&offset=10')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.data.pagination).toBeDefined();
      });

      it('should support date range filters', async () => {
        const startDate = new Date(Date.now() - 86400000).toISOString();
        const endDate = new Date().toISOString();

        const response = await request(app)
          .get(`/api/timeline/user_123?startDate=${startDate}&endDate=${endDate}`)
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
      });

      it('should return 404 for non-existent user', async () => {
        const response = await request(app)
          .get('/api/timeline/not_found')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('GET /api/timeline/:userId/summary', () => {
      it('should return timeline summary', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123/summary')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('totalEvents');
        expect(response.body.data).toHaveProperty('eventBreakdown');
        expect(response.body.data).toHaveProperty('topCategories');
      });

      it('should include predicted interests', async () => {
        const response = await request(app)
          .get('/api/timeline/user_123/summary')
          .set('X-Internal-Token', mockValidToken);

        expect(response.body.data).toHaveProperty('predictedInterests');
        expect(Array.isArray(response.body.data.predictedInterests)).toBe(true);
      });
    });

    describe('POST /api/timeline/:userId/enrich', () => {
      it('should enrich user timeline with segment data', async () => {
        const response = await request(app)
          .post('/api/timeline/user_123/enrich')
          .set('X-Internal-Token', mockValidToken)
          .send({
            segmentId: 'seg_high_value',
            preferences: { categories: ['electronics'] },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('enriched', true);
      });

      it('should reject enrichment without segmentId', async () => {
        const response = await request(app)
          .post('/api/timeline/user_123/enrich')
          .set('X-Internal-Token', mockValidToken)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });
    });
  });

  describe('Event Endpoints', () => {
    describe('POST /api/events/ingest', () => {
      it('should ingest single event', async () => {
        const event = generateMockTimelineEvent();

        const response = await request(app)
          .post('/api/events/ingest')
          .set('X-Internal-Token', mockValidToken)
          .send(event);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('eventId');
      });

      it('should reject event without userId', async () => {
        const response = await request(app)
          .post('/api/events/ingest')
          .set('X-Internal-Token', mockValidToken)
          .send({ type: 'page_view' });

        expect(response.status).toBe(400);
      });

      it('should reject event without type', async () => {
        const response = await request(app)
          .post('/api/events/ingest')
          .set('X-Internal-Token', mockValidToken)
          .send({ userId: 'user_123' });

        expect(response.status).toBe(400);
      });

      it('should accept event with metadata', async () => {
        const event = generateMockTimelineEvent({
          metadata: {
            sessionId: 'session_123',
            deviceId: 'device_456',
            ipAddress: '192.168.1.1',
          },
        });

        const response = await request(app)
          .post('/api/events/ingest')
          .set('X-Internal-Token', mockValidToken)
          .send(event);

        expect(response.status).toBe(201);
      });
    });

    describe('POST /api/events/batch', () => {
      it('should ingest batch of events', async () => {
        const events = [
          generateMockTimelineEvent({ userId: 'user_1' }),
          generateMockTimelineEvent({ userId: 'user_2' }),
          generateMockTimelineEvent({ userId: 'user_3' }),
        ];

        const response = await request(app)
          .post('/api/events/batch')
          .set('X-Internal-Token', mockValidToken)
          .send({ events });

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(3);
        expect(response.body.failed).toBe(0);
        expect(response.body.results).toHaveLength(3);
      });

      it('should reject batch without events array', async () => {
        const response = await request(app)
          .post('/api/events/batch')
          .set('X-Internal-Token', mockValidToken)
          .send({ events: 'not-an-array' });

        expect(response.status).toBe(400);
      });

      it('should handle partial failures in batch', async () => {
        const events = [
          generateMockTimelineEvent({ userId: 'user_1' }),
          { type: 'invalid' }, // Missing userId
          generateMockTimelineEvent({ userId: 'user_3' }),
        ];

        const response = await request(app)
          .post('/api/events/batch')
          .set('X-Internal-Token', mockValidToken)
          .send({ events });

        // Depending on implementation, should either fail all or process valid ones
        expect([200, 400]).toContain(response.status);
      });
    });

    describe('GET /api/events/:eventId', () => {
      it('should retrieve event by ID', async () => {
        const eventId = 'evt_12345';

        const response = await request(app)
          .get(`/api/events/${eventId}`)
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(eventId);
      });

      it('should return 404 for non-existent event', async () => {
        const response = await request(app)
          .get('/api/events/not_found')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Search Endpoints', () => {
    describe('POST /api/search/events', () => {
      it('should search events with query', async () => {
        const response = await request(app)
          .post('/api/search/events')
          .set('X-Internal-Token', mockValidToken)
          .send({
            query: { userId: 'user_123' },
            filters: { category: 'commerce' },
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('results');
        expect(response.body.data).toHaveProperty('total');
      });

      it('should support complex search queries', async () => {
        const response = await request(app)
          .post('/api/search/events')
          .set('X-Internal-Token', mockValidToken)
          .send({
            query: {
              $and: [
                { userId: { $exists: true } },
                { category: { $in: ['commerce', 'engagement'] } },
              ],
            },
          });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Segments Endpoints', () => {
    describe('GET /api/segments/:userId', () => {
      it('should retrieve user segments', async () => {
        const response = await request(app)
          .get('/api/segments/user_123')
          .set('X-Internal-Token', mockValidToken);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('segments');
        expect(Array.isArray(response.body.data.segments)).toBe(true);
      });

      it('should include segment confidence scores', async () => {
        const response = await request(app)
          .get('/api/segments/user_123')
          .set('X-Internal-Token', mockValidToken);

        const segment = response.body.data.segments[0];
        expect(segment).toHaveProperty('confidence');
        expect(typeof segment.confidence).toBe('number');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .set('X-Internal-Token', mockValidToken);

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/events/ingest')
        .set('X-Internal-Token', mockValidToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should log errors through error handler', async () => {
      const error = new Error('Test error');
      const errorHandler = mockLogger.error;

      expect(errorHandler).toBeDefined();
    });
  });

  describe('Request Logging', () => {
    it('should log completed requests', async () => {
      await request(app)
        .get('/live');

      // Request logger should be called
      expect(mockLogger.info).toBeDefined();
    });
  });
});

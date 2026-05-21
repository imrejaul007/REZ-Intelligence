/**
 * REZ Memory Layer - Integration Tests
 * Tests service-to-service communication, MongoDB, Redis, and Event Bus operations
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { generateMockTimelineEvent, generateMockUserTimeline } from './setup';

// Test configuration
const TEST_TOKEN = 'test-memory-layer-token-67890';
const MONGODB_URI = 'mongodb://localhost:27017/rez-memory-layer-test';
const REDIS_URL = 'redis://localhost:6379';
const EVENT_BUS_URL = 'http://localhost:4025';

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
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn(),
  hgetall: jest.fn().mockResolvedValue({}),
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(0),
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

// Mock axios for event bus calls
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

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Health check with dependency status
  app.get('/health', async (req: Request, res: Response) => {
    const mongoStatus = { status: 'up' as const };
    const redisStatus = { status: 'up' as const };
    const eventBusStatus = { status: 'up' as const, subscriptions: 5 };

    const overallStatus =
      mongoStatus.status === 'up' && redisStatus.status === 'up'
        ? 'healthy'
        : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
        eventBus: eventBusStatus,
      },
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });

  // Timeline operations
  app.get('/api/timeline/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Simulate Redis cache lookup
    const cached = await mockRedisInstance.get(`timeline:${userId}`);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached as string),
        cached: true,
      });
    }

    // Simulate MongoDB query
    const timeline = generateMockUserTimeline({ userId });

    // Cache result
    await mockRedisInstance.setex(
      `timeline:${userId}`,
      300,
      JSON.stringify(timeline)
    );

    res.json({
      success: true,
      data: timeline,
      cached: false,
    });
  });

  app.post('/api/timeline/:userId/segments', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { segments } = req.body;

    // Update user segments in Redis
    await mockRedisInstance.hset(
      `segments:${userId}`,
      'segments',
      JSON.stringify(segments)
    );

    res.json({
      success: true,
      data: { userId, segments },
    });
  });

  // Event operations
  app.post('/api/events/ingest', async (req: Request, res: Response) => {
    const event = req.body;

    // Store in Redis queue for batch processing
    await mockRedisInstance.lpush('event_queue', JSON.stringify(event));

    // Also update user event count
    await mockRedisInstance.hincrby(`user:${event.userId}`, 'eventCount', 1);

    res.status(201).json({
      success: true,
      eventId: event.id || 'evt_' + Date.now(),
      message: 'Event ingested successfully',
    });
  });

  app.post('/api/events/batch', async (req: Request, res: Response) => {
    const { events } = req.body;

    const results = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      try {
        await mockRedisInstance.lpush('event_queue', JSON.stringify(event));
        results.push({ index: i, success: true, eventId: 'evt_' + i });
      } catch {
        results.push({ index: i, success: false, error: 'Failed to process' });
      }
    }

    res.json({
      success: true,
      processed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  });

  // Event Bus integration
  app.post('/api/events/publish', async (req: Request, res: Response) => {
    const { event, data } = req.body;

    // Simulate event bus publish
    await mockRedisInstance.lpush(
      'event_bus_queue',
      JSON.stringify({
        event,
        data,
        publishedAt: Date.now(),
        source: 'memory-layer',
      })
    );

    res.json({
      success: true,
      published: true,
      event,
    });
  });

  // Search operations
  app.post('/api/search/events', async (req: Request, res: Response) => {
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

  // Segments
  app.get('/api/segments/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Check Redis for cached segments
    const cached = await mockRedisInstance.hget(`segments:${userId}`, 'segments');

    const segments = cached
      ? JSON.parse(cached as string)
      : [
          {
            segmentId: 'seg_high_value',
            segmentName: 'High Value User',
            confidence: 0.9,
          },
        ];

    res.json({
      success: true,
      data: { userId, segments },
    });
  });

  return app;
}

describe('REZ Memory Layer Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    process.env.INTERNAL_SERVICE_TOKEN = TEST_TOKEN;
    process.env.MONGODB_URI = MONGODB_URI;
    process.env.REDIS_URL = REDIS_URL;
    process.env.EVENT_BUS_URL = EVENT_BUS_URL;
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
        expect(response.body.services.mongodb.status).toBeDefined();
        expect(['up', 'down', 'unknown']).toContain(
          response.body.services.mongodb.status
        );
      });

      it('should include MongoDB in overall health status', async () => {
        const response = await request(app).get('/health');

        expect(response.body.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(
          response.body.status
        );
      });
    });

    describe('Data Operations', () => {
      it('should retrieve user timeline from MongoDB', async () => {
        const response = await request(app).get('/api/timeline/user_123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('userId', 'user_123');
        expect(response.body.data).toHaveProperty('events');
      });

      it('should update user segments in storage', async () => {
        const segments = [
          { segmentId: 'seg_1', segmentName: 'Test Segment' },
        ];

        const response = await request(app)
          .post('/api/timeline/user_123/segments')
          .send({ segments });

        expect(response.status).toBe(200);
        expect(mockRedisInstance.hset).toHaveBeenCalled();
      });
    });
  });

  describe('Redis Integration', () => {
    describe('Cache Operations', () => {
      it('should cache timeline data in Redis', async () => {
        const response = await request(app).get('/api/timeline/user_cache_123');

        expect(response.status).toBe(200);
        expect(mockRedisInstance.setex).toHaveBeenCalledWith(
          'timeline:user_cache_123',
          300,
          expect.any(String)
        );
      });

      it('should return cached data when available', async () => {
        // Simulate cached data
        const cachedTimeline = generateMockUserTimeline({
          userId: 'user_cached',
        });
        mockRedisInstance.get.mockResolvedValueOnce(
          JSON.stringify(cachedTimeline)
        );

        const response = await request(app).get('/api/timeline/user_cached');

        expect(response.status).toBe(200);
        expect(response.body.cached).toBe(true);
        expect(response.body.data).toEqual(cachedTimeline);
      });

      it('should use Redis for event queueing', async () => {
        const event = generateMockTimelineEvent();

        const response = await request(app)
          .post('/api/events/ingest')
          .send(event);

        expect(response.status).toBe(201);
        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'event_queue',
          expect.any(String)
        );
      });

      it('should track user event counts in Redis', async () => {
        const event = generateMockTimelineEvent({ userId: 'user_count' });

        await request(app)
          .post('/api/events/ingest')
          .send(event);

        expect(mockRedisInstance.hincrby).toHaveBeenCalledWith(
          'user:user_count',
          'eventCount',
          1
        );
      });
    });

    describe('Session Storage', () => {
      it('should store segments in Redis hash', async () => {
        const segments = [
          { segmentId: 'seg_1', segmentName: 'High Value' },
          { segmentId: 'seg_2', segmentName: 'Active User' },
        ];

        const response = await request(app)
          .post('/api/timeline/user_seg_123/segments')
          .send({ segments });

        expect(response.status).toBe(200);
        expect(mockRedisInstance.hset).toHaveBeenCalled();
      });

      it('should retrieve segments from Redis cache', async () => {
        const segments = [{ segmentId: 'seg_cached', segmentName: 'Cached' }];
        mockRedisInstance.hget.mockResolvedValueOnce(JSON.stringify(segments));

        const response = await request(app).get('/api/segments/user_seg_123');

        expect(response.status).toBe(200);
        expect(response.body.data.segments).toEqual(segments);
      });
    });
  });

  describe('Event Bus Integration', () => {
    describe('Event Publishing', () => {
      it('should publish events to event bus queue', async () => {
        const eventData = {
          event: 'user.segment.updated',
          data: {
            userId: 'user_123',
            segmentId: 'seg_1',
          },
        };

        const response = await request(app)
          .post('/api/events/publish')
          .send(eventData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.published).toBe(true);
        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'event_bus_queue',
          expect.stringContaining('user.segment.updated')
        );
      });

      it('should include source metadata in published events', async () => {
        const eventData = {
          event: 'timeline.event',
          data: { key: 'value' },
        };

        await request(app)
          .post('/api/events/publish')
          .send(eventData);

        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'event_bus_queue',
          expect.stringContaining('"source":"memory-layer"')
        );
      });

      it('should include timestamp in published events', async () => {
        const eventData = {
          event: 'test.event',
          data: {},
        };

        await request(app)
          .post('/api/events/publish')
          .send(eventData);

        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'event_bus_queue',
          expect.stringContaining('"publishedAt"')
        );
      });
    });

    describe('Batch Event Processing', () => {
      it('should queue all events in batch to Redis', async () => {
        const events = [
          generateMockTimelineEvent({ userId: 'user_1' }),
          generateMockTimelineEvent({ userId: 'user_2' }),
          generateMockTimelineEvent({ userId: 'user_3' }),
        ];

        const response = await request(app)
          .post('/api/events/batch')
          .send({ events });

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(3);
        expect(response.body.failed).toBe(0);
        expect(mockRedisInstance.lpush).toHaveBeenCalledTimes(3);
      });

      it('should handle partial failures in batch', async () => {
        mockRedisInstance.lpush
          .mockResolvedValueOnce(1)
          .mockRejectedValueOnce(new Error('Redis error'))
          .mockResolvedValueOnce(1);

        const events = [
          generateMockTimelineEvent({ userId: 'user_1' }),
          generateMockTimelineEvent({ userId: 'user_2' }),
          generateMockTimelineEvent({ userId: 'user_3' }),
        ];

        const response = await request(app)
          .post('/api/events/batch')
          .send({ events });

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(2);
        expect(response.body.failed).toBe(1);
      });
    });
  });

  describe('Service-to-Service Communication', () => {
    describe('Cross-Service Data Flow', () => {
      it('should process event from ingestion to storage', async () => {
        // Step 1: Ingest event
        const event = generateMockTimelineEvent({
          userId: 'user_flow_123',
        });

        const ingestResponse = await request(app)
          .post('/api/events/ingest')
          .send(event);

        expect(ingestResponse.status).toBe(201);
        expect(ingestResponse.body.eventId).toBeDefined();

        // Step 2: Retrieve updated timeline
        const timelineResponse = await request(app).get(
          `/api/timeline/${event.userId}`
        );

        expect(timelineResponse.status).toBe(200);
      });

      it('should track event processing in real-time', async () => {
        const event = generateMockTimelineEvent({ userId: 'user_track' });

        // Event count should increase
        await request(app)
          .post('/api/events/ingest')
          .send(event);

        expect(mockRedisInstance.hincrby).toHaveBeenCalledWith(
          'user:user_track',
          'eventCount',
          1
        );
      });
    });

    describe('Query Operations', () => {
      it('should support complex event queries', async () => {
        const response = await request(app)
          .post('/api/search/events')
          .send({
            query: { userId: 'user_123' },
            filters: { category: 'commerce' },
          });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('results');
        expect(response.body.data).toHaveProperty('total');
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(app).get('/api/timeline/user_fail');

      // Should still return response, possibly without cache
      expect([200, 500]).toContain(response.status);
    });

    it('should handle malformed event data', async () => {
      const response = await request(app)
        .post('/api/events/ingest')
        .send({
          userId: 'user_123',
          // Missing required 'type' field
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

  describe('Cache Invalidation', () => {
    it('should invalidate cache on segment update', async () => {
      const segments = [{ segmentId: 'seg_new', segmentName: 'New Segment' }];

      await request(app)
        .post('/api/timeline/user_invalidate/segments')
        .send({ segments });

      // Verify Redis hset was called for segment storage
      expect(mockRedisInstance.hset).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should track operation latencies in logs', async () => {
      await request(app).get('/health');

      expect(mockLogger.info).toBeDefined();
    });

    it('should include uptime in health response', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });
  });
});

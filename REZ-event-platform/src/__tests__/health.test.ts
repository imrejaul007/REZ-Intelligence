import request from 'supertest';
import express, { Express } from 'express';

// Mock dependencies before any imports
const mockRedisClient = {
  ping: jest.fn(),
  connected: true,
};

jest.mock('../config', () => ({
  config: {
    service: {
      name: 'rez-event-platform-test',
      port: 3001,
      env: 'test',
    },
    events: {
      schemaVersion: '1.0.0',
      enableDeadLetterQueue: true,
    },
    bullmq: {
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    },
    mongodb: {
      uri: 'mongodb://localhost:27017/test',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
  },
  connectMongoDB: jest.fn().mockResolvedValue(undefined),
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectAll: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../events/consumer', () => ({
  getQueueStats: jest.fn(),
}));

const mockEventStoreCount = jest.fn();
const mockDeadLetterCount = jest.fn();
jest.mock('../models/event-store', () => {
  const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

  const MockEventStore = function() {};
  (MockEventStore as any).countDocuments = mockEventStoreCount;
  (MockEventStore as any).updateOne = mockUpdateOne;

  const MockDeadLetterEvent = function() {};
  (MockDeadLetterEvent as any).countDocuments = mockDeadLetterCount;

  return {
    EventStore: MockEventStore,
    DeadLetterEvent: MockDeadLetterEvent,
  };
});

jest.mock('../events/schema-registry', () => ({
  schemaRegistry: {
    getRegisteredTypes: jest.fn().mockReturnValue([
      'inventory.low',
      'order.completed',
      'payment.success',
    ]),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
  },
}));

// Mock mongoose
const mockMongoose = {
  connection: {
    readyState: 1,
    db: {
      admin: () => ({
        ping: jest.fn().mockResolvedValue({ ok: 1 }),
      }),
    },
  },
};

jest.mock('mongoose', () => mockMongoose);

// Import health functions after mocks are set up
import {
  checkMongoDB,
  checkRedis,
  checkQueues,
  getHealthStatus,
  healthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  statsHandler,
} from '../health';

describe('Health Check Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Health endpoints
    app.get('/health', healthCheckHandler);
    app.get('/ready', readinessCheckHandler);
    app.get('/live', livenessCheckHandler);
    app.get('/stats', statsHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.ping.mockResolvedValue('PONG');
    mockMongoose.connection.readyState = 1;
    mockMongoose.connection.db = {
      admin: () => ({
        ping: jest.fn().mockResolvedValue({ ok: 1 }),
      }),
    };
  });

  // ============================================
  // MongoDB Connection Tests
  // ============================================
  describe('checkMongoDB', () => {
    it('should return up status when MongoDB is connected', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };

      const result = await checkMongoDB();

      expect(result.status).toBe('up');
      expect(result).toHaveProperty('latencyMs');
      expect(result).not.toHaveProperty('error');
    });

    it('should return down status when MongoDB is not connected', async () => {
      mockMongoose.connection.readyState = 0;

      const result = await checkMongoDB();

      expect(result.status).toBe('down');
      expect(result).toHaveProperty('error', 'Not connected');
    });

    it('should return down status when ping fails', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockRejectedValue(new Error('Ping failed')),
        }),
      };

      const result = await checkMongoDB();

      expect(result.status).toBe('down');
      expect(result).toHaveProperty('error');
    });

    it('should measure latency for MongoDB check', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };

      const start = Date.now();
      await checkMongoDB();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  // ============================================
  // Redis Connection Tests
  // ============================================
  describe('checkRedis', () => {
    it('should return up status when Redis is connected', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await checkRedis();

      expect(result.status).toBe('up');
      expect(result).toHaveProperty('latencyMs');
      expect(result).not.toHaveProperty('error');
    });

    it('should return down status when Redis client is not initialized', async () => {
      const { getRedisClient } = require('../config');
      getRedisClient.mockReturnValueOnce(null);

      const result = await checkRedis();

      expect(result.status).toBe('down');
      expect(result).toHaveProperty('error', 'Client not initialized');
    });

    it('should return down status when Redis ping fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await checkRedis();

      expect(result.status).toBe('down');
      expect(result).toHaveProperty('error');
    });

    it('should measure latency for Redis check', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const start = Date.now();
      await checkRedis();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  // ============================================
  // Queue Health Tests
  // ============================================
  describe('checkQueues', () => {
    it('should return up status when no excessive failures', async () => {
      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 5, active: 2, completed: 100, failed: 10 },
        'order.completed': { waiting: 3, active: 1, completed: 50, failed: 5 },
      });

      const result = await checkQueues();

      expect(result.status).toBe('up');
      expect(result.queues['inventory.low']).toBeDefined();
      expect(result.queues['inventory.low'].waiting).toBe(5);
      expect(result.queues['inventory.low'].failed).toBe(10);
      expect(result.queues['order.completed']).toBeDefined();
    });

    it('should return degraded status when failures exceed threshold', async () => {
      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 5, active: 2, completed: 100, failed: 150 },
      });

      const result = await checkQueues();

      expect(result.status).toBe('degraded');
    });

    it('should return down status when queue stats fail', async () => {
      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockRejectedValueOnce(new Error('Queue error'));

      const result = await checkQueues();

      expect(result.status).toBe('down');
      expect(result.queues).toEqual({});
    });

    it('should include all queue counts in response', async () => {
      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 1, active: 2, completed: 3, failed: 4 },
        'order.completed': { waiting: 5, active: 6, completed: 7, failed: 8 },
      });

      const result = await checkQueues();

      expect(result.queues['inventory.low']).toHaveProperty('waiting', 1);
      expect(result.queues['inventory.low']).toHaveProperty('active', 2);
      expect(result.queues['inventory.low']).toHaveProperty('completed', 3);
      expect(result.queues['inventory.low']).toHaveProperty('failed', 4);
    });
  });

  // ============================================
  // getHealthStatus Tests
  // ============================================
  describe('getHealthStatus', () => {
    it('should return healthy status when all services are up', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const health = await getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('uptime');
      expect(health.services.mongodb.status).toBe('up');
      expect(health.services.redis.status).toBe('up');
      expect(health.services.queues.status).toBe('up');
    });

    it('should return unhealthy status when MongoDB is down', async () => {
      mockMongoose.connection.readyState = 0;
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const health = await getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.services.mongodb.status).toBe('down');
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const health = await getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.services.redis.status).toBe('down');
    });

    it('should return degraded status when queues have excessive failures', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 5, active: 2, completed: 100, failed: 200 },
      });

      const health = await getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.services.queues.status).toBe('degraded');
    });
  });

  // ============================================
  // HTTP Endpoint Tests
  // ============================================
  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
    });

    it('should return 200 (not 503) when degraded', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 5, active: 2, completed: 100, failed: 150 },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
    });

    it('should return 503 when unhealthy', async () => {
      mockMongoose.connection.readyState = 0;
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'unhealthy');
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when ready', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ready', true);
    });

    it('should return 503 when MongoDB is down', async () => {
      mockMongoose.connection.readyState = 0;
      mockRedisClient.ping.mockResolvedValue('PONG');

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('ready', false);
      expect(response.body).toHaveProperty('mongodb', 'down');
    });

    it('should return 503 when Redis is down', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('ready', false);
      expect(response.body).toHaveProperty('redis', 'down');
    });

    it('should include both service statuses in response when not ready', async () => {
      mockMongoose.connection.readyState = 0;
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body.mongodb).toBe('down');
      expect(response.body.redis).toBe('down');
    });
  });

  describe('GET /live', () => {
    it('should return 200 with alive status', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alive', true);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid timestamp', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return positive uptime', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /stats', () => {
    it('should return stats with event counts', async () => {
      mockEventStoreCount
        .mockResolvedValueOnce(100)  // totalEvents
        .mockResolvedValueOnce(80)   // processedEvents
        .mockResolvedValueOnce(15)   // pendingEvents
        .mockResolvedValueOnce(5);   // failedEvents

      mockDeadLetterCount.mockResolvedValue(3);

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 2, active: 1, completed: 50, failed: 1 },
      });

      const response = await request(app).get('/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(response.body.events).toHaveProperty('total', 100);
      expect(response.body.events).toHaveProperty('processed', 80);
      expect(response.body.events).toHaveProperty('pending', 15);
      expect(response.body.events).toHaveProperty('failed', 5);
      expect(response.body.events).toHaveProperty('deadLetter', 3);
    });

    it('should return queue stats', async () => {
      mockEventStoreCount.mockResolvedValue(0);
      mockDeadLetterCount.mockResolvedValue(0);

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({
        'inventory.low': { waiting: 1, active: 2, completed: 3, failed: 4 },
      });

      const response = await request(app).get('/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queues');
      expect(response.body.queues['inventory.low']).toBeDefined();
      expect(response.body.queues['inventory.low'].waiting).toBe(1);
    });

    it('should return schema information', async () => {
      mockEventStoreCount.mockResolvedValue(0);
      mockDeadLetterCount.mockResolvedValue(0);

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({});

      const response = await request(app).get('/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toHaveProperty('registered');
      expect(response.body.schemas).toHaveProperty('versions');
    });

    it('should return system information', async () => {
      mockEventStoreCount.mockResolvedValue(0);
      mockDeadLetterCount.mockResolvedValue(0);

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValueOnce({});

      const response = await request(app).get('/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('system');
      expect(response.body.system).toHaveProperty('uptime');
      expect(response.body.system).toHaveProperty('memoryUsage');
      expect(response.body.system).toHaveProperty('cpuUsage');
    });

    it('should return 500 on stats retrieval error', async () => {
      mockEventStoreCount.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to retrieve stats');
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Health Check Integration', () => {
    it('should handle concurrent health checks', async () => {
      // Health and ready endpoints
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValue({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const response1 = await request(app).get('/health');
      expect(response1.status).toBe(200);

      const response2 = await request(app).get('/ready');
      expect(response2.status).toBe(200);

      const response3 = await request(app).get('/live');
      expect(response3.status).toBe(200);
    });

    it('should include all required health status fields', async () => {
      mockMongoose.connection.readyState = 1;
      mockMongoose.connection.db = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
      };
      mockRedisClient.ping.mockResolvedValue('PONG');

      const { getQueueStats } = require('../events/consumer');
      getQueueStats.mockResolvedValue({
        'inventory.low': { waiting: 0, active: 0, completed: 10, failed: 0 },
      });

      const response = await request(app).get('/health');
      const health = response.body;

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('mongodb');
      expect(health.services).toHaveProperty('redis');
      expect(health.services).toHaveProperty('queues');
    });
  });
});

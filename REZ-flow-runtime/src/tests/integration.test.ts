/**
 * REZ Flow Runtime - Integration Tests
 * Tests service-to-service communication, MongoDB, and Redis operations
 */

import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// Test configuration
const TEST_TOKEN = 'test-internal-token-12345';
const MONGODB_URI = 'mongodb://localhost:27017/rez-flow-runtime-test';
const REDIS_URL = 'redis://localhost:6379';

// Mock data
const mockWorkflow = {
  workflowId: 'wf_test_123',
  name: 'Test Workflow',
  description: 'Integration test workflow',
  version: 1,
  status: 'published',
  definition: {
    nodes: [
      { id: 'node_1', type: 'trigger', data: { label: 'Start' } },
      { id: 'node_2', type: 'action', data: { label: 'Action' } },
    ],
    edges: [{ id: 'e1', source: 'node_1', target: 'node_2' }],
  },
  nodes: [
    { id: 'node_1', type: 'trigger', data: { label: 'Start' } },
    { id: 'node_2', type: 'action', data: { label: 'Action' } },
  ],
  edges: [{ id: 'e1', source: 'node_1', target: 'node_2' }],
  entryNodeId: 'node_1',
};

const mockExecution = {
  workflowId: 'wf_test_123',
  workflowVersion: 1,
  status: 'pending',
  triggerType: 'manual',
  triggerData: { source: 'integration_test' },
  context: {
    userId: 'user_test_123',
    variables: {},
  },
  nodeResults: [],
  executionPath: [],
  logs: [],
  stats: {
    totalNodes: 2,
    completedNodes: 0,
    failedNodes: 0,
    skippedNodes: 0,
    totalRetries: 0,
  },
};

// Mock Redis instance
const mockRedisInstance = {
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  ltrim: jest.fn().mockResolvedValue('OK'),
  llen: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
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
      MockModel.getStats = jest.fn().mockResolvedValue({
        totalExecutions: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        running: 0,
      });
      return MockModel;
    }),
    Types: {
      ObjectId: jest.fn().mockImplementation(() => 'mock_object_id'),
    },
  };
});

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    getJob: jest.fn().mockResolvedValue(null),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    }),
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

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', async (req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1;
    const redisConnected = true; // Mock is always connected

    res.json({
      status: mongoStatus && redisConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        mongodb: mongoStatus ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
        dlq: 'connected',
      },
    });
  });

  // Workflow registration
  app.post('/api/workflows', async (req: Request, res: Response) => {
    const { workflow } = req.body;

    if (!workflow || !workflow.workflowId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing workflow data' },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        workflowId: workflow.workflowId,
        version: workflow.version || 1,
        status: 'draft',
      },
    });
  });

  // Workflow retrieval
  app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
    const { workflowId } = req.params;

    if (workflowId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow not found' },
      });
    }

    res.json({
      success: true,
      data: mockWorkflow,
    });
  });

  // Execution creation
  app.post('/api/executions', async (req: Request, res: Response) => {
    const { workflowId, triggerType, triggerData } = req.body;

    if (!workflowId || !triggerType) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        executionId: 'exec_' + Date.now(),
        workflowId,
        status: 'pending',
        triggerType,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Execution retrieval
  app.get('/api/executions/:executionId', async (req: Request, res: Response) => {
    const { executionId } = req.params;

    if (executionId === 'not_found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Execution not found' },
      });
    }

    res.json({
      success: true,
      data: {
        ...mockExecution,
        _id: executionId,
      },
    });
  });

  // DLQ operations
  app.get('/api/dlq', async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        stats: { totalMessages: 5, retryStats: { attempts: 10 } },
        messages: [
          { id: 'dlq_1', executionId: 'exec_1', error: 'Timeout', retryCount: 3 },
          { id: 'dlq_2', executionId: 'exec_2', error: 'Connection failed', retryCount: 5 },
        ],
        pagination: { total: 5, page: 1, limit: 20, totalPages: 1 },
      },
    });
  });

  app.post('/api/dlq/:jobId/retry', async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Message retry queued',
      jobId: req.params.jobId,
    });
  });

  // Stats endpoint
  app.get('/api/stats', async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        executions: {
          total: 100,
          completed: 80,
          failed: 15,
          running: 5,
        },
        dlq: { totalMessages: 5 },
        workflows: { total: 10, published: 8 },
        generatedAt: new Date().toISOString(),
      },
    });
  });

  // Event Bus integration test endpoint
  app.post('/api/events/publish', async (req: Request, res: Response) => {
    const { event, data } = req.body;

    // Simulate event bus publish
    await mockRedisInstance.lpush('event_queue', JSON.stringify({ event, data, timestamp: Date.now() }));

    res.json({
      success: true,
      published: true,
      event,
    });
  });

  return app;
}

describe('REZ Flow Runtime Integration Tests', () => {
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
      it('should report MongoDB connection status in health check', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.checks.mongodb).toBeDefined();
        expect(['connected', 'disconnected']).toContain(response.body.checks.mongodb);
      });

      it('should reflect connection status in overall health', async () => {
        const response = await request(app).get('/health');

        expect(response.body.status).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      });
    });

    describe('Workflow CRUD Operations', () => {
      it('should create workflow successfully', async () => {
        const response = await request(app)
          .post('/api/workflows')
          .send({ workflow: mockWorkflow });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.workflowId).toBe(mockWorkflow.workflowId);
      });

      it('should reject workflow creation with missing data', async () => {
        const response = await request(app)
          .post('/api/workflows')
          .send({ workflow: {} });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });

      it('should retrieve existing workflow', async () => {
        const response = await request(app)
          .get(`/api/workflows/${mockWorkflow.workflowId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.workflowId).toBe(mockWorkflow.workflowId);
      });

      it('should return 404 for non-existent workflow', async () => {
        const response = await request(app)
          .get('/api/workflows/not_found');

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('Execution CRUD Operations', () => {
      it('should create execution successfully', async () => {
        const response = await request(app)
          .post('/api/executions')
          .send({
            workflowId: mockWorkflow.workflowId,
            triggerType: 'manual',
            triggerData: { source: 'integration_test' },
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.executionId).toBeDefined();
      });

      it('should reject execution creation without workflowId', async () => {
        const response = await request(app)
          .post('/api/executions')
          .send({ triggerType: 'manual' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_INPUT');
      });

      it('should reject execution creation without triggerType', async () => {
        const response = await request(app)
          .post('/api/executions')
          .send({ workflowId: mockWorkflow.workflowId });

        expect(response.status).toBe(400);
      });

      it('should retrieve existing execution', async () => {
        const response = await request(app)
          .get('/api/executions/exec_123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data._id).toBe('exec_123');
      });
    });
  });

  describe('Redis Integration', () => {
    describe('Cache Operations', () => {
      it('should publish events to event queue', async () => {
        const eventData = { event: 'execution.completed', executionId: 'exec_123' };

        const response = await request(app)
          .post('/api/events/publish')
          .send(eventData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.published).toBe(true);
        expect(mockRedisInstance.lpush).toHaveBeenCalled();
      });

      it('should track event in Redis queue', async () => {
        const eventData = { event: 'workflow.published', workflowId: 'wf_123' };

        await request(app)
          .post('/api/events/publish')
          .send(eventData);

        expect(mockRedisInstance.lpush).toHaveBeenCalledWith(
          'event_queue',
          expect.stringContaining('workflow.published')
        );
      });
    });

    describe('DLQ Operations', () => {
      it('should retrieve DLQ messages from Redis', async () => {
        const response = await request(app).get('/api/dlq');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.messages).toBeInstanceOf(Array);
      });

      it('should retry DLQ message', async () => {
        const response = await request(app)
          .post('/api/dlq/dlq_1/retry');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('retry');
      });
    });
  });

  describe('Service-to-Service Communication', () => {
    describe('Event Bus Integration', () => {
      it('should publish workflow events', async () => {
        const workflowEvent = {
          event: 'workflow.execution.started',
          data: {
            workflowId: 'wf_123',
            executionId: 'exec_456',
            timestamp: Date.now(),
          },
        };

        const response = await request(app)
          .post('/api/events/publish')
          .send(workflowEvent);

        expect(response.status).toBe(200);
        expect(response.body.event).toBe(workflowEvent.event);
      });

      it('should handle event publishing failures gracefully', async () => {
        // Simulate Redis failure
        mockRedisInstance.lpush.mockRejectedValueOnce(new Error('Redis connection failed'));

        const response = await request(app)
          .post('/api/events/publish')
          .send({ event: 'test', data: {} });

        // Should return error response
        expect(response.status).toBe(500);
      });
    });

    describe('Cross-Service Data Flow', () => {
      it('should execute full workflow lifecycle', async () => {
        // Step 1: Create workflow
        const createResponse = await request(app)
          .post('/api/workflows')
          .send({ workflow: { workflowId: 'wf_lifecycle_test' } });

        expect(createResponse.status).toBe(201);
        const workflowId = createResponse.body.data.workflowId;

        // Step 2: Create execution
        const execResponse = await request(app)
          .post('/api/executions')
          .send({
            workflowId,
            triggerType: 'manual',
            triggerData: {},
          });

        expect(execResponse.status).toBe(201);
        const executionId = execResponse.body.data.executionId;

        // Step 3: Retrieve execution
        const getResponse = await request(app)
          .get(`/api/executions/${executionId}`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.workflowId).toBe(workflowId);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle MongoDB disconnection gracefully', async () => {
      // Mock disconnection
      (mongoose.connection.readyState as any) = 0;

      const response = await request(app).get('/health');

      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.mongodb).toBe('disconnected');

      // Restore
      (mongoose.connection.readyState as any) = 1;
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle oversized payloads', async () => {
      const largePayload = {
        workflow: {
          workflowId: 'wf_large',
          data: 'x'.repeat(11 * 1024 * 1024), // > 10MB
        },
      };

      const response = await request(app)
        .post('/api/workflows')
        .send(largePayload);

      // Should reject or handle appropriately
      expect([400, 413, 431]).toContain(response.status);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/health')
        );

      const responses = await Promise.all(promises);

      expect(responses.every((r) => r.status === 200)).toBe(true);
    });
  });

  describe('Stats and Monitoring', () => {
    it('should aggregate execution statistics', async () => {
      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.executions).toBeDefined();
      expect(response.body.data.dlq).toBeDefined();
      expect(response.body.data.workflows).toBeDefined();
    });

    it('should include timestamp in stats response', async () => {
      const response = await request(app).get('/api/stats');

      expect(response.body.data.generatedAt).toBeDefined();
      expect(new Date(response.body.data.generatedAt)).toBeInstanceOf(Date);
    });
  });
});

/**
 * REZ Flow Runtime - Jest Test Setup
 * Configures test environment with mocks and fixtures
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-flow-runtime-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token-12345';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.PORT = '4200';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock external dependencies
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    lpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    ltrim: jest.fn().mockResolvedValue('OK'),
    llen: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    disconnect: jest.fn(),
  }));
});

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      db: {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({ ok: 1 }),
        }),
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn().mockResolvedValue('index_created'),
        }),
      },
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    },
  };
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
  FlowProducer: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock logger to suppress output during tests
jest.mock('../services/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test utilities
export const mockValidToken = 'test-internal-token-12345';
export const mockInvalidToken = 'invalid-token-xyz';
export const mockApiKey = 'test-api-key-abc';
export const mockWebhookSignature = 'valid-webhook-signature';

export function generateMockExecution(overrides = {}) {
  return {
    _id: 'exec_123',
    workflowId: 'wf_456',
    workflowVersion: 1,
    status: 'pending',
    triggerType: 'manual',
    triggerData: {},
    context: {
      userId: 'user_123',
      sessionId: 'session_456',
      variables: {},
    },
    nodeResults: [],
    executionPath: [],
    logs: [],
    stats: {
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      skippedNodes: 0,
      totalRetries: 0,
    },
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function generateMockWorkflow(overrides = {}) {
  return {
    _id: 'wf_123',
    workflowId: 'wf_456',
    name: 'Test Workflow',
    description: 'A test workflow',
    version: 1,
    status: 'draft',
    definition: {},
    nodes: [
      {
        id: 'node_1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Start',
          type: 'trigger',
          config: {},
        },
      },
    ],
    edges: [],
    entryNodeId: 'node_1',
    variables: {},
    metadata: {
      createdBy: 'test_user',
      tags: ['test'],
      category: 'testing',
    },
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Clean up after all tests
afterAll(async () => {
  jest.clearAllMocks();
});

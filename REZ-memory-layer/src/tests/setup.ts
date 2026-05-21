/**
 * REZ Memory Layer - Jest Test Setup
 * Configures test environment with mocks and fixtures
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-memory-layer-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.INTERNAL_SERVICE_TOKEN = 'test-memory-layer-token-67890';
process.env.PORT = '4201';
process.env.EVENT_BUS_URL = 'http://localhost:4025';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock external dependencies
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

// Mock logger to suppress output during tests
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createContextLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock axios for event bus calls
jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({ data: { success: true } }),
    get: jest.fn().mockResolvedValue({ data: { status: 'healthy' } }),
  }),
}));

// Global test utilities
export const mockValidToken = 'test-memory-layer-token-67890';
export const mockInvalidToken = 'invalid-token-xyz';
export const mockApiKey = 'rez_memory_layer_abc123';

export function generateMockTimelineEvent(overrides = {}) {
  return {
    id: 'evt_' + Math.random().toString(36).substring(7),
    userId: 'user_' + Math.random().toString(36).substring(7),
    type: 'page_view',
    category: 'engagement',
    source: 'web',
    timestamp: new Date(),
    data: {
      page: '/home',
      duration: 3000,
    },
    metadata: {
      sessionId: 'session_123',
      deviceId: 'device_456',
      ipAddress: '127.0.0.1',
    },
    ...overrides,
  };
}

export function generateMockUserTimeline(overrides = {}) {
  return {
    userId: 'user_123',
    events: [],
    computedSegments: [
      {
        segmentId: 'seg_1',
        segmentName: 'High Value User',
        confidence: 0.85,
        lastTriggered: new Date(),
        triggers: ['purchase', 'review'],
      },
    ],
    computedPreferences: {
      categories: [{ category: 'electronics', score: 0.8, eventCount: 15, lastInteraction: new Date() }],
      brands: [{ brand: 'Apple', score: 0.9, purchaseCount: 5, avgOrderValue: 500 }],
      priceRanges: [{ range: '100-500', score: 0.7, percentage: 40 }],
      channels: [{ channel: 'mobile', score: 0.95, interactionCount: 50 }],
      timePatterns: [{ pattern: 'evening' as const, score: 0.6, peakHour: 19 }],
    },
    behavioralPatterns: [],
    lastUpdated: new Date(),
    eventCount: 100,
    ...overrides,
  };
}

// Clean up after all tests
afterAll(async () => {
  jest.clearAllMocks();
});

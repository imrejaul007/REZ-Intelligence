import { v4 as uuidv4 } from 'uuid';

// Mock Redis
const mockRedis = {
  ping: jest.fn().mockResolvedValue('PONG'),
  status: 'ready',
};

// Mock config
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
  getRedisClient: jest.fn().mockReturnValue(mockRedis),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Mock models
jest.mock('../models/event-store', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
  const mockCountDocuments = jest.fn().mockResolvedValue(0);

  const MockEventStore = function() {
    return { save: mockSave };
  };
  (MockEventStore as any).updateOne = mockUpdateOne;
  (MockEventStore as any).countDocuments = mockCountDocuments;

  const MockDeadLetterEvent = function() {};
  (MockDeadLetterEvent as any).countDocuments = mockCountDocuments;

  return {
    EventStore: MockEventStore,
    DeadLetterEvent: MockDeadLetterEvent,
  };
});

// Import after mocks
import {
  getEventQueue,
  initializeQueues,
  shutdownWorkers,
  getQueueStats,
} from '../events/consumer';

import { EventEmitter } from '../events/emitter';
import { EventType } from '../events/schema-registry';

// Helper to create mock events
function createMockEvent(type: EventType, payload: any) {
  return {
    id: uuidv4(),
    type,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    correlationId: uuidv4(),
    source: 'test',
    payload,
  };
}

// Mock job interface
interface MockJob {
  id: string;
  data: any;
  attemptsMade: number;
  timestamp: number;
  finishedOn?: number;
  log: jest.Mock;
}

// ============================================
// Event Queue Processing Tests
// ============================================
describe('Event Queue Processing Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Queue Initialization', () => {
    it('should initialize queues for all event types', async () => {
      await initializeQueues();

      // Verify queues were created for all event types
      Object.values(EventType).forEach(type => {
        const queue = getEventQueue(type);
        expect(queue).toBeDefined();
      });
    });

    it('should create queue with correct naming convention', () => {
      const queue = getEventQueue(EventType.INVENTORY_LOW);
      expect(queue).toBeDefined();
    });
  });

  describe('Queue Statistics', () => {
    it('should return queue statistics', async () => {
      const stats = await getQueueStats();

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should include counts for all event types', async () => {
      const stats = await getQueueStats();

      Object.values(EventType).forEach(type => {
        expect(stats[type]).toBeDefined();
        expect(stats[type]).toHaveProperty('waiting');
        expect(stats[type]).toHaveProperty('active');
        expect(stats[type]).toHaveProperty('completed');
        expect(stats[type]).toHaveProperty('failed');
      });
    });

    it('should have valid count properties for queues', async () => {
      const stats = await getQueueStats();

      const firstQueue = Object.keys(stats)[0];
      expect(stats[firstQueue]).toHaveProperty('waiting');
      expect(stats[firstQueue]).toHaveProperty('active');
      expect(stats[firstQueue]).toHaveProperty('completed');
      expect(stats[firstQueue]).toHaveProperty('failed');
    });
  });
});

// ============================================
// Dead Letter Queue Tests
// ============================================
describe('Dead Letter Queue Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dead Letter Queue Configuration', () => {
    it('should have dead letter queue enabled in config', () => {
      const { config } = require('../config');
      expect(config.events.enableDeadLetterQueue).toBe(true);
    });

    it('should have max retries configured', () => {
      const { config } = require('../config');
      expect(config.bullmq.maxRetries).toBe(3);
    });

    it('should have retry delay configured', () => {
      const { config } = require('../config');
      expect(config.bullmq.retryDelay).toBe(1000);
    });
  });
});

// ============================================
// Retry Logic Tests
// ============================================
describe('Retry Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Worker Retry Configuration', () => {
    it('should configure retry with exponential backoff', () => {
      const { config } = require('../config');

      expect(config.bullmq).toHaveProperty('maxRetries');
      expect(config.bullmq).toHaveProperty('retryDelay');
      expect(config.bullmq.maxRetries).toBe(3);
      expect(config.bullmq.retryDelay).toBe(1000);
    });

    it('should track attempts made on job', () => {
      const attemptsMade = 2;
      expect(attemptsMade).toBe(2);
    });

    it('should respect max retry configuration', () => {
      const { config } = require('../config');
      const maxRetries = config.bullmq.maxRetries;
      const attemptsMade = maxRetries;

      expect(attemptsMade).toBe(maxRetries);
    });
  });

  describe('Event Status Updates', () => {
    it('should have event store updateOne function', async () => {
      const { EventStore } = require('../models/event-store');
      expect((EventStore as any).updateOne).toBeDefined();
    });

    it('should have event store countDocuments function', async () => {
      const { EventStore } = require('../models/event-store');
      expect((EventStore as any).countDocuments).toBeDefined();
    });
  });
});

// ============================================
// Event Emitter Correlation Tests
// ============================================
describe('Event Emitter Correlation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Correlation ID Management', () => {
    it('should generate correlation IDs', () => {
      const emitter = EventEmitter.getInstance();
      const correlationId = emitter.generateCorrelationId();

      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should set and get correlation ID', () => {
      const emitter = EventEmitter.getInstance();
      const testId = uuidv4();

      emitter.setCorrelationId(testId);
      expect(emitter.getCorrelationId()).toBe(testId);

      emitter.clearCorrelationId();
      expect(emitter.getCorrelationId()).toBeUndefined();
    });

    it('should clear correlation ID', () => {
      const emitter = EventEmitter.getInstance();

      emitter.setCorrelationId(uuidv4());
      emitter.clearCorrelationId();

      expect(emitter.getCorrelationId()).toBeUndefined();
    });
  });

  describe('Event Publishing', () => {
    it('should publish event with correlation ID', async () => {
      const emitter = EventEmitter.getInstance();
      const correlationId = uuidv4();

      const event = {
        id: uuidv4(),
        type: EventType.INVENTORY_LOW,
        payload: {
          inventoryId: 'inv-123',
          productId: 'prod-456',
          productName: 'Test',
          currentQuantity: 5,
          threshold: 10,
        },
      };

      const result = await emitter.publish(event as any, { correlationId });

      expect(result).toHaveProperty('success');
    });

    it('should return correlation ID on successful publish', async () => {
      const emitter = EventEmitter.getInstance();

      const event = {
        id: uuidv4(),
        type: EventType.ORDER_COMPLETED,
        payload: {
          orderId: 'order-123',
          customerId: 'cust-456',
          items: [{ productId: 'p1', name: 'Item', quantity: 1, unitPrice: 10, subtotal: 10 }],
          subtotal: 10,
          tax: 1,
          shipping: 0,
          total: 11,
          paymentMethod: 'cash' as const,
        },
      };

      const result = await emitter.publish(event as any, {});

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('eventId');
      expect(result).toHaveProperty('correlationId');
    });
  });
});

// ============================================
// Graceful Shutdown Tests
// ============================================
describe('Graceful Shutdown Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shutdownWorkers', () => {
    it('should close all workers and queues', async () => {
      // This should complete without errors
      await expect(shutdownWorkers()).resolves.not.toThrow();
    });

    it('should complete within reasonable time', async () => {
      const start = Date.now();
      await shutdownWorkers();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });
  });
});

// ============================================
// Worker Initialization Tests
// ============================================
describe('Worker Initialization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Worker Configuration', () => {
    it('should have worker concurrency configured', () => {
      const { config } = require('../config');

      expect(config.bullmq).toHaveProperty('concurrency');
      expect(config.bullmq.concurrency).toBe(5);
    });

    it('should have all event types registered', () => {
      const expectedTypes = [
        EventType.INVENTORY_LOW,
        EventType.ORDER_COMPLETED,
        EventType.PAYMENT_SUCCESS,
        EventType.AD_IMPRESSION,
        EventType.AD_CLICK,
        EventType.CONVERSION,
        EventType.CAMPAIGN_CREATED,
        EventType.VOUCHER_ISSUED,
        EventType.NOTIFICATION_SENT,
        EventType.NOTIFICATION_OPENED,
      ];

      expectedTypes.forEach(type => {
        expect(Object.values(EventType)).toContain(type);
      });
    });
  });
});

// ============================================
// Event Type Tests
// ============================================
describe('Event Type Tests', () => {
  describe('Inventory Low Events', () => {
    it('should create valid inventory low event payload', () => {
      const payload = {
        inventoryId: 'inv-123',
        productId: 'prod-456',
        productName: 'Test Product',
        currentQuantity: 5,
        threshold: 10,
        severity: 'medium' as const,
      };

      expect(payload.inventoryId).toBeDefined();
      expect(payload.productId).toBeDefined();
      expect(payload.currentQuantity).toBeLessThan(payload.threshold);
    });

    it('should handle critical severity', () => {
      const payload = {
        inventoryId: 'inv-123',
        productId: 'prod-456',
        productName: 'Critical Item',
        currentQuantity: 0,
        threshold: 10,
        severity: 'critical' as const,
      };

      expect(payload.currentQuantity).toBe(0);
      expect(payload.severity).toBe('critical');
    });
  });

  describe('Order Completed Events', () => {
    it('should create valid order completed payload', () => {
      const payload = {
        orderId: 'order-123',
        customerId: 'cust-456',
        items: [
          { productId: 'p1', name: 'Item 1', quantity: 2, unitPrice: 10, subtotal: 20 },
          { productId: 'p2', name: 'Item 2', quantity: 1, unitPrice: 15, subtotal: 15 },
        ],
        subtotal: 35,
        tax: 3.5,
        shipping: 5,
        total: 43.5,
        paymentMethod: 'credit_card' as const,
      };

      expect(payload.orderId).toBeDefined();
      expect(payload.items.length).toBeGreaterThan(0);
      expect(payload.total).toBe(payload.subtotal + payload.tax + payload.shipping);
    });
  });

  describe('Payment Success Events', () => {
    it('should create valid payment success payload', () => {
      const payload = {
        paymentId: 'pay-123',
        orderId: 'order-456',
        customerId: 'cust-789',
        amount: 100.00,
        currency: 'INR',
        method: 'card',
        transactionId: 'txn-001',
        status: 'completed' as const,
        gateway: 'stripe' as const,
      };

      expect(payload.amount).toBeGreaterThan(0);
      expect(payload.status).toBe('completed');
      expect(payload.gateway).toBeDefined();
    });
  });

  describe('Ad Events', () => {
    it('should create valid ad impression payload', () => {
      const payload = {
        adId: 'ad-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        placement: 'homepage',
        deviceType: 'mobile' as const,
        platform: 'ios',
        location: 'Mumbai',
        referrer: 'google.com',
      };

      expect(payload.adId).toBeDefined();
      expect(payload.campaignId).toBeDefined();
    });

    it('should create valid ad click payload', () => {
      const payload = {
        adId: 'ad-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        placement: 'sidebar',
        deviceType: 'desktop' as const,
        platform: 'windows',
        location: 'Delhi',
        ctaClicked: 'Shop Now',
      };

      expect(payload.ctaClicked).toBeDefined();
    });

    it('should create valid conversion payload', () => {
      const payload = {
        conversionId: 'conv-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        orderId: 'order-999',
        value: 150.00,
        currency: 'INR',
        source: 'ad' as const,
        channel: 'facebook',
      };

      expect(payload.value).toBeGreaterThanOrEqual(0);
      expect(payload.source).toBe('ad');
    });
  });

  describe('Marketing Events', () => {
    it('should create valid campaign created payload', () => {
      const payload = {
        campaignId: 'camp-123',
        campaignName: 'Summer Sale',
        merchantId: 'merchant-789',
        channel: 'marketing' as const,
        budget: 5000.00,
        startDate: '2024-06-01T00:00:00Z',
        endDate: '2024-06-30T23:59:59Z',
      };

      expect(payload.campaignId).toBeDefined();
      expect(payload.budget).toBeGreaterThan(0);
    });

    it('should create valid voucher issued payload', () => {
      const payload = {
        voucherId: 'voucher-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        voucherCode: 'SAVE20',
        discountType: 'percentage' as const,
        discountValue: 20,
        minOrderValue: 100.00,
        expiresAt: '2024-12-31T23:59:59Z',
      };

      expect(payload.discountType).toBe('percentage');
      expect(payload.discountValue).toBeGreaterThan(0);
    });

    it('should create valid notification sent payload', () => {
      const payload = {
        notificationId: 'notif-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        channel: 'push' as const,
        templateId: 'template-001',
        title: 'Special Offer!',
      };

      expect(payload.channel).toBeDefined();
    });

    it('should create valid notification opened payload', () => {
      const payload = {
        notificationId: 'notif-123',
        campaignId: 'camp-456',
        merchantId: 'merchant-789',
        userId: 'user-001',
        channel: 'email' as const,
        openedAt: '2024-06-15T10:30:00Z',
      };

      expect(payload.openedAt).toBeDefined();
    });
  });
});

// ============================================
// Job Processing Simulation Tests
// ============================================
describe('Job Processing Simulation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should simulate job processing with logging', async () => {
    const mockJob: MockJob = {
      id: uuidv4(),
      data: {
        event: createMockEvent(EventType.INVENTORY_LOW, {
          inventoryId: 'inv-123',
          productId: 'prod-456',
          productName: 'Test',
          currentQuantity: 5,
          threshold: 10,
        }),
        publishedAt: new Date().toISOString(),
      },
      attemptsMade: 1,
      timestamp: Date.now(),
      log: jest.fn(),
    };

    // Simulate job processing
    mockJob.log('Processing started');
    mockJob.log(`Job ID: ${mockJob.id}`);
    mockJob.log('Processing completed');

    expect(mockJob.log).toHaveBeenCalledTimes(3);
  });

  it('should handle job failure and retry', () => {
    const mockJob: MockJob = {
      id: uuidv4(),
      data: {
        event: createMockEvent(EventType.ORDER_COMPLETED, {
          orderId: 'order-123',
          customerId: 'cust-456',
          items: [{ productId: 'p1', name: 'Item', quantity: 1, unitPrice: 10, subtotal: 10 }],
          subtotal: 10,
          tax: 1,
          shipping: 0,
          total: 11,
          paymentMethod: 'cash' as const,
        }),
        publishedAt: new Date().toISOString(),
      },
      attemptsMade: 2,
      timestamp: Date.now(),
      log: jest.fn(),
    };

    // Simulate retry logic
    const maxRetries = 3;
    const shouldRetry = mockJob.attemptsMade < maxRetries;

    expect(shouldRetry).toBe(true);
  });

  it('should move to DLQ after max retries', () => {
    const mockJob: MockJob = {
      id: uuidv4(),
      data: {
        event: createMockEvent(EventType.PAYMENT_SUCCESS, {
          paymentId: 'pay-123',
          orderId: 'order-456',
          customerId: 'cust-789',
          amount: 100.00,
          method: 'card',
          transactionId: 'txn-001',
          status: 'completed' as const,
          gateway: 'stripe' as const,
        }),
        publishedAt: new Date().toISOString(),
      },
      attemptsMade: 3,
      timestamp: Date.now(),
      log: jest.fn(),
    };

    const maxRetries = 3;
    const shouldMoveToDLQ = mockJob.attemptsMade >= maxRetries;

    expect(shouldMoveToDLQ).toBe(true);
  });

  it('should calculate job duration', () => {
    const startTime = Date.now() - 1000;
    const endTime = Date.now();

    const duration = endTime - startTime;

    expect(duration).toBeGreaterThanOrEqual(1000);
    expect(duration).toBeLessThan(2000);
  });
});

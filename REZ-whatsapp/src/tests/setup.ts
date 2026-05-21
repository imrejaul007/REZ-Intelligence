/**
 * REZ WhatsApp Service - Jest Test Setup
 * Configures test environment with mocks and fixtures
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-whatsapp-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.INTERNAL_SERVICE_TOKEN = 'test-whatsapp-token-98765';
process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.WHATSAPP_PHONE_NUMBER = '+1234567890';
process.env.TWILIO_VERIFY_TOKEN = 'test_verify_token';
process.env.PORT = '4202';

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock Redis
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
    lpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    disconnect: jest.fn(),
  }));
});

// Mock mongoose
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

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SM' + Math.random().toString(36).substring(7),
        status: 'queued',
      }),
    },
    conversations: {
      v1: {
        conversations: {
          create: jest.fn().mockResolvedValue({
            sid: 'CK' + Math.random().toString(36).substring(7),
          }),
        },
      },
    },
  }));
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

// Mock logger to suppress output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test utilities
export const mockValidToken = 'test-whatsapp-token-98765';
export const mockInvalidToken = 'invalid-whatsapp-token';
export const mockPhoneNumber = '+919876543210';
export const mockSessionId = 'session_' + Math.random().toString(36).substring(7);

export function generateMockMessage(overrides = {}) {
  return {
    id: 'msg_' + Math.random().toString(36).substring(7),
    from: mockPhoneNumber,
    to: '+1234567890',
    body: 'Hello, this is a test message',
    numMedia: '0',
    numSegments: '1',
    dateCreated: new Date().toISOString(),
    dateSent: new Date().toISOString(),
    status: 'sent',
    ...overrides,
  };
}

export function generateMockConversation(overrides = {}) {
  return {
    conversationId: 'conv_' + Math.random().toString(36).substring(7),
    sessionId: mockSessionId,
    userId: 'user_123',
    merchantId: 'merchant_456',
    turns: [],
    currentState: 'idle',
    lastIntent: null,
    startedAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

export function generateMockCartItem(overrides = {}) {
  return {
    productId: 'prod_' + Math.random().toString(36).substring(7),
    name: 'Test Product',
    price: 299,
    quantity: 1,
    merchantId: 'merchant_456',
    imageUrl: 'https://example.com/image.jpg',
    ...overrides,
  };
}

export function generateMockWebhookPayload(overrides = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry_123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: 'phone_id_123',
              },
              contacts: [
                {
                  profile: { name: 'Test User' },
                  wa_id: '919876543210',
                },
              ],
              messages: [
                {
                  from: '919876543210',
                  id: 'msg_123',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: { body: 'Hello' },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
    ...overrides,
  };
}

// Clean up after all tests
afterAll(async () => {
  jest.clearAllMocks();
});

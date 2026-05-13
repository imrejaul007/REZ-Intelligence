// Test setup file
// This runs before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.INTERNAL_SERVICE_TOKENS_JSON = JSON.stringify({
  'test-service': 'test-token',
});
process.env.JWT_SECRET = 'test-secret';

// Mock console to reduce noise in tests
// Uncomment if needed:
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

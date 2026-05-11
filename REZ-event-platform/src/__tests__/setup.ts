// Jest setup file for test configuration
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Increase timeout for async tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests (optional)
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console logs during tests unless in debug mode
  if (!process.env.DEBUG) {
    // Comment out to see logs during tests
    // console.log = jest.fn();
    // console.info = jest.fn();
    // console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

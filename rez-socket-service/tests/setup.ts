/**
 * Test setup for REZ Socket Service
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.PORT = '3001';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

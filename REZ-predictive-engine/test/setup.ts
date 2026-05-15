// Jest setup file
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '4059';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rez-predictive-engine-test';
process.env.LOG_LEVEL = 'error';

// Increase timeout for slow machines
jest.setTimeout(10000);

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logPrediction: jest.fn(),
    logError: jest.fn(),
    logBatchProgress: jest.fn()
  }
}));

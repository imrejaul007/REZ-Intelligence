// Test setup file
// Run before all tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-temporal-intelligence';
process.env.PORT = '4135';

// Suppress console logs during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'debug').mockImplementation(() => {});

// Set test timeout
jest.setTimeout(10000);

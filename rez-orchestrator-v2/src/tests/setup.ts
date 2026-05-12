// Test setup file
jest.setTimeout(10000);

// Mock environment variables
process.env.PORT = '4006';
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_KEY_PREFIX = 'rez:test:orchestrator:';
process.env.REDIS_TTL_SECONDS = '3600';
process.env.INTERNAL_SERVICE_TOKENS_JSON = '{"orchestrator":"test-token"}';
process.env.AGENT_HEALTH_CHECK_INTERVAL_MS = '30000';
process.env.AGENT_HEALTH_CHECK_TIMEOUT_MS = '5000';
process.env.AGENT_MAX_RESPONSE_TIME_MS = '30000';
process.env.AGENT_FALLBACK_ENABLED = 'true';
process.env.COLLABORATION_MAX_AGENTS = '5';
process.env.COLLABORATION_TIMEOUT_MS = '60000';
process.env.COLLABORATION_STRATEGY = 'sequential';
process.env.ESCALATION_ENABLED = 'true';
process.env.ESCALATION_THRESHOLD_ATTEMPTS = '3';
process.env.ESCALATION_TIMEOUT_MS = '120000';
process.env.RESPONSE_TIME_THRESHOLD_MS = '5000';
process.env.RESPONSE_TIME_ALERT_THRESHOLD_MS = '10000';
process.env.LOG_LEVEL = 'error';
process.env.LOG_FORMAT = 'simple';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.HEALTH_CHECK_ENABLED = 'true';
process.env.HEALTH_CHECK_ROUTE = '/health';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.MAX_REQUEST_SIZE = '10mb';
process.env.MAX_HEADERS_SIZE = '8kb';

// Global test utilities
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

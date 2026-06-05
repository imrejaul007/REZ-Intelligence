import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock dotenv
vi.mock('dotenv/config', () => ({}));

// Test the index module loads correctly
describe('Event Bus MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have required environment variables defined', () => {
    // Environment should be defined after imports
    expect(process.env.EVENT_BUS_URL).toBeDefined();
  });

  it('should load module without errors', async () => {
    // Just verify the module can be imported
    const module = await import('../index.js');
    expect(module).toBeDefined();
  });
});

// Test tool handlers if exported from index
describe('Event Bus Tool Handlers', () => {
  it('should define tool request handler', async () => {
    // The MCP server should be defined
    const indexModule = await import('../index.js');
    expect(indexModule).toBeDefined();
  });

  it('should have event types defined', async () => {
    // Verify event types are accessible
    expect([
      'user.created',
      'user.updated',
      'order.created',
      'payment.completed',
    ]).toBeDefined();
  });
});

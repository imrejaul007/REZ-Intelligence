import { vi } from 'vitest';
import mongoose from 'mongoose';

// Mock logger
vi.mock('@rez/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  withContext: <T>(context: Record<string, unknown>, fn: () => T) => fn(),
}));

// Mock Redis
vi.mock('ioredis', () => {
  return vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    keys: vi.fn().mockResolvedValue([]),
    quit: vi.fn().mockResolvedValue('OK'),
  }));
});

// Mock MongoDB connection
vi.mock('mongoose', async () => {
  const actual = await vi.importActual('mongoose');
  return {
    ...actual as unknown,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      on: vi.fn(),
      once: vi.fn(),
    },
  };
});

export { vi };

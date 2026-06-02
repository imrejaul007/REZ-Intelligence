import { GlobalConfig } from '../types';

export const config: GlobalConfig = {
  defaultWindowMs: 60000, // 1 minute
  defaultMaxRequests: 100,
  defaultBurstLimit: 20,
  defaultBurstWindowMs: 5000, // 5 seconds for burst detection
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
};

// Default rate limit configurations for different scenarios
export const defaultLimitConfigs = {
  // Per-user limits (stricter for authenticated users)
  user: {
    windowSizeMs: 60000, // 1 minute
    maxRequests: 100,
    burstLimit: 30,
    burstWindowMs: 5000,
  },
  // Per-IP limits (more permissive)
  ip: {
    windowSizeMs: 60000, // 1 minute
    maxRequests: 200,
    burstLimit: 50,
    burstWindowMs: 5000,
  },
  // Per-endpoint limits (varies by endpoint)
  endpoint: {
    windowSizeMs: 60000, // 1 minute
    maxRequests: 1000,
    burstLimit: 100,
    burstWindowMs: 5000,
  },
};

// Custom endpoint configurations
export const endpointConfigs: Record<string, { windowSizeMs: number; maxRequests: number }> = {
  '/api/auth/login': { windowSizeMs: 60000, maxRequests: 5 }, // Strict login limits
  '/api/auth/register': { windowSizeMs: 3600000, maxRequests: 3 }, // Very strict registration
  '/api/data/search': { windowSizeMs: 60000, maxRequests: 30 },
  '/api/data/export': { windowSizeMs: 60000, maxRequests: 10 }, // Heavy operations
  '/api/payments': { windowSizeMs: 60000, maxRequests: 20 },
};

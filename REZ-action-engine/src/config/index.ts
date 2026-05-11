/**
 * Configuration for REZ Action Engine
 */

export const config = {
  // Service
  port: parseInt(process.env.PORT || '4009', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'rez-action-engine',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-action-engine',
  },

  // Event Platform
  eventPlatform: {
    host: process.env.EVENT_PLATFORM_HOST || 'localhost',
    port: parseInt(process.env.EVENT_PLATFORM_PORT || '4001', 10),
    apiKey: process.env.EVENT_PLATFORM_API_KEY || '',
  },

  // NextaBiZ
  nextabizz: {
    apiUrl: process.env.NEXTABIZ_API_URL || 'http://localhost:4002',
    apiKey: process.env.NEXTABIZ_API_KEY || '',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

export type Config = typeof config;

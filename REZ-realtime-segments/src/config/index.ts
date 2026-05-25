import logger from './utils/logger';

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '4040', 10),
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '300', 10) // 5 minutes default
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-realtime-segments'
  },
  auth: {
    internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
    serviceTokens: parseServiceTokens(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}')
  },
  webhooks: {
    endpoints: parseWebhookEndpoints(process.env.WEBHOOK_ENDPOINTS || '[]')
  },
  external: {
    intentGraphUrl: process.env.REZ_INTENT_GRAPH_URL || 'http://localhost:4007',
    attributionUrl: process.env.REZ_ATTRIBUTION_URL || 'http://localhost:3000'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

function parseServiceTokens(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON, using empty object');
    return {};
  }
}

function parseWebhookEndpoints(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    logger.warn('Failed to parse WEBHOOK_ENDPOINTS, using empty array');
    return [];
  }
}

export default config;

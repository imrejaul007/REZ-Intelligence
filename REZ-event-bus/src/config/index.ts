/**
 * Configuration Module
 * Centralized configuration management with environment variables
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['REDIS_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} not set, using default`);
  }
}

// Server Configuration
export const config = {
  server: {
    port: parseInt(process.env.PORT || '4082', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rez:event-bus:',
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
  },

  // Kafka Configuration
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'rez-event-bus',
    groupId: process.env.KAFKA_GROUP_ID || 'rez-event-bus-group',
    sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000', 10),
    heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000', 10),
    // Kafka topic for event bus
    topic: 'rez-events',
    // Consumer settings
    consumer: {
      sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000', 10),
      heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000', 10),
    },
    // Producer settings
    producer: {
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    },
  },

  // Authentication Configuration
  auth: {
    internalServiceTokens: parseServiceTokens(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Event Bus Settings
  eventBus: {
    retentionHours: parseInt(process.env.EVENT_RETENTION_HOURS || '168', 10),
    maxPayloadSize: parseInt(process.env.MAX_EVENT_PAYLOAD_SIZE || '1048576', 10), // 1MB
    maxSubscriptionsPerClient: parseInt(process.env.MAX_SUBSCRIPTIONS_PER_CLIENT || '100', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  },
} as const;

// Helper function to parse service tokens
function parseServiceTokens(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

// Type definitions
export type Config = typeof config;
export type ServerConfig = typeof config.server;
export type RedisConfig = typeof config.redis;
export type KafkaConfig = typeof config.kafka;
export type AuthConfig = typeof config.auth;
export type LoggingConfig = typeof config.logging;
export type EventBusConfig = typeof config.eventBus;

export default config;

/**
 * Health Monitor Configuration
 * Environment and service configuration with circuit breaker settings
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  PORT: z.string().default('4095'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('rez:health-monitor:'),

  // Health Check Interval
  HEALTH_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),
  HEALTH_CHECK_TIMEOUT_MS: z.string().transform(Number).default('5000'),

  // Circuit Breaker Settings
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.string().transform(Number).default('3'),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS: z.string().transform(Number).default('1'),

  // Alert Settings
  ALERT_WEBHOOK_URL: z.string().optional(),
  ALERT_EMAIL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  ALERT_EMAIL_TO: z.string().optional(),
  ALERT_THRESHOLD_MINUTES: z.string().transform(Number).default('5'),

  // Cache TTL
  CACHE_TTL_MS: z.string().transform(Number).default('30000'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment variables:', parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;

export interface ServiceConfig {
  name: string;
  url: string;
  port?: number;
  category?: 'core' | 'expert' | 'integration' | 'data' | 'ai';
}

export interface HealthMonitorConfig {
  port: number;
  nodeEnv: string;
  redis: {
    url: string;
    keyPrefix: string;
  };
  healthCheck: {
    intervalMs: number;
    timeoutMs: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls: number;
  };
  alert: {
    webhookUrl?: string;
    emailEnabled: boolean;
    emailTo?: string;
    thresholdMinutes: number;
  };
  cache: {
    ttlMs: number;
  };
  logging: {
    level: string;
  };
}

export function getHealthMonitorConfig(): HealthMonitorConfig {
  return {
    port: parseInt(config.PORT, 10),
    nodeEnv: config.NODE_ENV,
    redis: {
      url: config.REDIS_URL,
      keyPrefix: config.REDIS_KEY_PREFIX,
    },
    healthCheck: {
      intervalMs: config.HEALTH_CHECK_INTERVAL_MS,
      timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
    },
    circuitBreaker: {
      failureThreshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      resetTimeoutMs: config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      halfOpenMaxCalls: config.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS,
    },
    alert: {
      webhookUrl: config.ALERT_WEBHOOK_URL,
      emailEnabled: config.ALERT_EMAIL_ENABLED,
      emailTo: config.ALERT_EMAIL_TO,
      thresholdMinutes: config.ALERT_THRESHOLD_MINUTES,
    },
    cache: {
      ttlMs: config.CACHE_TTL_MS,
    },
    logging: {
      level: config.LOG_LEVEL,
    },
  };
}

// Default services to monitor
export const DEFAULT_SERVICES: ServiceConfig[] = [
  // Core Services
  { name: 'REZ-event-platform', url: 'http://localhost:4008/health', port: 4008, category: 'core' },
  { name: 'REZ-identity-graph', url: 'http://localhost:4050/health', port: 4050, category: 'core' },

  // Expert Services
  { name: 'rez-hospitality-expert', url: 'http://localhost:3015/health', port: 3015, category: 'expert' },
  { name: 'rez-culinary-expert', url: 'http://localhost:3001/health', port: 3001, category: 'expert' },
  { name: 'rez-fitness-expert', url: 'http://localhost:3002/health', port: 3002, category: 'expert' },
  { name: 'rez-health-expert', url: 'http://localhost:3003/health', port: 3003, category: 'expert' },
  { name: 'rez-travel-expert', url: 'http://localhost:3004/health', port: 3004, category: 'expert' },
  { name: 'rez-retail-expert', url: 'http://localhost:3005/health', port: 3005, category: 'expert' },
  { name: 'rez-salon-expert', url: 'http://localhost:3006/health', port: 3006, category: 'expert' },
  { name: 'rez-education-expert', url: 'http://localhost:3007/health', port: 3007, category: 'expert' },

  // AI Services
  { name: 'REZ-merchant-brain', url: 'http://localhost:4061/health', port: 4061, category: 'ai' },
  { name: 'REZ-autonomous-agents', url: 'http://localhost:4062/health', port: 4062, category: 'ai' },
  { name: 'REZ-payments-brain', url: 'http://localhost:4070/health', port: 4070, category: 'ai' },
  { name: 'REZ-creator-network', url: 'http://localhost:4072/health', port: 4072, category: 'ai' },
  { name: 'REZ-ai-router', url: 'http://localhost:4052/health', port: 4052, category: 'ai' },

  // Data Services
  { name: 'REZ-memory-engine', url: 'http://localhost:4051/health', port: 4051, category: 'data' },
  { name: 'REZ-knowledge-graph', url: 'http://localhost:4060/health', port: 4060, category: 'data' },
  { name: 'REZ-reorder-engine', url: 'http://localhost:4040/health', port: 4040, category: 'data' },
  { name: 'REZ-taste-profile', url: 'http://localhost:4041/health', port: 4041, category: 'data' },
  { name: 'REZ-demand-forecast', url: 'http://localhost:4042/health', port: 4042, category: 'data' },
  { name: 'REZ-price-predictor', url: 'http://localhost:4043/health', port: 4043, category: 'data' },

  // Integration Services
  { name: 'REZ-inventory-sync', url: 'http://localhost:4071/health', port: 4071, category: 'integration' },
  { name: 'REZ-merchant-os', url: 'http://localhost:4073/health', port: 4073, category: 'integration' },
  { name: 'REZ-feedback-collector', url: 'http://localhost:4085/health', port: 4085, category: 'integration' },
  { name: 'REZ-unified-recommendations', url: 'http://localhost:4090/health', port: 4090, category: 'integration' },
  { name: 'REZ-integration-sdk', url: 'http://localhost:4091/health', port: 4091, category: 'integration' },
  { name: 'REZ-identity-bridge', url: 'http://localhost:4092/health', port: 4092, category: 'integration' },
  { name: 'REZ-notification-router', url: 'http://localhost:4093/health', port: 4093, category: 'integration' },
  { name: 'REZ-realtime-gateway', url: 'http://localhost:4094/health', port: 4094, category: 'integration' },
];

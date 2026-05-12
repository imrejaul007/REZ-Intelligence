import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server Configuration
  PORT: z.string().default('4006'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('rez:orchestrator:v2:'),
  REDIS_TTL_SECONDS: z.string().transform(Number).default('3600'),

  // Internal Service Authentication
  INTERNAL_SERVICE_TOKENS_JSON: z.string(),

  // Agent Registry
  AGENT_HEALTH_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),
  AGENT_HEALTH_CHECK_TIMEOUT_MS: z.string().transform(Number).default('5000'),
  AGENT_MAX_RESPONSE_TIME_MS: z.string().transform(Number).default('30000'),
  AGENT_FALLBACK_ENABLED: z.string().transform(val => val === 'true').default('true'),

  // Collaboration Settings
  COLLABORATION_MAX_AGENTS: z.string().transform(Number).default('5'),
  COLLABORATION_TIMEOUT_MS: z.string().transform(Number).default('60000'),
  COLLABORATION_STRATEGY: z.enum(['sequential', 'parallel', 'hierarchical']).default('sequential'),

  // Escalation Settings
  ESCALATION_ENABLED: z.string().transform(val => val === 'true').default('true'),
  ESCALATION_THRESHOLD_ATTEMPTS: z.string().transform(Number).default('3'),
  ESCALATION_TIMEOUT_MS: z.string().transform(Number).default('120000'),
  ESCALATION_WEBHOOK_URL: z.string().optional(),

  // Response Time Tracking
  RESPONSE_TIME_THRESHOLD_MS: z.string().transform(Number).default('5000'),
  RESPONSE_TIME_ALERT_THRESHOLD_MS: z.string().transform(Number).default('10000'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('1000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),

  // Health Check
  HEALTH_CHECK_ENABLED: z.string().transform(val => val === 'true').default('true'),
  HEALTH_CHECK_ROUTE: z.string().default('/health'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4000'),

  // Request Validation
  MAX_REQUEST_SIZE: z.string().default('10mb'),
  MAX_HEADERS_SIZE: z.string().default('8kb'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment variables:', parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;

export interface AppConfig {
  port: number;
  nodeEnv: string;
  redis: {
    url: string;
    keyPrefix: string;
    ttlSeconds: number;
  };
  internalServiceTokens: Record<string, string>;
  agent: {
    healthCheckIntervalMs: number;
    healthCheckTimeoutMs: number;
    maxResponseTimeMs: number;
    fallbackEnabled: boolean;
  };
  collaboration: {
    maxAgents: number;
    timeoutMs: number;
    strategy: 'sequential' | 'parallel' | 'hierarchical';
  };
  escalation: {
    enabled: boolean;
    thresholdAttempts: number;
    timeoutMs: number;
    webhookUrl?: string;
  };
  responseTime: {
    thresholdMs: number;
    alertThresholdMs: number;
  };
  logging: {
    level: string;
    format: string;
  };
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  healthCheck: {
    enabled: boolean;
    route: string;
  };
  cors: {
    origins: string[];
  };
  requestValidation: {
    maxRequestSize: string;
    maxHeadersSize: string;
  };
}

export function getAppConfig(): AppConfig {
  const tokens = JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  return {
    port: parseInt(config.PORT, 10),
    nodeEnv: config.NODE_ENV,
    redis: {
      url: config.REDIS_URL,
      keyPrefix: config.REDIS_KEY_PREFIX,
      ttlSeconds: config.REDIS_TTL_SECONDS,
    },
    internalServiceTokens: tokens,
    agent: {
      healthCheckIntervalMs: config.AGENT_HEALTH_CHECK_INTERVAL_MS,
      healthCheckTimeoutMs: config.AGENT_HEALTH_CHECK_TIMEOUT_MS,
      maxResponseTimeMs: config.AGENT_MAX_RESPONSE_TIME_MS,
      fallbackEnabled: config.AGENT_FALLBACK_ENABLED,
    },
    collaboration: {
      maxAgents: config.COLLABORATION_MAX_AGENTS,
      timeoutMs: config.COLLABORATION_TIMEOUT_MS,
      strategy: config.COLLABORATION_STRATEGY,
    },
    escalation: {
      enabled: config.ESCALATION_ENABLED,
      thresholdAttempts: config.ESCALATION_THRESHOLD_ATTEMPTS,
      timeoutMs: config.ESCALATION_TIMEOUT_MS,
      webhookUrl: config.ESCALATION_WEBHOOK_URL,
    },
    responseTime: {
      thresholdMs: config.RESPONSE_TIME_THRESHOLD_MS,
      alertThresholdMs: config.RESPONSE_TIME_ALERT_THRESHOLD_MS,
    },
    logging: {
      level: config.LOG_LEVEL,
      format: config.LOG_FORMAT,
    },
    rateLimit: {
      maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
      windowMs: config.RATE_LIMIT_WINDOW_MS,
    },
    healthCheck: {
      enabled: config.HEALTH_CHECK_ENABLED,
      route: config.HEALTH_CHECK_ROUTE,
    },
    cors: {
      origins: config.CORS_ORIGINS.split(','),
    },
    requestValidation: {
      maxRequestSize: config.MAX_REQUEST_SIZE,
      maxHeadersSize: config.MAX_HEADERS_SIZE,
    },
  };
}

export const appConfig = getAppConfig();

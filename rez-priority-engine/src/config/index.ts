import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4080'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-priority-engine'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('development-secret-change-in-production'),
  INTERNAL_SERVICE_TOKENS_JSON: z.string().default('{}'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  CACHE_TTL_SECONDS: z.string().default('300'),
  EMERGENCY_TIMEOUT_MS: z.string().default('1000'),
  PRIORITY_PROCESSING_INTERVAL_MS: z.string().default('100'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment configuration:', parseResult.error.format());
  process.exit(1);
}

const env = parseResult.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  mongodb: {
    uri: env.MONGODB_URI,
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    url: env.REDIS_URL,
    keyPrefix: 'rez:priority:',
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    internalServiceTokens: JSON.parse(env.INTERNAL_SERVICE_TOKENS_JSON),
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  cache: {
    ttlSeconds: parseInt(env.CACHE_TTL_SECONDS, 10),
  },
  processing: {
    emergencyTimeoutMs: parseInt(env.EMERGENCY_TIMEOUT_MS, 10),
    intervalMs: parseInt(env.PRIORITY_PROCESSING_INTERVAL_MS, 10),
  },
} as const;

export type Config = typeof config;

export default config;

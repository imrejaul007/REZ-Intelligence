import dotenv from 'dotenv';
import { z } from 'zod';
import type { AppConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

// Environment variable schema validation
const envSchema = z.object({
  PORT: z.string().default('4058').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-research-agent'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DAILY_SCHEDULE: z.string().default('0 6 * * *'),
  WEEKLY_SCHEDULE: z.string().default('0 7 * * 1'),
  REALTIME_INTERVAL: z.string().default('300000').transform(Number),
});

const env = envSchema.parse(process.env);

// Configuration object
export const config: AppConfig = {
  port: env.PORT,
  env: env.NODE_ENV,
  mongodb: {
    uri: env.MONGODB_URI,
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    url: env.REDIS_URL,
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  workers: {
    dailySchedule: env.DAILY_SCHEDULE,
    weeklySchedule: env.WEEKLY_SCHEDULE,
    realtimeInterval: env.REALTIME_INTERVAL,
  },
  logging: {
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === 'production' ? 'json' : 'simple',
  },
};

// Freeze config to prevent accidental modifications
Object.freeze(config);

// Helper functions
export function isProduction(): boolean {
  return config.env === 'production';
}

export function isDevelopment(): boolean {
  return config.env === 'development';
}

export function isTest(): boolean {
  return config.env === 'test';
}

export function getServiceUrl(): string {
  return `http://localhost:${config.port}`;
}

export default config;

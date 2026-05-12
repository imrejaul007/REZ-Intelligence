import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenv.config();

// Environment configuration schema
const envSchema = z.object({
  // Service configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  SERVICE_NAME: z.string().default('@rez/core-brain'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // MongoDB configuration
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-core-brain'),
  MONGODB_USER: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0').transform(Number),

  // JWT configuration
  JWT_SECRET: z.string().min(32).default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Memory configuration
  SHORT_TERM_MEMORY_TTL: z.string().default('3600').transform(Number), // 1 hour in seconds
  LONG_TERM_MEMORY_RETENTION: z.string().default('365').transform(Number), // days
  MAX_SHORT_TERM_MEMORIES: z.string().default('100').transform(Number),
  EMBEDDING_MODEL: z.string().default('text-embedding-ada-002'),

  // Session configuration
  SESSION_TTL: z.string().default('1800').transform(Number), // 30 minutes
  MAX_CONCURRENT_SESSIONS: z.string().default('10').transform(Number),

  // Rate limiting
  RATE_LIMIT_WINDOW: z.string().default('900000').transform(Number), // 15 minutes
  RATE_LIMIT_MAX: z.string().default('1000').transform(Number),

  // Internal service communication
  INTERNAL_SERVICE_TOKENS_JSON: z.string().default('{}'),

  // CORS
  CORS_ORIGINS: z.string().default('*'),

  // Optional external services
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

// Parse and validate environment variables
function parseEnvConfig() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Environment configuration error: ${issues}`);
    }
    throw error;
  }
}

export const config = parseEnvConfig();

// Derived configurations
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// MongoDB connection string with authentication
export function getMongoUri(): string {
  if (config.MONGODB_USER && config.MONGODB_PASSWORD) {
    const uri = new URL(config.MONGODB_URI);
    uri.username = config.MONGODB_USER;
    uri.password = config.MONGODB_PASSWORD;
    return uri.toString();
  }
  return config.MONGODB_URI;
}

// Redis configuration
export function getRedisConfig() {
  return {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_DB,
  };
}

// Internal service tokens
export function getInternalServiceTokens(): Record<string, string> {
  try {
    return JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON);
  } catch {
    return {};
  }
}

// CORS origins
export function getCorsOrigins(): string[] {
  if (config.CORS_ORIGINS === '*') return ['*'];
  return config.CORS_ORIGINS.split(',').map((o) => o.trim());
}

// Paths
export const paths = {
  root: path.resolve(__dirname, '../..'),
  dist: path.resolve(__dirname, '../../dist'),
  src: path.resolve(__dirname, '..'),
};

export default config;

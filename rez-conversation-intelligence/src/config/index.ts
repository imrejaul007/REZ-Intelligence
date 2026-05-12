import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('4008').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez_conversation_intelligence'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Internal Service Auth
  INTERNAL_SERVICE_TOKENS_JSON: z.string(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ML/NLP Settings
  SENTIMENT_MODEL: z.enum(['afinn', 'sentiwordnet', 'custom']).default('afinn'),
  INTENT_CONFIDENCE_THRESHOLD: z.string().default('0.7').transform(Number),
  SENTIMENT_CONFIDENCE_THRESHOLD: z.string().default('0.6').transform(Number),

  // Export Settings
  EXPORT_BATCH_SIZE: z.string().default('1000').transform(Number),
  EXPORT_INTERVAL_HOURS: z.string().default('24').transform(Number),
  MODEL_VERSION_PREFIX: z.string().default('v'),

  // Queue Settings
  QUEUE_CONCURRENCY: z.string().default('5').transform(Number),
  JOB_TIMEOUT_MS: z.string().default('300000').transform(Number),

  // External Services
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('1000').transform(Number),

  // Feature Flags
  ENABLE_SENTIMENT_ANALYSIS: z.enum(['true', 'false']).default('true'),
  ENABLE_INTENT_EXTRACTION: z.enum(['true', 'false']).default('true'),
  ENABLE_OUTCOME_TRACKING: z.enum(['true', 'false']).default('true'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment configuration:', parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

export const serviceTokens = JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON) as Record<string, string>;

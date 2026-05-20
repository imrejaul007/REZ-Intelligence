/**
 * Configuration
 * Environment and service configuration
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { HospitalityExpertConfig } from '../types/index.js';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  // Server
  PORT: z.string().default('3005'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // REZ Care Integration
  REZ_CARE_URL: z.string().default('http://localhost:4058'),
  INDUSTRY: z.string().default('hospitality'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017'),
  MONGODB_DB: z.string().default('rez_hospitality'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.string().default('4096'),

  // Service
  SERVICE_NAME: z.string().default('rez-hospitality-expert'),
  LOG_LEVEL: z.string().default('info'),

  // Internal Auth
  INTERNAL_SERVICE_TOKENS_JSON: z.string().default('{}'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Session
  SESSION_TIMEOUT_MS: z.string().default('1800000'),
  MAX_CONVERSATION_HISTORY: z.string().default('50'),

  // Hotel Property
  PROPERTY_NAME: z.string().default('REZ Hospitality Property'),
  DEFAULT_CURRENCY: z.string().default('USD'),
  DEFAULT_LANGUAGE: z.string().default('en'),
  TIMEZONE: z.string().default('America/New_York'),
  CHECK_IN_TIME: z.string().default('3:00 PM'),
  CHECK_OUT_TIME: z.string().default('11:00 AM'),
});

// Parse and validate configuration
function parseConfig() {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:', error.errors);
      throw new Error('Invalid configuration');
    }
    throw error;
  }
}

export const config = parseConfig();

// Export typed configuration
export const serviceConfig: HospitalityExpertConfig = {
  serviceName: config.SERVICE_NAME,
  port: parseInt(config.PORT, 10),
  mongodbUri: config.MONGODB_URI,
  mongodbDb: config.MONGODB_DB,
  redisUrl: config.REDIS_URL,
  anthropicApiKey: config.ANTHROPIC_API_KEY,
  anthropicModel: config.ANTHROPIC_MODEL,
  maxTokens: parseInt(config.ANTHROPIC_MAX_TOKENS, 10),
  sessionTimeout: parseInt(config.SESSION_TIMEOUT_MS, 10),
  maxConversationHistory: parseInt(config.MAX_CONVERSATION_HISTORY, 10),
  rateLimitWindow: parseInt(config.RATE_LIMIT_WINDOW_MS, 10),
  rateLimitMax: parseInt(config.RATE_LIMIT_MAX_REQUESTS, 10),
};

// Helper to check if running in production
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

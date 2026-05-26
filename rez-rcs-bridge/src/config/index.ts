import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4087'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Jio RCS Configuration
  JIO_RCS_API_KEY: z.string().optional(),
  JIO_RCS_API_SECRET: z.string().optional(),
  JIO_RCS_BASE_URL: z.string().default('https://api.jio.com/rcs/v1'),

  // Airtel RCS Configuration
  AIRTEL_RCS_API_KEY: z.string().optional(),
  AIRTEL_RCS_API_SECRET: z.string().optional(),
  AIRTEL_RCS_BASE_URL: z.string().default('https://api.airtel.in/rcs/v1'),

  // Service URLs
  ORCHESTRATOR_URL: z.string().default('http://localhost:4006'),

  // Internal Authentication
  INTERNAL_SERVICE_TOKENS_JSON: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez_rcs'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Environment validation failed:', parseResult.error.format());
  process.exit(1);
}

const env = parseResult.data;

interface ServiceTokens {
  [serviceName: string]: string;
}

function parseServiceTokens(json: string): ServiceTokens {
  try {
    return JSON.parse(json);
  } catch {
    console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

export const config = {
  server: {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
  },

  jio: {
    apiKey: env.JIO_RCS_API_KEY || '',
    apiSecret: env.JIO_RCS_API_SECRET || '',
    baseUrl: env.JIO_RCS_BASE_URL,
    enabled: !!env.JIO_RCS_API_KEY && !!env.JIO_RCS_API_SECRET,
  },

  airtel: {
    apiKey: env.AIRTEL_RCS_API_KEY || '',
    apiSecret: env.AIRTEL_RCS_API_SECRET || '',
    baseUrl: env.AIRTEL_RCS_BASE_URL,
    enabled: !!env.AIRTEL_RCS_API_KEY && !!env.AIRTEL_RCS_API_SECRET,
  },

  services: {
    orchestratorUrl: env.ORCHESTRATOR_URL,
  },

  auth: {
    serviceTokens: parseServiceTokens(env.INTERNAL_SERVICE_TOKENS_JSON),
  },

  redis: {
    url: env.REDIS_URL,
  },

  mongodb: {
    uri: env.MONGODB_URI,
  },

  logging: {
    level: env.LOG_LEVEL,
  },
};

export type Config = typeof config;

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4070),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/rez_mind_pharmacy'),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  AUTH_SERVICE_URL: z.string().url().optional(),
  NOTIFICATION_SERVICE_URL: z.string().url().optional(),
  INTENT_SERVICE_URL: z.string().url().optional(),
  CUSTOMER_PROFILE_SERVICE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_AI: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_MAX_READ: z.coerce.number().int().min(1).default(100),
  DRUG_DATABASE_UPDATE_INTERVAL: z.coerce.number().int().min(1000).default(86400000),
});

export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig;

try {
  envConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    console.error(error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n'));
    process.exit(1);
  }
  throw error;
}

export const config = {
  port: envConfig.PORT,
  nodeEnv: envConfig.NODE_ENV,
  mongodbUri: envConfig.MONGODB_URI,
  internalServiceToken: envConfig.INTERNAL_SERVICE_TOKEN,
  authServiceUrl: envConfig.AUTH_SERVICE_URL,
  notificationServiceUrl: envConfig.NOTIFICATION_SERVICE_URL,
  intentServiceUrl: envConfig.INTENT_SERVICE_URL,
  customerProfileServiceUrl: envConfig.CUSTOMER_PROFILE_SERVICE_URL,
  logLevel: envConfig.LOG_LEVEL,
  rateLimit: {
    windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
    maxAI: envConfig.RATE_LIMIT_MAX_AI,
    maxRead: envConfig.RATE_LIMIT_MAX_READ,
  },
  drugDatabaseUpdateInterval: envConfig.DRUG_DATABASE_UPDATE_INTERVAL,
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
export const isTest = config.nodeEnv === 'test';
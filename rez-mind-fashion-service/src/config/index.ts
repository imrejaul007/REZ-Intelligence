import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(4063),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  INTERNAL_TOKEN: z.string().min(16),
  RABTUL_API_KEY: z.string().optional(),
  RABTUL_BASE_URL: z.string().url().optional().default('https://api.rabtul.io'),
  AI_MODEL: z.string().default('claude-3-sonnet'),
  AI_MAX_TOKENS: z.coerce.number().int().min(100).max(4096).default(2048),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000),
  RATE_LIMIT_MAX_AI: z.coerce.number().positive().default(30),
  RATE_LIMIT_MAX_READ: z.coerce.number().positive().default(100),
  SESSION_TTL_DAYS: z.coerce.number().positive().default(90),
});

export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig;
try {
  envConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment validation failed:');
    error.errors.forEach((err) => console.error(`  - ${err.path.join('.')}: ${err.message}`));
    process.exit(1);
  }
  throw error;
}

export const config = {
  env: envConfig.NODE_ENV,
  port: envConfig.PORT,
  mongodb: { uri: envConfig.MONGODB_URI },
  auth: { jwtSecret: envConfig.JWT_SECRET, internalToken: envConfig.INTERNAL_TOKEN },
  rabtul: { apiKey: envConfig.RABTUL_API_KEY || '', baseUrl: envConfig.RABTUL_BASE_URL },
  ai: { model: envConfig.AI_MODEL, maxTokens: envConfig.AI_MAX_TOKENS, temperature: envConfig.AI_TEMPERATURE },
  rateLimit: { windowMs: envConfig.RATE_LIMIT_WINDOW_MS, maxAI: envConfig.RATE_LIMIT_MAX_AI, maxRead: envConfig.RATE_LIMIT_MAX_READ },
  session: { ttlDays: envConfig.SESSION_TTL_DAYS },
  isProduction: envConfig.NODE_ENV === 'production',
  isDevelopment: envConfig.NODE_ENV === 'development',
};

export default config;
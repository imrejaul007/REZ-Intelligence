import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4085'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  MSG91_API_KEY: z.string().optional(),
  ORCHESTRATOR_URL: z.string().default('http://localhost:4006'),
  INTERNAL_SERVICE_TOKENS_JSON: z.string().default('{}'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MONGODB_URI: z.string().optional(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment configuration:', parseResult.error.format());
  process.exit(1);
}

const env = parseResult.data;

export const config = {
  port: parseInt(env.PORT, 10),

  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || '',
    authToken: env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: env.TWILIO_PHONE_NUMBER || '',
  },

  msg91: {
    apiKey: env.MSG91_API_KEY || '',
  },

  orchestrator: {
    url: env.ORCHESTRATOR_URL,
  },

  internalServiceTokens: JSON.parse(env.INTERNAL_SERVICE_TOKENS_JSON) as Record<string, string>,

  redis: {
    url: env.REDIS_URL,
  },

  mongodb: {
    uri: env.MONGODB_URI,
  },
};

export type Config = typeof config;

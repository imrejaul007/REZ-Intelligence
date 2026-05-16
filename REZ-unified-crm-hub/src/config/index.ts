/**
 * REZ Unified CRM Hub - Configuration
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  // Service
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-unified-crm-hub'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Authentication
  INTERNAL_SERVICE_TOKEN: z.string(),

  // REZ Intelligence Services
  IDENTITY_GRAPH_URL: z.string().default('http://localhost:4050'),
  PREDICTIVE_ENGINE_URL: z.string().default('http://localhost:4059'),
  RFM_SERVICE_URL: z.string().default('http://localhost:4055'),
  UNIFIED_PROFILE_URL: z.string().default('http://localhost:4060'),
  CUSTOMER_INTELLIGENCE_URL: z.string().default('http://localhost:4140'),

  // REZ Consumer Services
  REZ_NOW_URL: z.string().default('http://localhost:3000'),
  MERCHANT_SERVICE_URL: z.string().default('http://localhost:4005'),

  // REZ Media Services
  ENGAGEMENT_PLATFORM_URL: z.string().default('http://localhost:4017'),
  CAMPAIGN_BUILDER_URL: z.string().default('http://localhost:4009'),

  // External CRM
  CRM_HUB_URL: z.string().default('http://localhost:4056'),

  // Optional
  SENTRY_DSN: z.string().optional(),
  SERVICE_NAME: z.string().default('rez-unified-crm-hub'),
});

export const env = envSchema.parse(process.env);

// Service URLs (for HTTP calls to other services)
export const serviceUrls = {
  intelligence: {
    identityGraph: env.IDENTITY_GRAPH_URL,
    predictiveEngine: env.PREDICTIVE_ENGINE_URL,
    rfmService: env.RFM_SERVICE_URL,
    unifiedProfile: env.UNIFIED_PROFILE_URL,
    customerIntelligence: env.CUSTOMER_INTELLIGENCE_URL,
  },
  consumer: {
    rezNow: env.REZ_NOW_URL,
    merchantService: env.MERCHANT_SERVICE_URL,
  },
  media: {
    engagementPlatform: env.ENGAGEMENT_PLATFORM_URL,
    campaignBuilder: env.CAMPAIGN_BUILDER_URL,
  },
  external: {
    crmHub: env.CRM_HUB_URL,
  },
} as const;

export default env;

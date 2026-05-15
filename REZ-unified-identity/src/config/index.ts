import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Service
  port: parseInt(process.env.PORT || '4098', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_unified_identity',
    user: process.env.MONGODB_USER,
    password: process.env.MONGODB_PASSWORD,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rez:identity:',
  },

  // Internal Service Token
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  internalServiceTokensJson: process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}',

  // Service URLs
  serviceUrls: {
    rezMerchant: process.env.REZ_MERCHANT_API_URL || 'http://localhost:4000',
    rezConsumer: process.env.REZ_CONSUMER_API_URL || 'http://localhost:5000',
    rezMedia: process.env.REZ_MEDIA_API_URL || 'http://localhost:4010',
  },

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

  // Privacy
  privacy: {
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '365', 10),
    consentExpiryDays: parseInt(process.env.CONSENT_EXPIRY_DAYS || '365', 10),
  },

  // Company identifiers
  companies: {
    REZ_MERCHANT: 'rez-merchant',
    REZ_CONSUMER: 'rez-consumer',
    REZ_MEDIA: 'rez-media',
    RABTUL: 'rabtul-technologies',
    STAYOWN: 'stayown-hospitality',
    CORPPERKS: 'corpperks',
    RTNM_GROUP: 'rtnm-group',
  } as const,
};

export type CompanyId = typeof config.companies[keyof typeof config.companies];

export const getInternalServiceTokens = (): Record<string, string> => {
  try {
    return JSON.parse(config.internalServiceTokensJson);
  } catch {
    return {};
  }
};

export const validateConfig = (): void => {
  const required: string[] = [];
  const warnings: string[] = [];

  if (!config.internalServiceToken) {
    warnings.push('INTERNAL_SERVICE_TOKEN not set - service-to-service auth will be insecure');
  }

  if (!config.encryptionKey) {
    warnings.push('ENCRYPTION_KEY not set - data encryption will be insecure');
  }

  if (warnings.length > 0) {
    console.warn('Configuration warnings:', warnings);
  }

  if (required.length > 0) {
    throw new Error(`Missing required configuration: ${required.join(', ')}`);
  }
};

export default config;

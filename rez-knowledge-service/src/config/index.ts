// REZ Knowledge Service - Configuration
// Centralized user knowledge base service for ALL apps

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-knowledge',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  // Connected app service URLs
  services: {
    stayown: {
      url: process.env.STAYOWN_SERVICE_URL || 'http://localhost:4001',
      apiKey: process.env.STAYOWN_API_KEY || '',
    },
    'rez-consumer': {
      url: process.env.REZ_CONSUMER_SERVICE_URL || 'http://localhost:4002',
      apiKey: process.env.REZ_CONSUMER_API_KEY || '',
    },
    rendez: {
      url: process.env.RENDEZ_SERVICE_URL || 'http://localhost:4003',
      apiKey: process.env.RENDEZ_API_KEY || '',
    },
    corpspark: {
      url: process.env.CORPSPARK_SERVICE_URL || 'http://localhost:4004',
      apiKey: process.env.CORPSPARK_API_KEY || '',
    },
    restaurant: {
      url: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:4005',
      apiKey: process.env.RESTAURANT_API_KEY || '',
    },
    salon: {
      url: process.env.SALON_SERVICE_URL || 'http://localhost:4006',
      apiKey: process.env.SALON_API_KEY || '',
    },
    healthcare: {
      url: process.env.HEALTHCARE_SERVICE_URL || 'http://localhost:4007',
      apiKey: process.env.HEALTHCARE_API_KEY || '',
    },
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  cors: {
    origins: (
      process.env.CORS_ORIGINS ||
      'http://localhost:3000,https://rez.money,https://admin.rez.money,https://merchant.rez.money'
    ).split(','),
  },

  service: {
    secret: process.env.SERVICE_SECRET || 'dev-service-secret',
    name: 'rez-knowledge-service',
    version: '2.0.0',
    description: 'Unified User Knowledge Base Service - Single Source of Truth for ALL Apps',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Signal collection settings
  signalCollection: {
    enabled: process.env.SIGNAL_COLLECTION_ENABLED !== 'false',
    defaultLimit: parseInt(process.env.SIGNAL_DEFAULT_LIMIT || '100', 10),
    maxSignalsPerUser: parseInt(process.env.MAX_SIGNALS_PER_USER || '10000', 10),
    retentionDays: parseInt(process.env.SIGNAL_RETENTION_DAYS || '90', 10),
  },
};

export default config;

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface Config {
  port: number;
  nodeEnv: string;
  mongodb: {
    uri: string;
    options: {
      maxPoolSize: number;
      serverSelectionTimeoutMS: number;
      socketTimeoutMS: number;
    };
  };
  redis: {
    url: string;
    keyPrefix: string;
    ttl: number;
  };
  services: {
    orderServiceUrl: string;
    paymentServiceUrl: string;
    reviewServiceUrl: string;
    segmentsServiceUrl: string;
    rfmServiceUrl: string;
    recommendationServiceUrl: string;
  };
  auth: {
    internalServiceToken: string;
    internalServiceTokensJson: Record<string, string>;
  };
  logging: {
    level: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cache: {
    customerOverviewTtl: number;
    recommendationsTtl: number;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '4140', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_customer_intelligence_hub',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'custintel:',
    ttl: 3600, // 1 hour cache TTL
  },

  services: {
    orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
    paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001',
    reviewServiceUrl: process.env.REVIEW_SERVICE_URL || 'http://localhost:4006',
    segmentsServiceUrl: process.env.SEGMENTS_SERVICE_URL || 'http://localhost:4015',
    rfmServiceUrl: process.env.RFM_SERVICE_URL || 'http://localhost:4055',
    recommendationServiceUrl: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:4017',
  },

  auth: {
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',
    internalServiceTokensJson: parseServiceTokens(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  cache: {
    customerOverviewTtl: 300, // 5 minutes
    recommendationsTtl: 1800, // 30 minutes
  },
};

function parseServiceTokens(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export default config;

export { Config };

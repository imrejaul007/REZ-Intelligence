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
    inventoryServiceUrl: string;
    orderServiceUrl: string;
    analyticsServiceUrl: string;
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
  inventory: {
    lowStockThreshold: number;
    criticalStockThreshold: number;
    forecastDays: number;
    velocityWindowDays: number;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '4141', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_inventory_intelligence',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'invintel:',
    ttl: 300, // 5 minutes cache TTL
  },

  services: {
    inventoryServiceUrl: process.env.INVENTORY_SERVICE_URL || 'http://localhost:4010',
    orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
    analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4006',
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

  inventory: {
    lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10),
    criticalStockThreshold: parseInt(process.env.CRITICAL_STOCK_THRESHOLD || '5', 10),
    forecastDays: parseInt(process.env.FORECAST_DAYS || '30', 10),
    velocityWindowDays: parseInt(process.env.VELOCITY_WINDOW_DAYS || '7', 10),
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

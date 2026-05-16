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
    shippingServiceUrl: string;
    locationServiceUrl: string;
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
  delivery: {
    defaultEtaHours: number;
    trafficMultiplier: number;
    weatherMultiplier: number;
    peakHoursStart: number;
    peakHoursEnd: number;
    baseDeliveryScore: number;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '4142', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_delivery_intelligence',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'delintel:',
    ttl: 300, // 5 minutes cache TTL
  },

  services: {
    orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
    shippingServiceUrl: process.env.SHIPPING_SERVICE_URL || 'http://localhost:4011',
    locationServiceUrl: process.env.LOCATION_SERVICE_URL || 'http://localhost:4006',
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

  delivery: {
    defaultEtaHours: parseInt(process.env.DEFAULT_ETA_HOURS || '48', 10),
    trafficMultiplier: parseFloat(process.env.TRAFFIC_MULTIPLIER || '1.2'),
    weatherMultiplier: parseFloat(process.env.WEATHER_MULTIPLIER || '1.3'),
    peakHoursStart: parseInt(process.env.PEAK_HOURS_START || '8', 10),
    peakHoursEnd: parseInt(process.env.PEAK_HOURS_END || '20', 10),
    baseDeliveryScore: parseInt(process.env.BASE_DELIVERY_SCORE || '85', 10),
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

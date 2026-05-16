import dotenv from 'dotenv';
import path from 'path';
import { ServiceConfig, ForecastConfig, OptimizationConfig } from '../types/inventory.types.js';

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
    authServiceUrl: string;
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
  forecast: ForecastConfig;
  optimization: OptimizationConfig;
}

/**
 * Forecast-specific configuration
 */
const forecastConfig: ForecastConfig = {
  historyDays: parseInt(process.env.FORECAST_HISTORY_DAYS || '90', 10),
  seasonalityWeeks: parseInt(process.env.FORECAST_SEASONALITY_WEEKS || '12', 10),
  confidenceLevel: parseFloat(process.env.FORECAST_CONFIDENCE_LEVEL || '0.95'),
  methods: {
    default: 'exponential_smoothing',
    fallback: ['simple_moving_average', 'weighted_moving_average'],
  },
};

/**
 * Optimization-specific configuration
 */
const optimizationConfig: OptimizationConfig = {
  safetyStockServiceLevel: parseFloat(process.env.SAFETY_STOCK_SERVICE_LEVEL || '0.95'),
  reorderPointServiceLevel: parseFloat(process.env.REORDER_POINT_SERVICE_LEVEL || '0.90'),
  targetTurnsPerYear: parseInt(process.env.DEFAULT_TARGET_TURNS || '12', 10),
  holdingCostPercent: parseFloat(process.env.DEFAULT_HOLDING_COST_PERCENT || '25'),
  orderCostPerOrder: parseFloat(process.env.DEFAULT_ORDER_COST || '50'),
};

const config: Config = {
  port: parseInt(process.env.PORT || '4035', 10),
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
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
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

  forecast: forecastConfig,
  optimization: optimizationConfig,
};

function parseServiceTokens(json: string): Record<string, string> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Validate critical configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.mongodb.uri) {
    errors.push('MONGODB_URI is required');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (!config.auth.internalServiceToken && config.nodeEnv === 'production') {
    errors.push('INTERNAL_SERVICE_TOKEN must be set in production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default config;

export { Config };

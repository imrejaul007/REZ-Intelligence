import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Service configuration with validation
 */
interface Config {
  app: {
    name: string;
    port: number;
    env: 'development' | 'production' | 'test';
    apiPrefix: string;
    corsOrigins: string[];
  };
  mongodb: {
    uri: string;
    database: string;
    options: {
      maxPoolSize: number;
      minPoolSize: number;
      maxIdleTimeMS: number;
      retryWrites: boolean;
      retryReads: boolean;
    };
  };
  redis: {
    url: string;
    keyPrefix: string;
    retryStrategy: {
      maxRetries: number;
      retryDelayMs: number;
    };
  };
  scoring: {
    weights: {
      intentMatch: number;
      contextRelevance: number;
      historyAccuracy: number;
      loadFactor: number;
    };
    cache: {
      enabled: boolean;
      ttlSeconds: number;
      maxEntries: number;
    };
    thresholds: {
      minimumScore: number;
      highConfidence: number;
      lowConfidence: number;
    };
    limits: {
      maxAgentsPerRequest: number;
      maxHistoryEntries: number;
      maxProcessingTimeMs: number;
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'simple';
  };
  metrics: {
    enabled: boolean;
    retentionDays: number;
  };
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'REDIS_URL',
  'INTERNAL_SERVICE_TOKENS_JSON',
  'JWT_SECRET',
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// Parse internal service tokens
function parseInternalTokens(): Record<string, string> {
  try {
    return JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');
  } catch {
    throw new Error('INTERNAL_SERVICE_TOKENS_JSON must be a valid JSON object');
  }
}

const config: Config = {
  app: {
    name: process.env.APP_NAME || 'rez-confidence-scorer',
    port: parseInt(process.env.PORT || '4081', 10),
    env: (process.env.NODE_ENV as Config['app']['env']) || 'development',
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },
  mongodb: {
    uri: process.env.MONGODB_URI!,
    database: process.env.MONGODB_DATABASE || 'rez_confidence',
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
      maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_MS || '30000', 10),
      retryWrites: process.env.MONGODB_RETRY_WRITES !== 'false',
      retryReads: process.env.MONGODB_RETRY_READS !== 'false',
    },
  },
  redis: {
    url: process.env.REDIS_URL!,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rez:confidence:',
    retryStrategy: {
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000', 10),
    },
  },
  scoring: {
    weights: {
      intentMatch: parseFloat(process.env.WEIGHT_INTENT_MATCH || '0.35'),
      contextRelevance: parseFloat(process.env.WEIGHT_CONTEXT_RELEVANCE || '0.30'),
      historyAccuracy: parseFloat(process.env.WEIGHT_HISTORY_ACCURACY || '0.25'),
      loadFactor: parseFloat(process.env.WEIGHT_LOAD_FACTOR || '0.10'),
    },
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
      maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000', 10),
    },
    thresholds: {
      minimumScore: parseFloat(process.env.MIN_SCORE_THRESHOLD || '0.1'),
      highConfidence: parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD || '0.75'),
      lowConfidence: parseFloat(process.env.LOW_CONFIDENCE_THRESHOLD || '0.4'),
    },
    limits: {
      maxAgentsPerRequest: parseInt(process.env.MAX_AGENTS_PER_REQUEST || '50', 10),
      maxHistoryEntries: parseInt(process.env.MAX_HISTORY_ENTRIES || '1000', 10),
      maxProcessingTimeMs: parseInt(process.env.MAX_PROCESSING_TIME_MS || '500', 10),
    },
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  logging: {
    level: (process.env.LOG_LEVEL as Config['logging']['level']) || 'info',
    format: (process.env.LOG_FORMAT as Config['logging']['format']) || 'json',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10),
  },
};

// Validate weight configuration sums to 1.0
const weightSum = Object.values(config.scoring.weights).reduce((sum, w) => sum + w, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(
    `Confidence weights must sum to 1.0, got: ${weightSum}. ` +
    `Weights: ${JSON.stringify(config.scoring.weights)}`
  );
}

// Internal service tokens for authentication
export const internalServiceTokens = parseInternalTokens();

export default config;

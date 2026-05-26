import mongoose from 'mongoose';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

export interface Config {
  service: {
    name: string;
    port: number;
    env: string;
  };
  mongodb: {
    uri: string;
    options: mongoose.ConnectOptions;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    maxRetriesPerRequest: number | null;
  };
  bullmq: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
  };
  events: {
    schemaVersion: string;
    enableDeadLetterQueue: boolean;
    deadLetterRetentionDays: number;
  };
  logging: {
    level: string;
  };
  webhooks: {
    secret: string;
    signatureHeader: string;
    timestampTolerance: number;
  };
}

export const config: Config = {
  service: {
    name: process.env.SERVICE_NAME || 'rez-event-platform',
    port: parseInt(process.env.PORT || '4008', 10),
    env: process.env.NODE_ENV || 'development',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-events',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    maxRetriesPerRequest: null,
  },
  bullmq: {
    concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5', 10),
    maxRetries: parseInt(process.env.BULLMQ_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.BULLMQ_RETRY_DELAY || '5000', 10),
  },
  events: {
    schemaVersion: process.env.EVENT_SCHEMA_VERSION || '1.0.0',
    enableDeadLetterQueue: process.env.ENABLE_DEAD_LETTER_QUEUE !== 'false',
    deadLetterRetentionDays: parseInt(process.env.DEAD_LETTER_RETENTION_DAYS || '7', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  webhooks: {
    secret: process.env.WEBHOOK_SECRET || '',
    signatureHeader: process.env.WEBHOOK_SIGNATURE_HEADER || 'x-razorpay-signature',
    timestampTolerance: parseInt(process.env.WEBHOOK_TIMESTAMP_TOLERANCE || '300', 10), // 5 minutes default
  },
};

let redisClient: Redis | null = null;
let mongooseConnection: typeof mongoose | null = null;

export async function connectMongoDB(): Promise<typeof mongoose> {
  if (mongooseConnection) {
    return mongooseConnection;
  }

  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongodb.uri });
    mongooseConnection = await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    logger.info('MongoDB connected successfully');
    return mongooseConnection;
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    throw error;
  }
}

export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig: {
    host: string;
    port: number;
    maxRetriesPerRequest: number | null;
    retryStrategy?: (times: number) => number | null;
    password?: string;
  } = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis max retry attempts reached');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  };

  if (config.redis.password) {
    redisConfig.password = config.redis.password;
  }

  redisClient = new Redis(redisConfig);

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully', { host: config.redis.host, port: config.redis.port });
  });

  redisClient.on('error', (error) => {
    logger.error('Redis connection error', { error: error.message });
  });

  return redisClient;
}

export async function disconnectAll(): Promise<void> {
  try {
    if (mongooseConnection) {
      await mongooseConnection.disconnect();
      logger.info('MongoDB disconnected');
    }
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error('Error during disconnection', { error });
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

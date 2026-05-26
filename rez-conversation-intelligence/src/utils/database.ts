import mongoose from 'mongoose';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import logger from './utils/logger';

let redisClient: Redis | null = null;
let mongoConnection: typeof mongoose | null = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoConnection) {
    return mongoConnection;
  }

  try {
    logger.info('Connecting to MongoDB...', { uri: config.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    mongoConnection = await mongoose.connect(config.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    logger.info('MongoDB connected successfully');
    return mongoConnection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: (error as Error).message });
    throw error;
  }
}

export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  try {
    logger.info('Connecting to Redis...', { url: config.REDIS_URL.replace(/\/\/.*@/, '//<credentials>@') });

    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    await redisClient.ping();
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error: (error as Error).message });
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function disconnectDatabase(): Promise<void> {
  try {
    if (mongoConnection) {
      await mongoConnection.disconnect();
      mongoConnection = null;
      logger.info('MongoDB disconnected');
    }

    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error('Error during database disconnection', { error: (error as Error).message });
    throw error;
  }
}

export async function healthCheck(): Promise<{
  mongodb: boolean;
  redis: boolean;
}> {
  const result = {
    mongodb: false,
    redis: false,
  };

  try {
    result.mongodb = mongoose.connection.readyState === 1;
  } catch {
    result.mongodb = false;
  }

  try {
    if (redisClient) {
      await redisClient.ping();
      result.redis = true;
    }
  } catch {
    result.redis = false;
  }

  return result;
}

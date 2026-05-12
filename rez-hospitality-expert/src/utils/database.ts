/**
 * Database Utilities
 * MongoDB and Redis connection management
 */

import { MongoClient, Db, Collection } from 'mongodb';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// ============================================
// MONGODB
// ============================================

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (mongoDb) {
    return mongoDb;
  }

  try {
    mongoClient = new MongoClient(config.MONGODB_URI);
    await mongoClient.connect();

    mongoDb = mongoClient.db(config.MONGODB_DB);

    logger.info('Connected to MongoDB', {
      host: config.MONGODB_URI.split('@')[1] || config.MONGODB_URI,
      database: config.MONGODB_DB,
    });

    return mongoDb;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

export async function getMongoDB(): Promise<Db> {
  if (!mongoDb) {
    return connectMongoDB();
  }
  return mongoDb;
}

export async function closeMongoDB(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    logger.info('MongoDB connection closed');
  }
}

export function getCollection<T = Document>(name: string): Collection<T> {
  if (!mongoDb) {
    throw new Error('MongoDB not connected');
  }
  return mongoDb.collection<T>(name);
}

// ============================================
// REDIS
// ============================================

let redisClient: Redis | null = null;

export function connectRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(config.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis', { url: config.REDIS_URL });
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    throw error;
  }
}

export function getRedis(): Redis {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

// ============================================
// SESSION STORAGE
// ============================================

const SESSION_PREFIX = 'hospitality:session:';
const SESSION_TTL = 1800; // 30 minutes

export async function storeSession(
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  const redis = getRedis();
  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_TTL,
    JSON.stringify(data)
  );
}

export async function getSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}

export async function refreshSession(sessionId: string): Promise<void> {
  const redis = getRedis();
  await redis.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL);
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

export async function closeAllConnections(): Promise<void> {
  await closeMongoDB();
  await closeRedis();
  logger.info('All database connections closed');
}

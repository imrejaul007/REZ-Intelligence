/**
 * Health Check Service
 */

import { redis } from '../config/redis';
import mongoose from 'mongoose';

interface HealthStatus {
  healthy: boolean;
  mongodb: boolean;
  redis: boolean;
  uptime: number;
  timestamp: string;
}

export async function healthCheck(): Promise<HealthStatus> {
  const start = Date.now();

  let mongodb = false;
  let redisOk = false;

  // Check MongoDB
  try {
    mongodb = mongoose.connection.readyState === 1;
  } catch {
    mongodb = false;
  }

  // Check Redis
  try {
    await redis.ping();
    redisOk = true;
  } catch {
    redisOk = false;
  }

  return {
    healthy: mongodb && redisOk,
    mongodb,
    redis: redisOk,
    uptime: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}

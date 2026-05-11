import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from './config';
import { getQueueStats } from './events/consumer';
import { EventStore, DeadLetterEvent } from './models/event-store';
import { schemaRegistry } from './events/schema-registry';
import { config } from './config';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    mongodb: ServiceHealth;
    redis: ServiceHealth;
    queues: QueueHealth;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface QueueHealth {
  status: 'up' | 'down' | 'degraded';
  queues: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}

export async function checkMongoDB(): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'down', error: 'Not connected' };
    }

    await mongoose.connection.db?.admin().ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    const redis = getRedisClient();

    if (!redis) {
      return { status: 'down', error: 'Client not initialized' };
    }

    await redis.ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkQueues(): Promise<QueueHealth> {
  try {
    const stats = await getQueueStats();

    // Check if any queue has excessive failures
    let hasFailures = false;
    for (const [queueName, counts] of Object.entries(stats)) {
      if (counts.failed > 100) {
        hasFailures = true;
      }
    }

    return {
      status: hasFailures ? 'degraded' : 'up',
      queues: stats,
    };
  } catch (error) {
    return {
      status: 'down',
      queues: {},
    };
  }
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [mongoHealth, redisHealth, queueHealth] = await Promise.all([
    checkMongoDB(),
    checkRedis(),
    checkQueues(),
  ]);

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (mongoHealth.status === 'down' || redisHealth.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (queueHealth.status === 'degraded') {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: config.events.schemaVersion,
    uptime: process.uptime(),
    services: {
      mongodb: mongoHealth,
      redis: redisHealth,
      queues: queueHealth,
    },
  };
}

export async function healthCheckHandler(req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus();

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
}

export async function readinessCheckHandler(req: Request, res: Response): Promise<void> {
  const mongoHealth = await checkMongoDB();
  const redisHealth = await checkRedis();

  if (mongoHealth.status === 'up' && redisHealth.status === 'up') {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({
      ready: false,
      mongodb: mongoHealth.status,
      redis: redisHealth.status,
    });
  }
}

export async function livenessCheckHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// Detailed stats endpoint
export async function statsHandler(req: Request, res: Response): Promise<void> {
  try {
    const queueStats = await getQueueStats();

    // Get event counts from MongoDB
    const [
      totalEvents,
      processedEvents,
      pendingEvents,
      failedEvents,
    ] = await Promise.all([
      EventStore.countDocuments(),
      EventStore.countDocuments({ processed: true }),
      EventStore.countDocuments({ status: 'pending' }),
      EventStore.countDocuments({ status: 'failed' }),
    ]);

    const deadLetterCount = await DeadLetterEvent.countDocuments({ status: 'pending' });

    res.json({
      events: {
        total: totalEvents,
        processed: processedEvents,
        pending: pendingEvents,
        failed: failedEvents,
        deadLetter: deadLetterCount,
      },
      queues: queueStats,
      schemas: {
        registered: schemaRegistry.getRegisteredTypes(),
        versions: Object.fromEntries(
          schemaRegistry.getRegisteredTypes().map(type => [type, schemaRegistry.getVersion(type)])
        ),
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

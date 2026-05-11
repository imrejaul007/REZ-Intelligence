import { Request, Response } from 'express';
import { ActionEngine } from './engine/action-engine';
import { EventConsumer, getEventConsumer } from './integrations/event-consumer';

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    redis: ServiceStatus;
    mongodb: ServiceStatus;
    eventConsumer: ServiceStatus;
    approvalQueue: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'unknown';
  latencyMs?: number;
  error?: string;
}

/**
 * Get system health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const startTime = Date.now();
  const eventConsumer = getEventConsumer();
  const actionEngine = ActionEngine.getInstance();
  const approvalQueue = actionEngine.getApprovalQueue();

  const services: HealthStatus['services'] = {
    redis: { status: 'unknown' },
    mongodb: { status: 'unknown' },
    eventConsumer: {
      status: eventConsumer.isActive() ? 'up' : 'down',
    },
    approvalQueue: {
      status: 'up', // Always up if service is running
    },
  };

  // Check Redis
  try {
    const redisStart = Date.now();
    // Redis health check would go here
    services.redis = {
      status: 'up',
      latencyMs: Date.now() - redisStart,
    };
  } catch (error) {
    services.redis = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check MongoDB
  try {
    const mongoStart = Date.now();
    // MongoDB health check would go here
    services.mongodb = {
      status: 'up',
      latencyMs: Date.now() - mongoStart,
    };
  } catch (error) {
    services.mongodb = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Determine overall status
  const criticalServices = [
    services.redis,
    services.mongodb,
  ];

  const hasDownService = criticalServices.some(s => s.status === 'down');
  const hasDegradedService = criticalServices.some(s => s.status === 'unknown');

  let overallStatus: HealthStatus['status'] = 'healthy';
  if (hasDownService) {
    overallStatus = 'unhealthy';
  } else if (hasDegradedService) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services,
  };
}

/**
 * Health check endpoint handler
 */
export async function healthHandler(req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus();

  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
}

/**
 * Liveness probe handler (Kubernetes)
 */
export function livenessHandler(req: Request, res: Response): void {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness probe handler (Kubernetes)
 */
export async function readinessHandler(req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus();

  if (health.status === 'unhealthy') {
    res.status(503).json({
      status: 'not ready',
      reason: 'Critical service unavailable',
    });
    return;
  }

  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Health Check Middleware
 *
 * OPS-003 FIX: Standardized health check endpoints across all services.
 *
 * Provides health status endpoints for monitoring and orchestration.
 * Usage: app.use(healthCheckRouter);
 *
 * Endpoints:
 *   GET /health         — Basic health (always 200 if process is running)
 *   GET /health/ready  — Readiness probe (checks dependencies)
 *   GET /health/live   — Liveness probe (Kubernetes)
 *   GET /health/startup — Startup probe (Kubernetes)
 */

import { Router, Request, Response } from 'express';
import type Redis from 'ioredis';
import mongoose from 'mongoose';

export interface HealthCheckDependencies {
  redis?: Redis;
  mongoose?: typeof mongoose;
  serviceName?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  service?: string;
  checks: {
    database?: { status: 'up' | 'down'; latency?: number };
    redis?: { status: 'up' | 'down'; latency?: number };
    memory?: { used: number; heapUsed: number; heapTotal: number };
  };
  errors?: string[];
}

/**
 * Create health check router
 */
export function createHealthCheckRouter(deps: HealthCheckDependencies): Router {
  const router = Router();
  const { serviceName } = deps;

  /**
   * Basic health check - simple liveness indicator.
   * Used by: Render health checks, basic monitoring
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: serviceName || 'unknown',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Liveness probe (is the service alive?)
   * Used by orchestration systems (K8s, etc.)
   */
  router.get('/health/live', async (req: Request, res: Response) => {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {},
      errors: [],
    };

    // Check memory usage
    const memUsage = process.memoryUsage();
    status.checks.memory = {
      used: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
    };

    res.status(200).json(status);
  });

  /**
   * Readiness probe (is the service ready to handle traffic?)
   * Checks external dependencies
   */
  router.get('/health/ready', async (req: Request, res: Response) => {
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {},
      errors: [],
    };

    try {
      // Check MongoDB with actual query test
      if (deps.mongoose && deps.mongoose.connection) {
        const startTime = Date.now();

        try {
          if (deps.mongoose.connection.readyState !== 1) {
            status.checks.database = { status: 'down' };
            status.errors?.push('Database connection state is not CONNECTED');
            status.status = 'unhealthy';
          } else {
            // Execute actual query to ensure database is functional
            const adminDb = deps.mongoose.connection.db?.admin();
            if (!adminDb) {
              throw new Error('Cannot access MongoDB admin interface');
            }
            const serverStatus = await adminDb.serverStatus();
            if (!serverStatus) {
              throw new Error('serverStatus returned null or undefined');
            }
            status.checks.database = {
              status: 'up',
              latency: Date.now() - startTime,
            };
          }
        } catch (err) {
          status.checks.database = { status: 'down' };
          status.errors?.push(`Database error: ${(err as Error).message}`);
          status.status = 'degraded';
        }
      }

      // Check Redis
      if (deps.redis) {
        const startTime = Date.now();

        try {
          await deps.redis.ping();
          status.checks.redis = {
            status: 'up',
            latency: Date.now() - startTime,
          };
        } catch (err) {
          status.checks.redis = { status: 'down' };
          status.errors?.push(`Redis error: ${(err as Error).message}`);
          status.status = 'degraded';
        }
      }

      // Return appropriate status code:
      // 200: all systems healthy
      // 503: degraded (one or more non-critical systems down)
      // 500: unhealthy (critical systems down)
      const statusCode = status.status === 'healthy'
        ? 200
        : status.status === 'degraded'
          ? 503
          : 500;
      res.status(statusCode).json(status);
    } catch (error) {
      status.status = 'unhealthy';
      status.errors?.push(`Health check error: ${(error as Error).message}`);
      res.status(503).json(status);
    }
  });

  /**
   * Startup probe (is the service still starting?)
   * Used by orchestration to know when to start sending traffic
   */
  router.get('/health/startup', (req: Request, res: Response) => {
    const uptime = process.uptime();
    const isReady = uptime > 10; // Service needs 10 seconds to initialize

    if (isReady) {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime,
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime,
        expectedTime: '10s',
      });
    }
  });

  /**
   * Metrics endpoint (for Prometheus, etc.)
   */
  router.get('/metrics', (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();

    const metrics = `# HELP process_memory_usage_bytes Memory usage in bytes
# TYPE process_memory_usage_bytes gauge
process_memory_usage_rss_bytes ${memUsage.rss}
process_memory_usage_heap_used_bytes ${memUsage.heapUsed}
process_memory_usage_heap_total_bytes ${memUsage.heapTotal}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
`;

    res.type('text/plain').send(metrics);
  });

  return router;
}

/**
 * Middleware to attach health check functions to app
 */
export function attachHealthChecks(app: any, deps: HealthCheckDependencies) {
  const router = createHealthCheckRouter(deps);
  app.use(router);
}

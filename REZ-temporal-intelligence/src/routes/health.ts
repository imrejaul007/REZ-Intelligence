import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { HealthStatus } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

// ============================================
// HEALTH CHECKS
// ============================================

/**
 * GET /health
 * Basic health check
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'REZ Temporal Intelligence',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/ready
 * Readiness check - verifies all dependencies are available
 */
router.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    database: false
  };

  // Check MongoDB
  try {
    checks.database = mongoose.connection.readyState === 1;
  } catch (error) {
    logger.error('MongoDB health check failed', error as Error);
  }

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /health/live
 * Liveness check - verifies the service is running
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/detailed
 * Detailed health status
 */
router.get('/detailed', asyncHandler(async (_req: Request, res: Response) => {
  const startTime = Date.now();

  // Check MongoDB
  let dbHealthy = false;
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await mongoose.connection.db?.admin().ping();
    dbLatency = Date.now() - dbStart;
    dbHealthy = true;
  } catch (error) {
    logger.error('MongoDB detailed health check failed', error as Error);
  }

  const health: HealthStatus = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0',
    checks: {
      database: dbHealthy,
      cache: false // Redis not implemented yet
    },
    metrics: {
      totalSequences: 0,
      totalPatterns: 0,
      predictionsLast24h: 0,
      averageLatencyMs: dbLatency
    },
    timestamp: new Date()
  };

  res.json({
    ...health,
    processingTimeMs: Date.now() - startTime
  });
}));

export default router;

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';
import logger from '../utils/logger';

const router = Router();

const startTime = Date.now();

// Service info
const SERVICE_INFO = {
  name: 'rez-predictive-engine',
  version: process.env.npm_package_version || '1.0.0',
  port: process.env.PORT || 4059,
  nodeVersion: process.version,
  platform: os.platform(),
  arch: os.arch()
};

/**
 * GET /health
 * Basic health check
 */
router.get('/', (_req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'healthy',
    service: SERVICE_INFO.name,
    version: SERVICE_INFO.version,
    uptime: `${uptime}s`,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/ready
 * Readiness check - includes database connectivity
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    database: false
  };

  // Check MongoDB connection
  try {
    const dbState = mongoose.connection.readyState;
    checks.database = dbState === 1; // 1 = connected
  } catch (error) {
    logger.error('MongoDB health check failed', error as Error);
  }

  const isReady = Object.values(checks).every(Boolean);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/live
 * Liveness check - simple ping
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/detailed
 * Detailed health information
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const uptime = Date.now() - startTime;
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  const checks: Record<string, boolean> = {
    database: false
  };

  // Check MongoDB
  try {
    const dbState = mongoose.connection.readyState;
    checks.database = dbState === 1;
  } catch (error) {
    logger.error('MongoDB check failed', error as Error);
  }

  const systemMetrics = {
    uptime: uptime,
    uptimeFormatted: formatUptime(uptime),
    memory: {
      rss: formatBytes(memoryUsage.rss),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      external: formatBytes(memoryUsage.external)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      loadAverage: os.loadavg()
    }
  };

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: SERVICE_INFO,
    checks,
    metrics: systemMetrics,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/ping
 * Simple ping endpoint
 */
router.get('/ping', (_req: Request, res: Response) => {
  res.send('pong');
});

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format uptime in human readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default router;

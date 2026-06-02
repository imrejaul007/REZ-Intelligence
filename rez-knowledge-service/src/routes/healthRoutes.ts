// REZ Knowledge Service - Health Check Routes

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { rezMindService } from '../services';
import config from '../config';

const router = Router();

// GET /health - Basic health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: config.service.name,
    version: config.service.version,
    timestamp: new Date().toISOString(),
  });
});

// GET /health/detailed - Detailed health check
router.get('/health/detailed', async (req: Request, res: Response) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  const mindAvailable = await rezMindService.isAvailable();

  const health = {
    success: true,
    status: mongoStatus === 'connected' ? 'healthy' : 'degraded',
    service: {
      name: config.service.name,
      version: config.service.version,
      environment: config.nodeEnv,
    },
    dependencies: {
      mongodb: {
        status: mongoStatus,
        readyState: mongoose.connection.readyState,
      },
      rezMind: {
        status: mindAvailable ? 'available' : 'unavailable',
        url: process.env.REZ_MIND_SERVICE_URL || 'http://localhost:3001',
      },
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };

  const statusCode =
    mongoStatus === 'connected' && mindAvailable ? 200 : 503;

  res.status(statusCode).json(health);
});

// GET /ready - Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;

  if (mongoReady) {
    res.json({
      success: true,
      status: 'ready',
    });
  } else {
    res.status(503).json({
      success: false,
      status: 'not ready',
      reason: 'MongoDB not connected',
    });
  }
});

// GET /live - Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'alive',
  });
});

export default router;

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'rez-targeting-engine',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  })
);

/**
 * GET /ready
 * Readiness check endpoint
 */
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    // Add database connection check here if needed
    const checks = {
      database: true, // Would check mongoose connection
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024 // 500MB limit
    };

    const isReady = Object.values(checks).every(v => v);

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      data: {
        ready: isReady,
        checks,
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;

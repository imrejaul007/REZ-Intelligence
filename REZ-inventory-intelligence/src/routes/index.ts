import { Router, Request, Response } from 'express';
import inventoryRoutes from './inventory.routes.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from '../middleware/error.middleware.js';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const router = Router();

/**
 * Rate limiting configuration
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
router.use('/api', apiLimiter);

/**
 * Health check endpoint (no auth required)
 */
router.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'rez-inventory-intelligence',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * API routes (protected by auth)
 */
router.use('/api/v1', authMiddleware, inventoryRoutes);

/**
 * 404 handler for unmatched routes
 */
router.use(notFoundHandler);

/**
 * Global error handler
 */
router.use(errorHandler);

export default router;

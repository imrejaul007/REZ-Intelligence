/**
 * REZ Memory Layer - Metrics Tracking Middleware
 * Tracks request metrics automatically
 */

import { Request, Response, NextFunction } from 'express';
import { updateRequestMetrics } from '../routes/metrics';

/**
 * Middleware to track request metrics
 */
export function metricsTracker() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = `${req.method} ${req.path}`;

    // Update metrics on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      updateRequestMetrics(endpoint, res.statusCode, duration);
    });

    next();
  };
}

export default metricsTracker;

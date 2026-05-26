/**
 * Health Check Service
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const checks = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'REZ-Intelligence-Gateway',
    version: '1.0.0'
  };

  res.json({
    status: 'healthy',
    ...checks
  });
}

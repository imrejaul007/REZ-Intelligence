/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export default function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = new Logger('http');
  const startTime = Date.now();

  // Log request
  logger.info(`--> ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`<-- ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

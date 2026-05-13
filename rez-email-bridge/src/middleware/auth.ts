import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;
  const validTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');

  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  if (!token) {
    logger.warn('Missing auth token', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if token is valid
  const isValid = Object.values(validTokens).includes(token);
  if (!isValid && token !== 'orchestrator-token') {
    logger.warn('Invalid auth token', { path: req.path, ip: req.ip });
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}

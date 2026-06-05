import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: { serviceId?: string };
}

export const auth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No valid authorization token provided' } });
      return;
    }
    try {
      const decoded = jwt.verify(authHeader.substring(7), config.internalServiceToken) as any;
      (req as AuthRequest).user = decoded;
      next();
    } catch {
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication service error' } });
  }
};

export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const internalToken = req.headers['x-internal-token'] as string;
    if (!internalToken) {
      res.status(401).json({ success: false, error: { code: 'MISSING_INTERNAL_TOKEN', message: 'X-Internal-Token header is required' } });
      return;
    }
    if (internalToken !== config.internalServiceToken) {
      logger.warn('Invalid internal token attempted', { ip: req.ip, path: req.path });
      res.status(403).json({ success: false, error: { code: 'INVALID_INTERNAL_TOKEN', message: 'Invalid service token' } });
      return;
    }
    (req as AuthRequest).user = { serviceId: 'internal-service' };
    next();
  } catch (error) {
    logger.error('Internal auth middleware error', { error });
    res.status(500).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Internal authentication service error' } });
  }
};

export default { auth, internalAuth };
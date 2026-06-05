import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';

export interface JwtPayload {
  userId: string;
  merchantId?: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      isInternalCall?: boolean;
    }
  }
}

export const authenticateJwt = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ success: false, error: 'Authorization header missing' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ success: false, error: 'Invalid authorization format' });
    return;
  }

  try {
    const decoded = jwt.verify(parts[1], config.auth.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

export const authenticateInternal = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.headers['x-internal-token'] as string;
  req.isInternalCall = token === config.auth.internalToken;
  next();
};

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isInternalCall) {
    next();
    return;
  }
  authenticateJwt(req, res, next);
};

export const requireUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user && !req.isInternalCall) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
};
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';

export interface JwtPayload { userId: string; merchantId?: string; role: string; }
declare global { namespace Express { interface Request { user?: JwtPayload; isInternalCall?: boolean; } } }

export const authenticateJwt = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ success: false, error: 'Authorization header missing' }); return; }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') { res.status(401).json({ success: false, error: 'Invalid format' }); return; }
  try {
    req.user = jwt.verify(parts[1], config.auth.jwtSecret) as JwtPayload;
    next();
  } catch { res.status(401).json({ success: false, error: 'Invalid or expired token' }); }
};

export const authenticateInternal = (req: Request, _res: Response, next: NextFunction): void => {
  req.isInternalCall = (req.headers['x-internal-token'] as string) === config.auth.internalToken;
  next();
};

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isInternalCall) { next(); return; }
  authenticateJwt(req, res, next);
};
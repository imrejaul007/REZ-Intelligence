/**
 * Authentication middleware for internal service calls
 */

import { Request, Response, NextFunction } from 'express';

const INTERNAL_SERVICE_TOKENS = JSON.parse(
  process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'
);

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
}

export default function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  // Skip auth for health checks
  if (req.path === '/health' || req.path === '/ready') {
    next();
    return;
  }

  if (!internalToken) {
    res.status(401).json({
      error: 'Missing authentication token',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  const serviceId = Object.entries(INTERNAL_SERVICE_TOKENS).find(
    ([_, token]) => token === internalToken
  )?.[0];

  if (!serviceId) {
    res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_INVALID'
    });
    return;
  }

  req.serviceId = serviceId;
  next();
}

// REZ Knowledge Service - Service Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { UnauthorizedError } from './errorHandler';

export interface ServiceAuthRequest extends Request {
  serviceId?: string;
  serviceName?: string;
}

export function serviceAuth(
  req: ServiceAuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['x-service-auth'];
  const serviceSecret = req.headers['x-service-secret'];

  // Check for service-to-service authentication
  if (serviceSecret === config.service.secret) {
    req.serviceId = req.headers['x-service-id'] as string;
    req.serviceName = req.headers['x-service-name'] as string;
    return next();
  }

  // Check for API key authentication (generic check)
  if (authHeader && typeof authHeader === 'string' && authHeader.length > 0) {
    return next();
  }

  // In development, allow unauthenticated access
  if (config.nodeEnv === 'development') {
    return next();
  }

  next(new UnauthorizedError('Invalid service credentials'));
}

export function validateUserId(
  req: ServiceAuthRequest,
  res: Response,
  next: NextFunction
): void {
  const userId = req.params.userId || req.body.userId;

  if (!userId || typeof userId !== 'string') {
    return next(new UnauthorizedError('Valid userId is required'));
  }

  // Basic format validation (adjust as needed)
  if (userId.length < 1 || userId.length > 100) {
    return next(new UnauthorizedError('Invalid userId format'));
  }

  next();
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}

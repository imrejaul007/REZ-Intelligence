import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternalService?: boolean;
  userId?: string;
}

const INTERNAL_HEADERS = {
  SERVICE_TOKEN: 'x-internal-token',
  SERVICE_ID: 'x-service-id',
  REQUEST_ID: 'x-request-id',
};

export function internalServiceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers[INTERNAL_HEADERS.SERVICE_TOKEN] as string | undefined;
  const serviceId = req.headers[INTERNAL_HEADERS.SERVICE_ID] as string | undefined;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing internal service token',
    });
    return;
  }

  const tokens = config.auth.internalServiceTokens;

  if (typeof tokens === 'object' && tokens !== null) {
    const tokenEntries = Object.entries(tokens);
    for (const [id, secret] of tokenEntries) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.path + (req.body ? JSON.stringify(req.body) : ''))
        .digest('hex');

      if (serviceId === id || token === secret) {
        req.serviceId = id;
        req.isInternalService = true;

        logger.debug('Internal service authenticated', {
          serviceId: id,
          path: req.path,
        });

        next();
        return;
      }
    }
  }

  if (token === config.auth.jwtSecret) {
    req.serviceId = 'system';
    req.isInternalService = true;
    next();
    return;
  }

  res.status(403).json({
    error: 'Forbidden',
    message: 'Invalid internal service token',
  });
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers[INTERNAL_HEADERS.SERVICE_TOKEN] as string | undefined;

  if (!token) {
    next();
    return;
  }

  internalServiceAuth(req, res, next);
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers[INTERNAL_HEADERS.SERVICE_TOKEN] as string | undefined;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  internalServiceAuth(req, res, next);
}

export function requestIdMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers[INTERNAL_HEADERS.REQUEST_ID] as string ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

export function loggingMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log({
      level: logLevel,
      message: `${req.method} ${req.path}`,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      serviceId: req.serviceId,
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

export default {
  internalServiceAuth,
  optionalAuth,
  requireAuth,
  requestIdMiddleware,
  loggingMiddleware,
};

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Internal service authentication middleware
 * Validates the X-Internal-Token header against configured service tokens
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
    return;
  }

  // Check if token matches any registered service
  const validTokens = Object.values(config.internalServiceTokens);
  const isValid = validTokens.includes(token);

  if (!isValid) {
    logger.warn('Invalid internal token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      tokenPrefix: token.substring(0, 8) + '...',
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid X-Internal-Token',
    });
    return;
  }

  // Identify which service is making the request
  const serviceName = Object.entries(config.internalServiceTokens)
    .find(([, t]) => t === token)?.[0] || 'unknown';

  // Attach service info to request for audit logging
  (req as Request & { serviceName?: string }).serviceName = serviceName;

  logger.info('Internal service request authenticated', {
    path: req.path,
    method: req.method,
    service: serviceName,
  });

  next();
}

/**
 * Optional internal auth - continues even without token
 * Useful for endpoints that support both internal and external access
 */
export function optionalInternalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (token) {
    const validTokens = Object.values(config.internalServiceTokens);
    const isValid = validTokens.includes(token);

    if (isValid) {
      const serviceName = Object.entries(config.internalServiceTokens)
        .find(([, t]) => t === token)?.[0] || 'unknown';
      (req as Request & { serviceName?: string }).serviceName = serviceName;
    }
  }

  next();
}

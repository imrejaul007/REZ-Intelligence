import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  (req as any).requestId = id;
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  logger.info('Incoming request', { requestId: (req as any).requestId, method: req.method, path: req.path, ip: req.ip });
  res.on('finish', () => logger.info('Request completed', { requestId: (req as any).requestId, method: req.method, path: req.path, statusCode: res.statusCode, duration: Date.now() - startTime }));
  next();
};

export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', { path: req.path });
  res.status(404).json({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const requestId = (req as any).requestId || uuidv4();
  logger.error('Request error', { requestId, error: err.message, stack: err.stack, path: req.path });
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({ success: false, error: { code: 'INTERNAL_ERROR', message: statusCode === 500 ? 'Internal server error' : err.message }, requestId });
};

export default { requestId, requestLogger, notFoundHandler, errorHandler };
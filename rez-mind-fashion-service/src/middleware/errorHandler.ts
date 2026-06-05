import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger';

export interface AppError extends Error { statusCode?: number; code?: string; }
export const createAppError = (msg: string, code: number = 500, err?: string): AppError => { const e = new Error(msg) as AppError; e.statusCode = code; e.code = err; return e; };

export const errorHandler = (err: AppError | Error, req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Error', { error: err.message, path: req.path });
  if (err instanceof ZodError) { res.status(400).json({ success: false, error: 'Validation failed', details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }); return; }
  res.status(err instanceof AppError ? err.statusCode || 500 : 500).json({ success: false, error: err.message || 'Internal error' });
};

export const notFoundHandler = (req: Request, res: Response): void => { res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` }); };

export const asyncHandler = <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) => (req: Request, res: Response, next: NextFunction): void => { Promise.resolve(fn(req, res, next)).catch(next); };

export const validate = (schema: any, source: 'body' | 'query' | 'params' = 'body') => (req: Request, _res: Response, next: NextFunction): void => {
  try { const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params; const parsed = schema.parse(data); if (source === 'body') req.body = parsed; else if (source === 'query') req.query = parsed as any; else req.params = parsed as any; next(); } catch (error) { next(error); }
};
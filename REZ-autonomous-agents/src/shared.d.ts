// Declaration file for shared module with .js extension
declare module '../../shared/index.js' {
  import { Request, Response, NextFunction } from 'express';
  import winston from 'winston';

  export const logger: winston.Logger;
  export const createRequestLogger: (requestId: string) => RequestLogger;
  export const sanitize: (obj: unknown, depth?: number) => unknown;
  export const error: (message: string, meta?: Record<string, unknown>) => void;
  export const warn: (message: string, meta?: Record<string, unknown>) => void;
  export const info: (message: string, meta?: Record<string, unknown>) => void;
  export const debug: (message: string, meta?: Record<string, unknown>) => void;

  export interface RequestLogger {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
  }

  export type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>;

  export function asyncHandler(
    fn: AsyncRequestHandler
  ): (req: Request, res: Response, next: NextFunction) => void;

  export interface RequestIdOptions {
    header?: string;
    generator?: () => string;
  }

  export function requestIdMiddleware(options?: RequestIdOptions): (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void;

  export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void;
}

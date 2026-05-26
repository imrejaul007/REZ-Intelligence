/**
 * REZ WhatsApp - Distributed Tracing Middleware
 * Adds traceId/spanId to all requests for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  service: string;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      trace: TraceContext;
    }
  }
}

const SERVICE_NAME = 'REZ-whatsapp';

/**
 * Tracing middleware that adds trace context to all requests
 */
export function tracingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get trace ID from header or generate new one
    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
    const spanId = uuidv4().substring(0, 16);
    const parentSpanId = req.headers['x-span-id'] as string | undefined;

    // Create trace context
    req.trace = {
      traceId,
      spanId,
      parentSpanId,
      startTime: Date.now(),
      service: SERVICE_NAME
    };

    // Add trace headers to response
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Span-Id', spanId);
    if (parentSpanId) {
      res.setHeader('X-Parent-Span-Id', parentSpanId);
    }

    // Log request start with trace context
    logger.info('Request started', {
      traceId,
      spanId,
      parentSpanId,
      method: req.method,
      path: req.path,
      service: SERVICE_NAME
    });

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - req.trace.startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

      logger[logLevel]('Request completed', {
        traceId: req.trace.traceId,
        spanId: req.trace.spanId,
        parentSpanId: req.trace.parentSpanId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        service: SERVICE_NAME,
        userAgent: req.get('user-agent'),
        ip: req.ip
      });

      // Track slow requests (>1s)
      if (duration > 1000) {
        logger.warn('Slow request detected', {
          traceId: req.trace.traceId,
          spanId: req.trace.spanId,
          duration,
          threshold: '1000ms',
          path: req.path
        });
      }
    });

    next();
  };
}

/**
 * Create a child logger with trace context
 */
export function createTraceLogger(trace: TraceContext) {
  return logger.child({
    traceId: trace.traceId,
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
    service: trace.service
  });
}

/**
 * Create a span for internal operations
 */
export function createSpan(parentTrace: TraceContext, operationName: string): TraceContext {
  return {
    traceId: parentTrace.traceId,
    spanId: uuidv4().substring(0, 16),
    parentSpanId: parentTrace.spanId,
    startTime: Date.now(),
    service: parentTrace.service
  };
}

/**
 * End a span and log its duration
 */
export function endSpan(span: TraceContext, operationName: string, success: boolean = true): void {
  const duration = Date.now() - span.startTime;
  const logLevel = success ? 'info' : 'error';

  logger[logLevel](`Span completed: ${operationName}`, {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    operation: operationName,
    duration: `${duration}ms`,
    success
  });
}

export default tracingMiddleware;

/**
 * Structured Request Logger Middleware
 *
 * Adds correlation IDs, logs all requests with structured format.
 * Loki-compatible JSON output for log aggregation.
 * Prometheus metrics for request monitoring.
 *
 * Usage: app.use(requestLogger);
 * Usage: app.use(requestLogger({ prometheus: true }));
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  correlationId: string;
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
  userId?: string;
  merchantId?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  service?: string;
  job?: string;
}

export interface RequestLoggerOptions {
  service?: string;
  prometheus?: boolean;
  logToStdout?: boolean;
}

// ─── Prometheus Metrics (Optional) ────────────────────────────────────────────

interface Metrics {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: Map<string, number[]>;
  httpRequestsInFlight: number;
}

let globalMetrics: Metrics | null = null;

function getOrCreateMetrics(): Metrics {
  if (!globalMetrics) {
    globalMetrics = {
      httpRequestsTotal: new Map(),
      httpRequestDuration: new Map(),
      httpRequestsInFlight: 0,
    };
  }
  return globalMetrics;
}

/**
 * Get Prometheus-compatible metrics
 */
export function getPrometheusMetrics(): {
  http_requests_total: { [key: string]: number };
  http_request_duration_seconds: { [key: string]: number };
  http_requests_in_flight: number;
} {
  const m = getOrCreateMetrics();
  return {
    http_requests_total: Object.fromEntries(m.httpRequestsTotal),
    http_request_duration_seconds: Object.fromEntries(
      Array.from(m.httpRequestDuration.entries()).map(([k, v]) => [
        k,
        v.reduce((a, b) => a + b, 0) / (v.length || 1),
      ])
    ),
    http_requests_in_flight: m.httpRequestsInFlight,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  globalMetrics = null;
}

// ─── Loki-Compatible Structured Logger ───────────────────────────────────────

/**
 * Structured logger with Loki-compatible JSON format
 */
export function structuredLog(context: Partial<LogContext>, message: string, data?: any) {
  const log = {
    // Loki uses these labels
    timestamp: new Date().toISOString(),
    level: 'info',
    service: context.service || process.env.SERVICE_NAME || 'unknown',

    // Correlation for distributed tracing
    correlation_id: context.correlationId,
    request_id: context.requestId,

    // Request context
    path: context.path,
    method: context.method,
    user_id: context.userId,
    merchant_id: context.merchantId,

    // Response context
    status_code: context.statusCode,
    duration_ms: context.duration,

    // Message
    message,

    // Additional data
    ...(data && { data }),
  };

  console.log(JSON.stringify(log));

  // Update Prometheus metrics if enabled
  if (context.statusCode && context.path && context.method) {
    const m = getOrCreateMetrics();
    const key = `${context.method}_${context.path}_${Math.floor((context.statusCode || 500) / 100)}xx`;

    m.httpRequestsTotal.set(key, (m.httpRequestsTotal.get(key) || 0) + 1);

    if (context.duration) {
      const durationKey = `${context.method}_${context.path}`;
      const durations = m.httpRequestDuration.get(durationKey) || [];
      durations.push(context.duration / 1000); // Convert to seconds
      if (durations.length > 100) durations.shift(); // Keep last 100 samples
      m.httpRequestDuration.set(durationKey, durations);
    }
  }
}

/**
 * Structured logger for errors (Loki-compatible)
 */
export function logError(context: Partial<LogContext>, error: Error, data?: any) {
  const log = {
    // Loki uses these labels
    timestamp: new Date().toISOString(),
    level: 'error',
    service: context.service || process.env.SERVICE_NAME || 'unknown',
    error: error.message,

    // Correlation for distributed tracing
    correlation_id: context.correlationId,
    request_id: context.requestId,

    // Request context
    path: context.path,
    method: context.method,
    user_id: context.userId,
    merchant_id: context.merchantId,

    // Response context
    status_code: context.statusCode || 500,
    duration_ms: context.duration,

    // Stack trace
    stack: error.stack,

    // Additional data
    ...(data && { data }),
  };

  console.error(JSON.stringify(log));
}

// ─── Request Logger Middleware ───────────────────────────────────────────────

const defaultOptions: RequestLoggerOptions = {
  service: process.env.SERVICE_NAME || 'unknown',
  prometheus: true,
  logToStdout: true,
};

/**
 * Request logging middleware
 *
 * Adds:
 * - Correlation ID (x-correlation-id header)
 * - Request ID
 * - User ID / Merchant ID extraction
 * - Request/response logging
 * - Loki-compatible JSON output
 * - Prometheus metrics collection
 */
export function requestLogger(options: RequestLoggerOptions = defaultOptions) {
  const serviceName = options.service || defaultOptions.service || 'unknown';
  const metrics = options.prometheus !== false ? getOrCreateMetrics() : null;

  return (req: Request, res: Response, next: NextFunction) => {
    if (metrics) {
      metrics.httpRequestsInFlight++;
    }

    const startTime = Date.now();

    // Extract or generate correlation ID
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const requestId = uuidv4();

    // Attach to request for use in routes
    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    // Extract user/merchant IDs if present
    const userId = (req as any).userId;
    const merchantId = (req as any).merchantId;

    // Log incoming request (Loki-compatible JSON)
    if (options.logToStdout !== false) {
      structuredLog(
        {
          correlationId,
          requestId,
          path: req.path,
          method: req.method,
          userId,
          merchantId,
          service: serviceName,
        },
        'Request received',
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          host: req.get('host'),
        }
      );
    }

    // Add correlation ID to response headers
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (metrics) {
        metrics.httpRequestsInFlight--;
        const key = `${req.method}_${req.path}_${Math.floor(res.statusCode / 100)}xx`;
        const statusKey = `${req.method}_${req.path}_${res.statusCode}`;
        metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);

        // Store duration for histogram
        const durations = metrics.httpRequestDuration.get(statusKey) || [];
        durations.push(duration / 1000);
        if (durations.length > 100) durations.shift();
        metrics.httpRequestDuration.set(statusKey, durations);
      }

      if (options.logToStdout !== false) {
        structuredLog(
          {
            correlationId,
            requestId,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration,
            userId,
            merchantId,
            service: serviceName,
          },
          'Request completed'
        );
      }
    });

    next();
  };
}

/**
 * Express middleware to attach logger to request
 */
export function attachLogger(req: Request, res: Response, next: NextFunction) {
  (req as any).logger = {
    info: (message: string, data?: any) =>
      structuredLog(
        {
          correlationId: (req as any).correlationId,
          requestId: (req as any).requestId,
          path: req.path,
          method: req.method,
          userId: (req as any).userId,
          merchantId: (req as any).merchantId,
        },
        message,
        data
      ),
    error: (error: Error, data?: any) =>
      logError(
        {
          correlationId: (req as any).correlationId,
          requestId: (req as any).requestId,
          path: req.path,
          method: req.method,
          userId: (req as any).userId,
          merchantId: (req as any).merchantId,
        },
        error,
        data
      ),
  };
  next();
}

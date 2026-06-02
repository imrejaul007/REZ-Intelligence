/**
 * Centralized Logging with Correlation ID Support
 *
 * OPS-003 FIX: Enables unified request tracing across service boundaries.
 *
 * Features:
 * - Correlation ID propagation (W3C traceparent compatible)
 * - Structured JSON logging
 * - Service context tagging
 * - Request/response timing
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  service?: string;
  environment?: string;
  duration?: number;
  [key: string]: unknown;
}

// ─── Correlation ID Generation ────────────────────────────────────────────────

/**
 * Generate a new correlation ID (compatible with W3C traceparent).
 * Format: 00-{traceId}-{spanId}-{flags}
 */
export function generateCorrelationId(): string {
  const traceId = crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  return `00-${traceId}-${spanId}-01`;
}

/**
 * Parse a W3C traceparent header.
 */
export function parseTraceparent(header: string): {
  traceId: string;
  spanId: string;
  traceFlags: string;
} | null {
  const match = header.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/);
  if (!match) return null;
  return {
    traceId: match[1],
    spanId: match[2],
    traceFlags: match[3],
  };
}

/**
 * Create a child span ID from a parent.
 */
export function createChildSpanId(parentSpanId: string): string {
  return crypto.randomBytes(8).toString('hex');
}

// ─── Logger Configuration ──────────────────────────────────────────────────────

let globalServiceName = process.env.SERVICE_NAME || 'unknown';
let globalEnvironment = process.env.NODE_ENV || 'development';

export function setGlobalContext(serviceName: string, environment: string): void {
  globalServiceName = serviceName;
  globalEnvironment = environment;
}

// ─── Core Logger ──────────────────────────────────────────────────────────────

class Logger {
  private serviceName: string;
  private environment: string;
  private baseContext: LogContext;

  constructor(serviceName?: string, environment?: string) {
    this.serviceName = serviceName || globalServiceName;
    this.environment = environment || globalEnvironment;
    this.baseContext = {
      serviceName: this.serviceName,
      environment: this.environment,
    };
  }

  private formatLog(
    level: LogEntry['level'],
    message: string,
    context?: LogContext,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      ...this.baseContext,
      ...context,
    };
  }

  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(json);
    } else {
      console.log(json);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatLog('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    this.output(this.formatLog('error', message, context));
  }

  fatal(message: string, context?: LogContext): void {
    this.output(this.formatLog('fatal', message, context));
  }

  // ─── Request Logging ──────────────────────────────────────────────────────

  logRequest(req: {
    method: string;
    path: string;
    ip?: string;
    headers?: Record<string, string>;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
  }): void {
    const context: LogContext = {
      httpMethod: req.method,
      httpPath: req.path,
      clientIp: req.ip,
      userAgent: req.headers?.['user-agent'],
      correlationId: req.correlationId,
      traceId: req.traceId,
      spanId: req.spanId,
      event: 'request_start',
    };

    this.info('Incoming request', context);
  }

  logResponse(
    req: {
      method: string;
      path: string;
      correlationId?: string;
      traceId?: string;
      spanId?: string;
    },
    res: {
      statusCode: number;
    },
    durationMs: number,
  ): void {
    const context: LogContext = {
      httpMethod: req.method,
      httpPath: req.path,
      statusCode: res.statusCode,
      durationMs,
      correlationId: req.correlationId,
      traceId: req.traceId,
      spanId: req.spanId,
      event: 'request_complete',
    };

    if (res.statusCode >= 500) {
      this.error('Request failed', context);
    } else if (res.statusCode >= 400) {
      this.warn('Request error', context);
    } else {
      this.info('Request completed', context);
    }
  }

  // ─── Service-to-Service Logging ────────────────────────────────────────────

  logServiceCall(options: {
    service: string;
    method: string;
    path: string;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
    durationMs?: number;
    statusCode?: number;
    error?: Error;
  }): void {
    const context: LogContext = {
      targetService: options.service,
      httpMethod: options.method,
      httpPath: options.path,
      durationMs: options.durationMs,
      statusCode: options.statusCode,
      correlationId: options.correlationId,
      traceId: options.traceId,
      spanId: options.spanId,
      event: options.error ? 'service_call_error' : 'service_call_complete',
      parentService: this.serviceName,
    };

    if (options.error) {
      context.errorMessage = options.error.message;
      context.errorStack = options.error.stack;
      this.error('Service call failed', context);
    } else {
      this.info('Service call completed', context);
    }
  }
}

// ─── Default Export ───────────────────────────────────────────────────────────

export const logger = new Logger();

/**
 * Create a service-specific logger instance.
 * Alias for backward compatibility.
 */
export function createServiceLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

// ─── Request Context Middleware ────────────────────────────────────────────────

export interface RequestContext {
  correlationId: string;
  traceId: string;
  spanId: string;
  startTime: number;
}

const requestContexts = new Map<string, RequestContext>();

/**
 * Create middleware to add correlation ID to requests.
 */
export function correlationIdMiddleware(
  req: {
    headers: Record<string, string | string[] | undefined>;
    id?: () => string;
    method?: string;
    path?: string;
  },
  res: {
    setHeader: (name: string, value: string) => void;
    getHeader: (name: string) => string | string[] | undefined;
    statusCode?: number;
    on: (event: string, callback: () => void) => void;
  },
  next: () => void,
): RequestContext {
  // Check for existing traceparent header
  const traceparent = req.headers['traceparent'] as string | undefined;
  let correlationId: string;
  let traceId: string;
  let spanId: string;

  if (traceparent) {
    const parsed = parseTraceparent(traceparent);
    if (parsed) {
      traceId = parsed.traceId;
      spanId = createChildSpanId(parsed.spanId);
      correlationId = `00-${traceId}-${spanId}-01`;
    } else {
      correlationId = generateCorrelationId();
      const parsed = parseTraceparent(correlationId);
      traceId = parsed!.traceId;
      spanId = parsed!.spanId;
    }
  } else {
    correlationId = generateCorrelationId();
    const parsed = parseTraceparent(correlationId);
    traceId = parsed!.traceId;
    spanId = parsed!.spanId;
  }

  // Generate request ID if not provided
  const requestId = req.id?.() || crypto.randomUUID();

  // Set response headers
  res.setHeader('traceparent', correlationId);
  res.setHeader('x-correlation-id', requestId);

  const context: RequestContext = {
    correlationId,
    traceId,
    spanId,
    startTime: Date.now(),
  };

  // Store context for access in handlers
  requestContexts.set(requestId, context);

  // Cleanup after response
  res.on('finish', () => {
    requestContexts.delete(requestId);
  });

  return context;
}

/**
 * Get correlation ID from current request context.
 */
export function getCurrentContext(requestId?: string): RequestContext | undefined {
  // This is a simplified version - in production, use async context or DI
  if (requestId) {
    return requestContexts.get(requestId);
  }
  return undefined;
}

// ─── Express/Request Integration ──────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      traceId?: string;
      spanId?: string;
      requestId?: string;
    }
  }
}

export function expressCorrelationMiddleware(
  req: Express.Request,
  res: Express.Response,
  next: () => void,
): void {
  // Cast to custom type expected by correlationIdMiddleware
  const reqAny = req as unknown as {
    headers: Record<string, string | string[] | undefined>;
    id?: () => string;
    method: string;
    path: string;
    ip: string;
  };
  const resAny = res as unknown as {
    setHeader: (name: string, value: string) => void;
    getHeader: (name: string) => string | string[] | undefined;
    on: (event: string, cb: () => void) => void;
    statusCode: number;
  };

  const context = correlationIdMiddleware(reqAny, resAny, next);

  req.correlationId = context.correlationId;
  req.traceId = context.traceId;
  req.spanId = context.spanId;
  req.requestId = crypto.randomUUID();

  // Log request start
  logger.logRequest({
    method: reqAny.method,
    path: reqAny.path,
    ip: reqAny.ip,
    headers: reqAny.headers as Record<string, string>,
    correlationId: context.correlationId,
    traceId: context.traceId,
    spanId: context.spanId,
  });

  // Log response on finish
  const startTime = Date.now();
  resAny.on('finish', () => {
    logger.logResponse(
      {
        method: reqAny.method,
        path: reqAny.path,
        correlationId: context.correlationId,
        traceId: context.traceId,
        spanId: context.spanId,
      },
      { statusCode: resAny.statusCode },
      Date.now() - startTime,
    );
  });

  next();
}

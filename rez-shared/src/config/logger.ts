/**
 * Service Logger Configuration
 *
 * Re-exports from utils/logger for backward compatibility.
 * Uses the centralized logging with correlation ID support.
 */

export {
  logger,
  createServiceLogger,
  type LogContext,
  type LogEntry,
  type RequestContext,
  generateCorrelationId,
  parseTraceparent,
  createChildSpanId,
  setGlobalContext,
  correlationIdMiddleware,
  getCurrentContext,
  expressCorrelationMiddleware,
} from '../utils/logger';

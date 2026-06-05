/**
 * Winston Logger Configuration
 * Production-ready logging for ReZ Mind Pharmacy Service
 */

import winston from 'winston';
import { config, isProduction, isDevelopment } from '../config';

// Custom format for structured logging
const structuredFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  const logObject = {
    timestamp,
    level,
    service: 'rez-mind-pharmacy-service',
    message,
    ...metadata,
  };
  return JSON.stringify(logObject);
});

// Color format for console output in development
const colorFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: isDevelopment ? colorFormat : structuredFormat,
    level: config.logLevel,
    handleExceptions: true,
    handleRejections: true,
  }),
];

// Add file transports in production
if (isProduction) {
  // Error log
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Combined log
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );

  // Audit log (for compliance)
  transports.push(
    new winston.transports.File({
      filename: 'logs/audit.log',
      level: 'info',
      format: structuredFormat,
      maxsize: 20 * 1024 * 1024, // 20MB for audit
      maxFiles: 30, // Keep more audit logs
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    service: 'rez-mind-pharmacy-service',
    environment: config.nodeEnv,
  },
  transports,
  exitOnError: false,
  exceptionHandlers: [
    new winston.transports.Console({
      format: structuredFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: structuredFormat,
    }),
  ],
});

// Special loggers for specific domains

/**
 * Audit Logger - for compliance and regulatory logging
 */
export const auditLogger = logger.child({
  domain: 'audit',
  category: 'compliance',
});

/**
 * Security Logger - for security-related events
 */
export const securityLogger = logger.child({
  domain: 'security',
});

/**
 * API Logger - for API request/response logging
 */
export const apiLogger = logger.child({
  domain: 'api',
});

/**
 * Database Logger - for database operations
 */
export const dbLogger = logger.child({
  domain: 'database',
});

/**
 * Pharmacy Logger - for pharmacy-specific operations
 */
export const pharmacyLogger = logger.child({
  domain: 'pharmacy',
});

// Helper methods for common logging scenarios

export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>
) => {
  apiLogger.info(`${method} ${path}`, {
    httpMethod: method,
    path,
    statusCode,
    duration,
    ...metadata,
  });
};

export const logDrugInteraction = (
  drug1: string,
  drug2: string,
  severity: string,
  action: 'checked' | 'alerted',
  metadata?: Record<string, any>
) => {
  pharmacyLogger.warn(`Drug interaction ${action}`, {
    drug1,
    drug2,
    severity,
    action,
    ...metadata,
  });

  auditLogger.info('Drug interaction event', {
    drug1,
    drug2,
    severity,
    action,
    ...metadata,
  });
};

export const logComplianceEvent = (
  eventType: string,
  severity: string,
  description: string,
  metadata?: Record<string, any>
) => {
  pharmacyLogger.warn(`Compliance event: ${eventType}`, {
    eventType,
    severity,
    description,
    ...metadata,
  });

  auditLogger.info('Compliance event', {
    eventType,
    severity,
    description,
    ...metadata,
  });
};

export const logRefillReminder = (
  customerId: string,
  drugName: string,
  channel: string,
  success: boolean,
  metadata?: Record<string, any>
) => {
  pharmacyLogger.info('Refill reminder sent', {
    customerId,
    drugName,
    channel,
    success,
    ...metadata,
  });
};

export const logInventoryAlert = (
  drugId: string,
  drugName: string,
  alertType: string,
  urgency: string,
  metadata?: Record<string, any>
) => {
  pharmacyLogger.warn(`Inventory alert: ${alertType}`, {
    drugId,
    drugName,
    alertType,
    urgency,
    ...metadata,
  });
};

export const logSecurityEvent = (
  eventType: string,
  description: string,
  metadata?: Record<string, any>
) => {
  securityLogger.warn(`Security event: ${eventType}`, {
    eventType,
    description,
    ...metadata,
  });

  auditLogger.warn('Security event', {
    eventType,
    description,
    ...metadata,
  });
};

export default logger;
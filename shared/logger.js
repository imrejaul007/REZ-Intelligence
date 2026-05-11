/**
 * Shared Winston Logger for REZ-Intelligence Services
 *
 * Features:
 * - JSON format for production, pretty-print for development
 * - Includes timestamp, level, service name, requestId
 * - Supports structured logging with metadata
 */

const winston = require('winston');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-intelligence-service';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Add service name to every log entry
    info.service = SERVICE_NAME;
    return info;
  })(),
  winston.format.json()
);

// Pretty format for development
const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const reqIdStr = requestId ? `[${requestId}]` : '';
    return `${timestamp} ${level} ${reqIdStr} [${service}]: ${message} ${metaStr}`;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
});

// Add file transports in production
if (NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * Create a child logger with additional context
 * @param {Object} context - Additional context to include in all logs
 * @returns {Object} Child logger with bound context
 */
function createChildLogger(context) {
  return {
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
    verbose: (message, meta = {}) => logger.verbose(message, { ...context, ...meta })
  };
}

/**
 * Generate a request ID for tracing
 * @returns {string} UUID request ID
 */
function generateRequestId() {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

/**
 * Express middleware to add request ID to logs
 * Usage: app.use(requestIdMiddleware)
 */
function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('x-request-id', req.requestId);

  // Log request start
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query
  });

  // Log response on finish
  res.on('finish', () => {
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });
  });

  next();
}

module.exports = {
  logger,
  createChildLogger,
  generateRequestId,
  requestIdMiddleware,
  SERVICE_NAME
};

// Also export convenience methods for direct use
module.exports.info = (message, meta) => logger.info(message, meta);
module.exports.error = (message, meta) => logger.error(message, meta);
module.exports.warn = (message, meta) => logger.warn(message, meta);
module.exports.debug = (message, meta) => logger.debug(message, meta);
module.exports.verbose = (message, meta) => logger.verbose(message, meta);

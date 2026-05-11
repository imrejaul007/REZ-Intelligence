'use strict';

const winston = require('winston');

const { combine, timestamp, json, errors, printf } = winston.format;

const serviceName = process.env.SERVICE_NAME || 'rez-intelligence';

const logFormat = printf(({ level, message, timestamp, service, requestId, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    service,
    requestId,
    message,
    ...meta
  });
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: serviceName },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    process.env.NODE_ENV === 'production' ? json() : logFormat
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

function createRequestLogger(requestId) {
  return {
    info: (message, meta = {}) => logger.info(message, { requestId, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { requestId, ...meta }),
    error: (message, meta = {}) => logger.error(message, { requestId, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { requestId, ...meta })
  };
}

function sanitize(obj, depth = 0) {
  if (depth > 10) return '[MaxDepth]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized = {};
  for (const [k, v] of Object.entries(obj)) {
    if (sensitive.some(s => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = sanitize(v, depth + 1);
    }
  }
  return sanitized;
}

module.exports = {
  logger,
  createRequestLogger,
  sanitize,
  error: (message, meta = {}) => logger.error(message, sanitize(meta)),
  warn: (message, meta = {}) => logger.warn(message, sanitize(meta)),
  info: (message, meta = {}) => logger.info(message, sanitize(meta)),
  debug: (message, meta = {}) => logger.debug(message, sanitize(meta))
};

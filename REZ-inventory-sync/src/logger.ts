import winston from 'winston';

const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'inventory-sync';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    info.service = SERVICE_NAME;
    return info;
  })(),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const reqIdStr = requestId ? `[${requestId}]` : '';
    return `${timestamp} ${level} ${reqIdStr} [${service}]: ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

export function createChildLogger(context: Record<string, unknown>) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => logger.info(message, { ...context, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => logger.error(message, { ...context, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, { ...context, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, { ...context, ...meta }),
  };
}

export function generateRequestId(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

export function requestIdMiddleware(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): void {
  req.requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  res.setHeader('x-request-id', req.requestId);

  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
  });

  res.on('finish', () => {
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
    });
  });

  next();
}

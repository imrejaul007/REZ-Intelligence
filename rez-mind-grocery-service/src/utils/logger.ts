import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack) {
    msg += `\n  Stack: ${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    const metaStr = JSON.stringify(metadata, null, 2);
    if (metaStr !== '{}') {
      msg += `\n  Meta: ${metaStr}`;
    }
  }

  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  defaultMeta: {
    service: 'rez-mind-grocery-service',
    pid: process.pid,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      ),
    }),
  ],
});

// Create file transport for production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Add request context helper
logger.withContext = (context: Record<string, any>) => {
  return logger.child(context);
};

// Add request ID helper
logger.withRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

export default logger;
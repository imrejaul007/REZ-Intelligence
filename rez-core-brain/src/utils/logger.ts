import winston from 'winston';
import { config, isProduction } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...metadata } = info;
  let msg = `${ts} [${level}]: ${message}`;

  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0 && metadata.stack) {
    msg += `\n${metadata.stack}`;
  } else if (metaKeys.length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  defaultMeta: {
    service: config.SERVICE_NAME,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      ),
    }),
  ],
});

// Add file transports in production
if (isProduction) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

// Create a child logger with additional context
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export default logger;

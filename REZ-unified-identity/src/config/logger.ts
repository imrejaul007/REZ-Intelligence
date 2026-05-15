import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack) {
    msg += `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

const jsonFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  json()
);

const consoleFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  colorize({ all: true }),
  errors({ stack: true }),
  logFormat
);

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: NODE_ENV === 'production' ? jsonFormat : consoleFormat,
  }),
];

// Add file transports in production
if (NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'rez-unified-identity',
    environment: NODE_ENV,
  },
  transports,
  exitOnError: false,
});

// Create child logger with additional context
export const createLogger = (context: Record<string, string>): winston.Logger => {
  return logger.child(context);
};

export default logger;

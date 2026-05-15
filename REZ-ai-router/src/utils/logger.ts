import winston from 'winston';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...rest }) => {
  const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
  return `${timestamp} [${level}]: ${message} ${meta}`;
});

const jsonFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json()
);

const simpleFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize(),
  logFormat
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT === 'json' ? jsonFormat : simpleFormat,
  defaultMeta: {
    service: 'rez-ai-router',
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

export default logger;

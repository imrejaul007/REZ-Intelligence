import winston from 'winston';
import { TransformableInfo } from 'logform';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: TransformableInfo) => {
  return `${info.timestamp} [${info.level}]: ${info.stack || info.message}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat)
    })
  ]
});

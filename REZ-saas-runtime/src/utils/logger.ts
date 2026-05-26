/**
 * REZ SaaS Runtime - Logger Utility
 */

import winston from 'winston';
import { TransformableInfo } from 'logform';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: TransformableInfo) => {
  const msg = `${info.timestamp} [${info.level}]: ${info.message}`;
  const { level, message, timestamp, ...metadata } = info;
  if (Object.keys(metadata).length > 0) {
    return msg + ` ${JSON.stringify(metadata)}`;
  }
  return msg;
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
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

export default logger;

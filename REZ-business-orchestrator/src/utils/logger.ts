/**
 * REZ Business Orchestrator - Logger
 */

import winston from 'winston';
import { TransformableInfo } from 'logform';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: TransformableInfo) => {
  let msg = `${info.timestamp} [${info.level}]: ${info.message}`;
  const { level, message, timestamp, stack, ...metadata } = info;
  if (Object.keys(metadata).length > 0) msg += ` ${JSON.stringify(metadata)}`;
  if (stack) msg += `\n${stack}`;
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
  ],
});

export default logger;

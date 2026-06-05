import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

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

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), logFormat),
  defaultMeta: { service: 'rez-mind-education-service', pid: process.pid },
  transports: [
    new winston.transports.Console({
      format: combine(colorize({ all: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), logFormat),
    }),
  ],
});

export default logger;
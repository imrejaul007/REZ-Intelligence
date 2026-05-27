/**
 * REZ Stream Processing - Logger
 */

import winston from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stream-processing' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...meta } = info;
          const metaStr = Object.keys(meta).length > 1
            ? JSON.stringify(meta, null, 2)
            : '';
          return `${ts} [${level}]: ${message} ${metaStr}`;
        })
      )
    })
  ]
});

export default logger;

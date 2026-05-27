/**
 * REZ Geo Intelligence Core - Logger
 */

import winston from 'winston';

const SERVICE_NAME = 'rez-geo-intelligence';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const { timestamp, level, message, ...meta } = info;
          const metaStr = Object.keys(meta).length > 1
            ? ` ${JSON.stringify(meta)}`
            : '';
          return `${timestamp} ${level} [${SERVICE_NAME}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

export default logger;

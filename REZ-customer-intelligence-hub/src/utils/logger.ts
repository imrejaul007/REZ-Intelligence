import winston from 'winston';
import config from '../config/index.js';

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rez-customer-intelligence-hub' },
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
      ),
    }),
  ],
});

export default logger;

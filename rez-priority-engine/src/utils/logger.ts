import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...meta } = info;
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      try {
        metaStr = ` ${JSON.stringify(meta)}`;
      } catch {
        metaStr = ' [unserializable metadata]';
      }
    }
    return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  logFormat
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

let transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? logFormat : consoleFormat,
  }),
];

if (config.nodeEnv === 'production') {
  transports = [
    new winston.transports.Console({
      format: logFormat,
      level: config.logging.level,
    }),
  ];
}

export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: {
    service: 'priority-engine',
    env: config.nodeEnv,
  },
  transports,
  exitOnError: false,
});

export const createChildLogger = (component: string): winston.Logger => {
  return logger.child({ component });
};

export default logger;

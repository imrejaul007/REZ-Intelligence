import winston from 'winston';

const NODE_ENV = process.env['NODE_ENV'] || 'development';
const SERVICE_NAME = process.env['SERVICE_NAME'] || 'consumer-loop';

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ],
});

export const log = {
  info: (stage: string, message: string, data: Record<string, unknown> = {}): void => {
    logger.info(message, { stage, ...data });
  },
  warn: (stage: string, message: string, data: Record<string, unknown> = {}): void => {
    logger.warn(message, { stage, ...data });
  },
  error: (stage: string, message: string, data: Record<string, unknown> = {}): void => {
    logger.error(message, { stage, ...data });
  },
};

export function createChildLogger(context: Record<string, unknown>) {
  return {
    info: (stage: string, message: string, meta?: Record<string, unknown>) => logger.info(message, { stage, ...context, ...meta }),
    warn: (stage: string, message: string, meta?: Record<string, unknown>) => logger.warn(message, { stage, ...context, ...meta }),
    error: (stage: string, message: string, meta?: Record<string, unknown>) => logger.error(message, { stage, ...context, ...meta }),
  };
}

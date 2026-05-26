import winston from 'winston';

const SERVICE_NAME = 'rez-health-monitor';
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  logger.error(message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(message, meta);
}

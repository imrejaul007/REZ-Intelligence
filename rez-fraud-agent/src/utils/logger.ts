import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'simple';

const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  simple: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.errors({ stack: true }),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...meta } = info;
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${ts} [${level}]: ${message} ${metaStr}`;
    })
  ),
  detailed: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }: { level: string; message: string; timestamp?: string; [key: string]: unknown }) => {
      const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
      const stack = meta.stack ? `\n${meta.stack}` : '';
      return `${ts} [${level}]: ${message}${metaStr}${stack}`;
    })
  ),
};

export const logger = winston.createLogger({
  level: logLevel,
  format: formats[logFormat as keyof typeof formats] || formats.simple,
  defaultMeta: { service: 'rez-fraud-agent' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Add request ID helper for structured logging
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

// Log levels with structured metadata
export const logAudit = (
  action: string,
  details: Record<string, unknown>
) => {
  logger.info(`[AUDIT] ${action}`, { audit: true, ...details });
};

export const logSecurity = (
  event: string,
  details: Record<string, unknown>
) => {
  logger.warn(`[SECURITY] ${event}`, { security: true, ...details });
};

export const logFraudAlert = (
  alertType: string,
  details: Record<string, unknown>
) => {
  logger.warn(`[FRAUD_ALERT] ${alertType}`, { fraudAlert: true, ...details });
};

export default logger;

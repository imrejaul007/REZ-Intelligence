import winston from 'winston';

const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rez-rfm-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info: unknown) => {
          const { level, message, timestamp, ...meta } = info as Record<string, unknown>;
          const metaStr = Object.keys(meta).length > 1
            ? JSON.stringify(meta, null, 2)
            : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

export { logger };
export default logger;

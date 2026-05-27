import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...meta } = info;
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${ts} [${level}]: ${message} ${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), logFormat),
    }),
  ],
});

export default logger;

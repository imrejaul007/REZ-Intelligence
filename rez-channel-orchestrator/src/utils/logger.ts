import winston from 'winston';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp, ...rest } = info;
  const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
  return `${timestamp} [${level}]: ${message} ${meta}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    colorize(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: `${logsDir}/error.log`, level: 'error' }),
    new winston.transports.File({ filename: `${logsDir}/combined.log` })
  ]
});

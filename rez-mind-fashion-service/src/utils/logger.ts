import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level.toUpperCase()}]`;
  if (stack) log += `\n${stack}`;
  else log += `: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.url === undefined) log += ` ${JSON.stringify(metadata)}`;
  return log;
});

const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : config.isProduction ? 'info' : 'error',
  defaultMeta: { service: 'rez-mind-fashion-service', environment: config.env },
  format: config.isProduction ? combine(timestamp(), errors({ stack: true }), json()) : combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

export default logger;
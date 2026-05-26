import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || 'logs';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp?: string; level: string; message: string; [key: string]: unknown }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Extended Logger interface with custom methods
interface ExtendedLogger extends winston.Logger {
  logPrediction: (
    userId: string,
    type: string,
    score: number,
    confidence: number,
    durationMs: number
  ) => void;
  logError: (
    context: string,
    error: Error | unknown,
    details?: Record<string, unknown>
  ) => void;
  logBatchProgress: (
    jobId: string,
    total: number,
    completed: number,
    failed: number
  ) => void;
}

// Create logger instance
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'rez-predictive-engine',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport - always enabled in development
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? fileFormat : consoleFormat
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Error log
  baseLogger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  // Combined log
  baseLogger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  // Prediction specific log
  baseLogger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'predictions.log'),
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10
    })
  );
}

// Helper methods for structured logging
const logger = baseLogger as ExtendedLogger;

logger.logPrediction = (
  userId: string,
  type: string,
  score: number,
  confidence: number,
  durationMs: number
) => {
  logger.info('Prediction generated', {
    userId,
    predictionType: type,
    score,
    confidence,
    durationMs
  });
};

logger.logError = (
  context: string,
  error: Error | unknown,
  details?: Record<string, unknown>
) => {
  const errorInfo = {
    context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...details
  };
  logger.error('Error occurred', errorInfo);
};

logger.logBatchProgress = (
  jobId: string,
  total: number,
  completed: number,
  failed: number
) => {
  const progress = ((completed + failed) / total) * 100;
  logger.info('Batch prediction progress', {
    jobId,
    total,
    completed,
    failed,
    progress: `${progress.toFixed(1)}%`
  });
};

export default logger;
export type { ExtendedLogger };

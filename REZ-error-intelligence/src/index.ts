/**
 * REZ Error Intelligence Service
 * Error tracking and analytics for the REZ platform
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import winston from 'winston';

// Shared utilities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitize = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!['password', 'token', 'secret', 'key'].some(s => key.toLowerCase().includes(s))) {
      result[key] = obj[key];
    }
  }
  return result;
};

// ============================================
// LOGGER CONFIGURATION
// ============================================

const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-error-intelligence';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    info.service = SERVICE_NAME;
    return info;
  })(),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// ============================================
// TYPE DEFINITIONS
// ============================================

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface IErrorLog extends Document {
  code: string;
  message: string;
  severity: Severity;
  service: string;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface ErrorQuery {
  code?: string;
  severity?: Severity;
  service?: string;
  limit?: number;
  offset?: number;
}

interface ErrorStats {
  totalErrors: number;
  totalOccurrences: number;
  resolved: number;
  unresolved: number;
  bySeverity: Record<Severity, number>;
  byService: Record<string, number>;
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

const ErrorQuerySchema = z.object({
  code: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  service: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

const CreateErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  service: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
  stackTrace: z.string().optional()
});

const ResolveErrorSchema = z.object({
  resolved: z.boolean().default(true)
});

type ErrorQueryInput = z.infer<typeof ErrorQuerySchema>;
type CreateErrorInput = z.infer<typeof CreateErrorSchema>;

// ============================================
// MONGOOSE SCHEMA
// ============================================

const errorSchema = new Schema<IErrorLog>({
  code: { type: String, required: true, index: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
  service: { type: String, required: true, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  stackTrace: { type: String },
  occurrences: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date }
});

errorSchema.index({ code: 1, service: 1 });
errorSchema.index({ resolved: 1, severity: 1 });

const ErrorLog: Model<IErrorLog> = mongoose.model<IErrorLog>('ErrorLog', errorSchema);

// ============================================
// EXPRESS APP
// ============================================

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });

  // Health check
  app.get('/health', async (_req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
      status: 'ok',
      service: SERVICE_NAME,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: mongoStatus
      }
    });
  });

  // Get errors with filtering
  app.get('/api/errors', async (req: Request, res: Response) => {
    try {
      const validation = ErrorQuerySchema.safeParse(req.query);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation error',
          details: validation.error.issues
        });
        return;
      }

      const { code, severity, service, limit, offset } = validation.data;

      const filter: Record<string, unknown> = {};
      if (code) filter.code = code;
      if (severity) filter.severity = severity;
      if (service) filter.service = service;

      const errors = await ErrorLog.find(filter)
        .sort({ lastSeen: -1 })
        .skip(offset)
        .limit(limit);

      const total = await ErrorLog.countDocuments(filter);

      res.json({
        data: errors,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + errors.length < total
        }
      });
    } catch (error) {
      logger.error('Error fetching errors', sanitize({ error: error instanceof Error ? error.message : 'Unknown error' }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get single error by ID
  app.get('/api/errors/:id', async (req: Request, res: Response) => {
    try {
      const error = await ErrorLog.findById(req.params.id);

      if (!error) {
        res.status(404).json({ error: 'Error not found' });
        return;
      }

      res.json({ data: error });
    } catch (error) {
      logger.error('Error fetching error by ID', sanitize({
        error: error instanceof Error ? error.message : 'Unknown error',
        id: req.params.id
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get error by code
  app.get('/api/errors/code/:code', async (req: Request, res: Response) => {
    try {
      const errors = await ErrorLog.find({ code: req.params.code })
        .sort({ lastSeen: -1 })
        .limit(100);

      if (errors.length === 0) {
        res.status(404).json({ error: 'No errors found with this code' });
        return;
      }

      res.json({ data: errors });
    } catch (error) {
      logger.error('Error fetching error by code', sanitize({
        error: error instanceof Error ? error.message : 'Unknown error',
        code: req.params.code
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create new error log
  app.post('/api/errors', async (req: Request, res: Response) => {
    try {
      const validation = CreateErrorSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation error',
          details: validation.error.issues
        });
        return;
      }

      const data = validation.data;

      // Check for existing error with same code and service
      const existing = await ErrorLog.findOne({
        code: data.code,
        service: data.service,
        resolved: false
      });

      if (existing) {
        // Increment occurrences
        existing.occurrences += 1;
        existing.lastSeen = new Date();
        existing.message = data.message;
        if (data.metadata) existing.metadata = data.metadata;
        if (data.stackTrace) existing.stackTrace = data.stackTrace;
        await existing.save();

        logger.info('Error occurrence incremented', sanitize({
          code: data.code,
          service: data.service,
          occurrences: existing.occurrences
        }));

        res.status(200).json({
          message: 'Error occurrence updated',
          data: existing
        });
        return;
      }

      // Create new error log
      const errorLog = new ErrorLog(data);
      await errorLog.save();

      logger.info('New error logged', sanitize({
        code: data.code,
        service: data.service,
        severity: data.severity
      }));

      res.status(201).json({
        message: 'Error logged successfully',
        data: errorLog
      });
    } catch (error) {
      logger.error('Error creating error log', sanitize({
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Resolve an error
  app.patch('/api/errors/:id/resolve', async (req: Request, res: Response) => {
    try {
      const validation = ResolveErrorSchema.safeParse(req.body);
      const resolved = validation.success ? validation.data.resolved : true;

      const error = await ErrorLog.findById(req.params.id);

      if (!error) {
        res.status(404).json({ error: 'Error not found' });
        return;
      }

      error.resolved = resolved;
      error.resolvedAt = new Date();
      await error.save();

      logger.info('Error resolved', sanitize({
        code: error.code,
        id: error._id
      }));

      res.json({
        message: resolved ? 'Error resolved' : 'Error reopened',
        data: error
      });
    } catch (error) {
      logger.error('Error resolving error', sanitize({
        error: error instanceof Error ? error.message : 'Unknown error',
        id: req.params.id
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get error statistics
  app.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await ErrorLog.aggregate([
        {
          $group: {
            _id: null,
            totalErrors: { $sum: 1 },
            totalOccurrences: { $sum: '$occurrences' },
            resolved: {
              $sum: { $cond: ['$resolved', 1, 0] }
            },
            unresolved: {
              $sum: { $cond: ['$resolved', 0, 1] }
            },
            bySeverity: { $push: '$severity' },
            byService: { $push: '$service' }
          }
        }
      ]);

      if (stats.length === 0) {
        res.json({
          data: {
            totalErrors: 0,
            totalOccurrences: 0,
            resolved: 0,
            unresolved: 0,
            bySeverity: {},
            byService: {}
          }
        });
        return;
      }

      const result = stats[0]!;

      // Count by severity
      const bySeverity: Record<string, number> = {};
      for (const sev of result.bySeverity) {
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      }

      // Count by service
      const byService: Record<string, number> = {};
      for (const svc of result.byService) {
        byService[svc] = (byService[svc] || 0) + 1;
      }

      res.json({
        data: {
          totalErrors: result.totalErrors,
          totalOccurrences: result.totalOccurrences,
          resolved: result.resolved,
          unresolved: result.unresolved,
          bySeverity,
          byService
        }
      });
    } catch (error) {
      logger.error('Error fetching stats', sanitize({
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', sanitize({
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    }));

    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let server: ReturnType<Express['listen']> | null = null;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      } catch (error) {
        logger.error('Error closing MongoDB connection', sanitize({
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }

      process.exit(0);
    });
  }

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// ============================================
// STARTUP
// ============================================

const PORT = process.env.PORT || 4005;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-error-intelligence';

async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', sanitize({
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    throw error;
  }
}

async function start(): Promise<void> {
  try {
    await connectToMongoDB();

    const app = createApp();
    server = app.listen(PORT, () => {
      logger.info(`REZ Error Intelligence Service started`, {
        port: PORT,
        env: NODE_ENV
      });
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Startup failed', sanitize({
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    process.exit(1);
  }
}

// Start if running directly
if (require.main === module) {
  start();
}

export { start, PORT };

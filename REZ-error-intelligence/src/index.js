require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { z } = require('zod');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 4005;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-error-intelligence';

// Request validation schemas
const errorQuerySchema = z.object({
  code: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  service: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

const createErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  service: z.string().min(1).max(100),
  metadata: z.record(z.any()).optional(),
  stackTrace: z.string().optional()
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Error model
const errorSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
  service: { type: String, required: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  stackTrace: { type: String },
  occurrences: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date }
});

const ErrorLog = mongoose.model('ErrorLog', errorSchema);

// Health endpoint
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'ok',
    service: 'rez-error-intelligence',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus
    }
  });
});

// Get errors with filtering
app.get('/api/errors', async (req, res) => {
  try {
    const query = errorQuerySchema.parse(req.query);

    const filter = {};
    if (query.code) filter.code = query.code;
    if (query.severity) filter.severity = query.severity;
    if (query.service) filter.service = query.service;

    const errors = await ErrorLog.find(filter)
      .sort({ lastSeen: -1 })
      .skip(query.offset)
      .limit(query.limit);

    const total = await ErrorLog.countDocuments(filter);

    res.json({
      data: errors,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + errors.length < total
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    logger.error('Error fetching errors', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single error by ID
app.get('/api/errors/:id', async (req, res) => {
  try {
    const error = await ErrorLog.findById(req.params.id);

    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }

    res.json({ data: error });
  } catch (error) {
    logger.error('Error fetching error by ID', { error: error.message, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get error by code
app.get('/api/errors/code/:code', async (req, res) => {
  try {
    const errors = await ErrorLog.find({ code: req.params.code })
      .sort({ lastSeen: -1 })
      .limit(100);

    if (errors.length === 0) {
      return res.status(404).json({ error: 'No errors found with this code' });
    }

    res.json({ data: errors });
  } catch (error) {
    logger.error('Error fetching error by code', { error: error.message, code: req.params.code });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new error log
app.post('/api/errors', async (req, res) => {
  try {
    const data = createErrorSchema.parse(req.body);

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
      existing.message = data.message; // Update with latest message
      if (data.metadata) existing.metadata = data.metadata;
      if (data.stackTrace) existing.stackTrace = data.stackTrace;
      await existing.save();

      logger.info('Error occurrence incremented', {
        code: data.code,
        service: data.service,
        occurrences: existing.occurrences
      });

      return res.status(200).json({
        message: 'Error occurrence updated',
        data: existing
      });
    }

    // Create new error log
    const errorLog = new ErrorLog(data);
    await errorLog.save();

    logger.info('New error logged', {
      code: data.code,
      service: data.service,
      severity: data.severity
    });

    res.status(201).json({
      message: 'Error logged successfully',
      data: errorLog
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    logger.error('Error creating error log', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve an error
app.patch('/api/errors/:id/resolve', async (req, res) => {
  try {
    const error = await ErrorLog.findById(req.params.id);

    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }

    error.resolved = true;
    error.resolvedAt = new Date();
    await error.save();

    logger.info('Error resolved', { code: error.code, id: error._id });

    res.json({
      message: 'Error resolved',
      data: error
    });
  } catch (error) {
    logger.error('Error resolving error', { error: error.message, id: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get error statistics
app.get('/api/stats', async (req, res) => {
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
          bySeverity: {
            $push: '$severity'
          },
          byService: {
            $push: '$service'
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        data: {
          totalErrors: 0,
          totalOccurrences: 0,
          resolved: 0,
          unresolved: 0,
          bySeverity: {},
          byService: {}
        }
      });
    }

    const result = stats[0];

    // Count by severity
    const bySeverity = result.bySeverity.reduce((acc, sev) => {
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});

    // Count by service
    const byService = result.byService.reduce((acc, svc) => {
      acc[svc] = (acc[svc] || 0) + 1;
      return acc;
    }, {});

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
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection', { error: error.message });
    }

    process.exit(0);
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// MongoDB connection
async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`REZ Error Intelligence Service started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });

  await connectToMongoDB();
});

module.exports = { app, server };

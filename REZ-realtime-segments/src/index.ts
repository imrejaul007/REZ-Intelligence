import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config from './config/index.js';
import { connectDatabase, disconnectDatabase, getConnectionStatus } from './database/index.js';
import { connectRedis, disconnectRedis, redisHealthCheck } from './services/redisCache.js';
import { startWebhookProcessor, stopWebhookProcessor } from './services/webhookEmitter.js';
import { DEFAULT_SEGMENTS, createMockUserData } from './services/segmentEngine.js';
import segmentRoutes from './routes/segmentRoutes.js';
import type { ApiResponse } from './types/index.js';

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for API
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Internal-Token', 'X-Request-ID']
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Trust proxy
app.set('trust proxy', 1);

// API Routes
app.use('/', segmentRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response): void => {
  res.json({
    service: 'REZ Realtime Segments',
    version: '1.0.0',
    description: 'Real-time user segment evaluation service',
    endpoints: {
      health: '/health',
      status: '/status',
      segments: '/segments',
      evaluate: '/segments/evaluate/:userId',
      members: '/segments/:segmentId/members',
      stats: '/segments/:segmentId/stats',
      trigger: '/segments/:segmentId/trigger',
      userSegments: '/users/:userId/segments'
    },
    documentation: '/docs',
    timestamp: new Date().toISOString()
  } as ApiResponse<unknown>);
});

// API Documentation endpoint
app.get('/docs', (req: Request, res: Response): void => {
  res.json({
    service: 'REZ Realtime Segments API',
    version: '1.0.0',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint'
      },
      {
        method: 'GET',
        path: '/status',
        description: 'Service status and statistics'
      },
      {
        method: 'GET',
        path: '/segments',
        description: 'List all segment definitions'
      },
      {
        method: 'GET',
        path: '/segments/:segmentId',
        description: 'Get a specific segment definition'
      },
      {
        method: 'POST',
        path: '/segments/:segmentId/evaluate/:userId',
        description: 'Evaluate a user against a specific segment',
        body: {
          userData: '(optional) User data object for evaluation'
        }
      },
      {
        method: 'POST',
        path: '/segments/evaluate/:userId',
        description: 'Evaluate a user against all segments',
        body: {
          userData: '(optional) User data object for evaluation'
        }
      },
      {
        method: 'GET',
        path: '/segments/:segmentId/members',
        description: 'Get paginated list of users in a segment',
        query: {
          page: 'Page number (default: 1)',
          limit: 'Items per page (default: 100, max: 100)'
        }
      },
      {
        method: 'GET',
        path: '/segments/:segmentId/stats',
        description: 'Get statistics for a segment'
      },
      {
        method: 'POST',
        path: '/segments/:segmentId/trigger',
        description: 'Trigger segment evaluation job'
      },
      {
        method: 'GET',
        path: '/jobs/:jobId',
        description: 'Get status of an evaluation job'
      },
      {
        method: 'GET',
        path: '/users/:userId/segments',
        description: 'Get all segments a user belongs to'
      }
    ],
    segments: DEFAULT_SEGMENTS.map(s => ({
      id: s.segmentId,
      name: s.name,
      description: s.description
    })),
    timestamp: new Date().toISOString()
  } as ApiResponse<unknown>);
});

// 404 handler
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  } as ApiResponse<never>);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: config.server.nodeEnv === 'production'
      ? 'Internal server error'
      : err.message,
    timestamp: new Date().toISOString()
  } as ApiResponse<never>);
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new requests
    stopWebhookProcessor();

    // Close connections
    await disconnectRedis();
    await disconnectDatabase();

    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  console.log('Starting REZ Realtime Segments Service...');

  try {
    // Connect to databases
    console.log('Connecting to MongoDB...');
    await connectDatabase();

    console.log('Connecting to Redis...');
    await connectRedis();

    // Start webhook processor
    console.log('Starting webhook processor...');
    startWebhookProcessor();

    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║           REZ REALTIME SEGMENTS SERVICE                  ║
╠══════════════════════════════════════════════════════════╣
║  Status:    RUNNING                                      ║
║  Port:       ${String(config.server.port).padEnd(43)}║
║  Environment: ${config.server.nodeEnv.padEnd(40)}║
║                                                          ║
║  Endpoints:                                              ║
║    GET  /           - Service info                       ║
║    GET  /health     - Health check                      ║
║    GET  /status     - Service status                     ║
║    GET  /segments   - List all segments                  ║
║    POST /segments/evaluate/:userId - Evaluate user        ║
║                                                          ║
║  Segments: ${DEFAULT_SEGMENTS.length} predefined                                  ║
╚══════════════════════════════════════════════════════════╝
      `);

      console.log('Service started successfully');
    });

    // Handle server errors
    server.on('error', (error: Error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Demo function to test segment evaluation
async function runDemo(): Promise<void> {
  console.log('\n=== Running Segment Evaluation Demo ===\n');

  const mockUser = createMockUserData({
    userId: 'demo-user-001',
    lifetime: {
      totalSpend: 15000,
      totalOrders: 15,
      avgOrderValue: 1000,
      tenureDays: 365
    }
  });

  console.log('Mock User Data:');
  console.log(JSON.stringify(mockUser, null, 2));

  // Simulate segment evaluation (without DB/Redis)
  const { evaluateAllSegments } = await import('./services/segmentEngine.js');
  const results = evaluateAllSegments(DEFAULT_SEGMENTS, mockUser);

  console.log('\n--- Segment Evaluation Results ---');
  for (const result of results) {
    const status = result.matches ? '✓ MATCHES' : '✗ NO MATCH';
    console.log(`${status} ${result.segmentId.padEnd(20)} (${result.evaluationTimeMs}ms)`);
    if (result.matches) {
      console.log(`   Matched rules: ${result.matchedRules.length}`);
    }
  }

  const matches = results.filter(r => r.matches);
  console.log(`\nTotal matches: ${matches.length}/${results.length}`);
}

// Export for testing
export { app };

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { redisClient } from './services/redisClient';
import { rateLimitService } from './services/rateLimitService';
import { createRateLimitMiddleware } from './middleware/rateLimit';
import limitsRouter from './routes/limits.routes';

const app = express();
const PORT = 4029;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint (no rate limiting)
app.get('/health', (req: Request, res: Response) => {
  const redisConnected = redisClient.isReady();
  res.json({
    status: redisConnected ? 'healthy' : 'degraded',
    service: 'rez-rate-limit',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: {
      connected: redisConnected,
    },
  });
});

// API health check
app.get('/api/health', (req: Request, res: Response) => {
  const redisConnected = redisClient.isReady();
  res.json({
    success: true,
    data: {
      status: redisConnected ? 'healthy' : 'degraded',
      redis: {
        connected: redisConnected,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Rate limiting middleware with whitelist for health endpoints
const rateLimitMiddleware = createRateLimitMiddleware({
  whitelist: [
    'GET:/health',
    'GET:/api/health',
    'GET:/api/limits/*',
    'POST:/api/limits/*',
  ],
  addHeaders: true,
});

// Apply rate limiting to all other routes
app.use(rateLimitMiddleware);

// Management API routes
app.use('/api/limits', limitsRouter);

// Example protected endpoints to demonstrate rate limiting
app.get('/api/data', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'This is rate-limited data endpoint',
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/data/search', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Search results would appear here',
      query: req.body.query,
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Login successful (this endpoint has strict rate limits)',
      token: 'example-token',
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Registration successful (very strict rate limits)',
      userId: 'new-user-id',
      timestamp: new Date().toISOString(),
    },
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await redisClient.disconnect();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    console.log('Connecting to Redis...');
    await redisClient.connect();
    console.log('Redis connected successfully');

    // Verify Redis connection
    const client = redisClient.getClient();
    if (client) {
      const pong = await client.ping();
      console.log(`Redis ping response: ${pong}`);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Rate Limiting Service                       ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                                 ║
║  Health check:        http://localhost:${PORT}/health             ║
║  API Health:          http://localhost:${PORT}/api/health        ║
║  Management API:      http://localhost:${PORT}/api/limits        ║
╠══════════════════════════════════════════════════════════════╣
║  Features enabled:                                              ║
║  - Per-user rate limits                                         ║
║  - Per-IP rate limits                                           ║
║  - Per-endpoint rate limits                                     ║
║  - Sliding window algorithm                                     ║
║  - Burst protection                                              ║
║  - Redis-backed counters                                        ║
╠══════════════════════════════════════════════════════════════╣
║  Example endpoints (all rate limited):                         ║
║  - GET  /api/data           - Standard rate limit               ║
║  - POST /api/data/search    - Custom endpoint limit             ║
║  - POST /api/auth/login     - Strict login limit (5/min)        ║
║  - POST /api/auth/register  - Very strict (3/hour)              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app };

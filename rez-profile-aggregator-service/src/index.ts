/**
 * Profile Aggregator Service
 *
 * Unified user profile from all services
 * Now integrated with REZ Mind for AI insights
 * Port: 4025
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectMongoDB } from './config/mongodb';
import { connectRedis, redis } from './config/redis';
import { profileRoutes } from './routes/profile.routes';
import { mindRoutes } from './routes/mind.routes';
import { merchantRoutes } from './routes/merchant.routes';
import { healthCheck } from './services/healthCheck';
import { ProfileAggregator } from './services/ProfileAggregator';
import { RezMindIntegration } from './services/rezMindIntegration';
import { startEventWorker } from './workers/eventWorker';

const app = express();
const PORT = process.env.PORT || 4025;

// Security headers
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Manual security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
});

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
  const status = await healthCheck();
  res.json({
    service: 'profile-aggregator',
    status: status.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    details: status,
  });
});

app.get('/ready', async (req, res) => {
  try {
    await redis.ping();
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// Routes
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/mind', mindRoutes);
app.use('/api/v1/merchant', merchantRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    // Connect to databases
    await connectMongoDB();
    await connectRedis();

    // Initialize aggregator
    const aggregator = new ProfileAggregator();
    await aggregator.initialize();

    // Start event worker
    await startEventWorker(aggregator);

    // Start server
    app.listen(PORT, () => {
      console.log(`Profile Aggregator listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

export default app;

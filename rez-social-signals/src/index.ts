import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import socialRoutes from './routes/socialRoutes';
import {
  authMiddleware,
  rateLimitMiddleware,
  errorHandler,
  requestLogger,
  corsMiddleware,
  securityHeaders
} from './middleware';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4146', 10);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-social-signals';

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(corsMiddleware);
app.use(securityHeaders);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined'));

// Rate limiting
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS || '100');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000 * 1000;
app.use(rateLimitMiddleware(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW));

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-social-signals',
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API routes with authentication
app.use('/api/social', authMiddleware, socialRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date()
  });
});

// Error handler
app.use(errorHandler);

// Database connection and server start
async function startServer(): Promise<void> {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   REZ Social Signals Service                               ║
║   ─────────────────────                                    ║
║                                                            ║
║   Status: Running                                          ║
║   Port: ${PORT}                                                ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                            ║
║   Endpoints:                                               ║
║   GET  /health                    - Health check           ║
║   GET  /api/social/:userId        - Get social profile     ║
║   GET  /api/social/:userId/influence - Get influence score ║
║   GET  /api/social/:userId/sharing - Get sharing behavior  ║
║   GET  /api/social/:userId/referrals - Get referral metrics║
║   POST /api/social/share         - Track share event      ║
║   POST /api/social/referral      - Track referral event   ║
║   GET  /api/social/influencers   - Get top influencers     ║
║   GET  /api/social/segments/:seg - Get users by segment   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;

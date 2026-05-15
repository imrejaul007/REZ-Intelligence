import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { connectDatabase } from './database/connection';
import { initializeServiceTokens } from './middleware/auth';
import competitorRoutes from './routes/competitorRoutes';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 4059;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Internal-Token', 'Authorization']
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Health check endpoint (before auth)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-competitor-detection',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/competitor', competitorRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date()
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    timestamp: new Date()
  });
});

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully`);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize service tokens
    initializeServiceTokens();

    // Connect to database
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`REZ Competitor Detection Service started`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development'
      });
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        REZ Competitor Detection Service                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Status: Running                                              ║
║  Port: ${PORT.toString().padEnd(55)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(48)}║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                    ║
║  GET  /health                           Health check          ║
║  GET  /api/competitor/:userId           Get profile           ║
║  GET  /api/competitor/:userId/signals   Get switch signals   ║
║  GET  /api/competitor/:userId/winback   Get win-back         ║
║  POST /api/competitor/visit             Record visit         ║
║  POST /api/competitor/detect            Run detection        ║
║  GET  /api/competitor/list/switchers    Get switchers        ║
║  GET  /api/competitor/list/winback      Get win-back list    ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

export default app;

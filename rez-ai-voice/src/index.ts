/**
 * REZ AI Voice Agent Service - Main Entry Point
 * Express server for Twilio Voice integration with OpenAI Whisper and ElevenLabs TTS
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { handleVoiceWebhook } from './webhooks/twilioVoiceWebhook';
import callRoutes from './routes/call.routes';
import usageRoutes from './routes/usage.routes';
import { logger } from './utils/logger';
import { HealthCheckResponse } from './types';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnvironment(): void {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
    'ANTHROPIC_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.warn('Missing environment variables', { missing });
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

// Create Express app
const app: Express = express();
const startTime = Date.now();

// Ensure required directories exist
function ensureDirectories(): void {
  const dirs = [
    process.env.TTS_OUTPUT_DIR || './audio_output',
    process.env.LOG_DIR || './logs'
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info('Created directory', { dir });
    }
  }
}

// Middleware
function setupMiddleware(): void {
  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));

  // Parse multipart/form-data (for Twilio webhooks)
  app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));

  // CORS (configure for your domain in production)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin || '')) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Token');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    });

    next();
  });

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Routes
function setupRoutes(): void {
  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    const { getSTTService } = await import('./services/sttService');
    const { getTTSService } = await import('./services/ttsService');

    const sttService = getSTTService();
    const ttsService = getTTSService();

    try {
      const [sttHealthy, ttsHealthy] = await Promise.all([
        sttService.healthCheck().catch(() => false),
        ttsService.healthCheck().catch(() => false)
      ]);

      const response: HealthCheckResponse = {
        status: sttHealthy && ttsHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        services: {
          twilio: true, // Twilio SDK would throw if not configured
          openai: sttHealthy,
          elevenlabs: ttsHealthy
        },
        uptime: Date.now() - startTime
      };

      res.status(response.status === 'healthy' ? 200 : 503).json(response);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        services: {
          twilio: false,
          openai: false,
          elevenlabs: false
        },
        uptime: Date.now() - startTime
      });
    }
  });

  // Readiness check
  app.get('/ready', (req: Request, res: Response) => {
    res.status(200).json({ ready: true });
  });

  // Twilio Voice Webhook
  app.post('/webhook/voice', handleVoiceWebhook);
  app.get('/webhook/voice', handleVoiceWebhook);

  // API Routes
  app.use('/api/calls', callRoutes);
  app.use('/api/usage', usageRoutes);

  // Audio files endpoint (serve synthesized audio)
  const audioDir = process.env.TTS_OUTPUT_DIR || './audio_output';
  app.use('/audio', express.static(audioDir));

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      service: 'REZ AI Voice Agent',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        voiceWebhook: 'POST /webhook/voice',
        calls: 'GET/POST /api/calls',
        usage: 'GET /api/usage',
        health: 'GET /health'
      }
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  });
}

// Graceful shutdown
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close server
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}

// Start server
let server: ReturnType<Express['listen']>;

async function start(): Promise<void> {
  try {
    // Validate environment
    validateEnvironment();

    // Ensure directories exist
    ensureDirectories();

    // Setup middleware
    setupMiddleware();

    // Setup routes
    setupRoutes();

    // Setup graceful shutdown
    setupGracefulShutdown();

    // Start listening
    const port = parseInt(process.env.PORT || '4112', 10);
    const host = process.env.HOST || '0.0.0.0';

    server = app.listen(port, host, () => {
      logger.info(`REZ AI Voice Agent started`, {
        host,
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
        webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || 'not configured'
      });

      logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                    REZ AI Voice Agent                      ║
╠══════════════════════════════════════════════════════════════╣
║  Service:    Voice AI Agent                                ║
║  Version:    1.0.0                                         ║
║  Port:       ${port}                                            ║
║  Mode:       ${(process.env.NODE_ENV || 'development').padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  - Voice:    POST /webhook/voice                           ║
║  - Calls:    GET/POST /api/calls                           ║
║  - Usage:    GET /api/usage                                ║
║  - Health:   GET /health                                   ║
╠══════════════════════════════════════════════════════════════╣
║  Ready to receive calls!                                   ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start if run directly
if (require.main === module) {
  start();
}

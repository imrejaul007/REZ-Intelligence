/**
 * REZ Unified Conversation Engine
 * Main entry point - connects all communication channels to REZ Agent OS
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { config } from './config';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { messageRouter } from './routes/message.routes';
import { sessionRouter } from './routes/session.routes';
import { webhookRouter } from './routes/webhook.routes';
import { WhatsAppAdapter } from './channels/whatsapp.adapter';
import { VoiceAdapter } from './channels/voice.adapter';
import { CopilotAdapter } from './channels/copilot.adapter';
import { WebAdapter } from './channels/web.adapter';
import { ConversationService } from './services/conversationLogger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authMiddleware, internalServiceMiddleware } from './middleware/auth.middleware';

// Load environment variables
dotenv.config();

class UnifiedEngine {
  public app: Express;
  public httpServer: ReturnType<typeof createServer>;
  public io: SocketIOServer;
  public whatsappAdapter: WhatsAppAdapter;
  public voiceAdapter: VoiceAdapter;
  public copilotAdapter: CopilotAdapter;
  public webAdapter: WebAdapter;
  public conversationService: ConversationService;
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    this.conversationService = new ConversationService();
    this.initializeAdapters();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupGracefulShutdown();
  }

  private initializeAdapters(): void {
    this.whatsappAdapter = new WhatsAppAdapter(this.conversationService);
    this.voiceAdapter = new VoiceAdapter(this.conversationService);
    this.copilotAdapter = new CopilotAdapter(this.conversationService);
    this.webAdapter = new WebAdapter(this.conversationService);
    logger.info('Channel adapters initialized');
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Channel-Type', 'X-Session-Id'],
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Request logging
    this.app.use(morgan(config.morganFormat, {
      stream: {
        write: (message: string) => logger.http(message.trim()),
      },
      skip: (req: Request) => req.url === '/health',
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      skip: (req: Request) => req.path === '/health',
    });
    this.app.use(limiter);

    // Trust proxy (for rate limiting behind reverse proxy)
    this.app.set('trust proxy', 1);

    logger.info('Middleware configured');
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      const healthcheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'rez-unified-engine',
        version: '1.0.0',
      };
      res.json(healthcheck);
    });

    // Readiness check
    this.app.get('/ready', async (req: Request, res: Response) => {
      try {
        const dbStatus = await this.checkDatabaseConnection();
        const redisStatus = await this.checkRedisConnection();

        const isReady = dbStatus.connected && redisStatus.connected;

        res.status(isReady ? 200 : 503).json({
          status: isReady ? 'ready' : 'not_ready',
          checks: {
            database: dbStatus,
            redis: redisStatus,
          },
        });
      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // API routes with authentication
    this.app.use('/api/messages', authMiddleware, messageRouter);
    this.app.use('/api/sessions', authMiddleware, sessionRouter);

    // Webhook routes (use internal service auth)
    this.app.use('/webhooks', internalServiceMiddleware, webhookRouter);

    // Channel-specific webhook endpoints
    this.app.post('/webhooks/whatsapp', this.whatsappAdapter.handleWebhook.bind(this.whatsappAdapter));
    this.app.post('/webhooks/voice', this.voiceAdapter.handleWebhook.bind(this.voiceAdapter));
    this.app.post('/webhooks/copilot', this.copilotAdapter.handleWebhook.bind(this.copilotAdapter));
    this.app.post('/webhooks/web', this.webAdapter.handleWebhook.bind(this.webAdapter));

    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(errorHandler);

    logger.info('Routes configured');
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Join session room
      socket.on('join-session', (sessionId: string) => {
        socket.join(`session:${sessionId}`);
        logger.debug(`Socket ${socket.id} joined session: ${sessionId}`);
      });

      // Leave session room
      socket.on('leave-session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`);
        logger.debug(`Socket ${socket.id} left session: ${sessionId}`);
      });

      // Typing indicator
      socket.on('typing', (data: { sessionId: string; isTyping: boolean }) => {
        socket.to(`session:${data.sessionId}`).emit('typing', {
          sessionId: data.sessionId,
          isTyping: data.isTyping,
          timestamp: Date.now(),
        });
      });

      // Web message
      socket.on('web-message', async (data: {
        sessionId: string;
        message: string;
        userId?: string;
      }) => {
        try {
          const response = await this.webAdapter.processMessage({
            sessionId: data.sessionId,
            message: data.message,
            userId: data.userId,
            channel: 'web',
          });

          socket.emit('web-message-response', response);
          socket.to(`session:${data.sessionId}`).emit('agent-response', response);
        } catch (error) {
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Failed to process message',
          });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    logger.info('Socket.IO configured');
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Close Socket.IO connections
      this.io.close(() => {
        logger.info('Socket.IO server closed');
      });

      try {
        // Close database connection
        await disconnectDatabase();
        logger.info('Database disconnected');

        // Close Redis connection
        await disconnectRedis();
        logger.info('Redis disconnected');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error, stack: error.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('unhandledRejection');
    });
  }

  private async checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    try {
      const { mongoose } = await import('mongoose');
      const start = Date.now();
      await mongoose.connection.db?.admin().ping();
      return { connected: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedisConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    try {
      const redis = await import('./config/redis');
      const client = redis.getRedisClient();
      const start = Date.now();
      await client.ping();
      return { connected: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting REZ Unified Conversation Engine...');

      // Connect to MongoDB
      await connectDatabase();
      logger.info('Connected to MongoDB');

      // Connect to Redis
      await connectRedis();
      logger.info('Connected to Redis');

      // Start HTTP server
      this.httpServer.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Health check: http://localhost:${config.port}/health`);
        logger.info(`Ready check: http://localhost:${config.port}/ready`);
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  // Emit event to session via Socket.IO
  public emitToSession(sessionId: string, event: string, data: unknown): void {
    this.io.to(`session:${sessionId}`).emit(event, data);
  }
}

// Create and start engine
const engine = new UnifiedEngine();
engine.start();

export { UnifiedEngine, engine };

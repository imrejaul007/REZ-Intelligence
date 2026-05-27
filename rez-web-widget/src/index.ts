import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';
import { widgetRoutes } from './routes/widget.routes';
import { SocketService } from './services/socketService';
import { WidgetService } from './services/widgetService';
import { authMiddleware } from './middleware/auth.js';

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Extend global to include services
declare global {
  namespace Express {
    interface Application {
      io?: SocketIOServer;
    }
  }
}

class ReZWebWidgetServer {
  private app: Application;
  private httpServer: HttpServer;
  private io: SocketIOServer;
  private redisClient: RedisClientType;
  private socketService: SocketService;
  private widgetService: WidgetService;
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || '4088', 10);
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: parseInt(process.env.WIDGET_PING_INTERVAL || '25000', 10),
      pingTimeout: 20000,
    });

    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    // Initialize services
    this.widgetService = new WidgetService(this.redisClient, logger);
    this.socketService = new SocketService(this.io, this.widgetService, logger);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });

    // Static files for widget assets
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'rez-web-widget',
        timestamp: new Date().toISOString(),
      });
    });

    // Widget routes
    this.app.use('/', widgetRoutes);

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });

      this.socketService.handleConnection(socket);

      socket.on('disconnect', (reason: string) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          reason,
        });
        this.socketService.handleDisconnect(socket);
      });

      socket.on('error', (error: Error) => {
        logger.error('Socket error:', {
          socketId: socket.id,
          error: error.message,
        });
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redisClient.connect();
      logger.info('Connected to Redis');

      // Initialize widget service
      await this.widgetService.initialize();

      // Start HTTP server
      this.httpServer.listen(this.port, () => {
        logger.info(`ReZ Web Widget server running on port ${this.port}`);
        logger.info(`Widget assets available at http://localhost:${this.port}/widget.js`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down...');
    await this.socketService.shutdown();
    await this.redisClient.quit();
    this.httpServer.close();
    process.exit(0);
  }
}

// Handle graceful shutdown
const server = new ReZWebWidgetServer();

process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start the server
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export { server };

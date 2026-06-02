/**
 * REZ Real Estate Expert Agent
 * AI-powered real estate expert for property search, investment analysis, and market insights
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { createLogger } from './utils/logger';
import { realEstateRouter } from './routes/realEstate.routes';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration schema
const configSchema = z.object({
  port: z.string().optional().transform(val => val ? parseInt(val, 10) : 3013),
  nodeEnv: z.string().optional().default('development'),
  corsOrigins: z.string().optional().default('http://localhost:3000'),
  logLevel: z.string().optional().default('info'),
  rateLimitWindowMs: z.string().optional().transform(val => val ? parseInt(val, 10) : 60000),
  rateLimitMaxRequests: z.string().optional().transform(val => val ? parseInt(val, 10) : 100),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config & { serviceName: string; version: string } {
  const result = configSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    corsOrigins: process.env.ALLOWED_ORIGINS,
    logLevel: process.env.LOG_LEVEL,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  });

  if (!result.success) {
    console.error('Configuration validation failed:', result.error.format());
    process.exit(1);
  }

  return {
    ...result.data,
    serviceName: 'rez-real-estate-expert',
    version: '1.0.0'
  };
}

const config = loadConfig();
const logger = createLogger(config.logLevel);

// Express app
const app: Express = express();

// Security middleware
app.use(helmet({
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

app.use(cors({
  origin: config.corsOrigins.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health checks
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health/detailed', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    }
  });
});

// API routes
app.use('/api/v1/real-estate', realEstateRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: config.serviceName,
    version: config.version,
    description: 'AI-powered real estate expert for property search, investment analysis, and market insights',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /api/v1/real-estate/chat',
      search: 'POST /api/v1/real-estate/search',
      analyze: 'POST /api/v1/real-estate/analyze',
      investment: 'POST /api/v1/real-estate/investment',
      marketTrends: 'GET /api/v1/real-estate/market-trends'
    }
  });
});

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Start server
let server: ReturnType<Express['listen']> | null = null;

function startServer(): void {
  try {
    server = app.listen(config.port, () => {
      logger.info(`REZ Real Estate Expert started on port ${config.port}`);
      logger.info('Endpoints: chat, search, analyze, investment, market-trends');
    });

    process.on('SIGTERM', () => { logger.info('SIGTERM received'); server?.close(); process.exit(0); });
    process.on('SIGINT', () => { logger.info('SIGINT received'); server?.close(); process.exit(0); });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.endsWith('index.ts')) {
  startServer();
}

export { app, startServer, config };

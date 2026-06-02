/**
 * REZ Logistics Expert Agent
 * AI-powered logistics expert for route optimization, fleet management, and supply chain insights
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
import { logisticsRouter } from './routes/logistics.routes';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const configSchema = z.object({
  port: z.string().optional().transform(val => val ? parseInt(val, 10) : 3015),
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
    serviceName: 'rez-logistics-expert',
    version: '1.0.0'
  };
}

const config = loadConfig();
const logger = createLogger(config.logLevel);

const app: Express = express();

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

app.use((req: Request, _res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip, userAgent: req.get('user-agent') });
  next();
});

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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
    memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB', heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB' }
  });
});

app.use('/api/v1/logistics', logisticsRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: config.serviceName,
    version: config.version,
    description: 'AI-powered logistics expert for route optimization, fleet management, and supply chain insights',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /api/v1/logistics/chat',
      optimize: 'POST /api/v1/logistics/optimize',
      track: 'GET /api/v1/logistics/track/:shipmentId',
      fleet: 'GET /api/v1/logistics/fleet',
      analytics: 'GET /api/v1/logistics/analytics'
    }
  });
});

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

let server: ReturnType<Express['listen']> | null = null;

function startServer(): void {
  try {
    server = app.listen(config.port, () => {
      logger.info(`REZ Logistics Expert started on port ${config.port}`);
      logger.info('Endpoints: chat, optimize, track, fleet, analytics');
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

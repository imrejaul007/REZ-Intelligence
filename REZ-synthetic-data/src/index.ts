import express, { json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import syntheticRoutes from './routes/syntheticRoutes.js';
import { logger } from './utils/logger.js';
import { createAuthMiddleware, createRateLimiter, errorHandler, notFoundHandler } from './middleware/index.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4145', 10);

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
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rez.money').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token'],
}));

// Rate limiting
app.use('/api', createRateLimiter({ windowMs: 60 * 1000, max: 100 }));

// Body parsing with size limits
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));

// Auth middleware
const apiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
const internalTokens = (process.env.INTERNAL_TOKENS || '').split(',').filter(Boolean);
app.use(createAuthMiddleware({
  apiKeys,
  internalTokens,
  bypassPaths: ['/health', '/ready'],
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-synthetic-data',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

app.use('/api', syntheticRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`REZ Synthetic Data running on port ${PORT}`);
  logger.info(`Health: http://localhost:${PORT}/health`);
  logger.info(`API: http://localhost:${PORT}/api`);
});

export default app;

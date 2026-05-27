/**
 * REZ Intelligence API Gateway
 * Entry Point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { createTenantRouter } from './routes/tenantRoutes';
import { tenantMiddleware, ClientType } from './middleware/tenantIsolation';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4200', 10);

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID
app.use((req, res, next) => {
  req.headers['x-request-id'] = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const tenant = (req as typeof req & { tenant?: { tenantId: string } }).tenant;
    logger.info('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      requestId: req.headers['x-request-id'],
      tenantId: tenant?.tenantId
    });
  });
  next();
});

// ─────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'REZ-Intelligence-Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  res.json({ ready: true });
});

// ─────────────────────────────────────────────────────────────
// ROUTES (Tenant-Aware)
// ─────────────────────────────────────────────────────────────

app.use('/api/v1/intelligence', tenantMiddleware, rateLimitMiddleware, createTenantRouter());
app.use('/api/v1/memory', tenantMiddleware, rateLimitMiddleware, createTenantRouter());
app.use('/api/v1/intent', tenantMiddleware, rateLimitMiddleware, createTenantRouter());
app.use('/api/v1/predict', tenantMiddleware, rateLimitMiddleware, createTenantRouter());
app.use('/api/v1/care', tenantMiddleware, rateLimitMiddleware, createTenantRouter());
app.use('/api/v1/whatsapp', tenantMiddleware, rateLimitMiddleware, createTenantRouter());

// ─────────────────────────────────────────────────────────────
// INTERNAL PROXY
// ─────────────────────────────────────────────────────────────

app.use('/internal', authMiddleware, (req, res, next) => {
  // Proxy to internal services
  // See services/proxy.ts for full implementation
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Internal proxy coming soon' }
  });
});

// ─────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
});

// ─────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`REZ Intelligence Gateway started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    endpoints: [
      '/api/v1/intelligence',
      '/api/v1/memory',
      '/api/v1/intent',
      '/api/v1/predict',
      '/api/v1/care',
      '/api/v1/whatsapp'
    ]
  });
});

export default app;

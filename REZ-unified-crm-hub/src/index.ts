/**
 * REZ Unified CRM Hub - Main Entry Point
 *
 * ⚠️ INTERNAL USE ONLY - For REZ Platform Team Only ⚠️
 *
 * This service provides:
 * - Internal API (Port 4100): Full intelligence data for REZ platform
 * - Merchant API (Port 4101): Sanitized data for merchants
 *
 * IMPORTANT: No internal intelligence data should be exposed to merchants.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import http from 'http';
import { env } from './config/index.js';
import { logger } from './utils/logger.js';

// Internal routes (Port 4100)
import internalRoutes from './routes/index.js';

// Merchant routes (Port 4101)
import merchantRoutes from './routes/merchant.js';

// Create express apps
const internalApp = express();
const merchantApp = express();

// Trust proxy (for rate limiting behind reverse proxy)
internalApp.set('trust proxy', 1);
merchantApp.set('trust proxy', 1);

// Security middleware
const securityMiddleware = helmet({
  contentSecurityPolicy: false,
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://admin.rez.money', 'https://merchant.rez.money']
    : '*',
  credentials: true,
};

// Apply middleware to internal app
internalApp.use(securityMiddleware);
internalApp.use(cors(corsOptions));
internalApp.use(compression());
internalApp.use(express.json({ limit: '1mb' }));
internalApp.use(express.urlencoded({ extended: true }));

// Apply middleware to merchant app
merchantApp.use(securityMiddleware);
merchantApp.use(cors(corsOptions));
merchantApp.use(compression());
merchantApp.use(express.json({ limit: '1mb' }));
merchantApp.use(express.urlencoded({ extended: true }));

// Request logging for internal
internalApp.use((req, _res, next) => {
  logger.debug('Internal API request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Request logging for merchant
merchantApp.use((req, _res, next) => {
  logger.debug('Merchant API request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// API routes
// Internal API (Port 4100)
internalApp.use('/api/v1', internalRoutes);

// Merchant API (Port 4101)
merchantApp.use('/api/v1', merchantRoutes);

// Internal root endpoint
internalApp.get('/', (_req, res) => {
  res.json({
    service: 'REZ Unified CRM Hub - Internal API',
    version: '1.0.0',
    type: 'INTERNAL',
    warning: 'INTERNAL USE ONLY - Do not expose to merchants',
    endpoints: {
      dashboard: '/api/v1/internal/dashboard/overview',
      customers: '/api/v1/internal/customers',
      segments: '/api/v1/internal/segments',
      tags: '/api/v1/internal/tags',
      health: '/api/v1/health',
    },
  });
});

// Merchant root endpoint
merchantApp.get('/', (_req, res) => {
  res.json({
    service: 'REZ Unified CRM Hub - Merchant API',
    version: '1.0.0',
    type: 'MERCHANT',
    description: 'Sanitized data for merchants',
    endpoints: {
      customers: '/api/v1/merchant/customers',
      segments: '/api/v1/merchant/segments',
      inbox: '/api/v1/merchant/inbox/messages',
      analytics: '/api/v1/merchant/analytics/overview',
      health: '/api/v1/health',
    },
  });
});

// 404 handlers
internalApp.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Internal API endpoint not found',
  });
});

merchantApp.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Merchant API endpoint not found',
  });
});

// Error handlers
internalApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Internal API error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

merchantApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Merchant API error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start servers
const INTERNAL_PORT = parseInt(process.env.PORT || '4100', 10);
const MERCHANT_PORT = parseInt(process.env.MERCHANT_PORT || '4101', 10);

// Internal API server (Port 4100)
const internalServer = http.createServer(internalApp);
internalServer.listen(INTERNAL_PORT, '0.0.0.0', () => {
  logger.info('REZ Unified CRM Hub - Internal API started', {
    port: INTERNAL_PORT,
    env: env.NODE_ENV,
    type: 'INTERNAL',
  });
});

// Merchant API server (Port 4101)
const merchantServer = http.createServer(merchantApp);
merchantServer.listen(MERCHANT_PORT, '0.0.0.0', () => {
  logger.info('REZ Unified CRM Hub - Merchant API started', {
    port: MERCHANT_PORT,
    env: env.NODE_ENV,
    type: 'MERCHANT',
  });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  internalServer.close(() => {
    logger.info('Internal API server closed');
  });

  merchantServer.close(() => {
    logger.info('Merchant API server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { internalApp, merchantApp };

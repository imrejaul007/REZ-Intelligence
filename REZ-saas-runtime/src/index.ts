/**
 * REZ SaaS Runtime - Main Entry Point
 *
 * Multi-tenant SaaS Runtime for REZ Intelligence
 * Handles tenant onboarding, billing, and lifecycle management
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import routes from './routes';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '4220', 10);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.headers['x-request-id'],
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/', routes);

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ SaaS Runtime',
    version: '1.0.0',
    description: 'Multi-tenant SaaS Runtime for REZ Intelligence',
    port: PORT,
    endpoints: {
      health: 'GET /health',
      plans: 'GET /api/plans',
      tenants: 'POST/GET /api/tenants',
      subscriptions: 'POST/GET /api/subscriptions',
      usage: 'GET /api/usage/:tenantId',
      onboarding: 'GET/POST /api/onboarding/:tenantId',
      validateKey: 'POST /api/validate-key',
    },
  });
});

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start
app.listen(PORT, () => {
  logger.info(`REZ SaaS Runtime started on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    plans: ['free', 'starter', 'professional', 'enterprise'],
  });
});

export default app;

/**
 * REZ Channel Orchestrator
 * Unified entry point for all channels
 * Routes messages to REZ Orchestrator v2
 */

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';
import { channelRoutes } from './routes/channel.routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4070', 10);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    channel: req.headers['x-channel'] || 'unknown',
    ip: req.ip
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-channel-orchestrator',
    timestamp: new Date().toISOString()
  });
});

// Channel routes
app.use('/api/v1', channelRoutes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
app.listen(PORT, () => {
  logger.info(`REZ Channel Orchestrator started on port ${PORT}`);
  logger.info('Available channels:', {
    whatsapp: `http://localhost:${PORT}/api/v1/whatsapp`,
    instagram: `http://localhost:${PORT}/api/v1/instagram`,
    sms: `http://localhost:${PORT}/api/v1/sms`,
    email: `http://localhost:${PORT}/api/v1/email`,
    rcs: `http://localhost:${PORT}/api/v1/rcs`,
    voice: `http://localhost:${PORT}/api/v1/voice`,
    web: `http://localhost:${PORT}/api/v1/web`,
    app: `http://localhost:${PORT}/api/v1/app`
  });
});

export default app;

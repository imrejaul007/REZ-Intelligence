/**
 * REZ Email Bridge
 * Connects Email to REZ Orchestrator
 */

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger';
import { emailRoutes } from './routes/email.routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4086', 10);

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
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check (no auth)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-email-bridge',
    timestamp: new Date().toISOString()
  });
});

// Auth middleware for API routes
app.use('/api', authMiddleware);

// Routes
app.use('/api', emailRoutes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
app.listen(PORT, () => {
  logger.info(`REZ Email Bridge started on port ${PORT}`);
});

export default app;

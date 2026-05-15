/**
 * REZ Unified Attribution Service
 *
 * Consolidates ALL attribution tracking into a single service:
 * - REZ-attribution-platform (Retail/Omnichannel)
 * - REZ-attribution-system (Digital Marketing)
 * - REZ-attribution-engine (Full Commerce Journey)
 *
 * Features:
 * - Multi-touch attribution (First, Last, Linear, Time Decay, Position Based, Data Driven)
 * - Channel tracking (DOOH, QR, Ads, Social, Email, SMS, Push, Organic, Walk-in)
 * - Aggregator attribution (Swiggy, Zomato, Dunzo)
 * - Wallet/Cashback attribution
 * - Creator attribution
 * - Incrementality testing
 * - ROI calculation
 * - Cohort analysis
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import { logger } from './services/logger.js';
import { attributionRouter } from './routes/attribution.js';
import { channelRouter } from './routes/channels.js';
import { touchpointRouter } from './routes/touchpoints.js';
import { conversionRouter } from './routes/conversions.js';
import { reportRouter } from './routes/reports.js';
import { roiRouter } from './routes/roi.js';

config();

const app = express();
const PORT = process.env.PORT || 4090;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-attribution';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-unified-attribution',
    version: '1.0.0',
    features: [
      'multi-touch-attribution',
      'channel-tracking',
      'aggregator-attribution',
      'creator-attribution',
      'incrementality-testing',
      'roi-calculation',
      'cohort-analysis'
    ]
  });
});

// Routes
app.use('/api/v1', attributionRouter);
app.use('/api/v1/channels', channelRouter);
app.use('/api/v1/touchpoints', touchpointRouter);
app.use('/api/v1/conversions', conversionRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/roi', roiRouter);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Attribution error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`REZ Unified Attribution Service started on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start service', { error });
    process.exit(1);
  }
}

start();

export { app };

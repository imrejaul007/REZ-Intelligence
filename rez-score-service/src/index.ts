/**
 * ReZ Score Service
 *
 * Calculate and manage ReZ Scores
 * Port: 4028
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectMongoDB } from './config/mongodb';
import { ReZScoreService } from './services/ReZScoreService';
import { scoreRoutes } from './routes/score.routes';
import { healthCheck } from './services/healthCheck';

const app = express();
const PORT = process.env.PORT || 4028;

// Security headers
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Manual security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
});

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (req, res) => {
  const status = await healthCheck();
  res.json({ service: 'score-service', ...status });
});

app.use('/api/v1/score', scoreRoutes);

async function start() {
  try {
    await connectMongoDB();
    const service = new ReZScoreService();
    await service.initialize();

    app.locals.service = service;

    app.listen(PORT, () => {
      console.log(`ReZ Score Service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();

export default app;

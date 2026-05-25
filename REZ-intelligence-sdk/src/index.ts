/**
 * REZ Intelligence SDK - Main Server
 *
 * Unified TypeScript client for all REZ Intelligence services
 * Port: 4151
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { IntelligenceClient } from './sdk';
import logger from './utils/logger';

const app = express();
const PORT = process.env.PORT || 4151;

// Initialize SDK client
const client = new IntelligenceClient({
  baseUrl: process.env.INTELLIGENCE_BASE_URL || 'http://localhost:4018',
  apiKey: process.env.INTELLIGENCE_API_KEY || '',
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// SDK PROXY ENDPOINTS
// ============================================

// Health
app.get('/api/health', async (_req: Request, res: Response) => {
  const health = await client.healthCheck();
  res.json({ success: true, ...health });
});

// User Profile
app.get('/api/profiles/:userId', async (req: Request, res: Response) => {
  const result = await client.getUserProfile(req.params.userId);
  res.json(result);
});

// Predictions
app.get('/api/predict/churn/:userId', async (req: Request, res: Response) => {
  const result = await client.predictChurn(req.params.userId);
  res.json(result);
});

app.get('/api/predict/ltv/:userId', async (req: Request, res: Response) => {
  const result = await client.predictLTV(req.params.userId);
  res.json(result);
});

app.get('/api/predict/next-purchase/:userId', async (req: Request, res: Response) => {
  const result = await client.predictNextPurchase(req.params.userId);
  res.json(result);
});

// Intent
app.post('/api/intent/predict', async (req: Request, res: Response) => {
  const { userId, context } = req.body;
  const result = await client.predictIntent(userId, context);
  res.json(result);
});

// Recommendations
app.get('/api/recommendations', async (req: Request, res: Response) => {
  const { userId, type, limit } = req.query;
  const result = await client.getRecommendations(userId as string, {
    type: type as string,
    limit: limit ? parseInt(limit as string) : undefined,
  });
  res.json(result);
});

app.post('/api/recommendations/feed', async (req: Request, res: Response) => {
  const { userId, limit } = req.body;
  const result = await client.getPersonalizedFeed(userId, limit);
  res.json(result);
});

// Segments
app.get('/api/segments', async (_req: Request, res: Response) => {
  const result = await client.getSegments();
  res.json(result);
});

app.get('/api/segments/user/:userId', async (req: Request, res: Response) => {
  const result = await client.getUserSegments(req.params.userId);
  res.json(result);
});

// Signals
app.get('/api/signals/:userId', async (req: Request, res: Response) => {
  const result = await client.getSignals(req.params.userId);
  res.json(result);
});

app.post('/api/events', async (req: Request, res: Response) => {
  const { userId, event, properties } = req.body;
  const result = await client.trackEvent(userId, event, properties);
  res.json(result);
});

// Location
app.get('/api/location/context/:userId', async (req: Request, res: Response) => {
  const result = await client.getLocationContext(req.params.userId);
  res.json(result);
});

app.post('/api/search/nearby', async (req: Request, res: Response) => {
  const { location, radius } = req.body;
  const result = await client.searchNearby(location.lat, location.lng, radius);
  res.json(result);
});

app.get('/api/location/predict/:userId', async (req: Request, res: Response) => {
  const result = await client.predictLocation(req.params.userId);
  res.json(result);
});

// Explainability
app.get('/api/explain/:predictionId', async (req: Request, res: Response) => {
  const result = await client.explainPrediction(req.params.predictionId);
  res.json(result);
});

app.post('/api/explain', async (req: Request, res: Response) => {
  const { entityType, entityId, predictionType } = req.body;
  if (predictionType === 'churn' || entityType === 'user') {
    const result = await client.explainUserChurn(entityId);
    res.json(result);
  } else {
    res.status(400).json({ success: false, error: 'Unsupported prediction type' });
  }
});

// Decisions
app.post('/api/decisions', async (req: Request, res: Response) => {
  const { context, options } = req.body;
  const result = await client.makeDecision(context, options);
  res.json(result);
});

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Intelligence SDK',
    version: '1.0.0',
    description: 'Unified TypeScript client for all REZ Intelligence services',
    port: PORT,
    endpoints: {
      health: ['GET /api/health'],
      profiles: ['GET /api/profiles/:userId'],
      predictions: ['GET /api/predict/:type/:userId'],
      intent: ['POST /api/intent/predict'],
      recommendations: ['GET /api/recommendations', 'POST /api/recommendations/feed'],
      segments: ['GET /api/segments', 'GET /api/segments/user/:userId'],
      signals: ['GET /api/signals/:userId', 'POST /api/events'],
      location: ['GET /api/location/context/:userId', 'POST /api/search/nearby', 'GET /api/location/predict/:userId'],
      explainability: ['GET /api/explain/:predictionId', 'POST /api/explain'],
      decisions: ['POST /api/decisions'],
    },
  });
});

// Error handling
app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`REZ Intelligence SDK started on port ${PORT}`));

export default app;

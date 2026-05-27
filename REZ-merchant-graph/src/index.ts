/**
 * REZ Merchant Graph - Main Server
 *
 * Merchant Intelligence Graph - Relationship mapping and network analysis
 * Port: 4150
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  createMerchant,
  getMerchant,
  searchMerchants,
  createRelationship,
  getRelationship,
  getMerchantRelationships,
  queryGraph,
  analyzeInfluence,
  analyzeOpportunities,
  getHealthStatus,
  getStats,
} from './merchantGraphService';

const app = express();
const PORT = process.env.PORT || 4150;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Validation schemas
const merchantSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['retail', 'restaurant', 'service', 'online', 'marketplace', 'franchise', 'chain', 'independent']),
  category: z.string(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    country: z.string(),
  }).optional(),
});

const relationshipSchema = z.object({
  sourceMerchantId: z.string(),
  targetMerchantId: z.string(),
  type: z.enum(['parent_subsidiary', 'franchise', 'supplier', 'distributor', 'partner', 'competitor', 'complementary', 'affiliate', 'cluster', 'referral', 'co_brand', 'shared_location']),
  bidirectional: z.boolean().optional(),
});

// Merchant endpoints
app.post('/api/merchants', async (req: Request, res: Response) => {
  try {
    const validation = merchantSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    const merchant = await createMerchant({
      ...validation.data,
      relationships: [],
    });
    res.status(201).json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create merchant' });
  }
});

app.get('/api/merchants', async (req: Request, res: Response) => {
  const result = await searchMerchants({
    query: req.query.query as string,
    limit: parseInt(req.query.limit as string) || 20,
  });
  res.json(result);
});

app.get('/api/merchants/:merchantId', async (req: Request, res: Response) => {
  const merchant = await getMerchant(req.params.merchantId);
  if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });
  res.json({ success: true, merchant });
});

// Relationship endpoints
app.post('/api/relationships', async (req: Request, res: Response) => {
  try {
    const validation = relationshipSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    const result = await createRelationship(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create relationship' });
  }
});

app.get('/api/relationships/:relationshipId', async (req: Request, res: Response) => {
  const relationship = await getRelationship(req.params.relationshipId);
  if (!relationship) return res.status(404).json({ success: false, error: 'Relationship not found' });
  res.json({ success: true, relationship });
});

app.get('/api/merchants/:merchantId/relationships', async (req: Request, res: Response) => {
  const relationships = await getMerchantRelationships(req.params.merchantId);
  res.json({ success: true, relationships });
});

// Graph endpoints
app.post('/api/graph/query', async (req: Request, res: Response) => {
  try {
    const result = await queryGraph(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Query failed' });
  }
});

// Analysis endpoints
app.get('/api/merchants/:merchantId/analysis/influence', async (req: Request, res: Response) => {
  const analysis = await analyzeInfluence(req.params.merchantId);
  if (!analysis) return res.status(404).json({ success: false, error: 'Merchant not found' });
  res.json({ success: true, analysis });
});

app.get('/api/merchants/:merchantId/analysis/opportunities', async (req: Request, res: Response) => {
  const analysis = await analyzeOpportunities(req.params.merchantId);
  if (!analysis) return res.status(404).json({ success: false, error: 'Merchant not found' });
  res.json({ success: true, analysis });
});

// Health & Stats
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, ...getHealthStatus() });
});

app.get('/api/stats', (_req: Request, res: Response) => {
  res.json({ success: true, ...getStats() });
});

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Merchant Graph',
    version: '1.0.0',
    description: 'Merchant Intelligence Graph - Relationship mapping and network analysis',
    port: PORT,
    endpoints: {
      merchants: ['POST /api/merchants', 'GET /api/merchants', 'GET /api/merchants/:id'],
      relationships: ['POST /api/relationships', 'GET /api/relationships/:id', 'GET /api/merchants/:id/relationships'],
      graph: ['POST /api/graph/query'],
      analysis: ['GET /api/merchants/:id/analysis/influence', 'GET /api/merchants/:id/analysis/opportunities'],
    },
  });
});

// Error handling
app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`REZ Merchant Graph started on port ${PORT}`));

export default app;

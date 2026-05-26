/**
 * REZ Intelligence SDK - Main Entry Point
 *
 * Unified TypeScript client for all REZ Intelligence services
 * Supports 3 client types: REZ_ECOSYSTEM, NON_REZ, RABTUL_SAAS
 *
 * Port: 4151
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { REZIntelligenceClient, createIntelligenceClient } from './sdk';
import type { IntelligenceClientConfig } from './types';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '4151', 10);

// ============================================
// CLIENT CONFIGURATION
// ============================================

const clientConfig: IntelligenceClientConfig = {
  baseUrl: process.env.INTELLIGENCE_BASE_URL || 'http://localhost:4300', // API Gateway
  apiKey: process.env.INTELLIGENCE_API_KEY || '',
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  cacheEnabled: process.env.CACHE_ENABLED !== 'false',
  cacheTtl: parseInt(process.env.CACHE_TTL || '60000', 10),
};

// Initialize client
const client = createIntelligenceClient(clientConfig);

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  logger.info(`${req.method} ${req.path}`, { requestId });
  next();
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ-Intelligence-SDK',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const health = await client.healthCheck();
    res.json({ success: true, ...health });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ success: false, error: 'Service unavailable' });
  }
});

// ============================================
// INTENT ENDPOINTS
// ============================================

app.post('/api/intent/predict', async (req: Request, res: Response) => {
  try {
    const result = await client.predictIntent(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Intent prediction failed', { error });
    res.status(500).json({ success: false, error: 'Intent prediction failed' });
  }
});

app.post('/api/intent/batch-predict', async (req: Request, res: Response) => {
  try {
    const result = await client.batchPredictIntent(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Batch intent prediction failed', { error });
    res.status(500).json({ success: false, error: 'Batch prediction failed' });
  }
});

// ============================================
// RECOMMENDATIONS ENDPOINTS
// ============================================

app.post('/api/recommendations', async (req: Request, res: Response) => {
  try {
    const result = await client.getRecommendations(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Get recommendations failed', { error });
    res.status(500).json({ success: false, error: 'Recommendations failed' });
  }
});

app.get('/api/recommendations/for-you', async (req: Request, res: Response) => {
  try {
    const { userId, limit } = req.query;
    const result = await client.getForYouFeed(
      userId as string,
      limit ? parseInt(limit as string) : 20
    );
    res.json(result);
  } catch (error) {
    logger.error('Get for-you feed failed', { error });
    res.status(500).json({ success: false, error: 'Feed retrieval failed' });
  }
});

// ============================================
// USER PROFILE ENDPOINTS
// ============================================

app.get('/api/profile/:userId', async (req: Request, res: Response) => {
  try {
    const result = await client.getUserProfile(req.params.userId);
    res.json(result);
  } catch (error) {
    logger.error('Get profile failed', { error });
    res.status(500).json({ success: false, error: 'Profile retrieval failed' });
  }
});

app.put('/api/profile/:userId', async (req: Request, res: Response) => {
  try {
    const result = await client.updateUserProfile(req.params.userId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Update profile failed', { error });
    res.status(500).json({ success: false, error: 'Profile update failed' });
  }
});

// ============================================
// WORKFLOW ENDPOINTS
// ============================================

app.get('/api/workflows', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const result = await client.listWorkflows(
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );
    res.json(result);
  } catch (error) {
    logger.error('List workflows failed', { error });
    res.status(500).json({ success: false, error: 'Workflow list failed' });
  }
});

app.post('/api/workflows', async (req: Request, res: Response) => {
  try {
    const result = await client.createWorkflow(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Create workflow failed', { error });
    res.status(500).json({ success: false, error: 'Workflow creation failed' });
  }
});

app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const result = await client.getWorkflow(req.params.workflowId);
    res.json(result);
  } catch (error) {
    logger.error('Get workflow failed', { error });
    res.status(500).json({ success: false, error: 'Workflow retrieval failed' });
  }
});

app.delete('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const result = await client.deleteWorkflow(req.params.workflowId);
    res.json(result);
  } catch (error) {
    logger.error('Delete workflow failed', { error });
    res.status(500).json({ success: false, error: 'Workflow deletion failed' });
  }
});

// ============================================
// EXECUTION ENDPOINTS
// ============================================

app.post('/api/executions', async (req: Request, res: Response) => {
  try {
    const result = await client.triggerExecution(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Trigger execution failed', { error });
    res.status(500).json({ success: false, error: 'Execution trigger failed' });
  }
});

app.get('/api/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const result = await client.getExecution(req.params.executionId);
    res.json(result);
  } catch (error) {
    logger.error('Get execution failed', { error });
    res.status(500).json({ success: false, error: 'Execution retrieval failed' });
  }
});

app.post('/api/executions/:executionId/cancel', async (req: Request, res: Response) => {
  try {
    const result = await client.cancelExecution(req.params.executionId);
    res.json(result);
  } catch (error) {
    logger.error('Cancel execution failed', { error });
    res.status(500).json({ success: false, error: 'Execution cancellation failed' });
  }
});

app.post('/api/executions/:executionId/retry', async (req: Request, res: Response) => {
  try {
    const result = await client.retryExecution(req.params.executionId);
    res.json(result);
  } catch (error) {
    logger.error('Retry execution failed', { error });
    res.status(500).json({ success: false, error: 'Execution retry failed' });
  }
});

// ============================================
// ML PREDICTION ENDPOINTS
// ============================================

app.post('/api/predict/churn', async (req: Request, res: Response) => {
  try {
    const result = await client.predictChurn(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Churn prediction failed', { error });
    res.status(500).json({ success: false, error: 'Churn prediction failed' });
  }
});

app.post('/api/predict/ltv', async (req: Request, res: Response) => {
  try {
    const result = await client.predictLTV(req.body);
    res.json(result);
  } catch (error) {
    logger.error('LTV prediction failed', { error });
    res.status(500).json({ success: false, error: 'LTV prediction failed' });
  }
});

app.post('/api/predict/revisit', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const result = await client.predictRevisit(userId);
    res.json(result);
  } catch (error) {
    logger.error('Revisit prediction failed', { error });
    res.status(500).json({ success: false, error: 'Revisit prediction failed' });
  }
});

// ============================================
// EVENT TRACKING ENDPOINTS
// ============================================

app.post('/api/events', async (req: Request, res: Response) => {
  try {
    const result = await client.trackEvent(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Track event failed', { error });
    res.status(500).json({ success: false, error: 'Event tracking failed' });
  }
});

app.post('/api/events/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    const result = await client.trackBatchEvents(events);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Batch track events failed', { error });
    res.status(500).json({ success: false, error: 'Batch event tracking failed' });
  }
});

// ============================================
// TIMELINE ENDPOINTS
// ============================================

app.post('/api/timeline/event', async (req: Request, res: Response) => {
  try {
    const result = await client.addTimelineEvent(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Add timeline event failed', { error });
    res.status(500).json({ success: false, error: 'Timeline event failed' });
  }
});

app.get('/api/timeline', async (req: Request, res: Response) => {
  try {
    const { userId, limit, type } = req.query;
    const result = await client.getTimeline(userId as string, {
      limit: limit ? parseInt(limit as string) : undefined,
      type: type as string | undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('Get timeline failed', { error });
    res.status(500).json({ success: false, error: 'Timeline retrieval failed' });
  }
});

// ============================================
// KNOWLEDGE ENDPOINTS
// ============================================

app.post('/api/knowledge/search', async (req: Request, res: Response) => {
  try {
    const result = await client.searchKnowledge(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Knowledge search failed', { error });
    res.status(500).json({ success: false, error: 'Knowledge search failed' });
  }
});

app.post('/api/knowledge/entries', async (req: Request, res: Response) => {
  try {
    const result = await client.addKnowledgeEntry(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Add knowledge entry failed', { error });
    res.status(500).json({ success: false, error: 'Knowledge entry failed' });
  }
});

// ============================================
// PRIVACY ENDPOINTS
// ============================================

app.post('/api/privacy/can-access', async (req: Request, res: Response) => {
  try {
    const result = await client.canAccessData(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Privacy check failed', { error });
    res.status(500).json({ success: false, error: 'Privacy check failed' });
  }
});

app.post('/api/privacy/filter', async (req: Request, res: Response) => {
  try {
    const result = await client.filterByPrivacy(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Privacy filter failed', { error });
    res.status(500).json({ success: false, error: 'Privacy filter failed' });
  }
});

// ============================================
// TENANT MANAGEMENT ENDPOINTS (Admin)
// ============================================

app.post('/api/tenants', async (req: Request, res: Response) => {
  try {
    const result = await client.createTenant(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Create tenant failed', { error });
    res.status(500).json({ success: false, error: 'Tenant creation failed' });
  }
});

app.get('/api/tenants', async (req: Request, res: Response) => {
  try {
    const { clientType } = req.query;
    const result = await client.listTenants(clientType as any);
    res.json(result);
  } catch (error) {
    logger.error('List tenants failed', { error });
    res.status(500).json({ success: false, error: 'Tenant list failed' });
  }
});

app.get('/api/tenants/:tenantId', async (req: Request, res: Response) => {
  try {
    const result = await client.getTenant(req.params.tenantId);
    res.json(result);
  } catch (error) {
    logger.error('Get tenant failed', { error });
    res.status(500).json({ success: false, error: 'Tenant retrieval failed' });
  }
});

// ============================================
// SERVICE STATUS
// ============================================

app.get('/api/services', async (_req: Request, res: Response) => {
  try {
    const result = await client.getServiceStatuses();
    res.json(result);
  } catch (error) {
    logger.error('Get service statuses failed', { error });
    res.status(500).json({ success: false, error: 'Service status failed' });
  }
});

// ============================================
// ROOT
// ============================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Intelligence SDK',
    version: '2.0.0',
    description: 'Unified TypeScript client for all REZ Intelligence services',
    port: PORT,
    clientTypes: ['REZ_ECOSYSTEM', 'NON_REZ', 'RABTUL_SAAS'],
    endpoints: {
      health: ['GET /health', 'GET /api/health', 'GET /api/services'],
      intent: ['POST /api/intent/predict', 'POST /api/intent/batch-predict'],
      recommendations: ['POST /api/recommendations', 'GET /api/recommendations/for-you'],
      profile: ['GET /api/profile/:userId', 'PUT /api/profile/:userId'],
      workflows: ['GET /api/workflows', 'POST /api/workflows', 'GET /api/workflows/:id', 'DELETE /api/workflows/:id'],
      executions: ['POST /api/executions', 'GET /api/executions/:id', 'POST /api/executions/:id/cancel', 'POST /api/executions/:id/retry'],
      predictions: ['POST /api/predict/churn', 'POST /api/predict/ltv', 'POST /api/predict/revisit'],
      events: ['POST /api/events', 'POST /api/events/batch'],
      timeline: ['POST /api/timeline/event', 'GET /api/timeline'],
      knowledge: ['POST /api/knowledge/search', 'POST /api/knowledge/entries'],
      privacy: ['POST /api/privacy/can-access', 'POST /api/privacy/filter'],
      tenants: ['POST /api/tenants', 'GET /api/tenants', 'GET /api/tenants/:id'],
    },
    documentation: 'https://docs.rez.money',
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================
// STARTUP
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Intelligence SDK started on port ${PORT}`, {
    baseUrl: clientConfig.baseUrl,
    cacheEnabled: clientConfig.cacheEnabled,
    timeout: clientConfig.timeout,
  });
});

export default app;

// ============================================
// EXPORTS
// ============================================

export { REZIntelligenceClient, createIntelligenceClient, getIntelligenceClient } from './sdk';
export * from './types';

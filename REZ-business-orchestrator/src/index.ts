/**
 * REZ Business Orchestrator - Main Server
 *
 * Business Intelligence Orchestrator - Cross-domain workflow automation
 * Port: 4149
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  executeWorkflow,
  getExecution,
  cancelExecution,
  createRule,
  evaluateRules,
  getTemplates,
  getWorkflowAnalytics,
  getHealthStatus,
  getStats,
} from './businessService';

const app = express();
const PORT = process.env.PORT || 4149;

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
const createWorkflowSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['onboarding', 'retention', 'conversion', 'reactivation', 'escalation', 'fulfillment', 'analytics', 'custom']),
  domain: z.enum(['commerce', 'loyalty', 'support', 'marketing', 'operations', 'finance', 'analytics']),
  steps: z.array(z.object({
    name: z.string(),
    type: z.enum(['service_call', 'decision', 'condition', 'parallel', 'loop', 'wait', 'transform', 'notification']),
    service: z.string(),
    action: z.string(),
    parameters: z.record(z.unknown()),
  })),
  triggers: z.array(z.object({
    type: z.enum(['event', 'schedule', 'webhook', 'manual', 'api']),
  })).optional(),
  conditions: z.array(z.object({
    field: z.string().optional(),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'contains', 'in']).optional(),
    value: z.unknown().optional(),
    action: z.enum(['proceed', 'skip', 'fail']),
  })).optional(),
  variables: z.array(z.object({
    name: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    defaultValue: z.unknown().optional(),
    scope: z.enum(['step', 'workflow']).optional(),
  })).optional(),
  options: z.object({
    timeout: z.number().optional(),
    maxConcurrent: z.number().optional(),
  }).optional(),
});

const executeWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  trigger: z.string().optional(),
  options: z.object({
    sync: z.boolean().optional(),
    timeout: z.number().optional(),
  }).optional(),
});

const evaluateRulesSchema = z.object({
  domain: z.enum(['commerce', 'loyalty', 'support', 'marketing', 'operations', 'finance', 'analytics']),
  entityId: z.string(),
  entityType: z.string(),
  data: z.record(z.unknown()),
});

// Workflow endpoints
app.post('/api/workflows', async (req: Request, res: Response) => {
  try {
    const validation = createWorkflowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.issues });
    }
    const result = await createWorkflow(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

app.get('/api/workflows', async (req: Request, res: Response) => {
  const { domain, type, status } = req.query;
  const workflows = await listWorkflows({ domain: domain as string, type: type as string, status: status as string });
  res.json({ success: true, workflows });
});

app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  const workflow = await getWorkflow(req.params.workflowId);
  if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
  res.json({ success: true, workflow });
});

app.put('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  const workflow = await updateWorkflow(req.params.workflowId, req.body);
  if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
  res.json({ success: true, workflow });
});

app.post('/api/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  try {
    const validation = executeWorkflowSchema.safeParse({ ...req.body, workflowId: req.params.workflowId });
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    const result = await executeWorkflow(validation.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Execution endpoints
app.get('/api/executions/:executionId', async (req: Request, res: Response) => {
  const execution = await getExecution(req.params.executionId);
  if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });
  res.json({ success: true, execution });
});

app.post('/api/executions/:executionId/cancel', async (req: Request, res: Response) => {
  const cancelled = await cancelExecution(req.params.executionId);
  res.json({ success: cancelled, cancelled });
});

// Rules endpoints
app.post('/api/rules', async (req: Request, res: Response) => {
  const rule = await createRule(req.body);
  res.status(201).json({ success: true, rule });
});

app.post('/api/rules/evaluate', async (req: Request, res: Response) => {
  try {
    const validation = evaluateRulesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    const result = await evaluateRules(validation.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Templates
app.get('/api/templates', (_req: Request, res: Response) => {
  res.json({ success: true, templates: getTemplates() });
});

// Analytics
app.get('/api/analytics/:workflowId', (req: Request, res: Response) => {
  const analytics = getWorkflowAnalytics(req.params.workflowId, { start: new Date(), end: new Date() });
  if (!analytics) return res.status(404).json({ success: false, error: 'Workflow not found' });
  res.json({ success: true, ...analytics });
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
    service: 'REZ Business Orchestrator',
    version: '1.0.0',
    description: 'Business Intelligence Orchestrator - Cross-domain workflow automation',
    port: PORT,
    endpoints: {
      workflows: ['POST /api/workflows', 'GET /api/workflows', 'GET /api/workflows/:id', 'PUT /api/workflows/:id', 'POST /api/workflows/:id/execute'],
      executions: ['GET /api/executions/:id', 'POST /api/executions/:id/cancel'],
      rules: ['POST /api/rules', 'POST /api/rules/evaluate'],
      templates: ['GET /api/templates'],
      analytics: ['GET /api/analytics/:workflowId'],
    },
  });
});

// Error handling
app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => logger.info(`REZ Business Orchestrator started on port ${PORT}`));

export default app;

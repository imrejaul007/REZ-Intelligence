/**
 * REZ Action Orchestrator - Main Server
 *
 * AI Action Engine - Autonomous execution orchestration
 * Port: 4146
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  registerTool,
  getTool,
  listTools,
  executeAction,
  createWorkflow,
  getWorkflow,
  listWorkflows,
  executeWorkflow,
  createPlan,
  executePlan,
  getHealthStatus,
  getStats,
} from './actionService';

const app = express();
const PORT = process.env.PORT || 4146;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const toolParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'enum']),
  description: z.string(),
  required: z.boolean(),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
  schema: z.record(z.unknown()).optional(),
});

const registerToolSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['data', 'computation', 'communication', 'integration', 'automation', 'analysis']),
  parameters: z.array(toolParameterSchema),
  returns: z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'void']),
    description: z.string(),
    schema: z.record(z.unknown()).optional(),
  }),
  handler: z.string(),
  options: z.object({
    requiresAuth: z.boolean().optional(),
    rateLimit: z.object({
      requests: z.number(),
      windowMs: z.number(),
    }).optional(),
    timeout: z.number().optional(),
  }).optional(),
});

const executeActionSchema = z.object({
  actionName: z.string().min(1),
  actionType: z.enum(['query', 'calculation', 'decision', 'notification', 'workflow', 'external_api', 'database', 'transform']),
  parameters: z.record(z.unknown()),
  options: z.object({
    timeout: z.number().optional(),
    maxRetries: z.number().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
  }).optional(),
});

const workflowStepSchema = z.object({
  name: z.string(),
  type: z.enum(['tool', 'action', 'condition', 'parallel', 'loop', 'wait', 'transform']),
  tool: z.string().optional(),
  action: z.string().optional(),
  subWorkflow: z.string().optional(),
  parameters: z.record(z.unknown()),
  nextStep: z.string().optional(),
  onSuccess: z.string().optional(),
  onFailure: z.string().optional(),
  retryPolicy: z.object({
    maxRetries: z.number(),
    backoffMs: z.number(),
  }).optional(),
  timeout: z.number().optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  steps: z.array(workflowStepSchema).min(1),
  triggers: z.array(z.object({
    type: z.enum(['event', 'schedule', 'webhook', 'api']),
    event: z.string().optional(),
    schedule: z.string().optional(),
    webhook: z.string().optional(),
  })).optional(),
  conditions: z.array(z.object({
    expression: z.string(),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'contains', 'matches']),
    value: z.unknown().optional(),
    action: z.enum(['proceed', 'skip', 'fail', 'goto']),
    target: z.string().optional(),
  })).optional(),
  variables: z.array(z.object({
    name: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    defaultValue: z.unknown().optional(),
    scope: z.enum(['step', 'workflow']),
  })).optional(),
  options: z.object({
    timeout: z.number().optional(),
    maxConcurrent: z.number().optional(),
  }).optional(),
});

const executeWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  trigger: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  options: z.object({
    sync: z.boolean().optional(),
    timeout: z.number().optional(),
  }).optional(),
});

const createPlanSchema = z.object({
  goal: z.string().min(1),
  constraints: z.object({
    maxSteps: z.number().optional(),
    maxCost: z.number().optional(),
    maxDuration: z.number().optional(),
  }).optional(),
  context: z.record(z.unknown()).optional(),
});

const executePlanSchema = z.object({
  planId: z.string().min(1),
  options: z.object({
    sync: z.boolean().optional(),
    stopOnFailure: z.boolean().optional(),
    parallelSteps: z.boolean().optional(),
  }).optional(),
});

// ============================================
// TOOL ENDPOINTS
// ============================================

/**
 * POST /api/tools
 * Register a new tool
 */
app.post('/api/tools', async (req: Request, res: Response) => {
  try {
    const validation = registerToolSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await registerTool(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool registration error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/tools
 * List all tools
 */
app.get('/api/tools', async (req: Request, res: Response) => {
  const { category } = req.query;
  const tools = await listTools(category as string | undefined);
  res.json({ success: true, tools });
});

/**
 * GET /api/tools/:toolId
 * Get a specific tool
 */
app.get('/api/tools/:toolId', async (req: Request, res: Response) => {
  const tool = await getTool(req.params.toolId);
  if (!tool) {
    return res.status(404).json({ success: false, error: 'Tool not found' });
  }
  res.json({ success: true, tool });
});

// ============================================
// ACTION ENDPOINTS
// ============================================

/**
 * POST /api/actions
 * Execute an action
 */
app.post('/api/actions', async (req: Request, res: Response) => {
  try {
    const validation = executeActionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await executeAction(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Action execution error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/actions/:actionId
 * Get action status/result
 */
app.get('/api/actions/:actionId', (req: Request, res: Response) => {
  const { actionId } = req.params;
  res.json({ success: true, actionId, status: 'unknown' });
});

// ============================================
// WORKFLOW ENDPOINTS
// ============================================

/**
 * POST /api/workflows
 * Create a new workflow
 */
app.post('/api/workflows', async (req: Request, res: Response) => {
  try {
    const validation = createWorkflowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await createWorkflow(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Workflow creation error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/workflows
 * List all workflows
 */
app.get('/api/workflows', async (_req: Request, res: Response) => {
  const workflows = await listWorkflows();
  res.json({ success: true, workflows });
});

/**
 * GET /api/workflows/:workflowId
 * Get a specific workflow
 */
app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  const workflow = await getWorkflow(req.params.workflowId);
  if (!workflow) {
    return res.status(404).json({ success: false, error: 'Workflow not found' });
  }
  res.json({ success: true, workflow });
});

/**
 * POST /api/workflows/:workflowId/execute
 * Execute a workflow
 */
app.post('/api/workflows/:workflowId/execute', async (req: Request, res: Response) => {
  try {
    const validation = executeWorkflowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    validation.data.workflowId = req.params.workflowId;
    const result = await executeWorkflow(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Workflow execution error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// PLAN ENDPOINTS
// ============================================

/**
 * POST /api/plans
 * Create a new plan
 */
app.post('/api/plans', async (req: Request, res: Response) => {
  try {
    const validation = createPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const result = await createPlan(validation.data);
    res.status(result.success ? 201 : 500).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plan creation error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/plans/:planId
 * Get a specific plan
 */
app.get('/api/plans/:planId', (req: Request, res: Response) => {
  const { planId } = req.params;
  res.json({ success: true, planId, plan: null });
});

/**
 * POST /api/plans/:planId/execute
 * Execute a plan
 */
app.post('/api/plans/:planId/execute', async (req: Request, res: Response) => {
  try {
    const validation = executePlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    validation.data.planId = req.params.planId;
    const result = await executePlan(validation.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plan execution error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// EXECUTION ENDPOINTS
// ============================================

/**
 * GET /api/executions
 * List all executions
 */
app.get('/api/executions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    executions: {
      actions: [],
      workflows: [],
      plans: [],
    },
  });
});

/**
 * GET /api/executions/:executionId
 * Get execution details
 */
app.get('/api/executions/:executionId', (req: Request, res: Response) => {
  const { executionId } = req.params;
  res.json({ success: true, executionId, execution: null });
});

/**
 * POST /api/executions/:executionId/cancel
 * Cancel an execution
 */
app.post('/api/executions/:executionId/cancel', (req: Request, res: Response) => {
  const { executionId } = req.params;
  res.json({ success: true, executionId, cancelled: true });
});

// ============================================
// CONTEXT ENDPOINTS
// ============================================

/**
 * GET /api/contexts/:contextId
 * Get execution context
 */
app.get('/api/contexts/:contextId', (req: Request, res: Response) => {
  const { contextId } = req.params;
  res.json({ success: true, contextId, context: null });
});

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

/**
 * GET /api/templates
 * List workflow templates
 */
app.get('/api/templates', (_req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'welcome_sequence',
        name: 'Welcome Sequence',
        description: 'Onboard new users with a series of welcome messages',
        steps: 5,
      },
      {
        id: 'engagement_loop',
        name: 'Engagement Loop',
        description: 'Re-engage dormant users',
        steps: 3,
      },
      {
        id: 'purchase_flow',
        name: 'Purchase Flow',
        description: 'Complete purchase workflow',
        steps: 8,
      },
    ],
  });
});

// ============================================
// STATS & HEALTH
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = getHealthStatus();
  res.json({ success: true, ...health });
});

/**
 * GET /api/stats
 * Get service statistics
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({ success: true, ...stats });
});

/**
 * GET /api/stats/actions
 * Get action statistics
 */
app.get('/api/stats/actions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byType: {},
    total: 0,
    avgExecutionTime: 0,
    successRate: 0,
  });
});

/**
 * GET /api/stats/workflows
 * Get workflow statistics
 */
app.get('/api/stats/workflows', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byStatus: {},
    total: 0,
    avgExecutionTime: 0,
  });
});

/**
 * GET /api/stats/plans
 * Get plan statistics
 */
app.get('/api/stats/plans', (_req: Request, res: Response) => {
  res.json({
    success: true,
    total: 0,
    avgSteps: 0,
    successRate: 0,
  });
});

// ============================================
// ROOT & DOCS
// ============================================

/**
 * GET /
 * Root endpoint with API info
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Action Orchestrator',
    version: '1.0.0',
    description: 'AI Action Engine - Autonomous execution orchestration',
    port: PORT,
    capabilities: {
      actions: ['query', 'calculation', 'decision', 'notification', 'workflow', 'external_api', 'database', 'transform'],
      workflows: ['create', 'execute', 'monitor', 'templates'],
      plans: ['create', 'execute', 'optimize'],
      tools: ['register', 'execute', 'list', 'search'],
    },
    endpoints: {
      tools: [
        'POST /api/tools - Register tool',
        'GET /api/tools - List tools',
        'GET /api/tools/:toolId - Get tool',
      ],
      actions: [
        'POST /api/actions - Execute action',
        'GET /api/actions/:actionId - Get action',
      ],
      workflows: [
        'POST /api/workflows - Create workflow',
        'GET /api/workflows - List workflows',
        'GET /api/workflows/:workflowId - Get workflow',
        'POST /api/workflows/:workflowId/execute - Execute workflow',
      ],
      plans: [
        'POST /api/plans - Create plan',
        'GET /api/plans/:planId - Get plan',
        'POST /api/plans/:planId/execute - Execute plan',
      ],
      executions: [
        'GET /api/executions - List executions',
        'GET /api/executions/:executionId - Get execution',
        'POST /api/executions/:executionId/cancel - Cancel execution',
      ],
      stats: [
        'GET /api/stats - Get stats',
        'GET /api/stats/actions - Get action stats',
        'GET /api/stats/workflows - Get workflow stats',
        'GET /api/stats/plans - Get plan stats',
      ],
      health: [
        'GET /api/health - Health check',
      ],
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Action Orchestrator started on port ${PORT}`);
});

export default app;

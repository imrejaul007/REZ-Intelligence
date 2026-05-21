/**
 * REZ Flow Runtime - Execution Routes
 * API endpoints for workflow execution management
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  CreateExecutionRequest,
  ListExecutionsQuery,
  ExecutionStatus,
  TriggerType,
  Execution
} from '../types/workflow';
import { Execution as ExecutionModel, Workflow } from '../models/Execution';
import { workflowExecutor } from '../services/workflowExecutor';
import { authenticateInternal } from '../middleware/auth';
import logger from '../services/logger';

const router = Router();

// Initialize Redis for BullMQ
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});
const executionQueue = new Queue('rez-flow-executions', { connection: redis });

// Validation schemas
const CreateExecutionSchema = z.object({
  workflowId: z.string().min(1),
  triggerType: z.nativeEnum(TriggerType),
  triggerData: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  variables: z.record(z.unknown()).optional()
});

const ListExecutionsSchema = z.object({
  workflowId: z.string().optional(),
  status: z.nativeEnum(ExecutionStatus).optional(),
  userId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'status', 'startedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

/**
 * POST /api/executions
 * Create a new workflow execution
 */
router.post('/', authenticateInternal, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = CreateExecutionSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.errors
        }
      });
      return;
    }

    const {
      workflowId,
      triggerType,
      triggerData = {},
      userId,
      sessionId,
      variables = {}
    } = validationResult.data as CreateExecutionRequest;

    // Find workflow
    const workflow = await Workflow.findOne({ workflowId, status: 'published' });
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found or not published: ${workflowId}`
        }
      });
      return;
    }

    // Create execution record
    const executionId = uuidv4();
    const execution = new ExecutionModel({
      workflowId: workflow._id,
      workflowVersion: workflow.version,
      status: ExecutionStatus.PENDING,
      triggerType,
      triggerData,
      context: {
        userId,
        sessionId,
        variables
      },
      nodeResults: [],
      executionPath: [],
      logs: [{
        id: uuidv4(),
        timestamp: new Date(),
        level: 'info',
        message: 'Execution created'
      }],
      stats: {
        totalNodes: workflow.nodes.length,
        completedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        totalRetries: 0
      },
      startedAt: new Date()
    });

    await execution.save();

    // Queue execution for async processing
    await executionQueue.add('execute', {
      executionId: execution._id.toString(),
      workflowId: workflow.workflowId,
      workflowDefinition: workflow.definition,
      context: {
        workflowId: workflow.workflowId,
        executionId: execution._id.toString(),
        triggerType,
        triggerData,
        userId,
        sessionId,
        variables: {
          ...variables,
          _workflowDefinition: workflow.definition
        },
        secrets: {},
        timestamp: new Date()
      }
    }, {
      jobId: `execution-${execution._id}`,
      removeOnComplete: false,
      removeOnFail: 3
    });

    logger.info('Execution created and queued', {
      executionId: execution._id.toString(),
      workflowId,
      triggerType
    });

    res.status(202).json({
      success: true,
      data: {
        executionId: execution._id.toString(),
        status: ExecutionStatus.PENDING,
        createdAt: execution.createdAt
      }
    });
  } catch (error) {
    logger.error('Failed to create execution', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create execution'
      }
    });
  }
});

/**
 * GET /api/executions/:id
 * Get execution status and details
 */
router.get('/:id', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const execution = await ExecutionModel.findById(id).populate('workflowId', 'name version');
    if (!execution) {
      res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `Execution not found: ${id}`
        }
      });
      return;
    }

    // Generate trace
    const trace = workflowExecutor.generateTrace(execution);

    res.json({
      success: true,
      data: {
        id: execution._id,
        workflowId: execution.workflowId,
        workflowVersion: execution.workflowVersion,
        status: execution.status,
        triggerType: execution.triggerType,
        triggerData: execution.triggerData,
        context: execution.context,
        nodeResults: execution.nodeResults,
        executionPath: execution.executionPath,
        trace,
        stats: execution.stats,
        error: execution.error,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to get execution', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve execution'
      }
    });
  }
});

/**
 * POST /api/executions/:id/cancel
 * Cancel a running execution
 */
router.post('/:id/cancel', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const execution = await ExecutionModel.findById(id);
    if (!execution) {
      res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `Execution not found: ${id}`
        }
      });
      return;
    }

    if (execution.status !== ExecutionStatus.RUNNING && execution.status !== ExecutionStatus.PENDING) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot cancel execution in state: ${execution.status}`
        }
      });
      return;
    }

    // Cancel in executor
    const cancelled = workflowExecutor.cancel(id);

    // Update database
    execution.markCancelled();
    await execution.save();

    logger.info('Execution cancelled', { executionId: id, cancelled });

    res.json({
      success: true,
      data: {
        executionId: id,
        status: ExecutionStatus.CANCELLED,
        cancelledAt: execution.cancelledAt
      }
    });
  } catch (error) {
    logger.error('Failed to cancel execution', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel execution'
      }
    });
  }
});

/**
 * POST /api/executions/:id/retry
 * Retry a failed execution from the beginning or from a specific node
 */
router.post('/:id/retry', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fromNodeId } = req.body as { fromNodeId?: string };

    const execution = await ExecutionModel.findById(id).populate('workflowId');
    if (!execution) {
      res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `Execution not found: ${id}`
        }
      });
      return;
    }

    if (execution.status !== ExecutionStatus.FAILED && execution.status !== ExecutionStatus.CANCELLED) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot retry execution in state: ${execution.status}`
        }
      });
      return;
    }

    // Get workflow definition
    const workflow = await Workflow.findOne({ workflowId: (execution.workflowId as unknown as { workflowId: string }).workflowId });
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Associated workflow not found'
        }
      });
      return;
    }

    // Create new execution record
    const newExecutionId = uuidv4();
    const newExecution = new ExecutionModel({
      workflowId: execution.workflowId,
      workflowVersion: workflow.version,
      status: ExecutionStatus.PENDING,
      triggerType: execution.triggerType,
      triggerData: execution.triggerData,
      context: {
        userId: execution.context.userId,
        sessionId: execution.context.sessionId,
        variables: execution.context.variables
      },
      nodeResults: [],
      executionPath: [],
      logs: [{
        id: uuidv4(),
        timestamp: new Date(),
        level: 'info',
        message: `Retry of execution ${id}${fromNodeId ? ` from node ${fromNodeId}` : ''}`
      }],
      stats: {
        totalNodes: workflow.nodes.length,
        completedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        totalRetries: 0
      },
      startedAt: new Date()
    });

    await newExecution.save();

    // Queue retry execution
    await executionQueue.add('retry', {
      executionId: newExecution._id.toString(),
      workflowId: workflow.workflowId,
      workflowDefinition: workflow.definition,
      context: {
        workflowId: workflow.workflowId,
        executionId: newExecution._id.toString(),
        triggerType: execution.triggerType,
        triggerData: execution.triggerData,
        userId: execution.context.userId,
        sessionId: execution.context.sessionId,
        variables: {
          ...execution.context.variables,
          _workflowDefinition: workflow.definition,
          _retryFromNodeId: fromNodeId,
          _originalExecutionId: id
        },
        secrets: {},
        timestamp: new Date()
      }
    }, {
      jobId: `retry-${newExecution._id}`,
      removeOnComplete: false,
      removeOnFail: 3
    });

    logger.info('Execution retry queued', {
      originalExecutionId: id,
      newExecutionId: newExecution._id.toString(),
      fromNodeId
    });

    res.status(202).json({
      success: true,
      data: {
        executionId: newExecution._id.toString(),
        originalExecutionId: id,
        status: ExecutionStatus.PENDING,
        createdAt: newExecution.createdAt
      }
    });
  } catch (error) {
    logger.error('Failed to retry execution', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retry execution'
      }
    });
  }
});

/**
 * GET /api/executions
 * List executions with filtering and pagination
 */
router.get('/', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const validationResult = ListExecutionsSchema.safeParse(req.query);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: validationResult.error.errors
        }
      });
      return;
    }

    const {
      workflowId,
      status,
      userId,
      fromDate,
      toDate,
      page,
      limit,
      sortBy,
      sortOrder
    } = validationResult.data as ListExecutionsQuery;

    // Build query
    const query: Record<string, unknown> = {};

    if (workflowId) {
      query.workflowId = workflowId;
    }
    if (status) {
      query.status = status;
    }
    if (userId) {
      query['context.userId'] = userId;
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        (query.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (query.createdAt as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    // Execute query
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      ExecutionModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ExecutionModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        executions: executions.map(e => ({
          id: e._id,
          workflowId: e.workflowId,
          workflowVersion: e.workflowVersion,
          status: e.status,
          triggerType: e.triggerType,
          context: e.context,
          stats: e.stats,
          error: e.error,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Failed to list executions', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list executions'
      }
    });
  }
});

/**
 * GET /api/executions/:id/logs
 * Get execution logs
 */
router.get('/:id/logs', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { level, since } = req.query;

    const execution = await ExecutionModel.findById(id);
    if (!execution) {
      res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `Execution not found: ${id}`
        }
      });
      return;
    }

    let logs = execution.logs;

    // Filter by level
    if (level && typeof level === 'string') {
      logs = logs.filter(l => l.level === level);
    }

    // Filter by timestamp
    if (since && typeof since === 'string') {
      const sinceDate = new Date(since);
      logs = logs.filter(l => l.timestamp >= sinceDate);
    }

    res.json({
      success: true,
      data: {
        executionId: id,
        logs,
        total: logs.length
      }
    });
  } catch (error) {
    logger.error('Failed to get execution logs', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve execution logs'
      }
    });
  }
});

/**
 * GET /api/executions/stats
 * Get execution statistics
 */
router.get('/stats/summary', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.query;

    const stats = await ExecutionModel.getStats(workflowId as string | undefined);

    res.json({
      success: true,
      data: {
        stats,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get execution stats', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve statistics'
      }
    });
  }
});

export default router;

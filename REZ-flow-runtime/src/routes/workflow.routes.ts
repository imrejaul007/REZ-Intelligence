/**
 * REZ Flow Runtime - Workflow Routes
 * API endpoints for workflow registration and management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  WorkflowDefinition,
  WorkflowStatus
} from '../types/workflow';
import { Workflow } from '../models/Execution';
import { authenticateInternal, authenticateApiKey } from '../middleware/auth';
import logger from '../services/logger';

const router = Router();

// Validation schemas
const RegisterWorkflowSchema = z.object({
  workflow: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    version: z.number().min(1).default(1),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    nodes: z.array(z.any()).min(1),
    edges: z.array(z.any()).default([]),
    entryNodeId: z.string().min(1),
    variables: z.record(z.unknown()).optional(),
    metadata: z.object({
      createdBy: z.string().optional(),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional()
    }).optional()
  }),
  apiKey: z.string().optional()
});

const PublishWorkflowSchema = z.object({
  version: z.number().min(1).optional()
});

/**
 * POST /api/workflows/register
 * Register a workflow from the workflow builder
 */
router.post('/register', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = RegisterWorkflowSchema.safeParse(req.body);
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

    const { workflow } = validationResult.data as { workflow: WorkflowDefinition };

    // Check if workflow already exists
    let existingWorkflow = await Workflow.findOne({ workflowId: workflow.id });

    if (existingWorkflow) {
      // Update existing workflow
      existingWorkflow.name = workflow.name;
      existingWorkflow.description = workflow.description;
      existingWorkflow.definition = workflow as unknown as Record<string, unknown>;
      existingWorkflow.nodes = workflow.nodes as unknown as Record<string, unknown>[];
      existingWorkflow.edges = workflow.edges as unknown as Record<string, unknown>[];
      existingWorkflow.entryNodeId = workflow.entryNodeId;
      existingWorkflow.variables = workflow.variables as Record<string, unknown>;
      existingWorkflow.metadata = workflow.metadata as Record<string, unknown>;

      await existingWorkflow.save();

      logger.info('Workflow updated', { workflowId: workflow.id });

      res.json({
        success: true,
        data: {
          workflowId: existingWorkflow.workflowId,
          version: existingWorkflow.version,
          status: existingWorkflow.status,
          updatedAt: existingWorkflow.updatedAt
        },
        message: 'Workflow updated successfully'
      });
    } else {
      // Create new workflow
      const newWorkflow = new Workflow({
        workflowId: workflow.id,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        status: workflow.status === 'published' ? 'draft' : workflow.status,
        definition: workflow,
        nodes: workflow.nodes,
        edges: workflow.edges,
        entryNodeId: workflow.entryNodeId,
        variables: workflow.variables,
        metadata: {
          createdBy: workflow.metadata?.createdBy,
          tags: workflow.metadata?.tags,
          category: workflow.metadata?.category
        }
      });

      await newWorkflow.save();

      logger.info('Workflow registered', { workflowId: workflow.id });

      res.status(201).json({
        success: true,
        data: {
          workflowId: newWorkflow.workflowId,
          version: newWorkflow.version,
          status: newWorkflow.status,
          createdAt: newWorkflow.createdAt
        },
        message: 'Workflow registered successfully'
      });
    }
  } catch (error) {
    logger.error('Failed to register workflow', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register workflow'
      }
    });
  }
});

/**
 * GET /api/workflows/:id
 * Get workflow details
 */
router.get('/:id', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { version, includeDefinition } = req.query;

    const query: Record<string, unknown> = { workflowId: id };
    if (version) {
      query.version = parseInt(version as string, 10);
    }

    const workflow = await Workflow.findOne(query);

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${id}`
        }
      });
      return;
    }

    const response: Record<string, unknown> = {
      workflowId: workflow.workflowId,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      status: workflow.status,
      entryNodeId: workflow.entryNodeId,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
      metadata: workflow.metadata,
      publishedAt: workflow.publishedAt,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };

    if (includeDefinition === 'true') {
      response.definition = workflow.definition;
      response.nodes = workflow.nodes;
      response.edges = workflow.edges;
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Failed to get workflow', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve workflow'
      }
    });
  }
});

/**
 * POST /api/workflows/:id/publish
 * Publish a workflow (make it available for execution)
 */
router.post('/:id/publish', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const validationResult = PublishWorkflowSchema.safeParse(req.body);
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

    const { id } = req.params;
    const { version } = validationResult.data;

    const workflow = await Workflow.findOne({ workflowId: id });

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${id}`
        }
      });
      return;
    }

    if (workflow.status === 'archived') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Cannot publish an archived workflow'
        }
      });
      return;
    }

    // Publish workflow
    const updatedWorkflow = await Workflow.publish(id);

    logger.info('Workflow published', { workflowId: id, version: updatedWorkflow.version });

    res.json({
      success: true,
      data: {
        workflowId: updatedWorkflow.workflowId,
        version: updatedWorkflow.version,
        status: updatedWorkflow.status,
        publishedAt: updatedWorkflow.publishedAt
      },
      message: 'Workflow published successfully'
    });
  } catch (error) {
    logger.error('Failed to publish workflow', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to publish workflow'
      }
    });
  }
});

/**
 * POST /api/workflows/:id/archive
 * Archive a workflow
 */
router.post('/:id/archive', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await Workflow.findOne({ workflowId: id });

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${id}`
        }
      });
      return;
    }

    if (workflow.status === 'archived') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Workflow is already archived'
        }
      });
      return;
    }

    workflow.status = 'archived';
    await workflow.save();

    logger.info('Workflow archived', { workflowId: id });

    res.json({
      success: true,
      data: {
        workflowId: workflow.workflowId,
        status: workflow.status,
        archivedAt: workflow.updatedAt
      },
      message: 'Workflow archived successfully'
    });
  } catch (error) {
    logger.error('Failed to archive workflow', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to archive workflow'
      }
    });
  }
});

/**
 * GET /api/workflows
 * List workflows with filtering
 */
router.get('/', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const {
      status,
      category,
      tag,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build query
    const query: Record<string, unknown> = {};

    if (status) {
      query.status = status;
    }
    if (category) {
      query['metadata.category'] = category;
    }
    if (tag) {
      query['metadata.tags'] = tag;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sort: Record<string, 1 | -1> = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const [workflows, total] = await Promise.all([
      Workflow.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-definition -nodes -edges')
        .lean(),
      Workflow.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        workflows: workflows.map(w => ({
          workflowId: w.workflowId,
          name: w.name,
          description: w.description,
          version: w.version,
          status: w.status,
          nodeCount: (w.nodes as unknown[])?.length || 0,
          edgeCount: (w.edges as unknown[])?.length || 0,
          metadata: w.metadata,
          publishedAt: w.publishedAt,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to list workflows', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list workflows'
      }
    });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow (soft delete - archives instead)
 */
router.delete('/:id', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const workflow = await Workflow.findOne({ workflowId: id });

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${id}`
        }
      });
      return;
    }

    if (force === 'true') {
      // Hard delete
      await Workflow.deleteOne({ workflowId: id });
      logger.info('Workflow deleted permanently', { workflowId: id });

      res.json({
        success: true,
        data: { workflowId: id },
        message: 'Workflow deleted permanently'
      });
    } else {
      // Soft delete (archive)
      workflow.status = 'archived';
      await workflow.save();
      logger.info('Workflow archived', { workflowId: id });

      res.json({
        success: true,
        data: {
          workflowId: workflow.workflowId,
          status: workflow.status
        },
        message: 'Workflow archived (use ?force=true to delete permanently)'
      });
    }
  } catch (error) {
    logger.error('Failed to delete workflow', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete workflow'
      }
    });
  }
});

/**
 * GET /api/workflows/:id/versions
 * Get all versions of a workflow
 */
router.get('/:id/versions', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await Workflow.find({ workflowId: id })
      .select('version status publishedAt createdAt updatedAt')
      .sort({ version: -1 })
      .lean();

    if (versions.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${id}`
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        workflowId: id,
        versions: versions.map(v => ({
          version: v.version,
          status: v.status,
          publishedAt: v.publishedAt,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get workflow versions', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve workflow versions'
      }
    });
  }
});

/**
 * POST /api/workflows/:id/validate
 * Validate a workflow definition
 */
router.post('/:id/validate', authenticateInternal, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { definition } = req.body;

    // Use the definition from request or fetch from database
    let workflowDefinition = definition;

    if (!workflowDefinition) {
      const workflow = await Workflow.findOne({ workflowId: id });
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: {
            code: 'WORKFLOW_NOT_FOUND',
            message: `Workflow not found: ${id}`
          }
        });
        return;
      }
      workflowDefinition = workflow.definition;
    }

    // Validate workflow structure
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workflowDefinition.nodes || workflowDefinition.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    if (!workflowDefinition.entryNodeId) {
      errors.push('Workflow must have an entry node ID');
    }

    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    for (const node of workflowDefinition.nodes || []) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Check entry node exists
    if (workflowDefinition.entryNodeId && !nodeIds.has(workflowDefinition.entryNodeId)) {
      errors.push(`Entry node not found: ${workflowDefinition.entryNodeId}`);
    }

    // Check for orphan nodes (not reachable from entry)
    const reachableNodes = new Set<string>([workflowDefinition.entryNodeId]);
    for (const edge of workflowDefinition.edges || []) {
      if (reachableNodes.has(edge.source)) {
        reachableNodes.add(edge.target);
      }
    }

    for (const nodeId of nodeIds) {
      if (!reachableNodes.has(nodeId)) {
        warnings.push(`Unreachable node: ${nodeId}`);
      }
    }

    // Check for missing edge targets
    for (const edge of workflowDefinition.edges || []) {
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge references missing node: ${edge.target}`);
      }
    }

    const isValid = errors.length === 0;

    res.json({
      success: true,
      data: {
        workflowId: id,
        isValid,
        errors,
        warnings,
        nodeCount: workflowDefinition.nodes?.length || 0,
        edgeCount: workflowDefinition.edges?.length || 0
      }
    });
  } catch (error) {
    logger.error('Failed to validate workflow', { id: req.params.id, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate workflow'
      }
    });
  }
});

export default router;

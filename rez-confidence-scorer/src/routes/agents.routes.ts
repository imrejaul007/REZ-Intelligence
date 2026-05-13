import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AgentMetrics } from '../models/AgentMetrics';
import { historyTrackerService } from '../services/historyTracker';
import { loadBalancerService } from '../services/loadBalancer';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
} from '../middleware/errorHandler';
import { AgentStatus } from '../types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/agents
 *
 * Register a new agent
 */
const RegisterAgentSchema = z.object({
  agentId: z.string().min(1),
  capabilities: z.object({
    domains: z.array(z.string()).default([]),
    maxConcurrentTasks: z.number().min(1).default(10),
    specializations: z.array(z.string()).default([]),
    supportedLanguages: z.array(z.string()).default(['en']),
    version: z.string().default('1.0.0'),
  }),
  loadMetrics: z
    .object({
      currentLoad: z.number().min(0).default(0),
      maxLoad: z.number().min(1).default(100),
      queueDepth: z.number().min(0).default(0),
      averageResponseTimeMs: z.number().min(0).default(0),
      successRate: z.number().min(0).max(1).default(1),
    })
    .optional(),
});

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = RegisterAgentSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.errors
      );
    }

    const { agentId, capabilities, loadMetrics } = validationResult.data;

    // Check if agent already exists
    const existing = await AgentMetrics.findOne({ agentId }).exec();
    if (existing) {
      throw new ValidationError(`Agent ${agentId} already exists`);
    }

    // Create new agent
    const agent = new AgentMetrics({
      agentId,
      status: AgentStatus.ACTIVE,
      capabilities,
      loadMetrics: loadMetrics || {
        currentLoad: 0,
        maxLoad: 100,
        queueDepth: 0,
        averageResponseTimeMs: 0,
        successRate: 1,
      },
      performance: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageConfidenceScore: 0,
        lastTaskTimestamp: null,
      },
    });

    await agent.save();

    logger.info('Agent registered', { agentId });

    res.status(201).json({
      success: true,
      data: agent.toJSON(),
    });
  })
);

/**
 * GET /api/v1/agents
 *
 * List all agents with optional filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const status = req.query.status as AgentStatus | undefined;
    const domain = req.query.domain as string | undefined;
    const availableOnly = req.query.available === 'true';

    let query: Record<string, unknown> = {};

    if (status) {
      query.status = status;
    }

    if (domain) {
      query['capabilities.domains'] = domain;
    }

    const agents = await AgentMetrics.find(query)
      .lean()
      .exec();

    let filteredAgents = agents;

    if (availableOnly) {
      filteredAgents = agents.filter((agent) => {
        const availableCapacity =
          agent.loadMetrics.maxLoad - agent.loadMetrics.currentLoad;
        return (
          agent.status === AgentStatus.ACTIVE &&
          availableCapacity > 0
        );
      });
    }

    res.status(200).json({
      success: true,
      data: filteredAgents,
      meta: {
        total: filteredAgents.length,
        filters: {
          status,
          domain,
          availableOnly,
        },
      },
    });
  })
);

/**
 * GET /api/v1/agents/:agentId
 *
 * Get agent details
 */
router.get(
  '/:agentId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const agent = await AgentMetrics.findOne({ agentId }).lean().exec();
    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    res.status(200).json({
      success: true,
      data: agent,
    });
  })
);

/**
 * PUT /api/v1/agents/:agentId
 *
 * Update agent
 */
const UpdateAgentSchema = z.object({
  status: z.nativeEnum(AgentStatus).optional(),
  capabilities: z
    .object({
      domains: z.array(z.string()).optional(),
      maxConcurrentTasks: z.number().min(1).optional(),
      specializations: z.array(z.string()).optional(),
      supportedLanguages: z.array(z.string()).optional(),
      version: z.string().optional(),
    })
    .optional(),
  loadMetrics: z
    .object({
      currentLoad: z.number().min(0).optional(),
      maxLoad: z.number().min(1).optional(),
      queueDepth: z.number().min(0).optional(),
      averageResponseTimeMs: z.number().min(0).optional(),
      successRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

router.put(
  '/:agentId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const agent = await AgentMetrics.findOne({ agentId }).exec();
    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    const validationResult = UpdateAgentSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.errors
      );
    }

    const updates = validationResult.data;

    // Apply updates
    if (updates.status) {
      agent.status = updates.status;
    }

    if (updates.capabilities) {
      agent.capabilities = {
        ...agent.capabilities.toObject(),
        ...updates.capabilities,
      };
    }

    if (updates.loadMetrics) {
      agent.loadMetrics = {
        ...agent.loadMetrics.toObject(),
        ...updates.loadMetrics,
      };
    }

    await agent.save();

    logger.info('Agent updated', { agentId });

    res.status(200).json({
      success: true,
      data: agent.toJSON(),
    });
  })
);

/**
 * DELETE /api/v1/agents/:agentId
 *
 * Remove agent (soft delete by setting inactive)
 */
router.delete(
  '/:agentId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const agent = await AgentMetrics.findOne({ agentId }).exec();
    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    // Soft delete - set to inactive
    agent.status = AgentStatus.INACTIVE;
    await agent.save();

    logger.info('Agent deactivated', { agentId });

    res.status(200).json({
      success: true,
      message: `Agent ${agentId} has been deactivated`,
    });
  })
);

/**
 * POST /api/v1/agents/:agentId/load
 *
 * Update agent load metrics
 */
const UpdateLoadSchema = z.object({
  currentLoad: z.number().min(0).optional(),
  queueDepth: z.number().min(0).optional(),
  incrementLoad: z.number().optional(),
  decrementLoad: z.number().optional(),
});

router.post(
  '/:agentId/load',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const agent = await AgentMetrics.findOne({ agentId }).exec();
    if (!agent) {
      throw new NotFoundError('Agent', agentId);
    }

    const validationResult = UpdateLoadSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.errors
      );
    }

    const { currentLoad, queueDepth, incrementLoad, decrementLoad } =
      validationResult.data;

    // Update load
    if (currentLoad !== undefined) {
      agent.loadMetrics.currentLoad = currentLoad;
    }

    if (queueDepth !== undefined) {
      agent.loadMetrics.queueDepth = queueDepth;
    }

    if (incrementLoad !== undefined) {
      agent.loadMetrics.currentLoad = Math.min(
        agent.loadMetrics.currentLoad + incrementLoad,
        agent.loadMetrics.maxLoad
      );
    }

    if (decrementLoad !== undefined) {
      agent.loadMetrics.currentLoad = Math.max(
        agent.loadMetrics.currentLoad - decrementLoad,
        0
      );
    }

    await agent.save();

    res.status(200).json({
      success: true,
      data: {
        agentId,
        loadMetrics: agent.loadMetrics.toObject(),
      },
    });
  })
);

/**
 * GET /api/v1/agents/:agentId/performance
 *
 * Get agent performance summary
 */
router.get(
  '/:agentId/performance',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const summary = await historyTrackerService.getPerformanceSummary(agentId);

    if (!summary) {
      throw new NotFoundError('Agent', agentId);
    }

    res.status(200).json({
      success: true,
      data: {
        agentId,
        ...summary,
      },
    });
  })
);

/**
 * GET /api/v1/agents/:agentId/load-factor
 *
 * Get agent load factor score
 */
router.get(
  '/:agentId/load-factor',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;

    const loadFactor = await loadBalancerService.calculateLoadFactor(agentId);

    res.status(200).json({
      success: true,
      data: {
        agentId,
        ...loadFactor,
      },
    });
  })
);

/**
 * GET /api/v1/agents/distribution/load
 *
 * Get load distribution across all agents
 */
router.get(
  '/distribution/load',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentIds = req.query.agentIds
      ? (req.query.agentIds as string).split(',')
      : undefined;

    const distribution = await loadBalancerService.getLoadDistribution(agentIds);

    res.status(200).json({
      success: true,
      data: distribution,
    });
  })
);

/**
 * GET /api/v1/agents/:agentId/availability
 *
 * Check agent availability
 */
router.get(
  '/:agentId/availability',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const requiredCapacity = parseInt(req.query.capacity as string) || 1;

    const isAvailable = await loadBalancerService.isAgentAvailable(
      agentId,
      requiredCapacity
    );

    res.status(200).json({
      success: true,
      data: {
        agentId,
        available: isAvailable,
        requiredCapacity,
      },
    });
  })
);

export default router;

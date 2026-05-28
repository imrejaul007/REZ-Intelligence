import { Router, Request, Response, NextFunction } from 'express';
import { priorityResolver } from '../services/priorityResolver';
import { ruleEngine } from '../services/ruleEngine';
import { intentClassifier } from '../services/intentClassifier';
import {
  internalServiceAuth,
  validateBody,
  validateQuery,
  PriorityRequestSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  PaginationSchema,
  AuthenticatedRequest,
} from '../middleware';
import { PriorityRule, PriorityTier, PriorityTierNames, PriorityTierValue } from '../models';
import { RoutingDecision, DecisionStatus } from '../models';
import { PRIORITY_MATRIX } from '../rules/priorityMatrix';
import { logger } from '../utils/logger.js';

const router = Router();

router.post(
  '/resolve',
  internalServiceAuth,
  validateBody(PriorityRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const result = await priorityResolver.resolve(req.body);

      const duration = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          processingTimeMs: duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/decision/:requestId',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'requestId is required',
        });
        return;
      }

      const decision = await priorityResolver.getDecision(requestId);

      if (!decision) {
        res.status(404).json({
          error: 'Not Found',
          message: `Decision with requestId ${requestId} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: decision,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/decisions',
  internalServiceAuth,
  validateQuery(PaginationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as {
        page: number;
        limit: number;
        sortBy?: string;
        sortOrder: 'asc' | 'desc';
      };
      const { page, limit, sortBy, sortOrder } = query;

      const skip = (page - 1) * limit;
      const sort: Record<string, 1 | -1> = { [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1 };

      const [decisions, total] = await Promise.all([
        RoutingDecision.find()
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        RoutingDecision.countDocuments(),
      ]);

      res.status(200).json({
        success: true,
        data: decisions,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/decisions/by-tier/:tier',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tier = parseInt(req.params.tier, 10);

      if (isNaN(tier) || tier < 1 || tier > 7) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Tier must be a number between 1 and 7',
        });
        return;
      }

      const decisions = await priorityResolver.getDecisionsByTier(tier as PriorityTierValue);

      res.status(200).json({
        success: true,
        data: decisions,
        meta: {
          tier,
          tierName: PriorityTierNames[tier as PriorityTierValue],
          count: decisions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/rules',
  internalServiceAuth,
  validateBody(CreateRuleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = await ruleEngine.createRule(req.body);
      const authReq = req as AuthenticatedRequest;

      logger.info('Rule created via API', {
        ruleId: rule._id,
        name: rule.name,
        serviceId: authReq.serviceId,
      });

      res.status(201).json({
        success: true,
        data: rule,
        message: 'Rule created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rules',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domain, enabled, type } = req.query;

      const query: Record<string, unknown> = {};
      if (domain) query.domain = domain;
      if (enabled !== undefined) query.enabled = enabled === 'true';
      if (type) query.ruleType = type;

      const rules = await PriorityRule.find(query)
        .sort({ priorityTier: 1, name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: rules,
        meta: {
          count: rules.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rules/:id',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = await PriorityRule.findById(req.params.id);

      if (!rule) {
        res.status(404).json({
          error: 'Not Found',
          message: `Rule with id ${req.params.id} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: rule,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/rules/:id',
  internalServiceAuth,
  validateBody(UpdateRuleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = await ruleEngine.updateRule(req.params.id, req.body);
      const authReq = req as AuthenticatedRequest;

      if (!rule) {
        res.status(404).json({
          error: 'Not Found',
          message: `Rule with id ${req.params.id} not found`,
        });
        return;
      }

      logger.info('Rule updated via API', {
        ruleId: rule._id,
        name: rule.name,
        serviceId: authReq.serviceId,
      });

      res.status(200).json({
        success: true,
        data: rule,
        message: 'Rule updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/rules/:id',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await ruleEngine.deleteRule(req.params.id);
      const authReq = req as AuthenticatedRequest;

      if (!deleted) {
        res.status(404).json({
          error: 'Not Found',
          message: `Rule with id ${req.params.id} not found`,
        });
        return;
      }

      logger.info('Rule deleted via API', {
        ruleId: req.params.id,
        serviceId: authReq.serviceId,
      });

      res.status(200).json({
        success: true,
        message: 'Rule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/matrix',
  internalServiceAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const matrix = Object.values(PRIORITY_MATRIX).map((entry) => ({
      tier: entry.tier,
      name: entry.name,
      scoreRange: entry.scoreRange,
      description: entry.description,
      responseTimeSla: entry.responseTimeSla,
      escalationPolicy: entry.escalationPolicy,
      routingConfig: entry.routingConfig,
    }));

    res.status(200).json({
      success: true,
      data: matrix,
    });
  }
);

router.get(
  '/classify',
  internalServiceAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { intent, context } = req.query;

      if (!intent || typeof intent !== 'string') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'intent query parameter is required',
        });
        return;
      }

      const parsedContext = context ? JSON.parse(context as string) : undefined;
      const classification = intentClassifier.classify(intent, parsedContext);

      res.status(200).json({
        success: true,
        data: classification,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cache/clear',
  internalServiceAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    intentClassifier.clearCache();
    ruleEngine.invalidateCache();

    logger.info('Cache cleared via API', {
      serviceId: req.serviceId,
    });

    res.status(200).json({
      success: true,
      message: 'Cache cleared successfully',
      meta: {
        classifierCacheSize: intentClassifier.getCacheSize(),
      },
    });
  }
);

router.get(
  '/health',
  async (req: Request, res: Response): Promise<void> => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'priority-engine',
      version: '1.0.0',
      uptime: process.uptime(),
      cacheSize: intentClassifier.getCacheSize(),
    };

    res.status(200).json(health);
  }
);

router.get(
  '/ready',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await PriorityRule.findOne().exec();

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          mongodb: 'connected',
        },
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          mongodb: 'disconnected',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;

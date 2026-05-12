import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Registry, ExpertInfo, ExpertCapability } from '../services/registry';
import { HealthMonitor } from '../services/healthMonitor';
import { logger } from '../services/logger';

// Validation schemas
const registerExpertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  version: z.string().default('1.0.0'),
  capabilities: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    parameters: z.record(z.object({
      type: z.string(),
      required: z.boolean(),
      default: z.unknown().optional(),
    })).optional(),
  })),
  endpoints: z.object({
    health: z.string().url(),
    process: z.string().url(),
    metadata: z.string().url().optional(),
  }),
  metadata: z.object({
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    industries: z.array(z.string()).optional(),
  }).optional(),
  ttlSeconds: z.number().min(60).max(86400).default(300),
});

const updateHeartbeatSchema = z.object({
  metrics: z.object({
    requestsHandled: z.number().optional(),
    avgResponseTimeMs: z.number().optional(),
    successRate: z.number().min(0).max(1).optional(),
    uptimeSeconds: z.number().optional(),
  }).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'draining']),
  error: z.string().optional(),
});

export interface RegistryRoutesConfig {
  registry: Registry;
  healthMonitor: HealthMonitor;
}

export function createRegistryRoutes(config: RegistryRoutesConfig): Router {
  const router = Router();
  const { registry, healthMonitor } = config;

  /**
   * Health check
   * GET /registry/health
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await registry.healthCheck();
      const overallHealth = await healthMonitor.getOverallHealth();
      const monitorStatus = healthMonitor.getStatus();

      res.json({
        status: health.healthy ? 'healthy' : 'degraded',
        registry: health.details,
        overall: overallHealth,
        monitor: monitorStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get all registered experts
   * GET /registry/experts
   */
  router.get('/experts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status, category } = req.query;

      const experts = await registry.getAllExperts({
        type: type as string,
        status: status as ExpertInfo['status'],
        category: category as string,
      });

      res.json({
        success: true,
        count: experts.length,
        experts,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get expert by ID
   * GET /registry/experts/:id
   */
  router.get('/experts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expert = await registry.getExpert(req.params.id);

      if (!expert) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Expert not found' },
        });
        return;
      }

      res.json({
        success: true,
        expert,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Register a new expert
   * POST /registry/experts
   */
  router.post('/experts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = registerExpertSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.errors,
          },
        });
        return;
      }

      const expert = await registry.registerExpert({
        ...validation.data,
        status: 'active',
        health: {
          healthy: true,
          lastChecked: new Date().toISOString(),
        },
        metrics: {
          requestsHandled: 0,
          avgResponseTimeMs: 0,
          successRate: 1.0,
          lastUsed: new Date().toISOString(),
          uptimeSeconds: 0,
        },
      });

      logger.info('Expert registered via API', { expertId: expert.id, name: expert.name });

      res.status(201).json({
        success: true,
        expert,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Unregister an expert
   * DELETE /registry/experts/:id
   */
  router.delete('/experts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const success = await registry.unregisterExpert(req.params.id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Expert not found' },
        });
        return;
      }

      logger.info('Expert unregistered via API', { expertId: req.params.id });

      res.json({
        success: true,
        message: 'Expert unregistered successfully',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update expert heartbeat
   * POST /registry/experts/:id/heartbeat
   */
  router.post('/experts/:id/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = updateHeartbeatSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.errors,
          },
        });
        return;
      }

      const success = await registry.updateHeartbeat(
        req.params.id,
        validation.data.metrics
      );

      if (!success) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Expert not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Heartbeat updated',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update expert status
   * PATCH /registry/experts/:id/status
   */
  router.patch('/experts/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = updateStatusSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.errors,
          },
        });
        return;
      }

      const success = await registry.updateExpertStatus(
        req.params.id,
        validation.data.status,
        validation.data.error
      );

      if (!success) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Expert not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Status updated',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get experts by capability
   * GET /registry/capabilities/:name/experts
   */
  router.get('/capabilities/:name/experts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experts = await registry.getExpertsByCapability(req.params.name);

      res.json({
        success: true,
        capability: req.params.name,
        count: experts.length,
        experts,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Find best expert for a task
   * POST /registry/find
   */
  router.post('/find', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { capability, minSuccessRate, maxResponseTimeMs } = req.body;

      if (!capability) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'capability is required' },
        });
        return;
      }

      const expert = await registry.findBestExpert(capability, {
        minSuccessRate,
        maxResponseTimeMs,
      });

      if (!expert) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No suitable expert found' },
        });
        return;
      }

      res.json({
        success: true,
        expert,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get registry statistics
   * GET /registry/stats
   */
  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await registry.getStatistics();
      const healthStatus = await healthMonitor.getOverallHealth();

      res.json({
        success: true,
        registry: stats,
        health: healthStatus,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Trigger health check for specific expert
   * POST /registry/experts/:id/check
   */
  router.post('/experts/:id/check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await healthMonitor.checkExpertById(req.params.id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Expert not found' },
        });
        return;
      }

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get health history for expert
   * GET /registry/experts/:id/health
   */
  router.get('/experts/:id/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = healthMonitor.getHealthHistory(req.params.id, limit);

      res.json({
        success: true,
        expertId: req.params.id,
        count: history.length,
        history,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get overall health status
   * GET /registry/health/overall
   */
  router.get('/health/overall', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await healthMonitor.getOverallHealth();

      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Trigger full health check cycle
   * POST /registry/health/check
   */
  router.post('/health/check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await healthMonitor.checkAllExperts();

      const healthyCount = results.filter(r => r.healthy).length;

      res.json({
        success: true,
        total: results.length,
        healthy: healthyCount,
        unhealthy: results.length - healthyCount,
        results,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

import { Router, Request, Response, NextFunction } from 'express';
import { AgentRegistry, AgentInfo } from '../services/agentRegistry';
import { ExpertSelector } from '../services/expertSelector';
import { AgentSwitcher } from '../services/agentSwitcher';
import { logger } from '../utils/logger';

const router = Router();

export interface RoutingRoutesConfig {
  agentRegistry: AgentRegistry;
  expertSelector: ExpertSelector;
  agentSwitcher: AgentSwitcher;
}

export function createRoutingRoutes(config: RoutingRoutesConfig): Router {
  const { agentRegistry, expertSelector, agentSwitcher } = config;

  /**
   * GET /api/v2/routing/agents
   * List all registered agents
   */
  router.get('/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, capability } = req.query;

      let agents = await agentRegistry.getAllAgents();

      // Filter by status
      if (status) {
        agents = agents.filter(a => a.status === status);
      }

      // Filter by capability
      if (capability) {
        agents = agents.filter(a =>
          a.capabilities.includes(capability as string)
        );
      }

      res.json({
        count: agents.length,
        agents: agents.map(agent => ({
          agentId: agent.agentId,
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          status: agent.status,
          health: {
            isHealthy: agent.health.isHealthy,
            successRate: agent.health.successRate,
            averageResponseTimeMs: agent.metrics.averageResponseTimeMs,
          },
          metrics: {
            totalRequests: agent.metrics.totalRequests,
            successRate: agent.health.successRate,
          },
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/routing/agents/:agentId
   * Get details for a specific agent
   */
  router.get('/agents/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;

      const agent = await agentRegistry.getAgent(agentId);

      if (!agent) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Agent ${agentId} not found`,
        });
      }

      res.json({
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        status: agent.status,
        version: agent.version,
        health: agent.health,
        metrics: agent.metrics,
        registeredAt: agent.registeredAt,
        updatedAt: agent.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v2/routing/agents
   * Register a new agent
   */
  router.post('/agents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = req.body;

      if (!registration.name || !registration.endpoint) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'name and endpoint are required',
        });
      }

      const agent = await agentRegistry.register({
        name: registration.name,
        description: registration.description || '',
        capabilities: registration.capabilities || ['natural_language'],
        endpoint: registration.endpoint,
        version: registration.version,
        metadata: registration.metadata,
      });

      logger.info('Agent registered via API', {
        agentId: agent.agentId,
        name: agent.name,
      });

      res.status(201).json({
        success: true,
        agent: {
          agentId: agent.agentId,
          name: agent.name,
          endpoint: agent.endpoint,
          capabilities: agent.capabilities,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/v2/routing/agents/:agentId
   * Unregister an agent
   */
  router.delete('/agents/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;

      const success = await agentRegistry.unregister(agentId);

      if (!success) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Agent ${agentId} not found`,
        });
      }

      logger.info('Agent unregistered via API', { agentId });

      res.json({
        success: true,
        agentId,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v2/routing/agents/:agentId/status
   * Update agent status
   */
  router.post('/agents/:agentId/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const { status } = req.body;

      const validStatuses = ['idle', 'busy', 'unavailable', 'error', 'maintenance'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      const agent = await agentRegistry.updateAgentStatus(agentId, status);

      if (!agent) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Agent ${agentId} not found`,
        });
      }

      res.json({
        success: true,
        agentId,
        status: agent.status,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/routing/agents/:agentId/health
   * Get agent health status
   */
  router.get('/agents/:agentId/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;

      const agent = await agentRegistry.getAgent(agentId);

      if (!agent) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Agent ${agentId} not found`,
        });
      }

      // Perform real-time health check
      const isHealthy = await agentSwitcher.healthCheck(agent);

      res.json({
        agentId,
        name: agent.name,
        isHealthy,
        lastCheck: agent.health.lastCheck,
        successRate: agent.health.successRate,
        averageResponseTimeMs: agent.metrics.averageResponseTimeMs,
        errorCount: agent.health.errorCount,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/routing/recommend
   * Get agent recommendation for a message
   */
  router.get('/recommend', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, capabilities } = req.query;

      if (!message) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'message query parameter is required',
        });
      }

      const mockRequest = {
        requestId: `RECOM-${Date.now()}`,
        message: message as string,
        routingHints: {
          requiredCapabilities: capabilities
            ? (capabilities as string).split(',')
            : undefined,
        },
        timestamp: new Date(),
        priority: 'normal' as const,
      };

      const result = await expertSelector.selectAgent(mockRequest);

      res.json({
        message: message as string,
        recommendedAgent: result.selectedAgent
          ? {
              agentId: result.selectedAgent.agentId,
              name: result.selectedAgent.name,
              capabilities: result.selectedAgent.capabilities,
              confidence: result.selectedAgent.health.successRate,
            }
          : null,
        fallbackAgent: result.fallbackAgent
          ? {
              agentId: result.fallbackAgent.agentId,
              name: result.fallbackAgent.name,
            }
          : null,
        allCandidates: result.allCandidates.map(a => ({
          agentId: a.agentId,
          name: a.name,
        })),
        warnings: result.warnings,
        reason: result.selectionReason,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/routing/metrics
   * Get routing metrics
   */
  router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = agentRegistry.getMetrics();

      res.json({
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createRoutingRoutes;

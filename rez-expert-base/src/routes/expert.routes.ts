/**
 * Expert Routes - REST API endpoints for expert agents
 * Provides standard API for interacting with expert services
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { IExpert, IExpertRegistry } from '../interfaces/IExpert';
import { IIntent, IntentSource, IntentPriority } from '../interfaces/IIntent';
import { IResponse } from '../interfaces/IResponse';
import { Logger } from '../utils/logger';

export interface ExpertRoutesConfig {
  registry: IExpertRegistry;
  logger: Logger;
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
  rateLimitMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
}

export class ExpertRoutes {
  private router: Router;
  private registry: IExpertRegistry;
  private logger: Logger;
  private authMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
  private rateLimitMiddleware?: (req: Request, res: Response, next: NextFunction) => void;

  constructor(config: ExpertRoutesConfig) {
    this.router = Router();
    this.registry = config.registry;
    this.logger = config.logger;
    this.authMiddleware = config.authMiddleware;
    this.rateLimitMiddleware = config.rateLimitMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Apply middleware
    if (this.rateLimitMiddleware) {
      this.router.use(this.rateLimitMiddleware);
    }

    if (this.authMiddleware) {
      this.router.use(this.authMiddleware);
    }

    // Health check (no auth required)
    this.router.get('/health', this.healthCheck.bind(this));
    this.router.get('/ready', this.readyCheck.bind(this));

    // Expert management
    this.router.get('/experts', this.listExperts.bind(this));
    this.router.get('/experts/:expertId', this.getExpert.bind(this));
    this.router.get('/experts/:expertId/capabilities', this.getCapabilities.bind(this));
    this.router.get('/experts/:expertId/metrics', this.getMetrics.bind(this));

    // Intent processing
    this.router.post('/intents', this.processIntent.bind(this));
    this.router.get('/intents/:intentId', this.getIntentStatus.bind(this));

    // Expert health
    this.router.get('/experts/:expertId/health', this.expertHealthCheck.bind(this));

    // System
    this.router.get('/capabilities', this.listAllCapabilities.bind(this));
  }

  /**
   * Health check endpoint
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);

    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        requestId,
        service: 'rez-expert-base'
      });
    } catch (error) {
      this.logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        requestId,
        error: 'Health check failed'
      });
    }
  }

  /**
   * Readiness check endpoint
   */
  private async readyCheck(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);

    try {
      const experts = this.registry.getAllExperts();
      const readyCount = experts.filter(e => e.expertId).length;

      if (readyCount > 0) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          requestId,
          readyExperts: readyCount,
          totalExperts: experts.length
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          requestId,
          readyExperts: readyCount,
          totalExperts: experts.length
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        requestId,
        error: 'Readiness check failed'
      });
    }
  }

  /**
   * List all registered experts
   */
  private async listExperts(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);

    try {
      const { industry, capability, limit = '50', offset = '0' } = req.query;

      let experts = this.registry.getAllExperts();

      // Filter by industry
      if (typeof industry === 'string') {
        experts = this.registry.getExpertsByIndustry(industry);
      }

      // Filter by capability
      if (typeof capability === 'string') {
        experts = experts.filter(e =>
          e.getCapabilities().some(c =>
            c.actions.includes(capability) || c.domain.includes(capability)
          )
        );
      }

      // Paginate
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);
      const paginatedExperts = experts.slice(offsetNum, offsetNum + limitNum);

      res.json({
        experts: paginatedExperts.map(e => ({
          expertId: e.expertId,
          name: e.name,
          industry: e.industry,
          version: e.version,
          capabilities: e.getCapabilities().map(c => c.domain)
        })),
        total: experts.length,
        offset: offsetNum,
        limit: limitNum,
        requestId
      });
    } catch (error) {
      this.logger.error('Failed to list experts:', error);
      res.status(500).json({
        error: 'Failed to list experts',
        requestId
      });
    }
  }

  /**
   * Get expert details
   */
  private async getExpert(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);
    const { expertId } = req.params;

    try {
      const expert = this.registry.getExpert(expertId);

      if (!expert) {
        res.status(404).json({
          error: 'Expert not found',
          expertId,
          requestId
        });
        return;
      }

      res.json({
        expertId: expert.expertId,
        name: expert.name,
        industry: expert.industry,
        version: expert.version,
        capabilities: expert.getCapabilities(),
        systemPrompt: expert.getSystemPrompt(),
        requestId
      });
    } catch (error) {
      this.logger.error(`Failed to get expert ${expertId}:`, error);
      res.status(500).json({
        error: 'Failed to get expert',
        expertId,
        requestId
      });
    }
  }

  /**
   * Get expert capabilities
   */
  private async getCapabilities(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);
    const { expertId } = req.params;

    try {
      const expert = this.registry.getExpert(expertId);

      if (!expert) {
        res.status(404).json({
          error: 'Expert not found',
          expertId,
          requestId
        });
        return;
      }

      res.json({
        expertId: expert.expertId,
        capabilities: expert.getCapabilities(),
        requestId
      });
    } catch (error) {
      this.logger.error(`Failed to get capabilities for ${expertId}:`, error);
      res.status(500).json({
        error: 'Failed to get capabilities',
        expertId,
        requestId
      });
    }
  }

  /**
   * Get expert metrics
   */
  private async getMetrics(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);
    const { expertId } = req.params;

    try {
      const expert = this.registry.getExpert(expertId);

      if (!expert) {
        res.status(404).json({
          error: 'Expert not found',
          expertId,
          requestId
        });
        return;
      }

      const metrics = await expert.getMetrics();

      res.json({
        expertId: expert.expertId,
        metrics,
        requestId
      });
    } catch (error) {
      this.logger.error(`Failed to get metrics for ${expertId}:`, error);
      res.status(500).json({
        error: 'Failed to get metrics',
        expertId,
        requestId
      });
    }
  }

  /**
   * Process an intent
   */
  private async processIntent(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);

    try {
      // Validate request body
      const intentSchema = z.object({
        input: z.string().min(1),
        expertId: z.string().optional(),
        industry: z.string().optional(),
        source: z.enum(['chat', 'api', 'webhook', 'automation', 'voice']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        context: z.object({
          userId: z.string().optional(),
          sessionId: z.string().optional(),
          conversationId: z.string().optional(),
          channel: z.string().optional(),
          metadata: z.record(z.unknown()).optional()
        }).optional()
      });

      const validation = intentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors,
          requestId
        });
        return;
      }

      const { input, expertId, industry, source, priority, context } = validation.data;

      // Find the best expert
      let expert: IExpert | undefined;

      if (expertId) {
        expert = this.registry.getExpert(expertId);
      } else if (industry) {
        const experts = this.registry.getExpertsByIndustry(industry);
        expert = experts[0];
      } else {
        // Find best expert automatically
        const mockIntent: IIntent = {
          intentId: uuidv4(),
          input,
          classification: {
            domain: '',
            action: 'query',
            entities: [],
            confidence: 1
          },
          priority: 'medium',
          source: 'api',
          context: {},
          timestamp: new Date().toISOString(),
          language: 'en',
          tags: [],
          status: 'pending',
          addContext: function(key: string, value: unknown): void {
            (this.context as Record<string, unknown>)[key] = value;
          },
          getContext: function<T = unknown>(key: string): T | undefined {
            return (this.context as Record<string, unknown>)[key] as T | undefined;
          },
          updateStatus: function(status: import('../interfaces/IIntent').IntentStatus): void {
            this.status = status;
          },
          addTag: function(tag: string): void {
            this.tags.push(tag);
          },
          isExpired: function(ttlSeconds: number): boolean {
            const created = new Date(this.timestamp).getTime();
            const now = Date.now();
            return (now - created) > ttlSeconds * 1000;
          }
        } as unknown as IIntent;

        expert = this.registry.findBestExpert(mockIntent);
      }

      if (!expert) {
        res.status(404).json({
          error: 'No expert found to handle this request',
          requestId
        });
        return;
      }

      // Create intent object
      const intent: IIntent = {
        intentId: uuidv4(),
        input,
        classification: {
          domain: expert.industry,
          action: 'query',
          entities: [],
          confidence: 1
        },
        priority: priority || 'medium',
        source: source || 'api',
        context: context || {},
        timestamp: new Date().toISOString(),
        language: 'en',
        tags: [],
        status: 'pending',
        addContext: function(key: string, value: unknown): void {
          (this.context as Record<string, unknown>)[key] = value;
        },
        getContext: function<T = unknown>(key: string): T | undefined {
          return (this.context as Record<string, unknown>)[key] as T | undefined;
        },
        updateStatus: function(status: import('../interfaces/IIntent').IntentStatus): void {
          this.status = status;
        },
        addTag: function(tag: string): void {
          this.tags.push(tag);
        },
        isExpired: function(ttlSeconds: number): boolean {
          const created = new Date(this.timestamp).getTime();
          const now = Date.now();
          return (now - created) > ttlSeconds * 1000;
        }
      } as unknown as IIntent;

      // Process intent
      const response = await expert.processIntent(intent);

      res.json({
        response,
        requestId
      });
    } catch (error) {
      this.logger.error('Failed to process intent:', error);
      res.status(500).json({
        error: 'Failed to process intent',
        requestId
      });
    }
  }

  /**
   * Get intent status
   */
  private async getIntentStatus(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);
    const { intentId } = req.params;

    res.json({
      intentId,
      status: 'completed',
      requestId
    });
  }

  /**
   * Expert health check
   */
  private async expertHealthCheck(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);
    const { expertId } = req.params;

    try {
      const expert = this.registry.getExpert(expertId);

      if (!expert) {
        res.status(404).json({
          error: 'Expert not found',
          expertId,
          requestId
        });
        return;
      }

      const health = await expert.healthCheck();

      res.json({
        expertId: expert.expertId,
        ...health,
        requestId
      });
    } catch (error) {
      this.logger.error(`Health check failed for ${expertId}:`, error);
      res.status(500).json({
        error: 'Health check failed',
        expertId,
        requestId
      });
    }
  }

  /**
   * List all capabilities across experts
   */
  private async listAllCapabilities(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    this.logger.setRequestId(requestId);

    try {
      const experts = this.registry.getAllExperts();
      const capabilitiesMap = new Map<string, Set<string>>();

      for (const expert of experts) {
        for (const cap of expert.getCapabilities()) {
          const existing = capabilitiesMap.get(cap.domain) || new Set();
          for (const action of cap.actions) {
            existing.add(action);
          }
          capabilitiesMap.set(cap.domain, existing);
        }
      }

      const capabilities = Array.from(capabilitiesMap.entries()).map(([domain, actions]) => ({
        domain,
        actions: Array.from(actions)
      }));

      res.json({
        capabilities,
        total: capabilities.length,
        requestId
      });
    } catch (error) {
      this.logger.error('Failed to list capabilities:', error);
      res.status(500).json({
        error: 'Failed to list capabilities',
        requestId
      });
    }
  }

  /**
   * Get the router instance
   */
  getRouter(): Router {
    return this.router;
  }
}

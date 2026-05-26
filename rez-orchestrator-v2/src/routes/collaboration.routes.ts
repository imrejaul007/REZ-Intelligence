import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CollaborationManager } from '../services/collaborationManager';
import { OrchestrationRequestSchema } from '../models/OrchestrationRequest';
import { CollaborationConfigSchema } from '../models/CollaborationDetails';
import { logger } from '../utils/logger';

const router = Router();

export interface CollaborationRoutesConfig {
  collaborationManager: CollaborationManager;
}

export function createCollaborationRoutes(config: CollaborationRoutesConfig): Router {
  const { collaborationManager } = config;

  /**
   * POST /api/v2/collaboration/create
   * Create a new collaboration session
   */
  router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = OrchestrationRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.issues,
        });
      }

      const configValidation = CollaborationConfigSchema.safeParse(req.body.config || {});

      if (!configValidation.success) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid collaboration config',
          details: configValidation.error.issues,
        });
      }

      const request = validationResult.data;
      const collaborationId = `COLLAB-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 9)}`;

      logger.info('Collaboration created via API', {
        collaborationId,
        messageLength: request.message.length,
      });

      res.status(201).json({
        success: true,
        collaborationId,
        message: 'Collaboration session created. Use the process endpoint to execute.',
        config: configValidation.data,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v2/collaboration/process
   * Execute a collaboration
   */
  router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const collaborationId = `COLLAB-${Date.now()}`;

    try {
      const validationResult = OrchestrationRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.issues,
        });
      }

      const configValidation = CollaborationConfigSchema.safeParse(req.body.config || {});

      if (!configValidation.success) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid collaboration config',
          details: configValidation.error.issues,
        });
      }

      const request = validationResult.data;

      logger.info('Starting collaboration via API', {
        collaborationId,
        messageLength: request.message.length,
      });

      // Note: In a full implementation, this would create a proper ProcessingContext
      // and call the collaboration manager
      res.status(501).json({
        error: 'NOT_IMPLEMENTED',
        message: 'Collaboration processing requires full orchestration context',
        collaborationId,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/collaboration/:collaborationId
   * Get collaboration status
   */
  router.get('/:collaborationId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collaborationId } = req.params;

      // In a full implementation, this would retrieve the collaboration details from storage
      res.json({
        collaborationId,
        status: 'unknown',
        message: 'Collaboration tracking not yet implemented',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v2/collaboration/:collaborationId/cancel
   * Cancel an active collaboration
   */
  router.post('/:collaborationId/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { collaborationId } = req.params;

      logger.info('Collaboration cancelled via API', { collaborationId });

      res.json({
        success: true,
        collaborationId,
        message: 'Collaboration cancelled',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v2/collaboration/strategies
   * List available collaboration strategies
   */
  router.get('/strategies', async (req: Request, res: Response) => {
    res.json({
      strategies: [
        {
          name: 'sequential',
          description: 'Agents work one after another, passing results to the next',
          bestFor: ['Complex multi-step tasks', 'Tasks with dependencies'],
        },
        {
          name: 'parallel',
          description: 'Agents work simultaneously on independent subtasks',
          bestFor: ['Independent subtasks', 'Speed-critical applications'],
        },
        {
          name: 'hierarchical',
          description: 'Coordinator agent orchestrates specialist agents',
          bestFor: ['Complex coordination', 'Expert-level analysis'],
        },
        {
          name: 'debate',
          description: 'Agents debate and present opposing views',
          bestFor: ['Decision making', 'Risk analysis'],
        },
        {
          name: 'voting',
          description: 'Multiple agents vote on the best approach',
          bestFor: ['Consensus building', 'Diverse perspectives'],
        },
      ],
    });
  });

  /**
   * POST /api/v2/collaboration/validate-config
   * Validate collaboration configuration
   */
  router.post('/validate-config', async (req: Request, res: Response) => {
    const validationResult = CollaborationConfigSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        valid: false,
        errors: validationResult.error.issues,
      });
    }

    res.json({
      valid: true,
      config: validationResult.data,
    });
  });

  return router;
}

export default createCollaborationRoutes;

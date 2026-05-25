import { Router, Response, NextFunction } from 'express';
import { validateInternalToken, AuthenticatedRequest } from '../middleware/auth';
import { BroadcastService } from '../services/broadcastService';
import { CreateBroadcastSchema, BroadcastStatus, ApiResponse } from '../types/whatsapp';
import { logger } from '../utils/logger';

export function createBroadcastRoutes(
  broadcastService: BroadcastService
): Router {
  const router = Router();

  /**
   * POST /api/broadcast
   * Create a new broadcast campaign
   */
  router.post(
    '/',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const validation = CreateBroadcastSchema.safeParse(req.body);
        if (!validation.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: validation.error.errors,
            },
          };
          res.status(400).json(response);
          return;
        }

        const { name, templateId, segment, scheduledAt, metadata } = validation.data;

        const merchantId = req.query.merchantId as string;

        const result = await broadcastService.createBroadcast(
          {
            name,
            templateId,
            segment: segment as unknown,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            metadata,
          },
          merchantId
        );

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'CREATE_FAILED',
              message: result.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        const response: ApiResponse<{
          broadcastId: string;
          status: string;
          scheduledAt?: Date;
        }> = {
          success: true,
          data: {
            broadcastId: result.broadcast!.broadcastId,
            status: result.broadcast!.status,
            scheduledAt: result.broadcast!.scheduledAt,
          },
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error('Failed to create broadcast', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/broadcast
   * List broadcasts
   */
  router.get(
    '/',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const merchantId = req.query.merchantId as string;
        const status = req.query.status as BroadcastStatus;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await broadcastService.listBroadcasts({
          merchantId,
          status,
          page,
          limit,
        });

        const response: ApiResponse<{
          broadcasts: unknown[];
          page: number;
          limit: number;
          total: number;
        }> = {
          success: true,
          data: {
            broadcasts: result.broadcasts,
            page: result.page,
            limit: result.limit,
            total: result.total,
          },
          meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to list broadcasts', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/broadcast/:broadcastId
   * Get broadcast status
   */
  router.get(
    '/:broadcastId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { broadcastId } = req.params;

        const result = await broadcastService.getBroadcastStatus(broadcastId);

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: result.error,
            },
          };
          res.status(404).json(response);
          return;
        }

        const response: ApiResponse<{
          broadcast: unknown;
          progress: {
            percentage: number;
            eta?: number;
            status: string;
          };
        }> = {
          success: true,
          data: {
            broadcast: result.broadcast,
            progress: result.progress,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to get broadcast status', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/broadcast/:broadcastId/start
   * Start a broadcast
   */
  router.post(
    '/:broadcastId/start',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { broadcastId } = req.params;

        const result = await broadcastService.startBroadcast(broadcastId);

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'START_FAILED',
              message: result.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        const response: ApiResponse<{
          message: string;
          status: string;
          total: number;
        }> = {
          success: true,
          data: {
            message: 'Broadcast started',
            status: result.broadcast!.status,
            total: result.broadcast!.progress.total,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to start broadcast', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/broadcast/:broadcastId/cancel
   * Cancel a broadcast
   */
  router.post(
    '/:broadcastId/cancel',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { broadcastId } = req.params;

        const result = await broadcastService.cancelBroadcast(broadcastId);

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'CANCEL_FAILED',
              message: result.error,
            },
          };
          res.status(400).json(response);
          return;
        }

        const response: ApiResponse<{
          message: string;
          status: string;
        }> = {
          success: true,
          data: {
            message: 'Broadcast cancelled',
            status: result.broadcast!.status,
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to cancel broadcast', { error });
        next(error);
      }
    }
  );

  /**
   * POST /api/broadcast/:broadcastId/pause
   * Pause a running broadcast (not implemented yet)
   */
  router.post(
    '/:broadcastId/pause',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { broadcastId } = req.params;

        // For now, return not implemented
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Pause functionality not yet implemented',
          },
        };
        res.status(501).json(response);
      } catch (error) {
        logger.error('Pause broadcast failed', { error });
        next(error);
      }
    }
  );

  /**
   * GET /api/broadcast/stats
   * Get broadcast statistics
   */
  router.get(
    '/stats',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const merchantId = req.query.merchantId as string;

        const stats = await broadcastService.getBroadcastStats(merchantId);

        const response: ApiResponse<{
          total: number;
          byStatus: Record<string, number>;
          avgDeliveryRate: number;
          avgReadRate: number;
        }> = {
          success: true,
          data: stats,
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to get broadcast stats', { error });
        next(error);
      }
    }
  );

  /**
   * DELETE /api/broadcast/:broadcastId
   * Delete a draft broadcast
   */
  router.delete(
    '/:broadcastId',
    validateInternalToken,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { broadcastId } = req.params;

        // Only allow deletion of draft broadcasts
        const result = await broadcastService.getBroadcastStatus(broadcastId);

        if (!result.success) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Broadcast not found',
            },
          };
          res.status(404).json(response);
          return;
        }

        if (result.broadcast!.status !== BroadcastStatus.DRAFT) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'INVALID_STATE',
              message: 'Only draft broadcasts can be deleted',
            },
          };
          res.status(400).json(response);
          return;
        }

        // Cancel to clean up
        await broadcastService.cancelBroadcast(broadcastId);

        const response: ApiResponse<{ message: string }> = {
          success: true,
          data: {
            message: 'Broadcast deleted',
          },
        };

        res.status(200).json(response);
      } catch (error) {
        logger.error('Failed to delete broadcast', { error });
        next(error);
      }
    }
  );

  return router;
}

export default createBroadcastRoutes;

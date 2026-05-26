/**
 * Bridge API Routes
 * REST API for the Attribution-Loyalty Bridge Service
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BridgeRecord, IBridgeRecordModel } from '../models/BridgeRecord.js';
import { CampaignConfig, ICampaignConfigModel } from '../models/CampaignConfig.js';
import { cashbackEngine } from '../services/cashbackEngine.js';
import { loyaltyTriggerService } from '../services/loyaltyTrigger.js';
import { attributionListener } from '../services/attributionListener.js';
import { bridgeLogger as logger } from '../services/logger.js';
import {
  CashbackRequestSchema,
  AttributionWebhookSchema,
  ChannelTypeSchema
} from '../types/schemas.js';

// Cast models to include static methods
const BridgeRecordTyped = BridgeRecord as unknown as IBridgeRecordModel;
const CampaignConfigTyped = CampaignConfig as unknown as ICampaignConfigModel;

// ============================================
// TYPES
// ============================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Add request ID to all requests
 */
function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as unknown as { requestId: string }).requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
}

/**
 * Create standardized API response
 */
function createResponse<T>(
  res: Response,
  data?: T,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: (res as unknown as { requestId?: string }).requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  } as ApiResponse<T>);
}

/**
 * Create error response
 */
function createErrorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const resAny = res as unknown as { requestId?: string };
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details },
    meta: {
      requestId: resAny.requestId || uuidv4(),
      timestamp: new Date().toISOString()
    }
  } as ApiResponse);
}

// ============================================
// ROUTES
// ============================================

export function createBridgeRouter(): Router {
  const router = Router();

  // Apply middleware
  router.use(requestIdMiddleware);

  // ============================================
  // HEALTH & STATUS
  // ============================================

  /**
   * GET /health
   * Service health check
   */
  router.get('/health', (_req: Request, res: Response) => {
    createResponse(res, {
      service: 'rez-attribution-loyalty-bridge',
      status: 'healthy',
      version: '1.0.0',
      features: [
        'cashback-calculation',
        'loyalty-trigger',
        'attribution-listener',
        'campaign-multipliers',
        'dooh-bonus',
        'real-time-notifications'
      ]
    });
  });

  /**
   * GET /status
   * Detailed service status
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const pendingCount = await BridgeRecordTyped.countDocuments({ status: 'pending' });
      const processingCount = await BridgeRecordTyped.countDocuments({ status: 'processing' });
      const completedCount = await BridgeRecordTyped.countDocuments({ status: 'completed' });
      const failedCount = await BridgeRecordTyped.countDocuments({ status: 'failed' });

      const recentBridges = await BridgeRecordTyped.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('bridgeId conversionId status totalCoins createdAt');

      createResponse(res, {
        queues: {
          pending: pendingCount,
          processing: processingCount,
          completed: completedCount,
          failed: failedCount
        },
        recentBridges,
        polling: {
          isPolling: false, // Would need to expose from listener
          intervalMs: parseInt(process.env.CONVERSION_WINDOW_HOURS || '30') * 1000
        }
      });
    } catch (error) {
      createErrorResponse(res, 500, 'STATUS_ERROR', 'Failed to get service status');
    }
  });

  // ============================================
  // CASHBACK CALCULATION
  // ============================================

  /**
   * POST /calculate
   * Calculate cashback for a conversion
   */
  router.post('/calculate', async (req: Request, res: Response) => {
    try {
      const validationResult = CashbackRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        return createErrorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          'Invalid request body',
          validationResult.error.issues
        );
      }

      const calculation = await cashbackEngine.calculate(validationResult.data);
      return createResponse(res, calculation, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Calculation failed';
      logger.error('Cashback calculation failed', { error: errorMessage });
      return createErrorResponse(res, 500, 'CALCULATION_ERROR', errorMessage);
    }
  });

  /**
   * POST /calculate-and-trigger
   * Calculate cashback and immediately trigger loyalty reward
   */
  router.post('/calculate-and-trigger', async (req: Request, res: Response) => {
    try {
      const validationResult = CashbackRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        return createErrorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          'Invalid request body',
          validationResult.error.issues
        );
      }

      // Calculate
      const calculation = await cashbackEngine.calculate(validationResult.data);
      const bridgeId = await cashbackEngine.createBridgeRecord(calculation);

      // Trigger reward
      const triggerResult = await loyaltyTriggerService.syncBridgeRecord(bridgeId);

      return createResponse(res, {
        bridgeId,
        calculation,
        triggerResult
      }, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      logger.error('Calculate and trigger failed', { error: errorMessage });
      return createErrorResponse(res, 500, 'OPERATION_ERROR', errorMessage);
    }
  });

  // ============================================
  // BRIDGE RECORDS
  // ============================================

  /**
   * GET /bridges
   * List bridge records with filtering
   */
  router.get('/bridges', async (req: Request, res: Response) => {
    try {
      const {
        customerId,
        merchantId,
        campaignId,
        status,
        startDate,
        endDate,
        limit = '50',
        skip = '0'
      } = req.query;

      const query: Record<string, unknown> = { deletedAt: { $exists: false } };

      if (customerId) query.customerId = customerId;
      if (merchantId) query.merchantId = merchantId;
      if (campaignId) query.campaignId = campaignId;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) (query.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
        if (endDate) (query.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
      }

      const bridges = await BridgeRecordTyped.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip as string))
        .limit(parseInt(limit as string));

      const total = await BridgeRecordTyped.countDocuments(query);

      return createResponse(res, {
        bridges,
        pagination: {
          total,
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          hasMore: parseInt(skip as string) + bridges.length < total
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'QUERY_ERROR', 'Failed to list bridges');
    }
  });

  /**
   * GET /bridges/:bridgeId
   * Get specific bridge record
   */
  router.get('/bridges/:bridgeId', async (req: Request, res: Response) => {
    try {
      const bridgeId = Array.isArray(req.params.bridgeId) ? req.params.bridgeId[0] : req.params.bridgeId;
      const bridge = await BridgeRecordTyped.findOne({
        bridgeId,
        deletedAt: { $exists: false }
      });

      if (!bridge) {
        return createErrorResponse(res, 404, 'NOT_FOUND', 'Bridge record not found');
      }

      return createResponse(res, bridge);
    } catch (error) {
      return createErrorResponse(res, 500, 'QUERY_ERROR', 'Failed to get bridge record');
    }
  });

  /**
   * POST /bridges/:bridgeId/trigger
   * Manually trigger loyalty reward for a bridge record
   */
  router.post('/bridges/:bridgeId/trigger', async (req: Request, res: Response) => {
    try {
      const bridgeId = Array.isArray(req.params.bridgeId) ? req.params.bridgeId[0] : req.params.bridgeId;
      const result = await loyaltyTriggerService.syncBridgeRecord(bridgeId);
      return createResponse(res, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Trigger failed';
      return createErrorResponse(res, 500, 'TRIGGER_ERROR', errorMessage);
    }
  });

  /**
   * POST /bridges/:bridgeId/retry
   * Retry a failed bridge record
   */
  router.post('/bridges/:bridgeId/retry', async (req: Request, res: Response) => {
    try {
      const bridgeId = Array.isArray(req.params.bridgeId) ? req.params.bridgeId[0] : req.params.bridgeId;
      const bridge = await BridgeRecordTyped.findOne({
        bridgeId,
        deletedAt: { $exists: false }
      });

      if (!bridge) {
        return createErrorResponse(res, 404, 'NOT_FOUND', 'Bridge record not found');
      }

      if (bridge.status !== 'failed') {
        return createErrorResponse(res, 400, 'INVALID_STATUS', 'Can only retry failed records');
      }

      if (bridge.retryCount >= 3) {
        return createErrorResponse(res, 400, 'MAX_RETRIES', 'Maximum retry attempts exceeded');
      }

      const result = await loyaltyTriggerService.syncBridgeRecord(bridgeId);
      return createResponse(res, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      return createErrorResponse(res, 500, 'RETRY_ERROR', errorMessage);
    }
  });

  /**
   * DELETE /bridges/:bridgeId
   * Cancel/soft delete a bridge record
   */
  router.delete('/bridges/:bridgeId', async (req: Request, res: Response) => {
    try {
      const bridgeId = Array.isArray(req.params.bridgeId) ? req.params.bridgeId[0] : req.params.bridgeId;
      const { reason } = req.body;
      await loyaltyTriggerService.cancelBridgeRecord(bridgeId, reason || 'Cancelled by user');
      return createResponse(res, { message: 'Bridge record cancelled' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cancellation failed';
      return createErrorResponse(res, 500, 'CANCEL_ERROR', errorMessage);
    }
  });

  // ============================================
  // CONVERSIONS
  // ============================================

  /**
   * POST /conversions/process
   * Process a conversion from attribution service
   */
  router.post('/conversions/process', async (req: Request, res: Response) => {
    try {
      const validationResult = AttributionWebhookSchema.safeParse(req.body);

      if (!validationResult.success) {
        return createErrorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          'Invalid conversion payload',
          validationResult.error.issues
        );
      }

      const result = await attributionListener.handleWebhook(validationResult.data);

      if (!result.accepted) {
        return createErrorResponse(res, 400, 'REJECTED', result.error || 'Webhook rejected');
      }

      return createResponse(res, result, result.processed ? 200 : 202);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      logger.error('Conversion processing failed', { error: errorMessage });
      return createErrorResponse(res, 500, 'PROCESSING_ERROR', errorMessage);
    }
  });

  /**
   * POST /conversions/:conversionId/reprocess
   * Reprocess a specific conversion
   */
  router.post('/conversions/:conversionId/reprocess', async (req: Request, res: Response) => {
    try {
      const conversionId = Array.isArray(req.params.conversionId) ? req.params.conversionId[0] : req.params.conversionId;
      const result = await attributionListener.reprocessConversion(conversionId);
      return createResponse(res, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reprocessing failed';
      return createErrorResponse(res, 500, 'REPROCESS_ERROR', errorMessage);
    }
  });

  // ============================================
  // CAMPAIGNS
  // ============================================

  /**
   * GET /campaigns
   * List active campaigns
   */
  router.get('/campaigns', async (req: Request, res: Response) => {
    try {
      const { merchantId, channel, active } = req.query;

      let campaigns;
      if (active === 'true') {
        const channelValue = channel ? ChannelTypeSchema.parse(channel) : undefined;
        campaigns = await CampaignConfigTyped.findActiveCampaigns(
          merchantId as string | undefined,
          channelValue
        );
      } else {
        const query: Record<string, unknown> = {};
        if (merchantId) query.merchantId = merchantId;
        campaigns = await CampaignConfigTyped.find(query)
          .sort({ startDate: -1 })
          .limit(50);
      }

      return createResponse(res, { campaigns });
    } catch (error) {
      return createErrorResponse(res, 500, 'QUERY_ERROR', 'Failed to list campaigns');
    }
  });

  /**
   * POST /campaigns
   * Create a new campaign
   */
  router.post('/campaigns', async (req: Request, res: Response) => {
    try {
      const campaign = new CampaignConfig({
        ...req.body,
        campaignId: req.body.campaignId || uuidv4()
      });
      await campaign.save();
      return createResponse(res, campaign, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Creation failed';
      return createErrorResponse(res, 500, 'CREATE_ERROR', errorMessage);
    }
  });

  /**
   * GET /campaigns/:campaignId
   * Get campaign details
   */
  router.get('/campaigns/:campaignId', async (req: Request, res: Response) => {
    try {
      const campaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
      const campaign = await CampaignConfigTyped.findByCampaignId(campaignId);

      if (!campaign) {
        return createErrorResponse(res, 404, 'NOT_FOUND', 'Campaign not found');
      }

      return createResponse(res, campaign);
    } catch (error) {
      return createErrorResponse(res, 500, 'QUERY_ERROR', 'Failed to get campaign');
    }
  });

  /**
   * PATCH /campaigns/:campaignId
   * Update campaign
   */
  router.patch('/campaigns/:campaignId', async (req: Request, res: Response) => {
    try {
      const campaignId = Array.isArray(req.params.campaignId) ? req.params.campaignId[0] : req.params.campaignId;
      const campaign = await CampaignConfigTyped.findByCampaignId(campaignId);

      if (!campaign) {
        return createErrorResponse(res, 404, 'NOT_FOUND', 'Campaign not found');
      }

      Object.assign(campaign, req.body);
      await campaign.save();

      return createResponse(res, campaign);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      return createErrorResponse(res, 500, 'UPDATE_ERROR', errorMessage);
    }
  });

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * GET /analytics/summary
   * Get bridge analytics summary
   */
  router.get('/analytics/summary', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, merchantId } = req.query;

      const match: Record<string, unknown> = {
        status: 'completed',
        deletedAt: { $exists: false }
      };

      if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) (match.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
        if (endDate) (match.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
      }

      if (merchantId) match.merchantId = merchantId;

      const summary = await BridgeRecordTyped.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalCoinsAwarded: { $sum: '$totalCoins' },
            totalCashbackAwarded: { $sum: '$totalCashback' },
            totalOrderValue: { $sum: '$orderValue' },
            totalConversions: { $sum: 1 },
            avgCoinsPerConversion: { $avg: '$totalCoins' },
            avgCashbackPerConversion: { $avg: '$totalCashback' }
          }
        }
      ]);

      // Channel breakdown
      const channelBreakdown = await BridgeRecordTyped.aggregateByChannel(
        startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate ? new Date(endDate as string) : new Date(),
        merchantId as string | undefined
      );

      return createResponse(res, {
        summary: summary[0] || {
          totalCoinsAwarded: 0,
          totalCashbackAwarded: 0,
          totalOrderValue: 0,
          totalConversions: 0,
          avgCoinsPerConversion: 0,
          avgCashbackPerConversion: 0
        },
        channelBreakdown: channelBreakdown.map((c: { channel: string; totalCoins: number; totalCashback: number; count: number }) => ({
          channel: c.channel,
          totalCoins: c.totalCoins,
          totalCashback: c.totalCashback,
          conversionCount: c.count
        }))
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'ANALYTICS_ERROR', 'Failed to get analytics');
    }
  });

  /**
   * GET /analytics/merchant/:merchantId
   * Get merchant-specific analytics
   */
  router.get('/analytics/merchant/:merchantId', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const match: Record<string, unknown> = {
        merchantId: req.params.merchantId as string,
        status: 'completed',
        deletedAt: { $exists: false }
      };

      if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) (match.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
        if (endDate) (match.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
      }

      const merchantId = req.params.merchantId as string;
      const [summary, topChannels, recentBridges] = await Promise.all([
        BridgeRecordTyped.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$merchantId',
              totalCoinsAwarded: { $sum: '$totalCoins' },
              totalCashbackAwarded: { $sum: '$totalCashback' },
              totalConversions: { $sum: 1 }
            }
          }
        ]),
        BridgeRecordTyped.aggregateByChannel(
          startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate ? new Date(endDate as string) : new Date(),
          merchantId
        ),
        BridgeRecordTyped.find({ merchantId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('bridgeId totalCoins totalCashback createdAt')
      ]);

      return createResponse(res, {
        summary: summary[0] || {
          merchantId,
          totalCoinsAwarded: 0,
          totalCashbackAwarded: 0,
          totalConversions: 0
        },
        topChannels: topChannels.slice(0, 5),
        recentBridges
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'ANALYTICS_ERROR', 'Failed to get merchant analytics');
    }
  });

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /**
   * POST /batch/process-pending
   * Process pending bridge records in batch
   */
  router.post('/batch/process-pending', async (req: Request, res: Response) => {
    try {
      const { limit = 100 } = req.body;
      const result = await loyaltyTriggerService.processPendingRecords(limit);
      return createResponse(res, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      return createErrorResponse(res, 500, 'BATCH_ERROR', errorMessage);
    }
  });

  return router;
}

export const bridgeRouter = createBridgeRouter();

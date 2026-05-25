import { Router, Request, Response } from 'express';
import { campaignService } from '../services';
import {
  asyncHandler,
  NotFoundError,
} from '../middleware';
import {
  validateRequest,
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignSchema,
  AudiencePreviewSchema,
  PaginationQuerySchema,
  z
} from '../schemas';

const router = Router();

// Param validation schemas
const campaignIdParams = z.object({
  id: z.string().min(1),
});

const audiencePreviewQuery = z.object({
  sample_size: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

const triggerCampaignBody = z.object({
  user_contexts: z.array(z.object({
    user_id: z.string().min(1),
    segments: z.array(z.string()).optional(),
    attributes: z.record(z.unknown()).optional(),
    preferences: z.record(z.unknown()).optional(),
  })).min(1),
});

const listQuery = z.object({
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
  created_by: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * POST /campaigns
 * Create a new targeting campaign
 */
router.post(
  '/',
  validateRequest({ body: CreateCampaignSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignService.createCampaign({
      name: req.body.name,
      description: req.body.description,
      rules: req.body.rules,
      ab_test_config: req.body.ab_test_config,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      created_by: req.body.created_by
    });

    res.status(201).json({
      success: true,
      data: {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        status: campaign.status,
        rules: campaign.rules,
        created_at: campaign.created_at
      },
      message: 'Campaign created successfully'
    });
  })
);

/**
 * GET /campaigns
 * List all campaigns with optional filtering
 */
router.get(
  '/',
  validateRequest({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, created_by, limit, offset } = req.query;

    const result = await campaignService.listCampaigns({
      status: status as unknown,
      created_by: created_by as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({
      success: true,
      data: {
        campaigns: result.campaigns.map(c => ({
          campaign_id: c.campaign_id,
          name: c.name,
          status: c.status,
          rules: c.rules,
          created_at: c.created_at,
          updated_at: c.updated_at
        })),
        pagination: {
          total: result.total,
          limit: limit ? parseInt(limit as string) : 20,
          offset: offset ? parseInt(offset as string) : 0
        }
      }
    });
  })
);

/**
 * GET /campaigns/stats
 * Get statistics for all campaigns
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await campaignService.getAllCampaignsStats();

    res.json({
      success: true,
      data: {
        campaigns: result.campaigns.map(c => ({
          campaign_id: c.campaign.campaign_id,
          name: c.campaign.name,
          status: c.campaign.status,
          stats: {
            impressions: c.stats.impressions,
            clicks: c.stats.clicks,
            conversions: c.stats.conversions,
            cost: c.stats.cost,
            revenue: c.stats.revenue,
            ctr: c.stats.ctr,
            roas: c.stats.roas
          }
        })),
        summary: result.summary
      }
    });
  })
);

/**
 * GET /campaigns/:id
 * Get campaign by ID
 */
router.get(
  '/:id',
  validateRequest({ params: campaignIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignService.getCampaign(req.params.id);

    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    res.json({
      success: true,
      data: {
        campaign: {
          campaign_id: campaign.campaign_id,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          rules: campaign.rules,
          ab_test_config: campaign.ab_test_config,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          created_by: campaign.created_by,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at
        }
      }
    });
  })
);

/**
 * PATCH /campaigns/:id
 * Update campaign
 */
router.patch(
  '/:id',
  validateRequest({ params: campaignIdParams, body: UpdateCampaignSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignService.updateCampaign(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      rules: req.body.rules,
      status: req.body.status,
      start_date: req.body.start_date,
      end_date: req.body.end_date
    });

    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    res.json({
      success: true,
      data: {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        status: campaign.status,
        updated_at: campaign.updated_at
      },
      message: 'Campaign updated successfully'
    });
  })
);

/**
 * DELETE /campaigns/:id
 * Delete (cancel) campaign
 */
router.delete(
  '/:id',
  validateRequest({ params: campaignIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await campaignService.deleteCampaign(req.params.id);

    if (!deleted) {
      throw new NotFoundError('Campaign');
    }

    res.json({
      success: true,
      message: 'Campaign cancelled successfully'
    });
  })
);

/**
 * GET /campaigns/:id/audience
 * Preview audience matching campaign targeting rules
 */
router.get(
  '/:id/audience',
  validateRequest({ params: campaignIdParams, query: audiencePreviewQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const sampleSize = req.query.sample_size
      ? parseInt(req.query.sample_size as string)
      : 100;

    const preview = await campaignService.previewAudience(req.params.id, sampleSize);

    res.json({
      success: true,
      data: {
        campaign_id: preview.campaign_id,
        total_matching: preview.total_matching,
        by_segment: preview.by_segment,
        excluded_count: preview.excluded_count,
        breakdown: preview.breakdown,
        sampled_users: preview.sampled_users
      }
    });
  })
);

/**
 * POST /campaigns/:id/trigger
 * Trigger campaign execution for target audience
 */
router.post(
  '/:id/trigger',
  validateRequest({ params: campaignIdParams, body: triggerCampaignBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await campaignService.triggerCampaign(
      req.params.id,
      req.body.user_contexts
    );

    res.json({
      success: true,
      data: result,
      message: 'Campaign triggered successfully'
    });
  })
);

/**
 * GET /campaigns/:id/stats
 * Get detailed statistics for a campaign
 */
router.get(
  '/:id/stats',
  validateRequest({ params: campaignIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await campaignService.getCampaignStats(req.params.id);

    res.json({
      success: true,
      data: {
        campaign_id: stats.campaign_id,
        period: stats.period,
        metrics: {
          impressions: stats.impressions,
          deliveries: stats.deliveries,
          views: stats.views,
          clicks: stats.clicks,
          conversions: stats.conversions,
          revenue: stats.revenue,
          cost: stats.cost,
          ctr: stats.ctr.toFixed(2) + '%',
          conversion_rate: stats.conversion_rate.toFixed(2) + '%',
          cpc: stats.cpc.toFixed(4),
          cpm: stats.cpm.toFixed(2),
          roas: stats.roas.toFixed(2)
        },
        by_channel: stats.by_channel
      }
    });
  })
);

export default router;

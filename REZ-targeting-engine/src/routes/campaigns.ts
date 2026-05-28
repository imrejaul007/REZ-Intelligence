import { Router, Request, Response } from 'express';
import { campaignService } from '../services';
import { asyncHandler, NotFoundError } from '../middleware';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  z
} from '../schemas';
import { CampaignRules, UserContext, UserAttributes, ABTestConfig } from '../types';

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate input with Zod
    const parsedBody = CreateCampaignSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    const campaign = await campaignService.createCampaign({
      name: parsedBody.data.name,
      description: parsedBody.data.description,
      rules: parsedBody.data.rules as CampaignRules,
      ab_test_config: parsedBody.data.ab_test_config as ABTestConfig | undefined,
      start_date: parsedBody.data.start_date,
      end_date: parsedBody.data.end_date,
      created_by: parsedBody.data.created_by
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
  asyncHandler(async (req: Request, res: Response) => {
    // Parse query params
    const parsedQuery = listQuery.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid query parameters', details: parsedQuery.error.errors }
      });
    }

    const { status, created_by, limit, offset } = parsedQuery.data;

    const result = await campaignService.listCampaigns({
      status,
      created_by,
      limit,
      offset
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
          limit: limit ?? 20,
          offset: offset ?? 0
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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    const campaign = await campaignService.getCampaign(parsedParams.data.id);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = UpdateCampaignSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    // Build update input with proper types
    const updateInput: {
      name?: string;
      description?: string;
      rules?: CampaignRules;
      status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
      start_date?: string;
      end_date?: string;
    } = {};

    if (parsedBody.data.name !== undefined) updateInput.name = parsedBody.data.name;
    if (parsedBody.data.description !== undefined) updateInput.description = parsedBody.data.description;
    if (parsedBody.data.rules !== undefined) updateInput.rules = parsedBody.data.rules as CampaignRules;
    if (parsedBody.data.status !== undefined) updateInput.status = parsedBody.data.status;
    if (parsedBody.data.start_date !== undefined) updateInput.start_date = parsedBody.data.start_date;
    if (parsedBody.data.end_date !== undefined) updateInput.end_date = parsedBody.data.end_date;

    const campaign = await campaignService.updateCampaign(parsedParams.data.id, updateInput);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    const deleted = await campaignService.deleteCampaign(parsedParams.data.id);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    // Parse query params
    const parsedQuery = audiencePreviewQuery.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid query parameters', details: parsedQuery.error.errors }
      });
    }

    const sampleSize = parsedQuery.data.sample_size ?? 100;

    const preview = await campaignService.previewAudience(parsedParams.data.id, sampleSize);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    // Validate body
    const parsedBody = triggerCampaignBody.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid request body', details: parsedBody.error.errors }
      });
    }

    // Build user contexts with proper types
    const userContexts: UserContext[] = parsedBody.data.user_contexts.map(ctx => ({
      user_id: ctx.user_id,
      segments: ctx.segments ?? [],
      attributes: (ctx.attributes ?? {}) as unknown as UserAttributes,
      preferences: ctx.preferences as unknown as UserContext['preferences'] ?? {
        timezone: 'UTC',
        notification_enabled: true,
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true
      }
    }));

    const result = await campaignService.triggerCampaign(parsedParams.data.id, userContexts);

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
  asyncHandler(async (req: Request, res: Response) => {
    // Validate params
    const parsedParams = campaignIdParams.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid campaign ID', details: parsedParams.error.errors }
      });
    }

    const stats = await campaignService.getCampaignStats(parsedParams.data.id);

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

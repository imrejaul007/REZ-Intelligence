import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { socialSignalsService } from '../services/socialSignalsService';
import { TrackShareInput, TrackReferralInput, ContentType, ShareChannel } from '../types';

const router = Router();

// Validation schemas
const trackShareSchema = z.object({
  userId: z.string().min(1),
  contentType: z.enum(['offer', 'deal', 'product', 'campaign', 'store']),
  contentId: z.string().min(1),
  channel: z.enum(['whatsapp', 'instagram', 'facebook', 'twitter', 'link', 'sms', 'email']),
  recipientCount: z.number().optional(),
  clickCount: z.number().optional(),
  conversionCount: z.number().optional(),
  revenue: z.number().optional(),
  metadata: z.object({
    deviceType: z.string().optional(),
    location: z.string().optional(),
    campaignId: z.string().optional()
  }).optional()
});

const trackReferralSchema = z.object({
  referrerId: z.string().min(1),
  refereeId: z.string().optional(),
  referralCode: z.string().min(1),
  source: z.enum(['whatsapp', 'instagram', 'facebook', 'twitter', 'link', 'sms', 'email']),
  conversionValue: z.number().optional()
});

const convertReferralSchema = z.object({
  referralId: z.string().min(1),
  conversionValue: z.number().min(0)
});

const updateCommunityRoleSchema = z.object({
  eventsOrganized: z.number(),
  groupsCreated: z.number(),
  groupsJoined: z.number(),
  postsCount: z.number(),
  commentsCount: z.number(),
  reactionsCount: z.number(),
  isModerator: z.boolean(),
  moderatorCommunities: z.array(z.string()).optional()
});

// Middleware for validation
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues,
        timestamp: new Date()
      });
    }
    req.body = result.data;
    next();
  };
};

// GET /api/social/:userId - Get social profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await socialSignalsService.getUserProfile(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/:userId/influence - Get influence score
router.get('/:userId/influence', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await socialSignalsService.getInfluenceScore(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/:userId/sharing - Get sharing behavior
router.get('/:userId/sharing', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await socialSignalsService.getSharingBehavior(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/:userId/referrals - Get referral metrics
router.get('/:userId/referrals', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await socialSignalsService.getReferralMetrics(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// POST /api/social/share - Track share event
router.post('/share', validateBody(trackShareSchema), async (req: Request, res: Response) => {
  try {
    const input: TrackShareInput = req.body;
    const result = await socialSignalsService.trackShare(input);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// POST /api/social/referral - Track referral event
router.post('/referral', validateBody(trackReferralSchema), async (req: Request, res: Response) => {
  try {
    const input: TrackReferralInput = req.body;
    const result = await socialSignalsService.trackReferral(input);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// POST /api/social/referral/convert - Convert a pending referral
router.post('/referral/convert', validateBody(convertReferralSchema), async (req: Request, res: Response) => {
  try {
    const { referralId, conversionValue } = req.body;
    const result = await socialSignalsService.convertReferral(referralId, conversionValue);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/influencers - Get top influencers
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 20;

    const result = await socialSignalsService.getTopInfluencers(limit, minScore);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/influencers - Get top influencers (alias)
router.get('/influencers', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 20;

    const result = await socialSignalsService.getTopInfluencers(limit, minScore);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// GET /api/social/segments/:segment - Get users by social segment
router.get('/segments/:segment', async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;
    const validSegments = ['influencer', 'referrer', 'community_organizer', 'viral_sharer', 'engaged_user'];

    if (!validSegments.includes(segment)) {
      return res.status(400).json({
        success: false,
        error: `Invalid segment. Must be one of: ${validSegments.join(', ')}`,
        timestamp: new Date()
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const result = await socialSignalsService.getUsersBySegment(segment as any, limit);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

// PATCH /api/social/:userId/community - Update community role
router.patch('/:userId/community', validateBody(updateCommunityRoleSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await socialSignalsService.updateCommunityRole(userId, req.body);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date()
    });
  }
});

export default router;

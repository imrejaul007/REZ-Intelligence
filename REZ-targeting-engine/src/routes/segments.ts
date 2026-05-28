import { Router, Request, Response } from 'express';
import { targetingEngine } from '../services';
import { asyncHandler } from '../middleware';
import { PREDEFINED_SEGMENTS } from '../config/constants';
import { UserContext, UserAttributes } from '../types';
import { validateRequest, z } from '../schemas';

const router = Router();

// Validation schemas
const segmentIdParams = z.object({
  id: z.string().min(1),
});

const evaluateBody = z.object({
  user_context: z.object({
    user_id: z.string().min(1),
    segments: z.array(z.string()).optional(),
    attributes: z.record(z.unknown()).optional(),
    preferences: z.record(z.unknown()).optional(),
  }),
  target_segments: z.array(z.string().min(1)).min(1),
});

const checkFrequencyBody = z.object({
  user_id: z.string().min(1),
  channel: z.enum(['banner', 'push', 'in_app', 'sms', 'email']),
  campaign_id: z.string().optional(),
});

/**
 * GET /segments
 * List all available user segments
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const segments = Object.entries(PREDEFINED_SEGMENTS).map(([id, segment]) => ({
      segment_id: id,
      name: segment.name,
      description: segment.description,
      criteria_type: segment.criteria.type,
      conditions_count: segment.criteria.conditions.length,
      priority: segment.priority
    }));

    res.json({
      success: true,
      data: {
        segments,
        total: segments.length
      }
    });
  })
);

/**
 * GET /segments/:id
 * Get detailed segment definition
 */
router.get(
  '/:id',
  validateRequest({ params: segmentIdParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const segment = PREDEFINED_SEGMENTS[req.params.id as keyof typeof PREDEFINED_SEGMENTS];

    if (!segment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Segment not found' }
      });
    }

    res.json({
      success: true,
      data: {
        segment_id: req.params.id,
        name: segment.name,
        description: segment.description,
        criteria: segment.criteria,
        priority: segment.priority
      }
    });
  })
);

/**
 * POST /segments/evaluate
 * Evaluate if a user matches specific segments
 */
router.post(
  '/evaluate',
  validateRequest({ body: evaluateBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user_context, target_segments } = req.body;

    const userContext: UserContext = {
      user_id: user_context.user_id,
      segments: user_context.segments || [],
      attributes: user_context.attributes || {} as UserAttributes,
      preferences: user_context.preferences || { timezone: 'UTC', notification_enabled: true, email_enabled: true, sms_enabled: true, push_enabled: true }
    };

    const results = await Promise.all(
      target_segments.map(async (segmentId: string) => {
        const segmentDef = PREDEFINED_SEGMENTS[segmentId as keyof typeof PREDEFINED_SEGMENTS];

        if (!segmentDef) {
          return {
            segment_id: segmentId,
            found: false,
            error: 'Segment does not exist'
          };
        }

        const result = await targetingEngine.evaluateTargeting(userContext, {
          user_segments: [segmentId],
          exclusions: [],
          recency_days: 0,
          min_orders: 0
        });

        return {
          segment_id: segmentId,
          name: segmentDef.name,
          matches: result.eligible,
          segments_matched: result.segments_matched,
          confidence_score: result.confidence_score,
          priority: result.priority
        };
      })
    );

    const matchingSegments = results.filter(r => (r as { found?: boolean; matches?: boolean }).found !== false && (r as { found?: boolean; matches?: boolean }).matches);

    res.json({
      success: true,
      data: {
        user_id: userContext.user_id,
        total_segments_evaluated: target_segments.length,
        matching_count: matchingSegments.length,
        results,
        recommendation: matchingSegments.length > 0
          ? `User matches ${matchingSegments.length} of ${target_segments.length} target segments`
          : 'User does not match unknown target segments'
      }
    });
  })
);

/**
 * POST /segments/check-frequency
 * Check frequency cap for a user
 */
router.post(
  '/check-frequency',
  validateRequest({ body: checkFrequencyBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user_id, channel, campaign_id } = req.body;

    const result = await targetingEngine.checkFrequencyCap(user_id, channel, campaign_id);

    res.json({
      success: true,
      data: {
        user_id,
        channel,
        campaign_id,
        ...result
      }
    });
  })
);

/**
 * GET /segments/segments.json
 * Export all segments in a static JSON format
 */
router.get(
  '/segments.json',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      segments: PREDEFINED_SEGMENTS,
      exported_at: new Date().toISOString(),
      version: '1.0.0'
    });
  })
);

export default router;

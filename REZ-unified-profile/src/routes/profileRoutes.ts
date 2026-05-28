import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import {
  createProfile,
  getProfile,
  getProfileByIdentifier,
  enrichProfile,
  mergeProfiles,
  searchProfiles,
  getProfilesBySegment,
  getSegmentStats,
  updateProfileSegments,
  deleteProfile
} from '../services/profileService.js';
import { aggregateSignals } from '../services/signalAggregator.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { EnrichmentPayload, ProfileMergeRequest, ProfileSearchQuery } from '../types/index.js';

const router = Router();

// Internal auth middleware - validates internal service tokens
const internalAuth = createAuthMiddleware({
  internalTokens: [process.env.INTERNAL_SERVICE_TOKEN || ''],
  bypassPaths: ['/health', '/ready', '/api/health']
});

// Validation schemas
const enrichPayloadSchema = z.object({
  source: z.enum(['identity', 'cdp', 'orders', 'signals', 'manual']),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional()
});

const mergeRequestSchema = z.object({
  primaryUserId: z.string().min(1),
  secondaryUserIds: z.array(z.string()).min(1),
  strategy: z.enum(['primary-wins', 'latest-wins', 'merge-all']).optional()
});

const searchQuerySchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  segment: z.string().optional(),
  city: z.string().optional(),
  minLifetimeValue: z.coerce.number().optional(),
  maxLifetimeValue: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional()
});

const segmentQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).optional(),
  skip: z.coerce.number().min(0).optional()
});

/**
 * GET /profile/:userId
 * Get full unified profile
 */
router.get('/profile/:userId', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    let profile = await getProfile(userId);

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await createProfile(userId);
      return res.status(201).json({
        success: true,
        data: profile,
        created: true
      });
    }

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    logger.error('Error fetching profile', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * GET /profile/:userId/signals
 * Get signal scores only
 */
router.get('/profile/:userId/signals', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Refresh signals from aggregator
    const signals = await aggregateSignals(userId);

    res.json({
      success: true,
      data: signals
    });

  } catch (error) {
    logger.error('Error fetching signals', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signals',
      message: error.message
    });
  }
});

/**
 * GET /profile/:userId/segments
 * Get segment memberships
 */
router.get('/profile/:userId/segments', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: profile.userId,
        segments: profile.segments,
        segmentCount: profile.segments.length
      }
    });

  } catch (error) {
    logger.error('Error fetching segments', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segments',
      message: error.message
    });
  }
});

/**
 * GET /profile/:userId/activity
 * Get activity summary
 */
router.get('/profile/:userId/activity', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: profile.activity
    });

  } catch (error) {
    logger.error('Error fetching activity', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity',
      message: error.message
    });
  }
});

/**
 * POST /profile/:userId/enrich
 * Enrich profile with new data
 */
router.post('/profile/:userId/enrich', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate payload
    const parseResult = enrichPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        details: parseResult.error.issues
      });
    }

    const payload: EnrichmentPayload = {
      source: parseResult.data.source,
      data: parseResult.data.data,
      timestamp: parseResult.data.timestamp ? new Date(parseResult.data.timestamp) : new Date()
    };

    const updatedProfile = await enrichProfile(userId, payload);

    res.json({
      success: true,
      data: updatedProfile,
      enrichedFrom: payload.source
    });

  } catch (error) {
    logger.error('Error enriching profile', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to enrich profile',
      message: error.message
    });
  }
});

/**
 * POST /profile/merge
 * Merge multiple profiles
 */
router.post('/profile/merge', internalAuth, async (req: Request, res: Response) => {
  try {
    // Validate payload
    const parseResult = mergeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        details: parseResult.error.issues
      });
    }

    const request: ProfileMergeRequest = {
      primaryUserId: parseResult.data.primaryUserId,
      secondaryUserIds: parseResult.data.secondaryUserIds,
      strategy: parseResult.data.strategy
    };

    const mergedProfile = await mergeProfiles(request);

    res.json({
      success: true,
      data: mergedProfile,
      mergedFrom: request.secondaryUserIds,
      strategy: request.strategy || 'latest-wins'
    });

  } catch (error) {
    logger.error('Error merging profiles', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to merge profiles',
      message: error.message
    });
  }
});

/**
 * GET /profiles/search
 * Search profiles
 */
router.get('/profiles/search', internalAuth, async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.issues
      });
    }

    const query: ProfileSearchQuery = parseResult.data;

    const profiles = await searchProfiles(query);

    res.json({
      success: true,
      data: profiles,
      count: profiles.length,
      query
    });

  } catch (error) {
    logger.error('Error searching profiles', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to search profiles',
      message: error.message
    });
  }
});

/**
 * GET /segments/:segment/members
 * Get users by segment
 */
router.get('/segments/:segment/members', internalAuth, async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;

    const parseResult = segmentQuerySchema.safeParse(req.query);
    const options = parseResult.success ? parseResult.data : {};

    const profiles = await getProfilesBySegment(segment, options);

    res.json({
      success: true,
      data: profiles.map(p => ({
        userId: p.userId,
        segments: p.segments,
        lifetime: p.lifetime,
        demographics: p.demographics
      })),
      count: profiles.length,
      segment
    });

  } catch (error) {
    logger.error('Error fetching segment members', { error: error.message, segment: req.params.segment });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segment members',
      message: error.message
    });
  }
});

/**
 * GET /segments/stats
 * Get segment statistics
 */
router.get('/segments/stats', internalAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getSegmentStats();

    res.json({
      success: true,
      data: stats,
      totalSegments: Object.keys(stats).length
    });

  } catch (error) {
    logger.error('Error fetching segment stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch segment stats',
      message: error.message
    });
  }
});

/**
 * PATCH /profile/:userId/segments
 * Update profile segments
 */
router.patch('/profile/:userId/segments', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { segments } = req.body;

    if (!Array.isArray(segments)) {
      return res.status(400).json({
        success: false,
        error: 'segments must be an array'
      });
    }

    const updatedProfile = await updateProfileSegments(userId, segments);

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: updatedProfile
    });

  } catch (error) {
    logger.error('Error updating segments', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to update segments',
      message: error.message
    });
  }
});

/**
 * DELETE /profile/:userId
 * Delete a profile
 */
router.delete('/profile/:userId', internalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const deleted = await deleteProfile(userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      message: `Profile ${userId} deleted`
    });

  } catch (error) {
    logger.error('Error deleting profile', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile',
      message: error.message
    });
  }
});

/**
 * POST /profiles/lookup
 * Lookup profile by identifier (email, phone, or userId)
 */
router.post('/profiles/lookup', internalAuth, async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier is required'
      });
    }

    const profile = await getProfileByIdentifier(identifier);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    logger.error('Error looking up profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to lookup profile',
      message: error.message
    });
  }
});

export default router;

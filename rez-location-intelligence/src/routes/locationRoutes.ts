/**
 * Location Routes
 * API endpoints for user location profiles and visits
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { locationService } from '../services/index.js';
import { authMiddleware, createApiError } from '../middleware/index.js';
import type { VisitInput } from '../types/index.js';

const router = Router();

// Validation schemas
const visitInputSchema = z.object({
  userId: z.string().min(1),
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  locationType: z.enum(['mall', 'restaurant', 'office', 'college', 'airport', 'gym', 'store', 'other']),
  zone: z.string().min(1),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  dwellTimeMinutes: z.number().min(0).optional(),
  source: z.enum(['qr_scan', 'checkin', 'delivery', 'booking']),
  metadata: z.record(z.unknown()).optional()
});

const batchVisitSchema = z.object({
  visits: z.array(visitInputSchema).min(1).max(100)
});

/**
 * GET /api/location/:userId
 * Get user location profile
 */
router.get('/:userId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const profile = await locationService.getUserProfile(userId);

    if (!profile) {
      throw createApiError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/:userId/patterns
 * Get user's detected location patterns
 */
router.get('/:userId/patterns', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const profile = await locationService.getUserProfile(userId);

    if (!profile) {
      throw createApiError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        userId,
        patterns: profile.patterns,
        primaryPattern: profile.patterns.reduce(
          (max, p) => (p.confidence > (max?.confidence || 0) ? p : max),
          null
        )
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/:userId/segments
 * Get user's location segments
 */
router.get('/:userId/segments', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const profile = await locationService.getUserProfile(userId);

    if (!profile) {
      throw createApiError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        userId,
        segments: profile.segments,
        totalVisits: profile.totalVisits,
        favoriteZones: profile.favoriteZones
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/:userId/visits
 * Get user's visit history
 */
router.get('/:userId/visits', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { limit, startDate, endDate, locationType } = req.query;

    const visits = await locationService.getUserVisits(userId, {
      limit: limit ? parseInt(limit as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      locationType: locationType as string | undefined
    });

    res.json({
      success: true,
      data: {
        userId,
        visitCount: visits.length,
        visits
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/location/visit
 * Record a new location visit
 */
router.post('/visit', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = visitInputSchema.parse(req.body);
    const visit = await locationService.recordVisit(validated as VisitInput);

    res.status(201).json({
      success: true,
      data: visit,
      message: 'Visit recorded successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createApiError('Invalid request body', 400, 'VALIDATION_ERROR'));
      return;
    }
    next(error);
  }
});

/**
 * POST /api/location/visit/batch
 * Record multiple visits
 */
router.post('/visit/batch', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = batchVisitSchema.parse(req.body);
    const visits = await locationService.recordVisitBatch(validated.visits as VisitInput[]);

    res.status(201).json({
      success: true,
      data: {
        recordedCount: visits.length,
        visits
      },
      message: `${visits.length} visits recorded successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createApiError('Invalid request body', 400, 'VALIDATION_ERROR'));
      return;
    }
    next(error);
  }
});

export default router;

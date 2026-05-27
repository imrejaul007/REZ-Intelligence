/**
 * Segment Routes
 * API endpoints for segments and zones
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { locationService, analyticsService } from '../services/index.js';
import { authMiddleware, createApiError } from '../middleware/index.js';
import { getAllSegments, getSegmentDescription } from '../services/segmentService.js';
import type { UserSegment, LocationZone } from '../types/index.js';

const router = Router();

// Validation schemas
const zoneInputSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['mall', 'airport', 'college', 'office_park', 'restaurant_hub', 'residential', 'commercial', 'other']),
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number())))
  }).optional(),
  attributes: z.object({
    premium: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    footfallTier: z.enum(['low', 'medium', 'high', 'ultra']).optional()
  }).optional()
});

/**
 * GET /api/location/segments
 * List all available segments
 */
router.get('/segments', authMiddleware, (_req: Request, res: Response) => {
  const segments = getAllSegments().map(segment => ({
    id: segment,
    description: getSegmentDescription(segment)
  }));

  res.json({
    success: true,
    data: segments
  });
});

/**
 * GET /api/location/segments/:segment/users
 * Get users in a specific segment
 */
router.get('/segments/:segment/users', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { segment } = req.params;
    const { limit } = req.query;

    const userIds = await locationService.getUsersBySegment(segment, {
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({
      success: true,
      data: {
        segment,
        description: getSegmentDescription(segment as UserSegment),
        userCount: userIds.length,
        userIds: userIds.slice(0, 100)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/zone/:zone/users
 * Get users who visited a specific zone
 */
router.get('/zone/:zone/users', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zone } = req.params;
    const { since, limit } = req.query;

    const userIds = await locationService.getUsersInZone(zone, {
      since: since ? new Date(since as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({
      success: true,
      data: {
        zone,
        userCount: userIds.length,
        userIds: userIds.slice(0, 100)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/zones
 * List all zones
 */
router.get('/zones', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, premium } = req.query;

    const zones = await locationService.getAllZones({
      type: type as string | undefined,
      premium: premium === 'true' ? true : premium === 'false' ? false : undefined
    });

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/zones/:zoneId
 * Get zone details
 */
router.get('/zones/:zoneId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;

    const zone = await locationService.getZone(zoneId);

    if (!zone) {
      throw createApiError('Zone not found', 404, 'ZONE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/location/zones
 * Create a new zone
 */
router.post('/zones', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = zoneInputSchema.parse(req.body);

    const existing = await locationService.getZone(validated.zoneId);
    if (existing) {
      throw createApiError('Zone already exists', 409, 'ZONE_EXISTS');
    }

    const zone = await locationService.createZone({
      zoneId: validated.zoneId,
      name: validated.name,
      type: validated.type,
      center: validated.center,
      polygon: validated.polygon,
      attributes: {
        premium: validated.attributes?.premium || false,
        categories: validated.attributes?.categories || [],
        footfallTier: validated.attributes?.footfallTier || 'medium'
      }
    } as unknown);

    res.status(201).json({
      success: true,
      data: zone,
      message: 'Zone created successfully'
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
 * PUT /api/location/zones/:zoneId
 * Update a zone
 */
router.put('/zones/:zoneId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const updateData = req.body;

    const zone = await locationService.updateZone(zoneId, updateData as unknown);

    if (!zone) {
      throw createApiError('Zone not found', 404, 'ZONE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: zone,
      message: 'Zone updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/zones/:zoneId/analytics
 * Get zone analytics
 */
router.get('/zones/:zoneId/analytics', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const { startDate, endDate } = req.query;

    const zone = await locationService.getZone(zoneId);
    if (!zone) {
      throw createApiError('Zone not found', 404, 'ZONE_NOT_FOUND');
    }

    const analytics = await analyticsService.getZoneAnalytics(zoneId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: {
        zone: zone,
        analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

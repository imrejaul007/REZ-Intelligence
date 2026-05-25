/**
 * Analytics Routes
 * API endpoints for footfall and analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { locationService, analyticsService } from '../services/index.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

/**
 * GET /api/location/footfall
 * Get footfall analytics
 */
router.get('/footfall', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      startDate,
      endDate,
      zone,
      locationType,
      granularity = 'daily'
    } = req.query;

    const footfall = await locationService.getFootfallAnalytics({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      zone: zone as string | undefined,
      locationType: locationType as unknown,
      granularity: granularity as unknown
    });

    res.json({
      success: true,
      data: {
        count: footfall.length,
        results: footfall
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/footfall/zone/:zoneId
 * Get zone-specific footfall
 */
router.get('/footfall/zone/:zoneId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const { startDate, endDate } = req.query;

    const zone = await locationService.getZone(zoneId);
    if (!zone) {
      res.status(404).json({
        success: false,
        error: 'Zone not found'
      });
      return;
    }

    const analytics = await analyticsService.getZoneAnalytics(zoneId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: {
        zone: zone.toObject(),
        analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/dwell-time
 * Get dwell time analytics
 */
router.get('/dwell-time', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId, zone, locationType, limit = 50 } = req.query;

    const analytics = await locationService.getDwellTimeAnalytics({
      locationId: locationId as string | undefined,
      zone: zone as string | undefined,
      locationType: locationType as unknown,
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: {
        count: analytics.length,
        results: analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/heatmap
 * Get heatmap data for visualization
 */
router.get('/heatmap', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zone, startDate, endDate } = req.query;

    const heatmapData = await locationService.getHeatmapData({
      zone: zone as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: {
        count: heatmapData.length,
        points: heatmapData
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/analytics/segments
 * Get segment analytics
 */
router.get('/analytics/segments', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await analyticsService.getSegmentAnalytics();

    res.json({
      success: true,
      data: {
        count: analytics.length,
        results: analytics
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/analytics/cross-location
 * Get cross-location analysis
 */
router.get('/analytics/cross-location', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { minZones = 2, limit = 100 } = req.query;

    const analysis = await analyticsService.getCrossLocationAnalysis({
      minZones: parseInt(minZones as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: {
        count: analysis.length,
        results: analysis
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/location/analytics/trends
 * Get trend analysis
 */
router.get('/analytics/trends', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zone, metrics } = req.query;

    const trends = await analyticsService.getTrendAnalysis(
      zone as string | undefined,
      metrics ? (metrics as string).split(',') as unknown : undefined
    );

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
});

export default router;

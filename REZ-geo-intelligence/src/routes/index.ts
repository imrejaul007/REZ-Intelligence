/**
 * REZ Geo Intelligence Core - API Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graphService.js';
import { eventGraphService } from '../services/eventGraphService.js';
import { demandPredictionService } from '../services/demandService.js';
import { recommendationService } from '../services/recommendationService.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { GeoPoint, EventCategory, MerchantCategory } from '../types/index.js';

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const geoQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().min(100).max(50000).default(5000),
  categories: z.string().optional(),
  priceRange: z.string().optional(),
  minRating: z.coerce.number().optional(),
  hasOffers: z.string().optional(),
  segments: z.string().optional(),
});

const eventQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().min(100).max(50000).default(5000),
  categories: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const recommendationQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  context: z.enum(['event', 'ride', 'food', 'hotel', 'general', 'navigation']).default('general'),
  nearbyEventId: z.string().optional(),
  nearbyMerchantId: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
});

const bookingSignalSchema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  ticketTypeName: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  totalAmount: z.number().min(0),
  coinsUsed: z.number().min(0).default(0),
  bookingType: z.enum(['solo', 'couple', 'group', 'corporate']),
  spendingTier: z.enum(['budget', 'mid', 'premium', 'luxury']),
  daysInAdvance: z.number().int().min(0),
  dayOfWeek: z.string(),
  timeOfDay: z.string(),
  friendsAttending: z.number().int().min(0).default(0),
});

// ============================================
// GRAPH ROUTES
// ============================================

// GET /api/graph/stats - Get graph statistics
router.get('/graph/stats', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await graphService.getGraphStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/graph/consumer/:userId - Get consumer profile
router.get('/graph/consumer/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const consumer = await graphService.getConsumerByUserId(req.params.userId);
    if (!consumer) {
      return res.status(404).json({ success: false, error: 'Consumer not found' });
    }
    res.json({ success: true, data: consumer });
  } catch (error) {
    next(error);
  }
});

// GET /api/graph/merchants/near - Find merchants near location
router.get('/graph/merchants/near', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius, categories, priceRange, minRating, hasOffers } = geoQuerySchema.parse(req.query);

    const merchants = await graphService.findMerchantsNear(
      { type: 'Point', coordinates: [lng, lat] },
      radius,
      {
        category: categories?.split(','),
        priceRange: priceRange?.split(','),
        minRating: minRating,
        hasOffers: hasOffers === 'true',
      }
    );

    res.json({
      success: true,
      data: {
        merchants,
        meta: { count: merchants.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/graph/consumers/near - Find consumers near location
router.get('/graph/consumers/near', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius } = geoQuerySchema.parse(req.query);
    const segments = req.query.segments as string | undefined;

    const consumers = await graphService.findConsumersNear(
      { type: 'Point', coordinates: [lng, lat] },
      radius,
      { segments: segments?.split(',') }
    );

    res.json({
      success: true,
      data: {
        consumers,
        meta: { count: consumers.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EVENT GRAPH ROUTES (Z-Events Integration)
// ============================================

// POST /api/events/sync - Sync event from Z-Events
router.post('/events/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventGraphService.syncEventFromZEvents(req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

// POST /api/events/booking-signal - Capture booking signal from Z-Events
router.post('/events/booking-signal', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signal = bookingSignalSchema.parse(req.body);
    await eventGraphService.captureBookingSignal(signal as import('../services/eventGraphService.js').EventBookingSignal);
    res.json({ success: true, message: 'Booking signal captured' });
  } catch (error) {
    next(error);
  }
});

// POST /api/events/checkin-signal - Capture check-in signal
router.post('/events/checkin-signal', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, eventId } = z.object({
      userId: z.string().min(1),
      eventId: z.string().min(1),
    }).parse(req.body);

    await eventGraphService.captureCheckinSignal(userId, eventId);
    res.json({ success: true, message: 'Check-in signal captured' });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/near - Find events near location
router.get('/events/near', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius, categories, fromDate, toDate, limit } = eventQuerySchema.parse(req.query);

    const events = await eventGraphService.getEventsNear(
      { type: 'Point', coordinates: [lng, lat] },
      radius,
      {
        category: categories?.split(',') as EventCategory[],
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        limit,
      }
    );

    res.json({
      success: true,
      data: {
        events,
        meta: { count: events.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/by-affinity - Get events by user affinity
router.get('/events/by-affinity', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const events = await eventGraphService.getEventsByAffinity(req.user!.id, limit);
    res.json({ success: true, data: { events, meta: { count: events.length } } });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:eventId/demand - Get demand prediction for event
router.get('/events/:eventId/demand', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prediction = await demandPredictionService.predictEventDemand(req.params.eventId);
    res.json({ success: true, data: prediction });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:eventId/merchants - Get nearby merchants for event
router.get('/events/:eventId/merchants', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const merchants = await eventGraphService.getNearbyMerchantsForEvent(req.params.eventId, 2000, limit);
    res.json({ success: true, data: { merchants, meta: { count: merchants.length } } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DEMAND PREDICTION ROUTES
// ============================================

// GET /api/demand/zone/:zoneId - Predict demand for zone
router.get('/demand/zone/:zoneId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeSlot = req.query.time ? new Date(req.query.time as string) : new Date();
    const prediction = await demandPredictionService.predictZoneDemand(req.params.zoneId, timeSlot);
    res.json({ success: true, data: prediction });
  } catch (error) {
    next(error);
  }
});

// GET /api/demand/near - Predict demand near location
router.get('/demand/near', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius, time } = geoQuerySchema.extend({
      time: z.string().datetime().optional(),
    }).parse(req.query);

    const timeSlot = time ? new Date(time) : new Date();
    const predictions = await demandPredictionService.predictDemandNear(
      { type: 'Point', coordinates: [lng, lat] },
      radius,
      timeSlot
    );

    res.json({
      success: true,
      data: {
        predictions,
        meta: { count: predictions.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RECOMMENDATION ROUTES
// ============================================

// GET /api/recommendations - Get unified recommendations
router.get('/recommendations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = recommendationQuerySchema.parse(req.query);
    const recommendations = await recommendationService.getRecommendations({
      userId: req.user!.id,
      location: { type: 'Point', coordinates: [params.lng, params.lat] },
      context: params.context,
      nearbyEventId: params.nearbyEventId,
      nearbyMerchantId: params.nearbyMerchantId,
      limit: params.limit,
    });

    res.json({
      success: true,
      data: {
        recommendations,
        meta: { count: recommendations.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/recommendations/ride - Get ride recommendations
router.get('/recommendations/ride', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat } = geoQuerySchema.parse(req.query);
    const recommendations = await recommendationService.getRecommendations({
      userId: req.user!.id,
      location: { type: 'Point', coordinates: [lng, lat] },
      context: 'ride',
    });
    res.json({ success: true, data: { recommendations } });
  } catch (error) {
    next(error);
  }
});

// GET /api/recommendations/food - Get food recommendations
router.get('/recommendations/food', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, limit } = geoQuerySchema.extend({
      limit: z.coerce.number().min(1).max(50).default(15),
    }).parse(req.query);

    const recommendations = await recommendationService.getRecommendations({
      userId: req.user!.id,
      location: { type: 'Point', coordinates: [lng, lat] },
      context: 'food',
      limit,
    });
    res.json({ success: true, data: { recommendations } });
  } catch (error) {
    next(error);
  }
});

// POST /api/recommendations/cross-app - Sync cross-app activity
router.post('/recommendations/cross-app', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({
      app: z.enum(['zevents', 'rezride', 'merchant', 'stayown', 'buzzlocal']),
      activity: z.object({
        type: z.enum(['event_booked', 'event_attended', 'ride_taken', 'order_placed', 'hotel_booked']),
        amount: z.number().optional(),
        category: z.string().optional(),
      }),
    });
    const { app, activity } = bodySchema.parse(req.body);

    await recommendationService.syncCrossAppActivity(req.user!.id, app, activity as { type: 'event_booked' | 'event_attended' | 'ride_taken' | 'order_placed' | 'hotel_booked'; amount?: number; category?: string });
    res.json({ success: true, message: 'Activity synced' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ZONE ROUTES
// ============================================

// GET /api/zones/near - Find zones near location
router.get('/zones/near', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius } = geoQuerySchema.parse(req.query);
    const zones = await graphService.findZonesNear(
      { type: 'Point', coordinates: [lng, lat] },
      radius
    );
    res.json({ success: true, data: { zones, meta: { count: zones.length } } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ZONE HIERARCHY ROUTES (NEW)
// ============================================

import { zoneHierarchyService } from '../services/zoneHierarchyService.js';
import { syntheticDemandService } from '../services/syntheticDemandService.js';
import { ZoneLevel } from '../types/zoneHierarchy.js';

const zoneLevelSchema = z.enum(['city', 'district', 'neighborhood', 'micro_zone', 'venue_cluster']);

// GET /api/zones/cities - List all cities
router.get('/zones/cities', optionalAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cities = await zoneHierarchyService.getAllCities();
    res.json({ success: true, data: { cities, meta: { count: cities.length } } });
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/hierarchy/:zoneId - Get full hierarchy for a zone
router.get('/zones/hierarchy/:zoneId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const level = req.query.level as ZoneLevel || 'neighborhood';

    const hierarchy = await zoneHierarchyService.getZoneHierarchy(zoneId, zoneLevelSchema.parse(level));
    res.json({ success: true, data: hierarchy });
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/lookup - Reverse geocode a point to zone hierarchy
router.get('/zones/lookup', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat } = z.object({
      lng: z.coerce.number().min(-180).max(180),
      lat: z.coerce.number().min(-90).max(90),
    }).parse(req.query);

    const zones = await zoneHierarchyService.findZonesAtPoint(lng, lat);
    res.json({ success: true, data: zones });
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/:level - List zones by level
router.get('/zones/:level', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const level = zoneLevelSchema.parse(req.params.level);
    const { parentId } = req.query;

    let zones: unknown[] = [];
    switch (level) {
      case 'city':
        zones = await zoneHierarchyService.getAllCities();
        break;
      case 'district':
        if (parentId) {
          zones = await zoneHierarchyService.getDistrictsByCity(parentId as string);
        }
        break;
      case 'neighborhood':
        if (parentId) {
          zones = await zoneHierarchyService.getNeighborhoodsByDistrict(parentId as string);
        }
        break;
      case 'micro_zone':
        if (parentId) {
          zones = await zoneHierarchyService.getMicroZonesByNeighborhood(parentId as string);
        }
        break;
      case 'venue_cluster':
        if (parentId) {
          zones = await zoneHierarchyService.getVenueClustersByMicroZone(parentId as string);
        }
        break;
    }

    res.json({ success: true, data: { zones, meta: { level, parentId: parentId || null, count: zones.length } } });
  } catch (error) {
    next(error);
  }
});

// GET /api/zones/:level/:zoneId - Get specific zone
router.get('/zones/:level/:zoneId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level, zoneId } = req.params;
    zoneLevelSchema.parse(level);

    let zone: unknown = null;
    switch (level) {
      case 'city':
        zone = await zoneHierarchyService.getCity(zoneId);
        break;
      case 'district':
        zone = await zoneHierarchyService.getDistrict(zoneId);
        break;
      case 'neighborhood':
        zone = await zoneHierarchyService.getNeighborhood(zoneId);
        break;
      case 'micro_zone':
        zone = await zoneHierarchyService.getMicroZone(zoneId);
        break;
      case 'venue_cluster':
        zone = await zoneHierarchyService.getVenueCluster(zoneId);
        break;
    }

    if (!zone) {
      return res.status(404).json({ success: false, error: 'Zone not found' });
    }

    res.json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
});

// POST /api/zones/seed - Seed sample zone data (Koramangala)
router.post('/zones/seed', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await zoneHierarchyService.seedKoramangala();
    res.json({ success: true, message: 'Zone data seeded successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DEMAND INDEX ROUTES (NEW)
// ============================================

// GET /api/demand-index/:zoneId - Get synthetic demand index for zone
router.get('/demand-index/:zoneId', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const level = req.query.level as ZoneLevel || 'neighborhood';
    const { lng, lat } = z.object({
      lng: z.coerce.number().min(-180).max(180).optional(),
      lat: z.coerce.number().min(-90).max(90).optional(),
    }).parse(req.query);

    const location = lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
    const index = await syntheticDemandService.computeDemandIndex(zoneId, zoneLevelSchema.parse(level), location);

    res.json({ success: true, data: index });
  } catch (error) {
    next(error);
  }
});

// GET /api/demand-index/near - Get demand indices for zones near location
router.get('/demand-index/near', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lng, lat, radius, level } = z.object({
      lng: z.coerce.number().min(-180).max(180),
      lat: z.coerce.number().min(-90).max(90),
      radius: z.coerce.number().min(100).max(50000).default(5000),
      level: zoneLevelSchema.optional(),
    }).parse(req.query);

    const map = await syntheticDemandService.computeDemandIndexMap(
      { lat, lng },
      radius,
      level ? zoneLevelSchema.parse(level) : 'neighborhood'
    );

    res.json({ success: true, data: map });
  } catch (error) {
    next(error);
  }
});

// GET /api/demand-index/:zoneId/history - Get demand history
router.get('/demand-index/:zoneId/history', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const { from, to } = z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(req.query);

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 days
    const toDate = to ? new Date(to) : new Date();

    const history = await syntheticDemandService.getDemandHistory(zoneId, fromDate, toDate);
    res.json({ success: true, data: { history, meta: { count: history.length } } });
  } catch (error) {
    next(error);
  }
});

// GET /api/demand-index/:zoneId/forecast - Get demand forecast
router.get('/demand-index/:zoneId/forecast', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const hoursAhead = parseInt(req.query.hours as string) || 24;

    const forecast = await syntheticDemandService.getDemandForecast(zoneId, hoursAhead);
    res.json({ success: true, data: { forecast, meta: { hoursAhead, count: forecast.length } } });
  } catch (error) {
    next(error);
  }
});

export default router;

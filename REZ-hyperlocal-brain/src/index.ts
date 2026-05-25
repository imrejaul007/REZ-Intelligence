/**
 * REZ Hyperlocal Brain - Main Server
 *
 * Hyperlocal Intelligence Engine - Location-aware AI with geospatial intelligence
 * Port: 4148
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger';
import {
  analyzeLocation,
  searchNearby,
  predictLocation,
  getZoneInsights,
  createZone,
  getZone,
  listZones,
  createHotspot,
  getHotspot,
  findNearbyHotspots,
  createSegment,
  getSegment,
  listSegments,
  calculateDistance,
  getHealthStatus,
  getStats,
} from './hyperlocalService';
import type {
  GeoPoint,
  SearchNearbyRequest,
  AnalyzeLocationRequest,
  PredictLocationRequest,
  GetZoneInsightsRequest,
  CreateSegmentRequest,
  SegmentType,
  ZoneType,
  HotspotType,
} from './types';

const app = express();
const PORT = process.env.PORT || 4148;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { query: req.query, ip: req.ip });
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().optional(),
});

const locationContextSchema = z.object({
  userId: z.string().optional(),
  entityId: z.string(),
  entityType: z.enum(['user', 'merchant', 'event', 'poi']),
  location: geoPointSchema,
  timestamp: z.string().datetime().or(z.date()),
  accuracy: z.number().optional(),
  source: z.enum(['gps', 'wifi', 'cell', 'ip', 'beacon', 'manual']),
});

const analyzeLocationSchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['user', 'merchant']),
  locations: z.array(locationContextSchema).min(1),
  options: z.object({
    detectPatterns: z.boolean().optional(),
    predictNext: z.boolean().optional(),
    analyzeZones: z.boolean().optional(),
  }).optional(),
});

const searchNearbySchema = z.object({
  location: geoPointSchema,
  radius: z.number().min(100).max(50000),
  query: z.string().optional(),
  categories: z.array(z.string()).optional(),
  filters: z.object({
    openNow: z.boolean().optional(),
    priceLevel: z.array(z.number()).optional(),
    rating: z.number().optional(),
    distance: z.number().optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
  limit: z.number().min(1).max(100).optional(),
  sortBy: z.enum(['distance', 'rating', 'reviews', 'popularity', 'price']).optional(),
});

const predictLocationSchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['user', 'merchant']),
  currentLocation: geoPointSchema,
  time: z.string().datetime().or(z.date()),
});

const createZoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['neighborhood', 'city', 'district', 'business_district', 'residential', 'commercial', 'mixed_use', 'transit_hub', 'attraction', 'custom']),
  geometry: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }),
  properties: z.object({
    population: z.number().optional(),
    density: z.number().optional(),
    medianIncome: z.number().optional(),
    tags: z.array(z.string()),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const createHotspotSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['commercial', 'transit', 'social', 'food', 'entertainment', 'shopping', 'office', 'residential']),
  location: geoPointSchema,
  radius: z.number().min(10).max(1000),
  properties: z.object({
    categories: z.array(z.string()),
    merchantCount: z.number(),
    averageRating: z.number().optional(),
    priceLevel: z.number().optional(),
  }),
  activity: z.object({
    current: z.number(),
    average: z.number(),
    peak: z.number(),
    trend: z.enum(['increasing', 'stable', 'decreasing']),
    density: z.enum(['low', 'medium', 'high']),
  }),
  score: z.number().min(0).max(1),
});

const createSegmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['behavioral', 'demographic', 'geographic', 'temporal', 'intent', 'lifecycle', 'custom']),
  zone: z.string().optional(),
  radius: z.number().optional(),
  center: geoPointSchema.optional(),
  characteristics: z.object({
    ageRange: z.object({ min: z.number(), max: z.number() }).optional(),
    incomeLevel: z.enum(['low', 'middle', 'high', 'affluent']).optional(),
    lifestyle: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    behaviors: z.array(z.string()).optional(),
  }),
  size: z.number().optional(),
  score: z.number().optional(),
});

// ============================================
// LOCATION ANALYSIS
// ============================================

/**
 * POST /api/locations/analyze
 * Analyze user/merchant locations
 */
app.post('/api/locations/analyze', async (req: Request, res: Response) => {
  try {
    const validation = analyzeLocationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: AnalyzeLocationRequest = {
      ...validation.data,
      locations: validation.data.locations.map(l => ({
        ...l,
        timestamp: new Date(l.timestamp),
      })),
    };

    const result = await analyzeLocation(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Location analysis error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/locations/predict
 * Predict next location
 */
app.post('/api/locations/predict', async (req: Request, res: Response) => {
  try {
    const validation = predictLocationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: PredictLocationRequest = {
      ...validation.data,
      time: new Date(validation.data.time),
    };

    const result = await predictLocation(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ============================================
// SEARCH & DISCOVERY
// ============================================

/**
 * POST /api/search/nearby
 * Search for nearby places
 */
app.post('/api/search/nearby', async (req: Request, res: Response) => {
  try {
    const validation = searchNearbySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: SearchNearbyRequest = validation.data;
    const result = await searchNearby(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Nearby search error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions
 */
app.get('/api/search/suggestions', (req: Request, res: Response) => {
  const { query } = req.query;

  res.json({
    success: true,
    suggestions: [
      { text: 'Coffee shops nearby', category: 'food' },
      { text: 'Gas stations', category: 'services' },
      { text: 'Shopping malls', category: 'retail' },
    ],
  });
});

// ============================================
// ZONES
// ============================================

/**
 * POST /api/zones
 * Create a new zone
 */
app.post('/api/zones', async (req: Request, res: Response) => {
  try {
    const validation = createZoneSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const zone = await createZone(validation.data);
    res.status(201).json({ success: true, zone });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/zones
 * List zones
 */
app.get('/api/zones', async (req: Request, res: Response) => {
  const { type } = req.query;
  const zones = await listZones({ type: type as ZoneType | undefined });
  res.json({ success: true, zones });
});

/**
 * GET /api/zones/:zoneId
 * Get zone details
 */
app.get('/api/zones/:zoneId', async (req: Request, res: Response) => {
  const zone = await getZone(req.params.zoneId);
  if (!zone) {
    return res.status(404).json({ success: false, error: 'Zone not found' });
  }
  res.json({ success: true, zone });
});

/**
 * GET /api/zones/:zoneId/insights
 * Get zone insights
 */
app.get('/api/zones/:zoneId/insights', async (req: Request, res: Response) => {
  const request: GetZoneInsightsRequest = { zoneId: req.params.zoneId };
  const result = await getZoneInsights(request);
  res.json(result);
});

// ============================================
// HOTSPOTS
// ============================================

/**
 * POST /api/hotspots
 * Create a new hotspot
 */
app.post('/api/hotspots', async (req: Request, res: Response) => {
  try {
    const validation = createHotspotSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const hotspot = await createHotspot(validation.data);
    res.status(201).json({ success: true, hotspot });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/hotspots
 * List hotspots
 */
app.get('/api/hotspots', async (req: Request, res: Response) => {
  const { lat, lng, radius, type } = req.query;

  if (lat && lng && radius) {
    const location: GeoPoint = {
      lat: parseFloat(lat as string),
      lng: parseFloat(lng as string),
    };
    const hotspots = await findNearbyHotspots(
      location,
      parseFloat(radius as string),
      { type: type as HotspotType }
    );
    return res.json({ success: true, hotspots });
  }

  res.json({ success: true, hotspots: [] });
});

/**
 * GET /api/hotspots/:hotspotId
 * Get hotspot details
 */
app.get('/api/hotspots/:hotspotId', async (req: Request, res: Response) => {
  const hotspot = await getHotspot(req.params.hotspotId);
  if (!hotspot) {
    return res.status(404).json({ success: false, error: 'Hotspot not found' });
  }
  res.json({ success: true, hotspot });
});

// ============================================
// SEGMENTS
// ============================================

/**
 * POST /api/segments
 * Create a new segment
 */
app.post('/api/segments', async (req: Request, res: Response) => {
  try {
    const validation = createSegmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const segment = await createSegment({
      ...validation.data,
      characteristics: {
        ...validation.data.characteristics,
        visitPatterns: {
          frequency: 'weekly',
          preferredTimes: [10, 14, 18],
          preferredDays: [1, 3, 5],
          avgDwellTime: 60,
        },
      },
      size: validation.data.size || 0,
      score: validation.data.score || 0,
    });
    res.status(201).json({ success: true, segment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/segments
 * List segments
 */
app.get('/api/segments', async (req: Request, res: Response) => {
  const { type, zone } = req.query;
  const segments = await listSegments({
    type: type as SegmentType | undefined,
    zone: zone as string | undefined,
  });
  res.json({ success: true, segments });
});

/**
 * GET /api/segments/:segmentId
 * Get segment details
 */
app.get('/api/segments/:segmentId', async (req: Request, res: Response) => {
  const segment = await getSegment(req.params.segmentId);
  if (!segment) {
    return res.status(404).json({ success: false, error: 'Segment not found' });
  }
  res.json({ success: true, segment });
});

// ============================================
// GEOSPATIAL UTILITIES
// ============================================

/**
 * GET /api/geo/distance
 * Calculate distance between two points
 */
app.get('/api/geo/distance', (req: Request, res: Response) => {
  const { lat1, lng1, lat2, lng2 } = req.query;

  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return res.status(400).json({ success: false, error: 'All coordinates required' });
  }

  const distance = calculateDistance(
    { lat: parseFloat(lat1 as string), lng: parseFloat(lng1 as string) },
    { lat: parseFloat(lat2 as string), lng: parseFloat(lng2 as string) }
  );

  res.json({
    success: true,
    distance,
    unit: 'meters',
  });
});

// ============================================
// TRIPS & PATTERNS
// ============================================

/**
 * GET /api/trips/:userId
 * Get trip patterns for user
 */
app.get('/api/trips/:userId', (req: Request, res: Response) => {
  res.json({
    success: true,
    userId: req.params.userId,
    trips: [],
  });
});

/**
 * GET /api/stays/:userId
 * Get stay patterns for user
 */
app.get('/api/stays/:userId', (req: Request, res: Response) => {
  res.json({
    success: true,
    userId: req.params.userId,
    homeLocation: null,
    workLocation: null,
    frequentLocations: [],
  });
});

// ============================================
// MOBILITY
// ============================================

/**
 * GET /api/mobility/:entityId
 * Get mobility metrics for entity
 */
app.get('/api/mobility/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { entityType } = req.query;

  res.json({
    success: true,
    entityId,
    entityType: entityType || 'user',
    metrics: {
      totalDistance: 0,
      avgTripDistance: 0,
      totalTrips: 0,
      avgTripDuration: 0,
      radiusOfGyration: 0,
      entropy: 0,
    },
  });
});

// ============================================
// STATS & HEALTH
// ============================================

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = getHealthStatus();
  res.json({ success: true, ...health });
});

/**
 * GET /api/stats
 * Get service statistics
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({ success: true, ...stats });
});

// ============================================
// ROOT
// ============================================

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Hyperlocal Brain',
    version: '1.0.0',
    description: 'Hyperlocal Intelligence Engine - Location-aware AI',
    port: PORT,
    endpoints: {
      locations: [
        'POST /api/locations/analyze - Analyze locations',
        'POST /api/locations/predict - Predict next location',
      ],
      search: [
        'POST /api/search/nearby - Search nearby',
        'GET /api/search/suggestions - Get suggestions',
      ],
      zones: [
        'POST /api/zones - Create zone',
        'GET /api/zones - List zones',
        'GET /api/zones/:zoneId - Get zone',
        'GET /api/zones/:zoneId/insights - Get insights',
      ],
      hotspots: [
        'POST /api/hotspots - Create hotspot',
        'GET /api/hotspots - List hotspots',
        'GET /api/hotspots/:hotspotId - Get hotspot',
      ],
      segments: [
        'POST /api/segments - Create segment',
        'GET /api/segments - List segments',
        'GET /api/segments/:segmentId - Get segment',
      ],
      geo: [
        'GET /api/geo/distance - Calculate distance',
      ],
      trips: [
        'GET /api/trips/:userId - Get trips',
        'GET /api/stays/:userId - Get stays',
      ],
      mobility: [
        'GET /api/mobility/:entityId - Get mobility metrics',
      ],
      health: [
        'GET /api/health - Health check',
      ],
      stats: [
        'GET /api/stats - Get stats',
      ],
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Hyperlocal Brain started on port ${PORT}`);
});

export default app;

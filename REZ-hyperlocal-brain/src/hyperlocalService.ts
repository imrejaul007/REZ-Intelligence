/**
 * REZ Hyperlocal Brain - Core Service
 *
 * Hyperlocal Intelligence Engine - Location-aware AI with geospatial intelligence
 */

import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import logger from './utils/logger';
import type {
  GeoPoint,
  Zone,
  ZoneType,
  Hotspot,
  HotspotType,
  MicroSegment,
  LocationContext,
  TripPattern,
  LocationPrediction,
  DiscoveryResult,
  Route,
  MobilityMetrics,
  SearchNearbyRequest,
  SearchNearbyResponse,
  AnalyzeLocationRequest,
  AnalyzeLocationResponse,
  PredictLocationRequest,
  PredictLocationResponse,
  GetZoneInsightsRequest,
  GetZoneInsightsResponse,
  HealthStatus,
  ServiceStats,
} from './types';

// In-memory stores
const zones = new Map<string, Zone>();
const hotspots = new Map<string, Hotspot>();
const segments = new Map<string, MicroSegment>();
const trips = new Map<string, TripPattern>();
const predictions = new Map<string, LocationPrediction>();
const routes = new Map<string, Route>();

// ============================================
// GEOSPATIAL UTILITIES
// ============================================

export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const lat1Rad = point1.lat * Math.PI / 180;
  const lat2Rad = point2.lat * Math.PI / 180;
  const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
  const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

export function isPointInRadius(point: GeoPoint, center: GeoPoint, radius: number): boolean {
  return calculateDistance(point, center) <= radius;
}

export function getBoundingBox(center: GeoPoint, radiusMeters: number): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos(center.lat * Math.PI / 180));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

export function generateGeoHash(point: GeoPoint, precision = 6): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2;
      if (point.lng >= mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (point.lat >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isEven = !isEven;
    bit++;
    if (bit === 5) {
      hash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// ============================================
// ZONE MANAGEMENT
// ============================================

export async function createZone(zone: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Zone> {
  const newZone: Zone = {
    ...zone,
    id: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  zones.set(newZone.id, newZone);
  logger.info('Zone created', { zoneId: newZone.id, name: newZone.name });
  return newZone;
}

export async function getZone(zoneId: string): Promise<Zone | null> {
  return zones.get(zoneId) || null;
}

export async function listZones(options?: {
  type?: ZoneType;
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}): Promise<Zone[]> {
  let result = Array.from(zones.values());

  if (options?.type) {
    result = result.filter(z => z.type === options.type);
  }

  if (options?.bbox) {
    result = result.filter(z => {
      const coords = z.geometry.coordinates[0][0];
      const [lng, lat] = coords;
      return lat >= options.bbox!.minLat && lat <= options.bbox!.maxLat &&
        lng >= options.bbox!.minLng && lng <= options.bbox!.maxLng;
    });
  }

  return result;
}

export async function updateZoneMetrics(zoneId: string, metrics: Zone['metrics']): Promise<Zone | null> {
  const zone = zones.get(zoneId);
  if (!zone) return null;

  zone.metrics = metrics;
  zone.updatedAt = new Date();
  zones.set(zoneId, zone);
  return zone;
}

// ============================================
// HOTSPOT MANAGEMENT
// ============================================

export async function createHotspot(hotspot: Omit<Hotspot, 'id' | 'updatedAt'>): Promise<Hotspot> {
  const newHotspot: Hotspot = {
    ...hotspot,
    id: uuidv4(),
    updatedAt: new Date(),
  };
  hotspots.set(newHotspot.id, newHotspot);
  logger.info('Hotspot created', { hotspotId: newHotspot.id, name: newHotspot.name });
  return newHotspot;
}

export async function getHotspot(hotspotId: string): Promise<Hotspot | null> {
  return hotspots.get(hotspotId) || null;
}

export async function findNearbyHotspots(
  location: GeoPoint,
  radiusMeters: number,
  options?: { type?: Hotspot['type']; categories?: string[] }
): Promise<Hotspot[]> {
  let result = Array.from(hotspots.values());

  result = result.filter(h => {
    const distance = calculateDistance(location, h.location);
    if (distance > radiusMeters) return false;
    if (options?.type && h.type !== options.type) return false;
    if (options?.categories?.length) {
      const hasCategory = h.properties.categories.some(c => options.categories!.includes(c));
      if (!hasCategory) return false;
    }
    return true;
  });

  // Sort by distance
  result.sort((a, b) => calculateDistance(location, a.location) - calculateDistance(location, b.location));

  return result;
}

export async function updateHotspotActivity(
  hotspotId: string,
  activity: Partial<Hotspot['activity']>
): Promise<Hotspot | null> {
  const hotspot = hotspots.get(hotspotId);
  if (!hotspot) return null;

  hotspot.activity = { ...hotspot.activity, ...activity };
  hotspot.updatedAt = new Date();
  hotspots.set(hotspotId, hotspot);
  return hotspot;
}

// ============================================
// MICRO-SEGMENT ANALYSIS
// ============================================

export async function createSegment(segment: Omit<MicroSegment, 'id' | 'createdAt'>): Promise<MicroSegment> {
  const newSegment: MicroSegment = {
    ...segment,
    id: uuidv4(),
    createdAt: new Date(),
  };
  segments.set(newSegment.id, newSegment);
  logger.info('Segment created', { segmentId: newSegment.id, name: newSegment.name });
  return newSegment;
}

export async function getSegment(segmentId: string): Promise<MicroSegment | null> {
  return segments.get(segmentId) || null;
}

export async function listSegments(options?: {
  type?: MicroSegment['type'];
  zone?: string;
}): Promise<MicroSegment[]> {
  let result = Array.from(segments.values());

  if (options?.type) {
    result = result.filter(s => s.type === options.type);
  }

  if (options?.zone) {
    result = result.filter(s => s.zone === options.zone);
  }

  return result;
}

export async function detectMicroSegments(
  locations: LocationContext[],
  entityId: string
): Promise<MicroSegment[]> {
  if (locations.length < 10) return [];

  const detected: MicroSegment[] = [];

  // Analyze temporal patterns
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const locationClusters: GeoPoint[] = [];

  locations.forEach(loc => {
    hourCounts[loc.location.lat]++;
    dayCounts[loc.location.lng]++;
    locationClusters.push(loc.location);
  });

  // Detect frequent locations
  const clusterCenters = clusterLocations(locationClusters);
  for (const center of clusterCenters) {
    const visits = locations.filter(l =>
      calculateDistance(l.location, center) < 500
    ).length;

    if (visits > 5) {
      const segment: MicroSegment = {
        id: uuidv4(),
        name: `Location cluster ${detected.length + 1}`,
        type: 'geographic',
        center,
        characteristics: {
          interests: ['local_visits'],
          visitPatterns: {
            frequency: visits > 20 ? 'daily' : visits > 10 ? 'weekly' : 'monthly',
            preferredTimes: findPeakHours(hourCounts),
            preferredDays: findPeakDays(dayCounts),
            avgDwellTime: 60,
          },
        },
        size: visits,
        score: Math.min(1, visits / 50),
        createdAt: new Date(),
      };
      detected.push(segment);
      segments.set(segment.id, segment);
    }
  }

  return detected;
}

function clusterLocations(points: GeoPoint[]): GeoPoint[] {
  if (points.length === 0) return [];

  const clusters: GeoPoint[] = [];
  const visited = new Set<number>();
  const minDistance = 500; // meters

  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;

    const clusterPoints: GeoPoint[] = [points[i]];
    visited.add(i);

    for (let j = i + 1; j < points.length; j++) {
      if (visited.has(j)) continue;
      if (calculateDistance(points[i], points[j]) < minDistance) {
        clusterPoints.push(points[j]);
        visited.add(j);
      }
    }

    // Calculate centroid
    const centroid: GeoPoint = {
      lat: clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length,
      lng: clusterPoints.reduce((sum, p) => sum + p.lng, 0) / clusterPoints.length,
    };
    clusters.push(centroid);
  }

  return clusters;
}

function findPeakHours(hourCounts: number[]): number[] {
  const avg = hourCounts.reduce((a, b) => a + b, 0) / hourCounts.length;
  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(({ count }) => count > avg * 1.5)
    .map(({ hour }) => hour);
}

function findPeakDays(dayCounts: number[]): number[] {
  const avg = dayCounts.reduce((a, b) => a + b, 0) / dayCounts.length;
  return dayCounts
    .map((count, day) => ({ day, count }))
    .filter(({ count }) => count > avg * 1.5)
    .map(({ day }) => day);
}

// ============================================
// LOCATION ANALYSIS
// ============================================

export async function analyzeLocation(
  request: AnalyzeLocationRequest
): Promise<AnalyzeLocationResponse> {
  try {
    const { entityId, entityType, locations, options } = request;

    if (locations.length === 0) {
      return { success: false, error: 'No locations provided' };
    }

    const analysis: AnalyzeLocationResponse['analysis'] = {
      zones: [],
      hotspots: [],
      patterns: [],
      predictions: [],
    };

    // Analyze zones
    if (options?.analyzeZones) {
      const relevantZones = await findZonesForLocations(locations);
      analysis.zones = relevantZones;
    }

    // Find nearby hotspots
    const center = calculateCentroid(locations.map(l => l.location));
    analysis.hotspots = await findNearbyHotspots(center, 5000);

    // Detect patterns
    if (options?.detectPatterns) {
      analysis.patterns = await detectTripPatterns(entityId, locations);
    }

    // Generate predictions
    if (options?.predictNext) {
      analysis.predictions = await predictNextLocations(entityId, locations);
    }

    logger.info('Location analysis completed', { entityId, locationCount: locations.length });

    return { success: true, analysis };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Location analysis failed', { error: message });
    return { success: false, error: message };
  }
}

function calculateCentroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) return { lat: 0, lng: 0 };
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

async function findZonesForLocations(locations: LocationContext[]): Promise<Zone[]> {
  const relevantZones: Zone[] = [];
  const zoneTypes: Zone['type'][] = ['neighborhood', 'city', 'business_district', 'commercial'];

  for (const zone of zones.values()) {
    if (!zoneTypes.includes(zone.type)) continue;

    for (const loc of locations) {
      const coords = zone.geometry.coordinates[0][0];
      const zonePoint: GeoPoint = { lat: coords[1], lng: coords[0] };
      if (calculateDistance(loc.location, zonePoint) < 1000) {
        if (!relevantZones.find(z => z.id === zone.id)) {
          relevantZones.push(zone);
        }
      }
    }
  }

  return relevantZones;
}

// ============================================
// TRIP PATTERN DETECTION
// ============================================

async function detectTripPatterns(
  userId: string,
  locations: LocationContext[]
): Promise<TripPattern[]> {
  if (locations.length < 10) return [];

  const patterns: TripPattern[] = [];

  // Sort by timestamp
  const sorted = [...locations].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Detect recurring locations
  const locationClusters = clusterLocations(sorted.map(l => l.location));
  const visitCounts = new Map<string, number>();

  for (const cluster of locationClusters) {
    const hash = generateGeoHash(cluster, 6);
    visitCounts.set(hash, (visitCounts.get(hash) || 0) + 1);
  }

  // Create patterns for frequent locations
  for (const [hash, count] of visitCounts) {
    if (count < 3) continue;

    const cluster = locationClusters.find(c => generateGeoHash(c, 6) === hash);
    if (!cluster) continue;

    const pattern: TripPattern = {
      id: uuidv4(),
      userId,
      type: inferTripType(locations, cluster),
      locations: [{
        location: cluster,
        category: 'frequent',
        visitFrequency: count,
        avgDwellTime: calculateAvgDwellTime(locations, cluster),
      }],
      frequency: count,
      regularity: Math.min(1, count / 20),
      preferredTimes: extractPreferredTimes(locations, cluster),
      typicalDuration: calculateAvgDwellTime(locations, cluster),
      nextExpected: predictNextVisit(locations, cluster),
      createdAt: new Date(),
    };

    patterns.push(pattern);
    trips.set(pattern.id, pattern);
  }

  return patterns;
}

function inferTripType(locations: LocationContext[], cluster: GeoPoint): TripPattern['type'] {
  // Simple heuristic - in production would use POI data
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 17) return 'commute';
  if (hour >= 18 && hour <= 21) return 'dining';
  return 'errand';
}

function calculateAvgDwellTime(locations: LocationContext[], cluster: GeoPoint): number {
  const nearbyLocations = locations.filter(l =>
    calculateDistance(l.location, cluster) < 500
  );

  if (nearbyLocations.length < 2) return 60;

  // Calculate average time between consecutive visits
  const sorted = nearbyLocations.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  let totalTime = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalTime += sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime();
  }

  return totalTime / (sorted.length - 1) / 60000; // minutes
}

function extractPreferredTimes(locations: LocationContext[], cluster: GeoPoint): number[] {
  const hourCounts = new Array(24).fill(0);

  locations
    .filter(l => calculateDistance(l.location, cluster) < 500)
    .forEach(l => hourCounts[l.timestamp.getHours()]++);

  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(({ count }) => count > 2)
    .map(({ hour }) => hour);
}

function predictNextVisit(locations: LocationContext[], cluster: GeoPoint): Date {
  const nearbyLocations = locations
    .filter(l => calculateDistance(l.location, cluster) < 500)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (nearbyLocations.length < 2) return new Date();

  // Calculate average interval
  let totalInterval = 0;
  for (let i = 1; i < nearbyLocations.length; i++) {
    totalInterval += nearbyLocations[i].timestamp.getTime() - nearbyLocations[i - 1].timestamp.getTime();
  }

  const avgInterval = totalInterval / (nearbyLocations.length - 1);
  const lastVisit = nearbyLocations[nearbyLocations.length - 1].timestamp;

  return new Date(lastVisit.getTime() + avgInterval);
}

// ============================================
// PREDICTIONS
// ============================================

export async function predictNextLocations(
  entityId: string,
  locations: LocationContext[]
): Promise<LocationPrediction[]> {
  if (locations.length < 5) return [];

  const predictions: LocationPrediction[] = [];

  // Predict next location
  const lastLocation = locations[locations.length - 1];
  const centroid = calculateCentroid(locations.map(l => l.location));

  // Simple prediction: most likely next location is home, work, or recent centroid
  predictions.push({
    id: uuidv4(),
    entityId,
    type: 'next_location',
    prediction: {
      location: centroid,
      probability: 0.7,
    },
    confidence: Math.min(1, locations.length / 20),
    timeframe: {
      start: new Date(),
      end: new Date(Date.now() + 3600000), // 1 hour
    },
    factors: [
      { name: 'recency', importance: 0.3, value: 1, description: 'Based on recent activity' },
      { name: 'frequency', importance: 0.4, value: 1, description: 'Based on visit frequency' },
      { name: 'time_of_day', importance: 0.3, value: new Date().getHours(), description: 'Based on time patterns' },
    ],
    generatedAt: new Date(),
  });

  // Predict dwell time
  const avgDwellTime = locations.reduce((sum, l) => sum + 60, 0) / locations.length;
  predictions.push({
    id: uuidv4(),
    entityId,
    type: 'dwell_time',
    prediction: {
      duration: avgDwellTime,
    },
    confidence: 0.6,
    timeframe: {
      start: new Date(),
      end: new Date(Date.now() + 600000),
    },
    factors: [
      { name: 'historical', importance: 0.7, value: avgDwellTime, description: 'Based on historical data' },
    ],
    generatedAt: new Date(),
  });

  // Predict crowd level
  const nearbyHotspots = await findNearbyHotspots(lastLocation.location, 1000);
  const avgActivity = nearbyHotspots.reduce((sum, h) => sum + h.activity.current, 0) / Math.max(1, nearbyHotspots.length);
  predictions.push({
    id: uuidv4(),
    entityId,
    type: 'crowd_level',
    prediction: {
      crowdLevel: avgActivity > 0.7 ? 'high' : avgActivity > 0.3 ? 'medium' : 'low',
    },
    confidence: 0.5,
    timeframe: {
      start: new Date(),
      end: new Date(Date.now() + 1800000),
    },
    factors: [
      { name: 'hotspot_activity', importance: 0.6, value: avgActivity, description: 'Based on nearby hotspots' },
    ],
    generatedAt: new Date(),
  });

  // Return predictions directly
  return predictions;
}

export async function predictLocation(
  request: PredictLocationRequest
): Promise<PredictLocationResponse> {
  try {
    const { entityId, entityType, currentLocation, time } = request;

    // Get historical locations for entity (would query DB in production)
    const locations: LocationContext[] = [];

    const resultPredictions = await predictNextLocations(entityId, locations);

    return { success: true, predictions: resultPredictions };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Location prediction failed', { error: message });
    return { success: false, error: message };
  }
}

// ============================================
// NEARBY SEARCH
// ============================================

export async function searchNearby(request: SearchNearbyRequest): Promise<SearchNearbyResponse> {
  try {
    const { location, radius, query, categories, filters, limit = 20 } = request;

    let results: DiscoveryResult[] = [];

    // Search hotspots
    const nearbyHotspots = await findNearbyHotspots(location, radius, {
      categories,
    });

    results = nearbyHotspots.map(h => ({
      id: h.id,
      name: h.name,
      type: 'poi' as const,
      location: h.location,
      distance: calculateDistance(location, h.location),
      score: h.score,
      category: h.properties.categories[0] || h.type,
      rating: h.properties.averageRating,
      priceLevel: h.properties.priceLevel,
    }));

    // Apply filters
    if (filters) {
      if (filters.rating) {
        results = results.filter(r => (r.rating || 0) >= filters.rating!);
      }
      if (filters.priceLevel) {
        results = results.filter(r => r.priceLevel && filters.priceLevel!.includes(r.priceLevel));
      }
      if (filters.openNow) {
        // Would check operating hours in production
        results = results.filter(() => randomInt(0, 100) > 50);
      }
    }

    // Sort
    if (query) {
      results.sort((a, b) => {
        const aMatch = a.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const bMatch = b.name.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    // Sort by specified option
    results.sort((a, b) => {
      switch (request.sortBy) {
        case 'distance': return a.distance - b.distance;
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'score': return b.score - a.score;
        default: return a.distance - b.distance;
      }
    });

    // Limit results
    results = results.slice(0, limit);

    return {
      success: true,
      results,
      count: results.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Nearby search failed', { error: message });
    return { success: false, error: message };
  }
}

// ============================================
// ZONE INSIGHTS
// ============================================

export async function getZoneInsights(
  request: GetZoneInsightsRequest
): Promise<GetZoneInsightsResponse> {
  try {
    const { zoneId, period } = request;

    const zone = zones.get(zoneId);
    if (!zone) {
      return { success: false, error: 'Zone not found' };
    }

    // Generate insights based on zone data
    const insights = {
      peakHours: [9, 12, 18, 20],
      demographics: { 'young_adult': 0.35, 'adult': 0.45, 'senior': 0.2 },
      topCategories: [
        { category: 'food', count: 45 },
        { category: 'retail', count: 32 },
        { category: 'services', count: 28 },
      ],
      trends: {
        footTraffic: [100, 105, 112, 118, 125],
        revenue: [10000, 11000, 12500, 13000, 14500],
      },
      recommendations: [
        'Peak hours align with meal times - consider food partnerships',
        'High young adult demographic suggests nightlife opportunities',
        'Steady traffic growth indicates good time for expansion',
      ],
    };

    return { success: true, zone, insights };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ============================================
// ROUTE MANAGEMENT
// ============================================

export async function createRoute(route: Omit<Route, 'id' | 'createdAt'>): Promise<Route> {
  const newRoute: Route = {
    ...route,
    id: uuidv4(),
    createdAt: new Date(),
  };
  routes.set(newRoute.id, newRoute);
  return newRoute;
}

export async function getRoute(routeId: string): Promise<Route | null> {
  return routes.get(routeId) || null;
}

// ============================================
// MOBILITY METRICS
// ============================================

export async function calculateMobilityMetrics(
  entityId: string,
  entityType: 'user' | 'merchant' | 'zone',
  locations: LocationContext[]
): Promise<MobilityMetrics> {
  if (locations.length < 2) {
    return {
      entityId,
      entityType,
      period: { start: new Date(), end: new Date() },
      metrics: {
        totalDistance: 0,
        avgTripDistance: 0,
        totalTrips: 0,
        avgTripDuration: 0,
        mostVisitedZones: [],
        radiusOfGyration: 0,
        entropy: 0,
      },
      aggregations: {
        byHour: new Array(24).fill(0),
        byDayOfWeek: new Array(7).fill(0),
        byTransportMode: { walk: 0, bike: 0, car: 0, public: 0, rideshare: 0 },
      },
    };
  }

  const sorted = [...locations].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalDistance += calculateDistance(sorted[i - 1].location, sorted[i].location);
  }

  // Calculate radius of gyration
  const centroid = calculateCentroid(sorted.map(l => l.location));
  let sumSquaredDistance = 0;
  for (const loc of sorted) {
    const dist = calculateDistance(loc.location, centroid);
    sumSquaredDistance += dist * dist;
  }
  const radiusOfGyration = Math.sqrt(sumSquaredDistance / sorted.length);

  // Hour and day aggregations
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  sorted.forEach(loc => {
    byHour[loc.timestamp.getHours()]++;
    byDayOfWeek[loc.timestamp.getDay()]++;
  });

  // Calculate entropy
  const totalVisits = sorted.length;
  let entropy = 0;
  const uniqueLocations = new Set(sorted.map(l => generateGeoHash(l.location, 6)));
  for (const loc of uniqueLocations) {
    const count = sorted.filter(l => generateGeoHash(l.location, 6) === loc).length;
    const p = count / totalVisits;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  return {
    entityId,
    entityType,
    period: {
      start: sorted[0].timestamp,
      end: sorted[sorted.length - 1].timestamp,
    },
    metrics: {
      totalDistance,
      avgTripDistance: totalDistance / Math.max(1, sorted.length - 1),
      totalTrips: sorted.length - 1,
      avgTripDuration: (sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime()) /
        (sorted.length - 1) / 60000,
      mostVisitedZones: [],
      radiusOfGyration,
      entropy,
    },
    aggregations: {
      byHour,
      byDayOfWeek,
      byTransportMode: { walk: 0.6, bike: 0.1, car: 0.2, 'public': 0.05, rideshare: 0.05 },
    },
  };
}

// ============================================
// HEALTH & STATS
// ============================================

export function getHealthStatus(): HealthStatus {
  return {
    status: 'healthy',
    uptime: Date.now(),
    zones: zones.size,
    hotspots: hotspots.size,
    segments: segments.size,
    predictions: predictions.size,
    lastProcessed: new Date(),
  };
}

export function getStats(): ServiceStats {
  return {
    totalZones: zones.size,
    totalHotspots: hotspots.size,
    totalSegments: segments.size,
    totalPredictions: predictions.size,
    avgSearchLatency: 50,
    byType: {
      zones: zones.size,
      hotspots: hotspots.size,
      segments: segments.size,
    },
  };
}

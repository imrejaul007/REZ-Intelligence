/**
 * REZ Hyperlocal Brain - Types
 *
 * Hyperlocal Intelligence Engine - Location-aware AI with geospatial intelligence
 */

import mongoose, { Document } from 'mongoose';

// ============================================
// GEOSPATIAL TYPES
// ============================================

export interface GeoPoint {
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface GeoCircle {
  center: GeoPoint;
  radius: number; // meters
}

export interface GeoBBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface GeoFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'Polygon' | 'LineString';
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, unknown>;
}

// ============================================
// LOCATION CONTEXT
// ============================================

export interface LocationContext {
  id?: string;
  userId?: string;
  entityId?: string;
  entityType: 'user' | 'merchant' | 'event' | 'poi';
  location: GeoPoint;
  timestamp: Date;
  accuracy?: number;
  source: LocationSource;
  context?: LocationContextData;
}

export type LocationSource =
  | 'gps'
  | 'wifi'
  | 'cell'
  | 'ip'
  | 'beacon'
  | 'manual';

export interface LocationContextData {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  neighborhood?: string;
  venue?: string;
  floor?: number;
  indoor?: boolean;
}

// ============================================
// ZONES & REGIONS
// ============================================

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  geometry: GeoPolygon | { type: string; coordinates: number[][][] };
  properties: ZoneProperties;
  metrics?: ZoneMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export type ZoneType =
  | 'neighborhood'
  | 'city'
  | 'district'
  | 'business_district'
  | 'residential'
  | 'commercial'
  | 'mixed_use'
  | 'transit_hub'
  | 'attraction'
  | 'custom';

export interface ZoneProperties {
  population?: number;
  density?: number;
  medianIncome?: number;
  dominantCategory?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface ZoneMetrics {
  footTraffic: number;
  dwellTime: number;
  visitFrequency: number;
  peakHours: number[];
  demographics?: Record<string, number>;
  trends?: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}

// ============================================
// HOTSPOTS
// ============================================

export interface Hotspot {
  id: string;
  name: string;
  type: HotspotType;
  location: GeoPoint;
  radius: number;
  properties: HotspotProperties;
  activity: HotspotActivity;
  score: number;
  updatedAt: Date;
}

export type HotspotType =
  | 'commercial'
  | 'transit'
  | 'social'
  | 'food'
  | 'entertainment'
  | 'shopping'
  | 'office'
  | 'residential';

export interface HotspotProperties {
  categories: string[];
  merchantCount: number;
  averageRating?: number;
  priceLevel?: number;
  operatingHours?: OperatingHours;
  indoor?: boolean;
  [key: string]: unknown;
}

export interface OperatingHours {
  [day: string]: { open: string; close: string } | null;
}

export interface HotspotActivity {
  current: number;
  average: number;
  peak: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  density: 'low' | 'medium' | 'high';
}

// ============================================
// MICRO-SEGMENTS
// ============================================

export interface MicroSegment {
  id: string;
  name: string;
  type: SegmentType;
  zone?: string;
  radius?: number;
  center?: GeoPoint;
  characteristics: SegmentCharacteristics;
  size: number;
  score: number;
  createdAt?: Date;
}

export type SegmentType =
  | 'behavioral'
  | 'demographic'
  | 'geographic'
  | 'temporal'
  | 'intent'
  | 'lifecycle'
  | 'custom';

export interface SegmentCharacteristics {
  ageRange?: { min: number; max: number };
  incomeLevel?: 'low' | 'middle' | 'high' | 'affluent';
  lifestyle?: string[];
  interests?: string[];
  behaviors?: string[];
  visitPatterns?: VisitPattern;
  preferences?: Record<string, number>;
}

export interface VisitPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  preferredTimes: number[];
  preferredDays: number[];
  avgDwellTime: number;
  seasonality?: string;
}

// ============================================
// ROUTE & TRAVEL
// ============================================

export interface Route {
  id: string;
  userId?: string;
  type: RouteType;
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  distance: number;
  duration: number;
  mode: TransportMode;
  segments: RouteSegment[];
  createdAt: Date;
}

export type RouteType = 'commute' | 'errand' | 'social' | 'recreational' | 'transit';

export type TransportMode = 'walk' | 'bike' | 'car' | 'public' | 'rideshare';

export interface RouteSegment {
  start: GeoPoint;
  end: GeoPoint;
  mode: TransportMode;
  distance: number;
  duration: number;
  waypoints?: GeoPoint[];
}

// ============================================
// PROXIMITY & DISCOVERY
// ============================================

export interface ProximitySearch {
  query: string;
  location: GeoPoint;
  radius: number;
  categories?: string[];
  filters?: SearchFilters;
  limit?: number;
  sortBy?: SortOption;
}

export interface SearchFilters {
  openNow?: boolean;
  priceLevel?: number[];
  rating?: number;
  distance?: number;
  categories?: string[];
  attributes?: string[];
}

export type SortOption = 'distance' | 'rating' | 'reviews' | 'popularity' | 'price';

export interface DiscoveryResult {
  id: string;
  name: string;
  type: 'merchant' | 'poi' | 'event' | 'deal';
  location: GeoPoint;
  distance: number;
  score: number;
  category: string;
  rating?: number;
  priceLevel?: number;
  imageUrl?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// PREDICTIONS
// ============================================

export interface LocationPrediction {
  id: string;
  entityId: string;
  type: PredictionType;
  prediction: LocationPredictionData;
  confidence: number;
  timeframe: {
    start: Date;
    end: Date;
  };
  factors: PredictionFactor[];
  generatedAt: Date;
}

export type PredictionType =
  | 'next_location'
  | 'visit_probability'
  | 'dwell_time'
  | 'route_prediction'
  | 'crowd_level'
  | 'demand_forecast';

export interface LocationPredictionData {
  location?: GeoPoint;
  probability?: number;
  duration?: number;
  route?: Route;
  crowdLevel?: 'low' | 'medium' | 'high';
}

export interface PredictionFactor {
  name: string;
  importance: number;
  value: unknown;
  description: string;
}

// ============================================
// TRIP & STAY PATTERNS
// ============================================

export interface TripPattern {
  id: string;
  userId: string;
  type: TripType;
  locations: TripLocation[];
  frequency: number;
  regularity: number;
  preferredTimes: number[];
  typicalDuration: number;
  purpose?: string;
  nextExpected?: Date;
  createdAt: Date;
}

export type TripType = 'commute' | 'shopping' | 'dining' | 'entertainment' | 'social' | 'fitness' | 'errand';

export interface TripLocation {
  location: GeoPoint;
  name?: string;
  category?: string;
  dwellTime?: number;
  arrivalTime?: Date;
  departureTime?: Date;
  visitFrequency?: number;
  avgDwellTime?: number;
}

export interface StayPattern {
  userId: string;
  homeLocation?: GeoPoint;
  workLocation?: GeoPoint;
  frequentLocations: FrequentLocation[];
  lastUpdated: Date;
}

export interface FrequentLocation {
  location: GeoPoint;
  name?: string;
  category?: string;
  visitFrequency: number;
  avgDwellTime: number;
  lastVisit: Date;
}

// ============================================
// MOBILITY METRICS
// ============================================

export interface MobilityMetrics {
  entityId: string;
  entityType: 'user' | 'merchant' | 'zone';
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalDistance: number;
    avgTripDistance: number;
    totalTrips: number;
    avgTripDuration: number;
    mostVisitedZones: { zoneId: string; visits: number }[];
    homeWorkDistance?: number;
    radiusOfGyration: number;
    entropy: number;
  };
  aggregations: {
    byHour: number[];
    byDayOfWeek: number[];
    byTransportMode: Record<TransportMode, number>;
  };
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface AnalyzeLocationRequest {
  entityId: string;
  entityType: 'user' | 'merchant';
  locations: LocationContext[];
  options?: {
    detectPatterns?: boolean;
    predictNext?: boolean;
    analyzeZones?: boolean;
  };
}

export interface AnalyzeLocationResponse {
  success: boolean;
  analysis?: {
    zones: Zone[];
    hotspots: Hotspot[];
    patterns: TripPattern[];
    predictions: LocationPrediction[];
  };
  error?: string;
}

export interface SearchNearbyRequest {
  location: GeoPoint;
  radius: number;
  query?: string;
  categories?: string[];
  filters?: SearchFilters;
  limit?: number;
  sortBy?: 'distance' | 'rating' | 'reviews' | 'popularity' | 'price' | 'score';
}

export interface SearchNearbyResponse {
  success: boolean;
  results?: DiscoveryResult[];
  count?: number;
  error?: string;
}

export interface GetZoneInsightsRequest {
  zoneId: string;
  period?: {
    start: Date;
    end: Date;
  };
}

export interface GetZoneInsightsResponse {
  success: boolean;
  zone?: Zone;
  insights?: {
    peakHours: number[];
    demographics: Record<string, number>;
    topCategories: { category: string; count: number }[];
    trends: Record<string, number[]>;
    recommendations: string[];
  };
  error?: string;
}

export interface PredictLocationRequest {
  entityId: string;
  entityType: 'user' | 'merchant';
  currentLocation: GeoPoint;
  time: Date;
}

export interface PredictLocationResponse {
  success: boolean;
  predictions?: LocationPrediction[];
  error?: string;
}

export interface CreateSegmentRequest {
  name: string;
  type: SegmentType;
  characteristics: SegmentCharacteristics;
  zone?: string;
  radius?: number;
  center?: GeoPoint;
  size?: number;
  score?: number;
  createdAt?: Date;
}

// ============================================
// MONGODB SCHEMAS
// ============================================

export interface IZone extends Document {
  name: String;
  type: String;
  geometry: mongoose.Schema.Types.Mixed;
  properties: mongoose.Schema.Types.Mixed;
  metrics: mongoose.Schema.Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHotspot extends Document {
  name: String;
  type: String;
  location: mongoose.Schema.Types.Mixed;
  radius: Number;
  properties: mongoose.Schema.Types.Mixed;
  activity: mongoose.Schema.Types.Mixed;
  score: Number;
  updatedAt: Date;
}

export interface IMicroSegment extends Document {
  name: String;
  type: String;
  characteristics: mongoose.Schema.Types.Mixed;
  size: Number;
  score: Number;
  createdAt: Date;
}

export interface ILocationContext extends Document {
  userId: String;
  entityId: String;
  entityType: String;
  location: mongoose.Schema.Types.Mixed;
  timestamp: Date;
  accuracy: Number;
  source: String;
  context: mongoose.Schema.Types.Mixed;
}

// ============================================
// SERVICE TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  zones: number;
  hotspots: number;
  segments: number;
  predictions: number;
  lastProcessed: Date;
}

export interface ServiceStats {
  totalZones: number;
  totalHotspots: number;
  totalSegments: number;
  totalPredictions: number;
  avgSearchLatency: number;
  byType: Record<string, number>;
}

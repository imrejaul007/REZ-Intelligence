/**
 * Location Intelligence Types
 * Core type definitions for location tracking and pattern detection
 */

export type LocationType =
  | 'mall'
  | 'restaurant'
  | 'office'
  | 'college'
  | 'airport'
  | 'gym'
  | 'store'
  | 'other';

export type VisitSource = 'qr_scan' | 'checkin' | 'delivery' | 'booking';

export type PatternType =
  | 'commuter'
  | 'mall_goer'
  | 'traveler'
  | 'explorer'
  | 'gym_enthusiast'
  | 'foodie';

export type PatternFrequency = 'daily' | 'weekly' | 'occasional';

export type ZoneType =
  | 'mall'
  | 'airport'
  | 'college'
  | 'office_park'
  | 'restaurant_hub'
  | 'residential'
  | 'commercial'
  | 'other';

export type UserSegment =
  | 'premium_mall_visitor'
  | 'office_commuter'
  | 'college_student'
  | 'frequent_traveler'
  | 'high_footfall_seeker'
  | 'food_enthusiast'
  | 'fitness_focused'
  | 'explorer';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LocationVisit {
  _id?: string;
  userId: string;
  locationId: string;
  locationName: string;
  locationType: LocationType;
  zone: string;
  coordinates?: Coordinates;
  timestamp: Date;
  dwellTimeMinutes?: number;
  source: VisitSource;
  metadata?: Record<string, unknown>;
}

export interface LocationPattern {
  type: PatternType;
  confidence: number;
  locations: string[];
  frequency: PatternFrequency;
  peakDays: string[];
  peakHours: number[];
  detectedAt: Date;
}

export interface UserLocationProfile {
  _id?: string;
  userId: string;
  patterns: LocationPattern[];
  segments: UserSegment[];
  totalVisits: number;
  favoriteZones: string[];
  lastVisit?: Date;
  lastUpdated: Date;
  createdAt: Date;
}

export interface ZoneAttributes {
  premium: boolean;
  categories: string[];
  footfallTier?: 'low' | 'medium' | 'high' | 'ultra';
}

export interface LocationZone {
  _id?: string;
  zoneId: string;
  name: string;
  type: ZoneType;
  polygon?: Polygon;
  center?: Coordinates;
  attributes: ZoneAttributes;
  activeUsers: number;
  dailyFootfall: number;
  weeklyFootfall: number;
  monthlyFootfall: number;
  lastUpdated: Date;
}

export interface VisitInput {
  userId: string;
  locationId: string;
  locationName: string;
  locationType: LocationType;
  zone: string;
  coordinates?: Coordinates;
  dwellTimeMinutes?: number;
  source: VisitSource;
  metadata?: Record<string, unknown>;
}

export interface FootfallQuery {
  startDate?: Date;
  endDate?: Date;
  zone?: string;
  locationType?: LocationType;
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface FootfallResult {
  date: string;
  visits: number;
  uniqueUsers: number;
  avgDwellTime: number;
  zone?: string;
}

export interface DwellTimeAnalytics {
  locationId: string;
  locationName: string;
  avgDwellTime: number;
  minDwellTime: number;
  maxDwellTime: number;
  medianDwellTime: number;
  visitCount: number;
}

export interface HeatmapPoint {
  coordinates: Coordinates;
  intensity: number;
  visitCount: number;
  zone?: string;
}

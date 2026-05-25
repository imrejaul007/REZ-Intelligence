/**
 * REZ Geo Intelligence - Zone Hierarchy Types
 * Complete geographic hierarchy: City → District → Neighborhood → Micro-zone → Venue Cluster
 */

import { GeoPoint, GeoPolygon } from './index.js';

// ============================================
// ZONE HIERARCHY LEVELS
// ============================================

export type ZoneLevel =
  | 'city'         // Top level: Bangalore, Mumbai, Delhi
  | 'district'     // Sub-city: Koramangala, Indiranagar, Whitefield
  | 'neighborhood' // Sub-district: 5th Block, 100ft Road
  | 'micro_zone'   // Ultra-local: 100m radius areas
  | 'venue_cluster'; // Point-of-interest clusters

export const ZONE_LEVEL_PRIORITY: Record<ZoneLevel, number> = {
  city: 1,
  district: 2,
  neighborhood: 3,
  micro_zone: 4,
  venue_cluster: 5,
};

// ============================================
// CITY LEVEL
// ============================================

export interface CityZone {
  zoneId: string;
  level: 'city';
  name: string;
  state: string;
  country: string;

  // Geometry
  boundary: GeoPolygon;
  center: GeoPoint;

  // Characteristics
  population: number;
  areaSqKm: number;
  timezone: string;
  metroStatus: 'metro' | 'major' | 'tier2' | 'tier3';

  // Demand aggregation
  aggregateDemand: CityDemandMetrics;

  // Child references
  districtIds: string[];

  // Metadata
  metadata: CityMetadata;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CityDemandMetrics {
  avgDailyRides: number;
  avgDailyOrders: number;
  avgDailyEvents: number;
  peakHour: number;
  busiestDay: number;
}

export interface CityMetadata {
  tier: 1 | 2 | 3;
  regions: string[];
  primaryLanguages: string[];
  crimeIndex: number; // 0-100, lower is better
  womenSafetyScore: number;
}

// ============================================
// DISTRICT LEVEL
// ============================================

export interface DistrictZone {
  zoneId: string;
  level: 'district';
  name: string;
  cityId: string;

  // Geometry
  boundary: GeoPolygon;
  center: GeoPoint;
  radiusMeters: number;

  // Characteristics
  areaType: 'residential' | 'commercial' | 'mixed' | 'industrial' | 'entertainment' | 'corporate';
  characteristics: DistrictCharacteristics;

  // Demand aggregation
  aggregateDemand: DistrictDemandMetrics;

  // Child references
  neighborhoodIds: string[];

  // Performance
  performanceIndex: number; // 0-100, overall district performance

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface DistrictCharacteristics {
  isTechHub: boolean;
  isFoodDestination: boolean;
  isNightlifeHub: boolean;
  isShoppingDistrict: boolean;
  hasCoworking: boolean;
  hasMetro: boolean;
  hasMalls: boolean;
  hasStreetFood: boolean;
}

export interface DistrictDemandMetrics {
  avgDailyRides: number;
  avgDailyOrders: number;
  avgOrderValue: number;
  rideDemand: number;        // 0-1
  deliveryDemand: number;     // 0-1
  eventAttendance: number;
  footfall: number;          // people per hour
}

// ============================================
// NEIGHBORHOOD LEVEL
// ============================================

export interface NeighborhoodZone {
  zoneId: string;
  level: 'neighborhood';
  name: string;
  districtId: string;
  cityId: string;

  // Geometry
  boundary: GeoPolygon;
  center: GeoPoint;
  radiusMeters: number;

  // Characteristics
  characteristics: NeighborhoodCharacteristics;

  // Demand aggregation
  aggregateDemand: NeighborhoodDemandMetrics;

  // Child references
  microZoneIds: string[];

  // Demographics
  demographics: NeighborhoodDemographics;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface NeighborhoodCharacteristics {
  vibe: 'upscale' | 'trendy' | 'traditional' | 'bustling' | 'quiet' | 'familial';
  priceLevel: 'budget' | 'mid' | 'upscale' | 'premium';
  footTrafficLevel: 'low' | 'moderate' | 'high' | 'very_high';
  noiseLevel: 'quiet' | 'moderate' | 'loud' | 'very_loud';
  parkingDifficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
}

export interface NeighborhoodDemandMetrics {
  avgDailyOrders: number;
  avgOrderValue: number;
  dominantCuisine: string[];
  peakHours: number[];
  deliveryRadius: number;
  avgDeliveryTime: number; // minutes
}

export interface NeighborhoodDemographics {
  avgAge: number;
  avgIncome: number; // INR per month
  dominantAgeGroup: 'young' | 'adult' | 'middle_aged' | 'senior';
  workingProfessionalRatio: number; // 0-1
}

// ============================================
// MICRO-ZONE LEVEL
// ============================================

export interface MicroZone {
  zoneId: string;
  level: 'micro_zone';
  name: string;
  neighborhoodId: string;
  districtId: string;
  cityId: string;

  // Geometry
  boundary: GeoPolygon;
  center: GeoPoint;
  radiusMeters: number; // typically 100-500m

  // Characteristics
  microType: 'residential_complex' | 'commercial_pocket' | 'mixed_use' | 'transit_hub' | 'market_area';
  attributes: MicroZoneAttributes;

  // Demand (real-time)
  currentDemand: MicroZoneDemand;
  historicalDemand: MicroZoneHistoricalDemand;

  // Child references
  venueClusterIds: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface MicroZoneAttributes {
  hasMetroStation: boolean;
  hasBusStop: boolean;
  hasAutoStand: boolean;
  hasParking: boolean;
  hasATMs: boolean;
  hasRestrooms: boolean;
  lightingQuality: 'poor' | 'moderate' | 'good' | 'excellent';
  roadCondition: 'poor' | 'moderate' | 'good';
  crowdDensity: 'sparse' | 'moderate' | 'dense' | 'very_dense';
}

export interface MicroZoneDemand {
  timestamp: Date;
  rideDemand: number;         // 0-1
  deliveryDemand: number;       // 0-1
  footfall: number;            // people per 5 min
  activeDrivers: number;
  waitTimeEstimate: number;    // seconds
  surgeMultiplier: number;
  confidence: number;          // 0-1, how confident we are in this data
}

export interface MicroZoneHistoricalDemand {
  avgWeekday: number;
  avgWeekend: number;
  peakHour: number;
  troughHour: number;
  volatilityScore: number;    // 0-1, how much demand varies
}

// ============================================
// VENUE CLUSTER LEVEL
// ============================================

export interface VenueCluster {
  zoneId: string;
  level: 'venue_cluster';
  name: string;
  microZoneId: string;
  neighborhoodId: string;
  districtId: string;
  cityId: string;

  // Geometry
  center: GeoPoint;
  radiusMeters: number; // typically 50-150m

  // Venues in this cluster
  venueIds: string[];

  // Cluster characteristics
  clusterType: 'restaurant_row' | 'bar_district' | 'food_court' | 'market' | 'mall_area' | 'standalone';
  dominantCategory: string;
  operatingHours: OperatingHours;

  // Demand
  aggregateDemand: VenueClusterDemand;

  // Performance
  performanceIndex: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface OperatingHours {
  opensAt: number;  // hour of day (0-23)
  closesAt: number;
  is24Hours: boolean;
  hasLateNight: boolean; // closes after midnight
}

export interface VenueClusterDemand {
  avgOrdersPerHour: number;
  peakHourOrders: number;
  avgBasketSize: number;
  avgPrepTime: number;       // minutes
  fulfillmentRate: number;    // 0-1, how often orders are completed
}

// ============================================
// HIERARCHY TRAVERSAL
// ============================================

export interface ZoneHierarchyPath {
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  neighborhoodId?: string;
  neighborhoodName?: string;
  microZoneId?: string;
  microZoneName?: string;
  venueClusterId?: string;
  venueClusterName?: string;
}

export interface ZoneHierarchyResponse {
  zone: CityZone | DistrictZone | NeighborhoodZone | MicroZone | VenueCluster;
  path: ZoneHierarchyPath;
  children: {
    level: ZoneLevel;
    count: number;
    ids: string[];
  }[];
  siblings: {
    zoneId: string;
    name: string;
    distance: number; // meters
  }[];
}

// ============================================
// SYNTHETIC DEMAND INDEX
// ============================================

export interface SyntheticDemandIndex {
  zoneId: string;
  level: ZoneLevel;
  timestamp: Date;

  // Component scores (0-100)
  components: DemandComponents;

  // Composite score (0-100)
  overallIndex: number;

  // Confidence and quality
  confidence: number;
  dataQuality: DataQualityScore;

  // Trend
  trend: 'rising' | 'stable' | 'declining';
  trendChange: number; // percentage change from last period

  // Influencing factors
  influencingEvents: string[];
  influencingWeather: string;
  influencingTime: TimeSlot;
}

export interface DemandComponents {
  // Commerce signals
  orderVelocity: number;       // Orders per hour
  basketSize: number;          // Avg order value normalized
  fulfillmentRate: number;      // Order completion rate

  // Mobility signals
  rideFrequency: number;       // Rides in zone
  rideDestinationRatio: number; // Rides ending here vs passing through

  // Event signals
  eventAttendance: number;      // Ticket sales
  eventBuzz: number;            // Social media mentions

  // Footfall signals
  footfallCount: number;       // People count
  footfallDensity: number;      // People per sq meter

  // Context signals
  weatherImpact: number;       // Weather effect on demand
  timeImpact: number;          // Time-of-day effect
}

export interface DataQualityScore {
  overall: number;             // 0-100
  signalCoverage: number;       // What % of signals are present
  freshnessScore: number;       // How recent is the data
  completenessScore: number;    // Are all fields populated
  consistencyScore: number;    // Do signals agree with each other
}

export interface TimeSlot {
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
  slotType: 'breakfast' | 'lunch' | 'evening' | 'dinner' | 'late_night' | 'midday' | 'other';
}

// ============================================
// DEMAND INDEX CALCULATION
// ============================================

export interface DemandIndexWeights {
  orderVelocity: number;
  basketSize: number;
  fulfillmentRate: number;
  rideFrequency: number;
  rideDestinationRatio: number;
  eventAttendance: number;
  eventBuzz: number;
  footfallCount: number;
  footfallDensity: number;
  weatherImpact: number;
  timeImpact: number;
}

export const DEFAULT_DEMAND_INDEX_WEIGHTS: DemandIndexWeights = {
  orderVelocity: 0.20,
  basketSize: 0.10,
  fulfillmentRate: 0.08,
  rideFrequency: 0.12,
  rideDestinationRatio: 0.08,
  eventAttendance: 0.12,
  eventBuzz: 0.08,
  footfallCount: 0.10,
  footfallDensity: 0.06,
  weatherImpact: 0.03,
  timeImpact: 0.03,
};

// ============================================
// QUERY TYPES
// ============================================

export interface ZoneHierarchyQuery {
  location?: GeoPoint;
  zoneId?: string;
  level?: ZoneLevel;
  cityId?: string;
  districtId?: string;
  neighborhoodId?: string;
}

export interface DemandIndexQuery {
  zoneId?: string;
  location?: GeoPoint;
  radiusMeters?: number;
  level?: ZoneLevel;
  fromDate?: Date;
  toDate?: Date;
  includeComponents?: boolean;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ZoneHierarchyListResponse {
  success: boolean;
  zones: (CityZone | DistrictZone | NeighborhoodZone | MicroZone | VenueCluster)[];
  meta: {
    count: number;
    level: ZoneLevel;
    parentId?: string;
    queryTime: number;
  };
}

export interface DemandIndexResponse {
  success: boolean;
  index: SyntheticDemandIndex;
  comparable: {
    zoneId: string;
    name: string;
    overallIndex: number;
    distance?: number;
  }[];
  meta: {
    computedAt: Date;
    sourceSignals: string[];
    confidence: number;
  };
}

export interface DemandIndexMapResponse {
  success: boolean;
  indices: SyntheticDemandIndex[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  meta: {
    level: ZoneLevel;
    count: number;
    timestamp: Date;
  };
}

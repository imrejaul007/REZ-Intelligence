/**
 * REZ Geo Intelligence Core - Unified Types
 * Single source of truth for all geo-intelligence types
 */

// ============================================
// Core Geo Types
// ============================================

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: number[][];
}

export interface GeoCircle {
  center: GeoPoint;
  radius: number; // in meters
}

// ============================================
// Source App Types
// ============================================

export type SourceApp =
  | 'zevents'      // Z-Events
  | 'rezride'      // ReZ Ride
  | 'reznow'       // REZ NOW / Merchant
  | 'consumer'     // REZ App
  | 'buzzlocal'    // BuzzLocal
  | 'stayown';     // StayOwn Hotels

// ============================================
// GRAPH: Consumer Node
// ============================================

export interface ConsumerNode {
  nodeId: string;
  type: 'consumer';
  userId: string;

  // Identity
  primarySource: SourceApp;
  unifiedId: string;

  // Location
  homeLocation?: GeoPoint;
  workLocation?: GeoPoint;
  lastKnownLocation?: GeoPoint;
  lastLocationUpdate: Date;

  // Preferences
  preferences: ConsumerPreferences;

  // Affinities
  affinities: ConsumerAffinities;

  // Segments
  segments: string[];

  // Activity
  totalEventsAttended: number;
  totalRidesTaken: number;
  totalOrdersPlaced: number;
  totalSpent: number;
  avgOrderValue: number;

  // Cross-app behavior
  crossAppActivity: CrossAppActivity;

  // Trust
  trustScore: number;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';

  // Timestamps
  firstActivity: Date;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsumerPreferences {
  categories: Record<string, number>; // category -> affinity (0-1)
  preferredCuisine: string[];
  preferredPriceRange: 'budget' | 'mid' | 'premium' | 'luxury';
  preferredTransport: ('bike' | 'auto' | 'cab' | 'suv')[];
  preferredNeighborhoods: string[];
  preferredTimeSlots: string[]; // 'morning', 'afternoon', 'evening', 'night'
  socialBookingRatio: number; // 0-1
  advanceBookingDays: number;
}

export interface ConsumerAffinities {
  rideProbability: number;           // 0-1, likelihood to take ride
  restaurantAffinities: Record<string, number>; // cuisine -> probability
  hotelProbability: number;           // 0-1, likelihood to book hotel
  eventProbability: number;           // 0-1, likelihood to attend event
  premiumAffinities: Record<string, number>; // premium product -> probability
}

export interface CrossAppActivity {
  zeventsScore: number;    // Event engagement score (0-100)
  rezrideScore: number;   // Ride frequency score (0-100)
  merchantScore: number;  // Order frequency score (0-100)
  stayownScore: number;   // Hotel usage score (0-100)
  buzzlocalScore: number; // Community engagement score (0-100)
}

// ============================================
// GRAPH: Merchant Node
// ============================================

export interface MerchantNode {
  nodeId: string;
  type: 'merchant';
  merchantId: string;

  // Identity
  businessName: string;
  category: MerchantCategory;
  subcategory?: string;
  ownerId?: string;

  // Location
  location: GeoPoint;
  address: MerchantAddress;
  coverageRadius: number; // meters

  // Offerings
  priceRange: 'budget' | 'mid' | 'premium' | 'luxury';
  cuisines?: string[];
  amenities?: string[];

  // Trust & Quality
  trustScore: number;      // 0-100
  qualityScore: number;     // 0-100
  avgRating: number;       // 1-5
  reviewCount: number;

  // Performance
  popularity: PopularityMetrics;
  eventParticipation: EventParticipation;

  // Loyalty & Offers
  loyaltyPrograms: string[];
  activeOffers: ActiveOffer[];

  // Demand
  demandMetrics: DemandMetrics;

  // Source
  sourceApp: SourceApp;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type MerchantCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'nightlife'
  | 'retail'
  | 'hotel'
  | 'entertainment'
  | 'fitness'
  | 'salon'
  | 'healthcare'
  | 'grocery'
  | 'pharmacy'
  | 'other';

export interface MerchantAddress {
  house?: string;
  street?: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface PopularityMetrics {
  dailyFootfall: number;
  weeklyTrend: number;     // -1 to 1, negative = declining
  peakHours: number[];     // hours of day (0-23)
  busyDays: number[];      // day of week (0-6)
  eventImpact: number;     // 0-1, how much events affect this merchant
}

export interface EventParticipation {
  isVenue: boolean;         // Can host events
  eventCount: number;      // Events hosted
  avgAttendance: number;
  lastEventDate?: Date;
}

export interface ActiveOffer {
  offerId: string;
  type: 'discount' | 'cashback' | 'buy1get1' | 'free_delivery';
  value: number;
  minOrderValue?: number;
  validUntil: Date;
}

export interface DemandMetrics {
  avgOrdersPerDay: number;
  avgOrderValue: number;
  rideDemandImpact: number; // How much rides spike after events
  orderVelocity: number;   // Orders per hour
}

// ============================================
// GRAPH: Event Node (from Z-Events)
// ============================================

export interface EventNode {
  nodeId: string;
  type: 'event';
  eventId: string;

  // Identity
  title: string;
  description: string;
  category: EventCategory;
  tags: string[];

  // Location
  venue: EventVenue;
  coverageRadius: number; // meters

  // Timing
  startDate: Date;
  endDate: Date;
  isMultiDay: boolean;

  // Capacity & Attendance
  capacity: number;
  ticketsSold: number;
  predictedAttendance: number;
  checkinCount: number;

  // Demographics
  demographicProfile: DemographicProfile;

  // Impact
  impactMetrics: EventImpactMetrics;

  // Spillover (cross-category predictions)
  spilloverEffect: SpilloverEffect;

  // Trust
  organizerTrustScore: number;

  // Source
  sourceApp: SourceApp;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type EventCategory =
  | 'music'
  | 'sports'
  | 'comedy'
  | 'tech'
  | 'food'
  | 'art'
  | 'business'
  | 'fitness'
  | 'lifestyle'
  | 'community';

export interface EventVenue {
  name: string;
  location: GeoPoint;
  address: MerchantAddress;
  indoor: boolean;
  capacity: number;
}

export interface DemographicProfile {
  avgAge: number;
  ageRange: [number, number];
  spendingTier: 'budget' | 'mid' | 'premium' | 'luxury';
  avgGroupSize: number;
  corporateRatio: number; // 0-1, portion corporate bookings
}

export interface EventImpactMetrics {
  rideDemandIncrease: number;      // multiplier, e.g., 1.5 = 50% more rides
  foodDeliveryIncrease: number;   // multiplier
  hotelOccupancyIncrease: number; // multiplier
  retailSpike: number;           // multiplier
  avgTicketPrice: number;
  totalRevenue: number;
  socialMediaBuzz: number;        // 0-100 score
}

export interface SpilloverEffect {
  nearbyMerchantBoost: number;     // 0-1, how much nearby merchants benefit
  restaurantDemandIncrease: number;
  nightlifeDemandIncrease: number;
  hotelDemandIncrease: number;
  rideDemandIncrease: number;
}

// ============================================
// GRAPH: Zone Node
// ============================================

export interface ZoneNode {
  nodeId: string;
  type: 'zone';
  zoneId: string;

  // Identity
  name: string;
  city: string;
  area: string;

  // Geometry
  boundary: GeoPolygon;
  center: GeoPoint;
  radius: number; // meters

  // Characteristics
  zoneType: 'residential' | 'commercial' | 'mixed' | 'industrial' | 'entertainment';
  attributes: ZoneAttributes;

  // Metrics
  populationDensity?: number;
  commercialDensity?: number;
  eventFrequency: number; // events per month

  // Trust
  womenSafetyScore: number; // 0-100
  crimeRate: number;        // 0-100, lower is better

  // Demand
  aggregateDemand: DemandMetrics;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ZoneAttributes {
  isPremium: boolean;
  isNightlifeHub: boolean;
  isFoodDestination: boolean;
  isTechHub: boolean;
  hasMetro: boolean;
  hasParking: boolean;
}

// ============================================
// GRAPH: Edge Types
// ============================================

export interface GraphEdge {
  edgeId: string;
  source: string;      // nodeId
  target: string;      // nodeId
  relationship: EdgeRelationship;
  weight: number;      // 0-1
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type EdgeRelationship =
  // Consumer -> Event
  | 'attended'
  | 'booked'
  | 'wishlisted'
  | 'shared'
  | 'reviewed'

  // Consumer -> Merchant
  | 'visited'
  | 'ordered'
  | 'reviewed'
  | 'favorited'

  // Consumer -> Consumer
  | 'friend'
  | 'family'
  | 'colleague'

  // Event -> Merchant
  | 'venue_for'
  | 'sponsored_by'
  | 'nearby'

  // Merchant -> Zone
  | 'located_in'

  // Consumer -> Zone
  | 'lives_in'
  | 'works_in'
  | 'frequents';

// ============================================
// Demand Prediction
// ============================================

export interface ZoneDemandPrediction {
  zoneId: string;
  timeSlot: Date;

  predictions: {
    rideDemand: number;        // 0-1 probability
    deliveryDemand: number;    // 0-1 probability
    restaurantRush: number;    // 0-1 probability
    hotelOccupancy: number;    // 0-1 probability
    eventCrowd: number;        // 0-1 probability
  };

  confidence: number;          // 0-1
  triggeringEvents: string[];  // eventIds causing demand
  triggeringOffers: string[];  // active offers boosting demand

  // Recommendations
  recommendations: DemandRecommendation[];
}

export interface DemandRecommendation {
  type: 'surge_pricing' | 'driver_deployment' | 'merchant_boost' | 'ad_campaign';
  action: string;
  targetEntity: string;
  expectedImpact: number;
}

// ============================================
// Trust Layer
// ============================================

export interface TrustScore {
  entityId: string;
  entityType: 'consumer' | 'merchant' | 'event' | 'zone';
  overall: number;          // 0-100

  components: {
    verificationScore: number;
    reviewScore: number;
    transactionScore: number;
    safetyScore: number;
    fraudScore: number;      // 0-100, lower is better
  };

  riskFlags: RiskFlag[];

  lastUpdated: Date;
}

export interface RiskFlag {
  type: 'fraud' | 'abuse' | 'complaint' | 'chargeback' | 'fake_review';
  severity: 'low' | 'medium' | 'high';
  description: string;
  reportedAt: Date;
  resolvedAt?: Date;
}

// ============================================
// Query Types
// ============================================

export interface GeoQuery {
  center: GeoPoint;
  radius: number; // meters
  includeExpired?: boolean;
}

export interface EventQuery {
  near?: GeoQuery;
  category?: EventCategory[];
  fromDate?: Date;
  toDate?: Date;
  minCapacity?: number;
  maxPrice?: number;
}

export interface MerchantQuery {
  near?: GeoQuery;
  category?: MerchantCategory[];
  priceRange?: ('budget' | 'mid' | 'premium' | 'luxury')[];
  minRating?: number;
  hasOffers?: boolean;
}

export interface RecommendationQuery {
  userId: string;
  location: GeoPoint;
  context: 'event' | 'ride' | 'food' | 'hotel' | 'general';
  nearbyEventId?: string;
  limit?: number;
}

// ============================================
// Response Types
// ============================================

export interface GraphQueryResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    count: number;
    queryTime: number; // ms
    cached: boolean;
  };
}

export interface RecommendationResponse {
  success: boolean;
  recommendations: Recommendation[];
  context: {
    userId: string;
    location: GeoPoint;
    triggeringEvent?: EventNode;
  };
}

export interface Recommendation {
  type: 'merchant' | 'event' | 'ride' | 'hotel' | 'offer';
  entityId: string;
  entity: MerchantNode | EventNode | unknown;
  score: number;      // 0-100
  reason: string;      // Why this was recommended
  distance?: number;   // meters from user
  offer?: ActiveOffer;
}

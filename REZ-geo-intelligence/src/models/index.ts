/**
 * REZ Geo Intelligence Core - MongoDB Models
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  GeoPoint,
  SourceApp,
  MerchantCategory,
  EventCategory,
  ZoneNode,
  ConsumerNode,
  MerchantNode,
  EventNode,
  GraphEdge,
  TrustScore,
  ZoneDemandPrediction,
  EdgeRelationship,
  RiskFlag,
  ConsumerPreferences,
  ConsumerAffinities,
  CrossAppActivity,
  PopularityMetrics,
  EventParticipation,
  ActiveOffer,
  DemandMetrics,
  DemographicProfile,
  EventImpactMetrics,
  SpilloverEffect,
  ZoneAttributes,
} from '../types/index.js';

// ============================================
// Geo Utilities
// ============================================

export function createGeoPoint(lng: number, lat: number): GeoPoint {
  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
}

export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const [lng1, lat1] = point1.coordinates;
  const [lng2, lat2] = point2.coordinates;

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

// ============================================
// Consumer Model
// ============================================

const consumerPreferencesSchema = new Schema<ConsumerPreferences>(
  {
    categories: { type: Map, of: Number, default: {} },
    preferredCuisine: [String],
    preferredPriceRange: {
      type: String,
      enum: ['budget', 'mid', 'premium', 'luxury'],
      default: 'mid',
    },
    preferredTransport: [String],
    preferredNeighborhoods: [String],
    preferredTimeSlots: [String],
    socialBookingRatio: { type: Number, default: 0, min: 0, max: 1 },
    advanceBookingDays: { type: Number, default: 7 },
  },
  { _id: false }
);

const consumerAffinitiesSchema = new Schema<ConsumerAffinities>(
  {
    rideProbability: { type: Number, default: 0.5, min: 0, max: 1 },
    restaurantAffinities: { type: Map, of: Number, default: {} },
    hotelProbability: { type: Number, default: 0, min: 0, max: 1 },
    eventProbability: { type: Number, default: 0.5, min: 0, max: 1 },
    premiumAffinities: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const crossAppActivitySchema = new Schema<CrossAppActivity>(
  {
    zeventsScore: { type: Number, default: 0, min: 0, max: 100 },
    rezrideScore: { type: Number, default: 0, min: 0, max: 100 },
    merchantScore: { type: Number, default: 0, min: 0, max: 100 },
    stayownScore: { type: Number, default: 0, min: 0, max: 100 },
    buzzlocalScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const consumerSchema = new Schema<ConsumerNode & Document>(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['consumer'], required: true },
    userId: { type: String, required: true, unique: true, index: true },

    // Identity
    primarySource: { type: String, enum: ['zevents', 'rezride', 'reznow', 'consumer', 'buzzlocal', 'stayown'] },
    unifiedId: { type: String, required: true, index: true },

    // Location
    homeLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    workLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    lastKnownLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    lastLocationUpdate: { type: Date, default: Date.now },

    // Preferences & Affinities
    preferences: { type: consumerPreferencesSchema, default: () => ({}) },
    affinities: { type: consumerAffinitiesSchema, default: () => ({}) },

    // Segments
    segments: [String],

    // Activity
    totalEventsAttended: { type: Number, default: 0 },
    totalRidesTaken: { type: Number, default: 0 },
    totalOrdersPlaced: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },

    // Cross-app
    crossAppActivity: { type: crossAppActivitySchema, default: () => ({}) },

    // Trust
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    kycStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
consumerSchema.index({ homeLocation: '2dsphere' });
consumerSchema.index({ workLocation: '2dsphere' });
consumerSchema.index({ lastKnownLocation: '2dsphere' });
consumerSchema.index({ segments: 1 });
consumerSchema.index({ affinities: 1 });

export const ConsumerModel = mongoose.model<ConsumerNode & Document>('GeoConsumer', consumerSchema);

// ============================================
// Merchant Model
// ============================================

const merchantAddressSchema = new Schema(
  {
    house: String,
    street: String,
    area: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    pincode: String,
    landmark: String,
  },
  { _id: false }
);

const popularityMetricsSchema = new Schema<PopularityMetrics>(
  {
    dailyFootfall: { type: Number, default: 0 },
    weeklyTrend: { type: Number, default: 0, min: -1, max: 1 },
    peakHours: [Number],
    busyDays: [Number],
    eventImpact: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false }
);

const eventParticipationSchema = new Schema<EventParticipation>(
  {
    isVenue: { type: Boolean, default: false },
    eventCount: { type: Number, default: 0 },
    avgAttendance: { type: Number, default: 0 },
    lastEventDate: Date,
  },
  { _id: false }
);

const activeOfferSchema = new Schema<ActiveOffer>(
  {
    offerId: { type: String, required: true },
    type: { type: String, enum: ['discount', 'cashback', 'buy1get1', 'free_delivery'], required: true },
    value: { type: Number, required: true },
    minOrderValue: Number,
    validUntil: { type: Date, required: true },
  },
  { _id: false }
);

const demandMetricsSchema = new Schema<DemandMetrics>(
  {
    avgOrdersPerDay: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    rideDemandImpact: { type: Number, default: 0, min: 0 },
    orderVelocity: { type: Number, default: 0 },
  },
  { _id: false }
);

const merchantSchema = new Schema<MerchantNode & Document>(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['merchant'], required: true },
    merchantId: { type: String, required: true, unique: true, index: true },

    // Identity
    businessName: { type: String, required: true },
    category: {
      type: String,
      enum: ['restaurant', 'cafe', 'bar', 'nightlife', 'retail', 'hotel', 'entertainment', 'fitness', 'salon', 'healthcare', 'grocery', 'pharmacy', 'other'],
      required: true,
    },
    subcategory: String,
    ownerId: String,

    // Location (2dsphere)
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { type: merchantAddressSchema, required: true },
    coverageRadius: { type: Number, default: 1000 },

    // Offerings
    priceRange: { type: String, enum: ['budget', 'mid', 'premium', 'luxury'], default: 'mid' },
    cuisines: [String],
    amenities: [String],

    // Trust
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    qualityScore: { type: Number, default: 100, min: 0, max: 100 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    // Performance
    popularity: { type: popularityMetricsSchema, default: () => ({}) },
    eventParticipation: { type: eventParticipationSchema, default: () => ({}) },

    // Offers
    loyaltyPrograms: [String],
    activeOffers: [activeOfferSchema],

    // Demand
    demandMetrics: { type: demandMetricsSchema, default: () => ({}) },

    // Source
    sourceApp: { type: String, enum: ['zevents', 'rezride', 'reznow', 'consumer', 'buzzlocal', 'stayown'] },

    // Timestamps
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
merchantSchema.index({ location: '2dsphere' });
merchantSchema.index({ category: 1, 'location': '2dsphere' });
merchantSchema.index({ priceRange: 1 });
merchantSchema.index({ 'activeOffers.validUntil': 1 });

export const MerchantModel = mongoose.model<MerchantNode & Document>('GeoMerchant', merchantSchema);

// ============================================
// Event Model (from Z-Events)
// ============================================

const eventVenueSchema = new Schema(
  {
    name: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    address: { type: merchantAddressSchema, required: true },
    indoor: { type: Boolean, default: false },
    capacity: { type: Number, required: true },
  },
  { _id: false }
);

const demographicProfileSchema = new Schema<DemographicProfile>(
  {
    avgAge: { type: Number, default: 25 },
    ageRange: { type: [Number], default: [18, 35] },
    spendingTier: { type: String, enum: ['budget', 'mid', 'premium', 'luxury'], default: 'mid' },
    avgGroupSize: { type: Number, default: 2 },
    corporateRatio: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false }
);

const eventImpactMetricsSchema = new Schema<EventImpactMetrics>(
  {
    rideDemandIncrease: { type: Number, default: 1.0 },
    foodDeliveryIncrease: { type: Number, default: 1.0 },
    hotelOccupancyIncrease: { type: Number, default: 1.0 },
    retailSpike: { type: Number, default: 1.0 },
    avgTicketPrice: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    socialMediaBuzz: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const spilloverEffectSchema = new Schema<SpilloverEffect>(
  {
    nearbyMerchantBoost: { type: Number, default: 0.5, min: 0, max: 1 },
    restaurantDemandIncrease: { type: Number, default: 0.5 },
    nightlifeDemandIncrease: { type: Number, default: 0.5 },
    hotelDemandIncrease: { type: Number, default: 0.3 },
    rideDemandIncrease: { type: Number, default: 0.8 },
  },
  { _id: false }
);

const eventSchema = new Schema<EventNode & Document>(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['event'], required: true },
    eventId: { type: String, required: true, unique: true, index: true },

    // Identity
    title: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ['music', 'sports', 'comedy', 'tech', 'food', 'art', 'business', 'fitness', 'lifestyle', 'community'],
      required: true,
    },
    tags: [String],

    // Location
    venue: { type: eventVenueSchema, required: true },
    coverageRadius: { type: Number, default: 5000 },

    // Timing
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    isMultiDay: { type: Boolean, default: false },

    // Capacity
    capacity: { type: Number, required: true },
    ticketsSold: { type: Number, default: 0 },
    predictedAttendance: { type: Number, default: 0 },
    checkinCount: { type: Number, default: 0 },

    // Demographics
    demographicProfile: { type: demographicProfileSchema, default: () => ({}) },

    // Impact
    impactMetrics: { type: eventImpactMetricsSchema, default: () => ({}) },

    // Spillover
    spilloverEffect: { type: spilloverEffectSchema, default: () => ({}) },

    // Trust
    organizerTrustScore: { type: Number, default: 100, min: 0, max: 100 },

    // Source
    sourceApp: { type: String, enum: ['zevents'], default: 'zevents' },
  },
  { timestamps: true }
);

// Indexes
eventSchema.index({ 'venue.location': '2dsphere' });
eventSchema.index({ category: 1, startDate: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ status: 1 });

export const EventModel = mongoose.model<EventNode & Document>('GeoEvent', eventSchema);

// ============================================
// Zone Model
// ============================================

const zoneAttributesSchema = new Schema<ZoneAttributes>(
  {
    isPremium: { type: Boolean, default: false },
    isNightlifeHub: { type: Boolean, default: false },
    isFoodDestination: { type: Boolean, default: false },
    isTechHub: { type: Boolean, default: false },
    hasMetro: { type: Boolean, default: false },
    hasParking: { type: Boolean, default: false },
  },
  { _id: false }
);

const zoneSchema = new Schema<ZoneNode & Document>(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['zone'], required: true },
    zoneId: { type: String, required: true, unique: true, index: true },

    // Identity
    name: { type: String, required: true },
    city: { type: String, required: true, index: true },
    area: { type: String, required: true },

    // Geometry
    boundary: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    center: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    radius: { type: Number, required: true },

    // Characteristics
    zoneType: {
      type: String,
      enum: ['residential', 'commercial', 'mixed', 'industrial', 'entertainment'],
      default: 'mixed',
    },
    attributes: { type: zoneAttributesSchema, default: () => ({}) },

    // Metrics
    populationDensity: Number,
    commercialDensity: Number,
    eventFrequency: { type: Number, default: 0 },

    // Trust
    womenSafetyScore: { type: Number, default: 100, min: 0, max: 100 },
    crimeRate: { type: Number, default: 0, min: 0, max: 100 },

    // Demand
    aggregateDemand: { type: demandMetricsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Indexes
zoneSchema.index({ 'center': '2dsphere' });
zoneSchema.index({ 'boundary': '2dsphere' });
zoneSchema.index({ city: 1, zoneType: 1 });

export const ZoneModel = mongoose.model<ZoneNode & Document>('GeoZone', zoneSchema);

// ============================================
// Graph Edges Model
// ============================================

const graphEdgeSchema = new Schema<GraphEdge & Document>(
  {
    edgeId: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, index: true },
    target: { type: String, required: true, index: true },
    relationship: {
      type: String,
      enum: ['attended', 'booked', 'wishlisted', 'shared', 'reviewed', 'visited', 'ordered', 'favorited', 'friend', 'family', 'colleague', 'venue_for', 'sponsored_by', 'nearby', 'located_in', 'lives_in', 'works_in', 'frequents'],
      required: true,
    },
    weight: { type: Number, default: 1, min: 0, max: 1 },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Compound indexes for edge traversal
graphEdgeSchema.index({ source: 1, relationship: 1 });
graphEdgeSchema.index({ target: 1, relationship: 1 });
graphEdgeSchema.index({ source: 1, target: 1 }, { unique: true });

export const GraphEdgeModel = mongoose.model<GraphEdge & Document>('GeoEdge', graphEdgeSchema);

// ============================================
// Trust Model
// ============================================

const riskFlagSchema = new Schema<RiskFlag>(
  {
    type: { type: String, enum: ['fraud', 'abuse', 'complaint', 'chargeback', 'fake_review'], required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    description: String,
    reportedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { _id: false }
);

const trustScoreSchema = new Schema<TrustScore & Document>(
  {
    entityId: { type: String, required: true, unique: true, index: true },
    entityType: { type: String, enum: ['consumer', 'merchant', 'event', 'zone'], required: true },
    overall: { type: Number, default: 100, min: 0, max: 100 },

    components: {
      verificationScore: { type: Number, default: 100, min: 0, max: 100 },
      reviewScore: { type: Number, default: 100, min: 0, max: 100 },
      transactionScore: { type: Number, default: 100, min: 0, max: 100 },
      safetyScore: { type: Number, default: 100, min: 0, max: 100 },
      fraudScore: { type: Number, default: 0, min: 0, max: 100 },
    },

    riskFlags: [riskFlagSchema],

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

trustScoreSchema.index({ entityType: 1, overall: -1 });

export const TrustScoreModel = mongoose.model<TrustScore & Document>('GeoTrustScore', trustScoreSchema);

// ============================================
// Demand Prediction Model
// ============================================

const zoneDemandPredictionSchema = new Schema<ZoneDemandPrediction & Document>(
  {
    zoneId: { type: String, required: true, index: true },
    timeSlot: { type: Date, required: true, index: true },

    predictions: {
      rideDemand: { type: Number, default: 0.5, min: 0, max: 1 },
      deliveryDemand: { type: Number, default: 0.5, min: 0, max: 1 },
      restaurantRush: { type: Number, default: 0.5, min: 0, max: 1 },
      hotelOccupancy: { type: Number, default: 0.5, min: 0, max: 1 },
      eventCrowd: { type: Number, default: 0, min: 0, max: 1 },
    },

    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    triggeringEvents: [String],
    triggeringOffers: [String],

    recommendations: [
      {
        type: { type: String, enum: ['surge_pricing', 'driver_deployment', 'merchant_boost', 'ad_campaign'] },
        action: String,
        targetEntity: String,
        expectedImpact: Number,
      },
    ],
  },
  { timestamps: true }
);

zoneDemandPredictionSchema.index({ zoneId: 1, timeSlot: 1 }, { unique: true });
zoneDemandPredictionSchema.index({ 'predictions.rideDemand': -1 });
zoneDemandPredictionSchema.index({ triggeringEvents: 1 });

export const ZoneDemandPredictionModel = mongoose.model<ZoneDemandPrediction & Document>('GeoZoneDemandPrediction', zoneDemandPredictionSchema);

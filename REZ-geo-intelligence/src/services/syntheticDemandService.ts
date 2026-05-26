/**
 * REZ Geo Intelligence - Synthetic Demand Index Service
 * Composes demand from multiple signals: rides, bookings, events, weather, commerce, footfall, social
 *
 * Koramangala Demand Index: 84/100 composed from:
 * - Ride frequency & destination ratios
 * - Booking/order velocity
 * - Event attendance & buzz
 * - Weather conditions
 * - Commerce signals
 * - Footfall density
 * - Social buzz
 */

import mongoose, { Schema, Model, type Document } from 'mongoose';
import { Redis } from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import axios from 'axios';
import { randomInt } from 'crypto';
import {
  SyntheticDemandIndex,
  DemandComponents,
  DataQualityScore,
  TimeSlot,
  DemandIndexWeights,
  DEFAULT_DEMAND_INDEX_WEIGHTS,
  DemandIndexResponse,
  DemandIndexMapResponse,
  ZoneLevel,
} from '../types/zoneHierarchy.js';
import logger from '../utils/logger.js';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = 60; // seconds

// Signal source URLs
const SIGNAL_SOURCES = {
  rides: process.env.RIDE_SERVICE_URL || 'http://localhost:4007',
  orders: process.env.ORDER_SERVICE_URL || 'http://localhost:4006',
  events: process.env.EVENT_SERVICE_URL || 'http://localhost:4101',
  weather: process.env.WEATHER_SERVICE_URL || 'http://localhost:4105',
  social: process.env.SOCIAL_SERVICE_URL || 'http://localhost:4110',
  footfall: process.env.FOOTFALL_SERVICE_URL || 'http://localhost:4115',
};

// ============================================
// MONGOOSE SCHEMA
// ============================================

const SyntheticDemandIndexSchema = new Schema({
  zoneId: { type: String, required: true, index: true },
  level: { type: String, enum: ['city', 'district', 'neighborhood', 'micro_zone', 'venue_cluster'], required: true },
  timestamp: { type: Date, default: Date.now, index: true },

  // Component scores (0-100)
  components: {
    orderVelocity: { type: Number, default: 0 },
    basketSize: { type: Number, default: 0 },
    fulfillmentRate: { type: Number, default: 0 },
    rideFrequency: { type: Number, default: 0 },
    rideDestinationRatio: { type: Number, default: 0 },
    eventAttendance: { type: Number, default: 0 },
    eventBuzz: { type: Number, default: 0 },
    footfallCount: { type: Number, default: 0 },
    footfallDensity: { type: Number, default: 0 },
    weatherImpact: { type: Number, default: 0 },
    timeImpact: { type: Number, default: 0 },
  },

  // Composite score (0-100)
  overallIndex: { type: Number, default: 0 },

  // Confidence and quality
  confidence: { type: Number, default: 0 },
  dataQuality: {
    overall: { type: Number, default: 0 },
    signalCoverage: { type: Number, default: 0 },
    freshnessScore: { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0 },
    consistencyScore: { type: Number, default: 0 },
  },

  // Trend
  trend: { type: String, enum: ['rising', 'stable', 'declining'], default: 'stable' },
  trendChange: { type: Number, default: 0 },

  // Influencing factors
  influencingEvents: [{ type: String }],
  influencingWeather: { type: String, default: '' },
  influencingTime: {
    hourOfDay: Number,
    dayOfWeek: Number,
    isWeekend: Boolean,
    isHoliday: Boolean,
    slotType: String,
  },
});

SyntheticDemandIndexSchema.index({ zoneId: 1, timestamp: -1 });
SyntheticDemandIndexSchema.index({ level: 1, timestamp: -1 });

// ============================================
// MODEL
// ============================================

export const SyntheticDemandIndexModel: Model<SyntheticDemandIndex> = mongoose.model<SyntheticDemandIndex>(
  'SyntheticDemandIndex',
  SyntheticDemandIndexSchema
);

// ============================================
// SIGNAL FETCHERS
// ============================================

interface SignalData {
  rideFrequency?: number;
  rideDestinationRatio?: number;
  orderVelocity?: number;
  basketSize?: number;
  fulfillmentRate?: number;
  eventAttendance?: number;
  eventBuzz?: number;
  footfallCount?: number;
  footfallDensity?: number;
  confidence?: number;
  source: string;
  timestamp: Date;
}

class SyntheticDemandService {
  private redis: RedisType | null = null;
  private weights: DemandIndexWeights = DEFAULT_DEMAND_INDEX_WEIGHTS;

  // ============================================
  // INITIALIZATION
  // ============================================

  async initialize(): Promise<void> {
    try {
      this.redis = new Redis(REDIS_URL);
      await this.redis.ping();
      logger.info('Synthetic Demand Service initialized with Redis');
    } catch (error) {
      logger.warn('Redis connection failed, running without cache', { error });
    }
  }

  // ============================================
  // MAIN COMPUTATION
  // ============================================

  /**
   * Compute synthetic demand index for a zone
   */
  async computeDemandIndex(
    zoneId: string,
    level: ZoneLevel,
    location?: { lat: number; lng: number }
  ): Promise<DemandIndexResponse> {
    const startTime = Date.now();

    // Check cache
    const cached = await this.getFromCache(zoneId);
    if (cached) {
      return cached;
    }

    // Gather all signal data
    const signals = await this.gatherSignals(zoneId, location);

    // Compute components
    const components = this.computeComponents(signals);

    // Compute quality score
    const dataQuality = this.computeDataQuality(signals);

    // Compute overall index
    const overallIndex = this.computeOverallIndex(components);

    // Determine trend
    const { trend, trendChange } = await this.computeTrend(zoneId, overallIndex);

    // Build result
    const index: SyntheticDemandIndex = {
      zoneId,
      level,
      timestamp: new Date(),
      components,
      overallIndex,
      confidence: dataQuality.overall,
      dataQuality,
      trend,
      trendChange,
      influencingEvents: signals.eventData?.events?.map((e: { eventId: string }) => e.eventId) || [],
      influencingWeather: signals.weatherData?.condition || 'unknown',
      influencingTime: signals.timeSlot,
    };

    // Persist
    await this.persistIndex(index);

    // Cache result
    await this.setCache(zoneId, { success: true, index, comparable: [], meta: { computedAt: new Date(), sourceSignals: Object.keys(signals), confidence: dataQuality.overall } });

    const queryTime = Date.now() - startTime;
    logger.info('Demand index computed', { zoneId, overallIndex, queryTime });

    return {
      success: true,
      index,
      comparable: await this.getComparableZones(zoneId, overallIndex),
      meta: {
        computedAt: new Date(),
        sourceSignals: Object.keys(signals),
        confidence: dataQuality.overall,
      },
    };
  }

  /**
   * Compute demand index map for a region
   */
  async computeDemandIndexMap(
    location: { lat: number; lng: number },
    radiusMeters: number,
    level: ZoneLevel = 'neighborhood'
  ): Promise<DemandIndexMapResponse> {
    // This would query the zone hierarchy service for zones in the radius
    // For now, return a placeholder structure

    const indices: SyntheticDemandIndex[] = [];
    const bounds = {
      north: location.lat + (radiusMeters / 111000),
      south: location.lat - (radiusMeters / 111000),
      east: location.lng + (radiusMeters / (111000 * Math.cos(location.lat * Math.PI / 180))),
      west: location.lng - (radiusMeters / (111000 * Math.cos(location.lat * Math.PI / 180))),
    };

    // TODO: Query zone hierarchy service for zones in bounds
    // For now, compute for center point
    const centerIndex = await this.computeDemandIndex(
      `demand_${location.lat.toFixed(4)}_${location.lng.toFixed(4)}`,
      level,
      location
    );
    indices.push(centerIndex.index);

    return {
      success: true,
      indices,
      bounds,
      meta: {
        level,
        count: indices.length,
        timestamp: new Date(),
      },
    };
  }

  // ============================================
  // SIGNAL GATHERING
  // ============================================

  private async gatherSignals(
    zoneId: string,
    location?: { lat: number; lng: number }
  ): Promise<{
    rideData?: SignalData;
    orderData?: SignalData;
    eventData?: { events: { eventId: string; attendance: number }[]; buzz: number };
    weatherData?: { condition: string; impact: number };
    socialData?: SignalData;
    footfallData?: SignalData;
    timeSlot: TimeSlot;
  }> {
    const now = new Date();
    const timeSlot = this.computeTimeSlot(now);

    // Parallel fetch from all sources
    const [rideData, orderData, eventData, weatherData, socialData, footfallData] = await Promise.all([
      this.fetchRideSignals(zoneId, location),
      this.fetchOrderSignals(zoneId, location),
      this.fetchEventSignals(zoneId, location, timeSlot),
      this.fetchWeatherSignals(location),
      this.fetchSocialSignals(zoneId),
      this.fetchFootfallSignals(zoneId, location),
    ]);

    return {
      rideData,
      orderData,
      eventData,
      weatherData,
      socialData,
      footfallData,
      timeSlot,
    };
  }

  private async fetchRideSignals(zoneId: string, location?: { lat: number; lng: number }): Promise<SignalData | undefined> {
    try {
      // Try to fetch from ride service
      const response = await axios.get(`${SIGNAL_SOURCES.rides}/api/zone-stats`, {
        params: { zoneId, lat: location?.lat, lng: location?.lng },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data) {
        return {
          rideFrequency: this.normalizeRideFrequency(response.data.rideFrequency || 0),
          rideDestinationRatio: response.data.destinationRatio || 0.5,
          confidence: 0.8,
          source: 'ride-service',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.debug('Ride signals unavailable', { zoneId });
    }

    // Return mock data for development
    return {
      rideFrequency: this.normalizeRideFrequency(randomInt(0, 100)),
      rideDestinationRatio: 0.4 + randomInt(0, 41) / 100,
      confidence: 0.3,
      source: 'mock',
      timestamp: new Date(),
    };
  }

  private async fetchOrderSignals(zoneId: string, location?: { lat: number; lng: number }): Promise<SignalData | undefined> {
    try {
      const response = await axios.get(`${SIGNAL_SOURCES.orders}/api/zone-demand`, {
        params: { zoneId, lat: location?.lat, lng: location?.lng },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data) {
        return {
          orderVelocity: this.normalizeOrderVelocity(response.data.ordersPerHour || 0),
          basketSize: this.normalizeBasketSize(response.data.avgOrderValue || 0),
          fulfillmentRate: response.data.fulfillmentRate || 0.9,
          confidence: 0.85,
          source: 'order-service',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.debug('Order signals unavailable', { zoneId });
    }

    // Mock data
    return {
      orderVelocity: this.normalizeOrderVelocity(randomInt(0, 51)),
      basketSize: this.normalizeBasketSize(200 + randomInt(0, 601)),
      fulfillmentRate: 0.85 + randomInt(0, 11) / 100,
      confidence: 0.3,
      source: 'mock',
      timestamp: new Date(),
    };
  }

  private async fetchEventSignals(
    zoneId: string,
    location: { lat: number; lng: number } | undefined,
    timeSlot: TimeSlot
  ): Promise<{ events: { eventId: string; attendance: number }[]; buzz: number } | undefined> {
    try {
      // Check if there are events in this zone
      const response = await axios.get(`${SIGNAL_SOURCES.events}/api/events/nearby`, {
        params: {
          lat: location?.lat,
          lng: location?.lng,
          radiusMeters: 2000,
          from: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
          to: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours ahead
        },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data?.events) {
        const events = response.data.events;
        const totalAttendance = events.reduce((sum: number, e: { ticketsSold?: number }) => sum + (e.ticketsSold || 0), 0);

        return {
          events: events.map((e: { eventId: string; ticketsSold?: number }) => ({
            eventId: e.eventId,
            attendance: e.ticketsSold || 0,
          })),
          buzz: Math.min(100, events.length * 15 + totalAttendance / 10),
        };
      }
    } catch (error) {
      logger.debug('Event signals unavailable', { zoneId });
    }

    // Mock with occasional events
    const hasEvent = randomInt(0, 100) > 70;
    return {
      events: hasEvent ? [{ eventId: `evt_${Date.now()}`, attendance: 50 + randomInt(0, 201) }] : [],
      buzz: hasEvent ? 40 + randomInt(0, 41) : 10 + randomInt(0, 21),
    };
  }

  private async fetchWeatherSignals(location?: { lat: number; lng: number }): Promise<{ condition: string; impact: number } | undefined> {
    try {
      const response = await axios.get(`${SIGNAL_SOURCES.weather}/api/weather/current`, {
        params: { lat: location?.lat, lng: location?.lng },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data) {
        return {
          condition: response.data.condition || 'clear',
          impact: this.computeWeatherImpact(response.data.condition),
        };
      }
    } catch (error) {
      logger.debug('Weather signals unavailable');
    }

    // Mock weather based on time
    const hour = new Date().getHours();
    const conditions = ['clear', 'cloudy', 'rain', 'hot'];
    const weights = [0.5, 0.2, 0.1, 0.2];
    const rand = randomInt(0, 100) / 100;
    let cumWeight = 0;
    let condition = 'clear';
    for (let i = 0; i < conditions.length; i++) {
      cumWeight += weights[i];
      if (rand < cumWeight) {
        condition = conditions[i];
        break;
      }
    }

    return {
      condition,
      impact: this.computeWeatherImpact(condition),
    };
  }

  private async fetchSocialSignals(zoneId: string): Promise<SignalData | undefined> {
    try {
      const response = await axios.get(`${SIGNAL_SOURCES.social}/api/zone-buzz`, {
        params: { zoneId },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data) {
        return {
          eventBuzz: response.data.buzzScore || 50,
          confidence: 0.6,
          source: 'social-service',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.debug('Social signals unavailable', { zoneId });
    }

    // Mock social buzz
    return {
      eventBuzz: 20 + randomInt(0, 61),
      confidence: 0.3,
      source: 'mock',
      timestamp: new Date(),
    };
  }

  private async fetchFootfallSignals(zoneId: string, location?: { lat: number; lng: number }): Promise<SignalData | undefined> {
    try {
      const response = await axios.get(`${SIGNAL_SOURCES.footfall}/api/count`, {
        params: { zoneId, lat: location?.lat, lng: location?.lng },
        timeout: 2000,
      }).catch(() => null);

      if (response?.data) {
        return {
          footfallCount: this.normalizeFootfall(response.data.count || 0),
          footfallDensity: response.data.density || 0.5,
          confidence: 0.7,
          source: 'footfall-service',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      logger.debug('Footfall signals unavailable', { zoneId });
    }

    // Mock footfall
    return {
      footfallCount: this.normalizeFootfall(100 + randomInt(0, 501)),
      footfallDensity: 0.3 + randomInt(0, 51) / 100,
      confidence: 0.3,
      source: 'mock',
      timestamp: new Date(),
    };
  }

  // ============================================
  // COMPONENT COMPUTATION
  // ============================================

  private computeComponents(signals: ReturnType<SyntheticDemandService['gatherSignals']> extends Promise<infer T> ? T : never): DemandComponents {
    const {
      rideData,
      orderData,
      eventData,
      weatherData,
      socialData,
      footfallData,
      timeSlot,
    } = signals;

    return {
      // Commerce signals (0-100)
      orderVelocity: orderData?.orderVelocity || 50,
      basketSize: orderData?.basketSize || 50,
      fulfillmentRate: (orderData?.fulfillmentRate || 0.9) * 100,

      // Mobility signals (0-100)
      rideFrequency: rideData?.rideFrequency || 50,
      rideDestinationRatio: (rideData?.rideDestinationRatio || 0.5) * 100,

      // Event signals (0-100)
      eventAttendance: eventData
        ? Math.min(100, eventData.events.reduce((sum, e) => sum + e.attendance, 0) / 5)
        : 50,
      eventBuzz: eventData?.buzz || 50,

      // Footfall signals (0-100)
      footfallCount: footfallData?.footfallCount || 50,
      footfallDensity: (footfallData?.footfallDensity || 0.5) * 100,

      // Context signals (0-100)
      weatherImpact: (weatherData?.impact || 1) * 50,
      timeImpact: this.computeTimeImpact(timeSlot),
    };
  }

  private computeOverallIndex(components: DemandComponents): number {
    const w = this.weights;

    const weightedSum =
      components.orderVelocity * w.orderVelocity +
      components.basketSize * w.basketSize +
      components.fulfillmentRate * w.fulfillmentRate +
      components.rideFrequency * w.rideFrequency +
      components.rideDestinationRatio * w.rideDestinationRatio +
      components.eventAttendance * w.eventAttendance +
      components.eventBuzz * w.eventBuzz +
      components.footfallCount * w.footfallCount +
      components.footfallDensity * w.footfallDensity +
      components.weatherImpact * w.weatherImpact +
      components.timeImpact * w.timeImpact;

    return Math.round(Math.min(100, Math.max(0, weightedSum)));
  }

  private computeDataQuality(signals: ReturnType<SyntheticDemandService['gatherSignals']> extends Promise<infer T> ? T : never): DataQualityScore {
    const sources = ['rideData', 'orderData', 'eventData', 'weatherData', 'socialData', 'footfallData'] as const;
    const presentSignals = sources.filter((s) => signals[s] !== undefined);

    const signalCoverage = (presentSignals.length / sources.length) * 100;

    let freshnessSum = 0;
    let completenessSum = 0;
    let consistencySum = 0;

    for (const signal of presentSignals) {
      const data = signals[signal];
      if (data && 'confidence' in data) {
        freshnessSum += (data as { confidence: number }).confidence;
        completenessSum += 1; // If signal is present, assume complete
      } else if (data) {
        freshnessSum += 0.5; // Default confidence for signals without it
        completenessSum += 1;
      }
    }

    // Check consistency between signals
    if (signals.rideData && signals.orderData) {
      // If both ride and order are high, they're consistent
      const rideNorm = (signals.rideData.rideFrequency || 50) / 100;
      const orderNorm = (signals.orderData.orderVelocity || 50) / 100;
      consistencySum = (1 - Math.abs(rideNorm - orderNorm)) * 100;
    } else {
      consistencySum = 50;
    }

    return {
      overall: Math.round((signalCoverage + freshnessSum / sources.length + consistencySum) / 3),
      signalCoverage: Math.round(signalCoverage),
      freshnessScore: Math.round(freshnessSum / Math.max(1, presentSignals.length)),
      completenessScore: Math.round((completenessSum / sources.length) * 100),
      consistencyScore: Math.round(consistencySum),
    };
  }

  private async computeTrend(zoneId: string, currentIndex: number): Promise<{ trend: 'rising' | 'stable' | 'declining'; trendChange: number }> {
    // Get last 3 indices for trend calculation
    const history = await SyntheticDemandIndexModel.find({ zoneId })
      .sort({ timestamp: -1 })
      .limit(4)
      .select('overallIndex');

    if (history.length < 2) {
      return { trend: 'stable', trendChange: 0 };
    }

    const previousAvg = history.slice(1).reduce((sum, h) => sum + h.overallIndex, 0) / (history.length - 1);
    const trendChange = ((currentIndex - previousAvg) / Math.max(1, previousAvg)) * 100;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (trendChange > 5) trend = 'rising';
    else if (trendChange < -5) trend = 'declining';

    return { trend, trendChange: Math.round(trendChange) };
  }

  // ============================================
  // TIME SLOT
  // ============================================

  private computeTimeSlot(date: Date): TimeSlot {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Check if today is a holiday (simplified)
    const holidays = [
      '2026-01-01', '2026-01-26', '2026-03-10', '2026-03-14', '2026-04-06',
      '2026-04-14', '2026-05-01', '2026-05-10', '2026-08-15', '2026-10-02',
      '2026-10-20', '2026-11-01', '2026-11-04', '2026-12-25',
    ];
    const today = date.toISOString().split('T')[0];
    const isHoliday = holidays.includes(today);

    let slotType: TimeSlot['slotType'] = 'other';
    if (hour >= 7 && hour < 10) slotType = 'breakfast';
    else if (hour >= 10 && hour < 12) slotType = 'midday';
    else if (hour >= 12 && hour < 14) slotType = 'lunch';
    else if (hour >= 14 && hour < 17) slotType = 'midday';
    else if (hour >= 17 && hour < 19) slotType = 'evening';
    else if (hour >= 19 && hour < 22) slotType = 'dinner';
    else if (hour >= 22 || hour < 5) slotType = 'late_night';

    return { hourOfDay: hour, dayOfWeek, isWeekend, isHoliday, slotType };
  }

  private computeTimeImpact(timeSlot: TimeSlot): number {
    // Base demand by time slot
    const slotDemand: Record<TimeSlot['slotType'], number> = {
      breakfast: 40,
      lunch: 75,
      evening: 65,
      dinner: 85,
      late_night: 35,
      midday: 45,
      other: 30,
    };

    let impact = slotDemand[timeSlot.slotType] || 50;

    // Weekend boost
    if (timeSlot.isWeekend) impact *= 1.2;

    // Holiday boost
    if (timeSlot.isHoliday) impact *= 1.3;

    return Math.min(100, impact);
  }

  private computeWeatherImpact(condition: string): number {
    const impacts: Record<string, number> = {
      clear: 1.0,
      cloudy: 0.9,
      rain: 0.5,
      heavy_rain: 0.3,
      hot: 1.1,
      cold: 0.8,
      snow: 0.2,
      fog: 0.6,
      storm: 0.2,
    };
    return impacts[condition] || 1.0;
  }

  // ============================================
  // NORMALIZATION HELPERS
  // ============================================

  private normalizeRideFrequency(frequency: number): number {
    // Expect 0-200 rides/hour as normal range
    return Math.min(100, (frequency / 200) * 100);
  }

  private normalizeOrderVelocity(ordersPerHour: number): number {
    // Expect 0-100 orders/hour as normal range
    return Math.min(100, (ordersPerHour / 100) * 100);
  }

  private normalizeBasketSize(avgOrderValue: number): number {
    // Normalize basket size to 0-100
    // Low: 100, Mid: 400, High: 800
    if (avgOrderValue < 200) return 30 + (avgOrderValue / 200) * 20;
    if (avgOrderValue < 500) return 50 + ((avgOrderValue - 200) / 300) * 30;
    return 80 + Math.min(20, ((avgOrderValue - 500) / 500) * 20);
  }

  private normalizeFootfall(count: number): number {
    // Normalize footfall 0-1000 people as range
    return Math.min(100, (count / 1000) * 100);
  }

  // ============================================
  // COMPARABLE ZONES
  // ============================================

  private async getComparableZones(currentZoneId: string, currentIndex: number): Promise<DemandIndexResponse['comparable']> {
    // Find zones with similar demand levels
    const similar = await SyntheticDemandIndexModel.find({
      zoneId: { $ne: currentZoneId },
      overallIndex: { $gte: currentIndex - 10, $lte: currentIndex + 10 },
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Within 1 hour
    })
      .sort({ overallIndex: -1 })
      .limit(5)
      .select('zoneId overallIndex');

    return similar.map((s) => ({
      zoneId: s.zoneId,
      name: s.zoneId,
      overallIndex: s.overallIndex,
    }));
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async persistIndex(index: SyntheticDemandIndex): Promise<void> {
    try {
      await SyntheticDemandIndexModel.findOneAndUpdate(
        { zoneId: index.zoneId, timestamp: { $gte: new Date(Date.now() - 60000) } },
        index,
        { upsert: true }
      );
    } catch (error) {
      logger.error('Failed to persist demand index', { zoneId: index.zoneId, error });
    }
  }

  // ============================================
  // CACHING
  // ============================================

  private async getFromCache(zoneId: string): Promise<DemandIndexResponse | null> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(`demand:${zoneId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.debug('Cache read failed', { zoneId });
    }
    return null;
  }

  private async setCache(zoneId: string, data: DemandIndexResponse): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.setex(`demand:${zoneId}`, CACHE_TTL, JSON.stringify(data));
    } catch (error) {
      logger.debug('Cache write failed', { zoneId });
    }
  }

  // ============================================
  // HISTORY & ANALYTICS
  // ============================================

  /**
   * Get demand history for a zone
   */
  async getDemandHistory(
    zoneId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<{ timestamp: Date; overallIndex: number }[]> {
    const history = await SyntheticDemandIndexModel.find({
      zoneId,
      timestamp: { $gte: fromDate, $lte: toDate },
    })
      .sort({ timestamp: 1 })
      .select('timestamp overallIndex');

    return history.map((h) => ({
      timestamp: h.timestamp,
      overallIndex: h.overallIndex,
    }));
  }

  /**
   * Get demand forecast (simple projection)
   */
  async getDemandForecast(zoneId: string, hoursAhead: number = 24): Promise<{
    timestamp: Date;
    predictedIndex: number;
    confidence: number;
  }[]> {
    const forecast: { timestamp: Date; predictedIndex: number; confidence: number }[] = [];
    const now = new Date();

    // Get recent history for trend
    const recent = await this.getDemandHistory(
      zoneId,
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
      now
    );

    if (recent.length === 0) {
      // No data, return neutral forecasts
      for (let i = 1; i <= hoursAhead; i++) {
        forecast.push({
          timestamp: new Date(now.getTime() + i * 60 * 60 * 1000),
          predictedIndex: 50,
          confidence: 0.2,
        });
      }
      return forecast;
    }

    // Simple trend projection
    const avgIndex = recent.reduce((sum, r) => sum + r.overallIndex, 0) / recent.length;
    const trend = recent.length > 1
      ? (recent[recent.length - 1].overallIndex - recent[0].overallIndex) / recent.length
      : 0;

    for (let i = 1; i <= hoursAhead; i++) {
      const projected = avgIndex + trend * i;
      const confidence = Math.max(0.3, 1 - (i / hoursAhead) * 0.5);

      forecast.push({
        timestamp: new Date(now.getTime() + i * 60 * 60 * 1000),
        predictedIndex: Math.round(Math.min(100, Math.max(0, projected))),
        confidence,
      });
    }

    return forecast;
  }
}

export const syntheticDemandService = new SyntheticDemandService();

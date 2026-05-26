/**
 * REZ Geo Intelligence Core - Event Graph Service
 * Connects Z-Events to the unified Geo Intelligence Graph
 */

import crypto from 'crypto';
import { EventModel, MerchantModel, ConsumerModel, GraphEdgeModel } from '../models/index.js';
import { EventNode, GeoPoint, EventCategory, SpilloverEffect } from '../types/index.js';
import logger from '../utils/logger.js';

export interface ZEventsEvent {
  eventId: string;
  title: string;
  description?: string;
  category: EventCategory;
  tags?: string[];
  venue: {
    name: string;
    location: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    address: {
      area: string;
      city: string;
      state?: string;
      pincode?: string;
    };
    capacity: number;
    indoor?: boolean;
  };
  startDate: Date;
  endDate: Date;
  capacity: number;
  ticketsSold?: number;
  organizerTrustScore?: number;
  pricing?: {
    avgTicketPrice?: number;
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface EventBookingSignal {
  userId: string;
  eventId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  totalAmount: number;
  coinsUsed?: number;
  bookingType: 'solo' | 'couple' | 'group' | 'corporate';
  spendingTier: 'budget' | 'mid' | 'premium' | 'luxury';
  daysInAdvance: number;
  dayOfWeek: string;
  timeOfDay: string;
  friendsAttending: number;
}

export class EventGraphService {
  private readonly COVERAGE_RADIUS = 5000; // 5km default coverage

  // ============================================
  // SYNC: Import event from Z-Events
  // ============================================

  async syncEventFromZEvents(zEvent: ZEventsEvent): Promise<EventNode> {
    const nodeId = `event_${zEvent.eventId}`;

    // Calculate spillover effect
    const spilloverEffect = this.calculateSpillover(zEvent);

    // Calculate demographic profile (from available data)
    const demographicProfile = {
      avgAge: this.estimateAvgAge(zEvent.category),
      ageRange: this.estimateAgeRange(zEvent.category) as [number, number],
      spendingTier: this.estimateSpendingTier(zEvent.pricing?.avgTicketPrice),
      avgGroupSize: this.estimateAvgGroupSize(zEvent.category),
      corporateRatio: zEvent.category === 'business' || zEvent.category === 'tech' ? 0.3 : 0.1,
    };

    const eventNode: Partial<EventNode> = {
      nodeId,
      type: 'event',
      eventId: zEvent.eventId,
      title: zEvent.title,
      description: zEvent.description,
      category: zEvent.category,
      tags: zEvent.tags || [],
      venue: {
        name: zEvent.venue.name,
        location: zEvent.venue.location as GeoPoint,
        address: {
          area: zEvent.venue.address.area,
          city: zEvent.venue.address.city,
          state: zEvent.venue.address.state || '',
          pincode: zEvent.venue.address.pincode || '',
        },
        indoor: zEvent.venue.indoor ?? true,
        capacity: zEvent.venue.capacity,
      },
      coverageRadius: this.COVERAGE_RADIUS,
      startDate: new Date(zEvent.startDate),
      endDate: new Date(zEvent.endDate),
      isMultiDay: new Date(zEvent.endDate).getTime() - new Date(zEvent.startDate).getTime() > 86400000,
      capacity: zEvent.capacity,
      ticketsSold: zEvent.ticketsSold || 0,
      predictedAttendance: zEvent.ticketsSold || Math.floor(zEvent.capacity * 0.7),
      checkinCount: 0,
      demographicProfile,
      impactMetrics: {
        rideDemandIncrease: spilloverEffect.rideDemandIncrease,
        foodDeliveryIncrease: spilloverEffect.restaurantDemandIncrease,
        hotelOccupancyIncrease: spilloverEffect.hotelDemandIncrease,
        retailSpike: 1.0,
        avgTicketPrice: zEvent.pricing?.avgTicketPrice || 0,
        totalRevenue: (zEvent.ticketsSold || 0) * (zEvent.pricing?.avgTicketPrice || 0),
        socialMediaBuzz: 50, // Default, would be updated from social signals
      },
      spilloverEffect,
      organizerTrustScore: zEvent.organizerTrustScore || 80,
      sourceApp: 'zevents',
    };

    const result = await EventModel.findOneAndUpdate(
      { eventId: zEvent.eventId },
      { $set: eventNode },
      { upsert: true, new: true }
    );

    logger.info('Event synced to Geo Intelligence', {
      eventId: zEvent.eventId,
      title: zEvent.title,
      category: zEvent.category,
    });

    return result.toObject() as EventNode;
  }

  // ============================================
  // CAPTURE: Process booking signal from Z-Events
  // ============================================

  async captureBookingSignal(signal: EventBookingSignal): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Get the event node
      const event = await EventModel.findOne({ eventId: signal.eventId });
      if (!event) {
        logger.warn('Event not found for booking signal', { eventId: signal.eventId });
        return;
      }

      // 2. Get or create consumer node
      let consumer = await ConsumerModel.findOne({ userId: signal.userId });
      if (!consumer) {
        consumer = await ConsumerModel.create({
          nodeId: `consumer_${signal.userId}`,
          type: 'consumer',
          userId: signal.userId,
          primarySource: 'zevents',
          unifiedId: signal.userId,
          segments: [],
          crossAppActivity: { zeventsScore: 0 },
          trustScore: 100,
          kycStatus: 'none',
        });
      }

      // 3. Update consumer affinities based on booking
      const currentAffinities = consumer.affinities || { eventProbability: 0.5, rideProbability: 0.3, restaurantAffinities: {}, premiumAffinities: {} };
      const category = event.category;

      // Update category affinity
      const currentCategoryAffinity = currentAffinities.eventProbability || 0.5;
      const newCategoryAffinity = Math.min(1, currentCategoryAffinity + 0.1);

      // Update ride probability (events strongly predict ride taking)
      const currentRideProbability = currentAffinities.rideProbability || 0.3;
      const newRideProbability = Math.min(0.95, currentRideProbability + 0.2);

      // Update restaurant affinities based on event type
      const restaurantAffinities = { ...(currentAffinities.restaurantAffinities || {}) };
      if (category === 'music') {
        restaurantAffinities['nightlife'] = (restaurantAffinities['nightlife'] || 0) + 0.2;
        restaurantAffinities['casual'] = (restaurantAffinities['casual'] || 0) + 0.1;
      } else if (category === 'food') {
        restaurantAffinities['premium'] = (restaurantAffinities['premium'] || 0) + 0.3;
      }

      // Update premium affinities based on spending
      const premiumAffinities = { ...(currentAffinities.premiumAffinities || {}) };
      if (signal.spendingTier === 'premium' || signal.spendingTier === 'luxury') {
        premiumAffinities['luxury_events'] = (premiumAffinities['luxury_events'] || 0) + 0.2;
        premiumAffinities['premium_dining'] = (premiumAffinities['premium_dining'] || 0) + 0.15;
      }

      // Update consumer
      await ConsumerModel.updateOne(
        { userId: signal.userId },
        {
          $set: {
            affinities: {
              ...currentAffinities,
              eventProbability: newCategoryAffinity,
              rideProbability: newRideProbability,
              restaurantAffinities,
              premiumAffinities,
            },
            'crossAppActivity.zeventsScore': Math.min(100, (consumer.crossAppActivity?.zeventsScore || 0) + 10),
            totalEventsAttended: (consumer.totalEventsAttended || 0) + 1,
            totalSpent: (consumer.totalSpent || 0) + signal.totalAmount,
            lastActivity: new Date(),
          },
          $addToSet: {
            segments: { $each: this.inferSegments(event.category, signal.bookingType) },
          },
        }
      );

      // 4. Create edge: Consumer -> Event (booked)
      await GraphEdgeModel.findOneAndUpdate(
        { source: consumer.nodeId, target: event.nodeId, relationship: 'booked' },
        {
          $set: {
            source: consumer.nodeId,
            target: event.nodeId,
            relationship: 'booked',
            weight: 1,
            metadata: {
              quantity: signal.quantity,
              totalAmount: signal.totalAmount,
              bookingType: signal.bookingType,
            },
          },
          $setOnInsert: {
            edgeId: `${crypto.randomUUID()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      // 5. Create edges to nearby merchants (for cross-selling)
      await this.createMerchantEdgesForEvent(event.nodeId, event.category);

      // 6. Update event metrics
      await EventModel.updateOne(
        { nodeId: event.nodeId },
        {
          $inc: { ticketsSold: signal.quantity },
          $set: {
            'impactMetrics.totalRevenue': (event.impactMetrics?.totalRevenue || 0) + signal.totalAmount,
          },
        }
      );

      const duration = Date.now() - startTime;
      logger.info('Booking signal processed', {
        userId: signal.userId,
        eventId: signal.eventId,
        category,
        duration,
      });
    } catch (error) {
      logger.error('Failed to process booking signal', { error, signal });
    }
  }

  // ============================================
  // CAPTURE: Process check-in signal
  // ============================================

  async captureCheckinSignal(userId: string, eventId: string): Promise<void> {
    try {
      const event = await EventModel.findOne({ eventId });
      if (!event) return;

      // Update event checkin count
      await EventModel.updateOne(
        { eventId },
        { $inc: { checkinCount: 1 } }
      );

      // Create edge: Consumer attended event
      const consumer = await ConsumerModel.findOne({ userId });
      if (consumer) {
        await GraphEdgeModel.findOneAndUpdate(
          { source: consumer.nodeId, target: event.nodeId, relationship: 'attended' },
          {
            $set: {
              source: consumer.nodeId,
              target: event.nodeId,
              relationship: 'attended',
              weight: 0.8,
            },
          },
          { upsert: true }
        );

        // Update cross-app activity
        await ConsumerModel.updateOne(
          { userId },
          { $set: { lastActivity: new Date() } }
        );
      }

      logger.debug('Checkin signal captured', { userId, eventId });
    } catch (error) {
      logger.error('Failed to process checkin signal', { error, userId, eventId });
    }
  }

  // ============================================
  // QUERY: Get events near a location
  // ============================================

  async getEventsNear(
    location: GeoPoint,
    radiusMeters = 5000,
    options?: {
      category?: EventCategory[];
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<EventNode[]> {
    const query: Record<string, unknown> = {
      'venue.location': { $nearSphere: { $geometry: location, $maxDistance: radiusMeters } },
    };

    if (options?.category?.length) {
      query.category = { $in: options.category };
    }
    if (options?.fromDate) {
      query.startDate = { $gte: options.fromDate };
    }
    if (options?.toDate) {
      query.endDate = { $lte: options.toDate };
    }

    const events = await EventModel.find(query).limit(options?.limit || 50);
    return events.map((e) => e.toObject() as EventNode);
  }

  // ============================================
  // QUERY: Get events by consumer affinity
  // ============================================

  async getEventsByAffinity(userId: string, limit = 10): Promise<EventNode[]> {
    const consumer = await ConsumerModel.findOne({ userId });
    if (!consumer) {
      // Return popular events
      return this.getPopularEvents(limit);
    }

    // Get category affinities from preferences
    const categoryScores: Record<string, number> = {};
    if (consumer.preferences?.categories) {
      for (const [cat, score] of Object.entries(consumer.preferences.categories as Record<string, number>)) {
        categoryScores[cat] = score;
      }
    }

    // Sort categories by affinity
    const sortedCategories = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)
      .map(([cat]) => cat);

    // Find events matching top categories
    const events = await EventModel.find({
      category: { $in: sortedCategories },
      startDate: { $gte: new Date() },
    })
      .sort({ startDate: 1 })
      .limit(limit);

    return events.map((e) => e.toObject() as EventNode);
  }

  // ============================================
  // QUERY: Get nearby merchants for event
  // ============================================

  async getNearbyMerchantsForEvent(
    eventId: string,
    radiusMeters = 2000,
    limit = 20
  ): Promise<{ merchantId: string; businessName: string; category: string; distance: number }[]> {
    const event = await EventModel.findOne({ eventId });
    if (!event) return [];

    const [lng, lat] = event.venue.location.coordinates;

    // Use MongoDB aggregation for geo + distance
    const merchants = await MerchantModel.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radiusMeters,
          spherical: true,
        },
      },
      { $sort: { distance: 1 } },
      { $limit: limit },
      {
        $project: {
          merchantId: 1,
          businessName: 1,
          category: 1,
          distance: 1,
        },
      },
    ]);

    return merchants;
  }

  // ============================================
  // QUERY: Get demand predictions for event
  // ============================================

  async getEventDemandPrediction(eventId: string): Promise<SpilloverEffect | null> {
    const event = await EventModel.findOne({ eventId });
    if (!event) return null;

    return event.spilloverEffect;
  }

  // ============================================
  // HELPERS
  // ============================================

  private calculateSpillover(event: ZEventsEvent): SpilloverEffect {
    const category = event.category;
    const avgPrice = event.pricing?.avgTicketPrice || 0;

    // Base spillover calculations
    let rideIncrease = 0.5;
    let restaurantIncrease = 0.3;
    let nightlifeIncrease = 0;
    let hotelIncrease = 0.1;

    // Category-specific adjustments
    switch (category) {
      case 'music':
        rideIncrease = 0.9;
        restaurantIncrease = 0.6;
        nightlifeIncrease = 0.8;
        hotelIncrease = 0.15;
        break;
      case 'sports':
        rideIncrease = 0.7;
        restaurantIncrease = 0.5;
        break;
      case 'tech':
      case 'business':
        rideIncrease = 0.4;
        restaurantIncrease = 0.7;
        hotelIncrease = 0.4;
        break;
      case 'food':
        restaurantIncrease = 0.8;
        rideIncrease = 0.3;
        break;
      case 'art':
      case 'lifestyle':
        rideIncrease = 0.5;
        restaurantIncrease = 0.5;
        break;
    }

    // Price-based adjustments
    if (avgPrice > 5000) {
      hotelIncrease += 0.2;
      rideIncrease += 0.1;
    }

    return {
      nearbyMerchantBoost: Math.min(0.9, 0.5 + restaurantIncrease * 0.3),
      restaurantDemandIncrease: Math.min(1.5, 1 + restaurantIncrease * 0.5),
      nightlifeDemandIncrease: Math.min(1.5, 1 + nightlifeIncrease * 0.5),
      hotelDemandIncrease: Math.min(1.3, 1 + hotelIncrease * 0.3),
      rideDemandIncrease: Math.min(2.0, 1 + rideIncrease * 0.5),
    };
  }

  private estimateAvgAge(category: EventCategory): number {
    const ageMap: Record<EventCategory, number> = {
      music: 24,
      sports: 28,
      comedy: 30,
      tech: 32,
      food: 35,
      art: 33,
      business: 36,
      fitness: 30,
      lifestyle: 28,
      community: 35,
    };
    return ageMap[category] || 30;
  }

  private estimateAgeRange(category: EventCategory): [number, number] {
    const rangeMap: Record<EventCategory, [number, number]> = {
      music: [18, 35],
      sports: [22, 45],
      comedy: [25, 45],
      tech: [25, 45],
      food: [25, 50],
      art: [25, 55],
      business: [28, 55],
      fitness: [20, 45],
      lifestyle: [22, 40],
      community: [25, 60],
    };
    return rangeMap[category] || [25, 45];
  }

  private estimateSpendingTier(avgPrice?: number): 'budget' | 'mid' | 'premium' | 'luxury' {
    if (!avgPrice) return 'mid';
    if (avgPrice >= 5000) return 'luxury';
    if (avgPrice >= 2000) return 'premium';
    if (avgPrice >= 500) return 'mid';
    return 'budget';
  }

  private estimateAvgGroupSize(category: EventCategory): number {
    const sizeMap: Record<EventCategory, number> = {
      music: 4,
      sports: 3,
      comedy: 2,
      tech: 2,
      food: 4,
      art: 2,
      business: 3,
      fitness: 1,
      lifestyle: 3,
      community: 5,
    };
    return sizeMap[category] || 2;
  }

  private inferSegments(category: EventCategory, bookingType: string): string[] {
    const segments: string[] = [];

    // Category segments
    switch (category) {
      case 'music':
        segments.push('music_enthusiast', 'nightlife_enthusiast');
        break;
      case 'sports':
        segments.push('sports_enthusiast', 'fitness_conscious');
        break;
      case 'tech':
      case 'business':
        segments.push('tech_enthusiast', 'business_professional', 'networking_active');
        break;
      case 'food':
        segments.push('foodie');
        break;
      case 'art':
        segments.push('culture_seeker');
        break;
      case 'fitness':
        segments.push('fitness_conscious');
        break;
    }

    // Booking type segments
    if (bookingType === 'group' || bookingType === 'corporate') {
      segments.push('social_booker', 'group_leader');
    } else if (bookingType === 'couple') {
      segments.push('social_casual');
    } else {
      segments.push('solo_explorer');
    }

    return segments;
  }

  private async createMerchantEdgesForEvent(eventNodeId: string, category: EventCategory): Promise<void> {
    const event = await EventModel.findOne({ nodeId: eventNodeId });
    if (!event) return;

    // Find nearby merchants
    const [lng, lat] = event.venue.location.coordinates;
    const nearbyMerchants = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 2000,
        },
      },
    }).limit(10);

    // Create edges: Event -> Merchant (nearby)
    for (const merchant of nearbyMerchants) {
      await GraphEdgeModel.findOneAndUpdate(
        { source: eventNodeId, target: merchant.nodeId, relationship: 'nearby' },
        {
          $set: {
            source: eventNodeId,
            target: merchant.nodeId,
            relationship: 'nearby',
            weight: 0.5,
          },
        },
        { upsert: true }
      );
    }
  }

  private async getPopularEvents(limit: number): Promise<EventNode[]> {
    const events = await EventModel.find({
      startDate: { $gte: new Date() },
    })
      .sort({ 'impactMetrics.totalRevenue': -1, ticketsSold: -1 })
      .limit(limit);
    return events.map((e) => e.toObject() as EventNode);
  }
}

export const eventGraphService = new EventGraphService();

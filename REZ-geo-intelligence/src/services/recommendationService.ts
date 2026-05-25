/**
 * REZ Geo Intelligence Core - Recommendation Service
 * Cross-graph recommendations for all REZ products
 */

import { ConsumerModel, MerchantModel, EventModel, GraphEdgeModel } from '../models/index.js';
import { GeoPoint, Recommendation, EventNode, MerchantNode, ConsumerNode } from '../types/index.js';
import logger from '../utils/logger.js';

export interface RecommendationContext {
  userId: string;
  location: GeoPoint;
  context: 'event' | 'ride' | 'food' | 'hotel' | 'general' | 'navigation';
  nearbyEventId?: string;
  nearbyMerchantId?: string;
  limit?: number;
}

export class RecommendationService {

  // ============================================
  // UNIFIED RECOMMENDATIONS
  // ============================================

  /**
   * Get unified recommendations based on context
   */
  async getRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const startTime = Date.now();

    try {
      switch (ctx.context) {
        case 'event':
          return this.getEventContextRecommendations(ctx);
        case 'ride':
          return this.getRideRecommendations(ctx);
        case 'food':
          return this.getFoodRecommendations(ctx);
        case 'hotel':
          return this.getHotelRecommendations(ctx);
        case 'navigation':
          return this.getNavigationRecommendations(ctx);
        default:
          return this.getGeneralRecommendations(ctx);
      }
    } finally {
      const duration = Date.now() - startTime;
      logger.debug('Recommendations generated', { context: ctx.context, userId: ctx.userId, duration });
    }
  }

  // ============================================
  // EVENT CONTEXT RECOMMENDATIONS
  // ============================================

  private async getEventContextRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // 1. Get nearby events based on user affinity
    const consumer = await ConsumerModel.findOne({ userId: ctx.userId });
    const categoryPrefs = consumer?.preferences?.categories as Record<string, number> || {};
    const topCategories = Object.entries(categoryPrefs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);

    // Find events near user
    const events = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 10000, // 10km
        },
      },
      startDate: { $gte: new Date() },
      ...(topCategories.length > 0 && { category: { $in: topCategories } }),
    }).limit(ctx.limit || 10);

    for (const event of events) {
      const distance = this.calculateDistance(ctx.location, event.venue.location);
      recommendations.push({
        type: 'event',
        entityId: event.eventId,
        entity: event.toObject(),
        score: this.scoreEventRecommendation(event, consumer, distance),
        reason: this.getEventReason(event, consumer),
        distance,
      });
    }

    // 2. Add nearby restaurants (pre-event food)
    const restaurants = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 2000,
        },
      },
      category: { $in: ['restaurant', 'cafe', 'bar'] },
    }).limit(5);

    for (const restaurant of restaurants) {
      const distance = this.calculateDistance(ctx.location, restaurant.location);
      recommendations.push({
        type: 'merchant',
        entityId: restaurant.merchantId,
        entity: restaurant.toObject(),
        score: this.scoreMerchantRecommendation(restaurant, 'food', consumer, distance),
        reason: 'Pre-event dining nearby',
        distance,
        offer: restaurant.activeOffers?.[0],
      });
    }

    // Sort by score
    return recommendations.sort((a, b) => b.score - a.score);
  }

  // ============================================
  // RIDE RECOMMENDATIONS
  // ============================================

  private async getRideRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Check for nearby events (ride demand is high near events)
    const nearbyEvents = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 2000,
        },
      },
      startDate: { $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) }, // Starting within 2 hours
      endDate: { $gte: new Date() },
    }).limit(3);

    for (const event of nearbyEvents) {
      const distance = this.calculateDistance(ctx.location, event.venue.location);
      const score = (1 - distance / 2000) * 100 * event.spilloverEffect?.rideDemandIncrease;

      recommendations.push({
        type: 'event',
        entityId: event.eventId,
        entity: event.toObject(),
        score,
        reason: `${Math.round(event.spilloverEffect?.rideDemandIncrease * 100)}% surge expected - event starting soon`,
        distance,
      });
    }

    // Add high-demand merchant areas
    const popularMerchants = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 3000,
        },
      },
    })
      .sort({ 'demandMetrics.rideDemandImpact': -1 })
      .limit(5);

    for (const merchant of popularMerchants) {
      const distance = this.calculateDistance(ctx.location, merchant.location);
      recommendations.push({
        type: 'merchant',
        entityId: merchant.merchantId,
        entity: merchant.toObject(),
        score: (1 - distance / 3000) * 80 * (merchant.demandMetrics?.rideDemandImpact || 1),
        reason: 'Popular destination area',
        distance,
      });
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  // ============================================
  // FOOD RECOMMENDATIONS
  // ============================================

  private async getFoodRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get user preferences
    const consumer = await ConsumerModel.findOne({ userId: ctx.userId });
    const preferredCuisines = consumer?.preferences?.preferredCuisine || [];
    const priceRange = consumer?.preferences?.preferredPriceRange || 'mid';

    // Find restaurants
    const query: Record<string, unknown> = {
      location: {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 5000,
        },
      },
      category: { $in: ['restaurant', 'cafe', 'bar', 'nightlife'] },
    };

    const restaurants = await MerchantModel.find(query)
      .limit(ctx.limit || 20);

    for (const restaurant of restaurants) {
      const distance = this.calculateDistance(ctx.location, restaurant.location);

      // Calculate score
      let score = 50;

      // Distance factor (closer = better)
      score += (1 - distance / 5000) * 30;

      // Cuisine match
      if (restaurant.cuisines?.some(c => preferredCuisines.includes(c))) {
        score += 15;
      }

      // Price range match
      if (restaurant.priceRange === priceRange) {
        score += 10;
      }

      // Rating factor
      score += (restaurant.avgRating / 5) * 10;

      // Active offers
      if (restaurant.activeOffers?.length) {
        score += 5;
      }

      recommendations.push({
        type: 'merchant',
        entityId: restaurant.merchantId,
        entity: restaurant.toObject(),
        score: Math.min(100, score),
        reason: this.getFoodReason(restaurant, consumer),
        distance,
        offer: restaurant.activeOffers?.[0],
      });
    }

    // Check for events causing food demand
    const nearbyEvents = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 3000,
        },
      },
      startDate: { $lte: new Date(Date.now() + 3 * 60 * 60 * 1000) },
      endDate: { $gte: new Date() },
    });

    for (const event of nearbyEvents) {
      if (event.spilloverEffect?.restaurantDemandIncrease > 1.2) {
        recommendations.push({
          type: 'event',
          entityId: event.eventId,
          entity: event.toObject(),
          score: (event.spilloverEffect?.restaurantDemandIncrease - 1) * 50,
          reason: `${Math.round((event.spilloverEffect?.restaurantDemandIncrease - 1) * 100)}% more orders expected due to nearby event`,
          distance: this.calculateDistance(ctx.location, event.venue.location),
        });
      }
    }

    return recommendations
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, ctx.limit || 15);
  }

  // ============================================
  // HOTEL RECOMMENDATIONS
  // ============================================

  private async getHotelRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get consumer data
    const consumer = await ConsumerModel.findOne({ userId: ctx.userId });

    // Check for business events (higher hotel probability)
    const nearbyBusinessEvents = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 5000,
        },
      },
      category: { $in: ['business', 'tech'] },
      startDate: { $gte: new Date() },
    }).limit(3);

    // Check for out-of-city patterns
    const isOutstation = false; // eventCities not part of ConsumerPreferences
    const hotelPricePreference = consumer?.preferences?.preferredPriceRange || 'mid';

    // Find hotels
    const hotels = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 10000,
        },
      },
      category: 'hotel',
      ...(hotelPricePreference !== 'mid' && { priceRange: hotelPricePreference }),
    }).limit(ctx.limit || 10);

    for (const hotel of hotels) {
      const distance = this.calculateDistance(ctx.location, hotel.location);

      let score = 50;
      score += (1 - distance / 10000) * 30;
      score += (hotel.avgRating / 5) * 15;
      score += (hotel.trustScore / 100) * 5;

      // Boost for business events
      if (nearbyBusinessEvents.some(e => e.spilloverEffect?.hotelDemandIncrease > 1.2)) {
        score += 20;
      }

      recommendations.push({
        type: 'hotel',
        entityId: hotel.merchantId,
        entity: hotel.toObject(),
        score: Math.min(100, score),
        reason: isOutstation
          ? 'Hotels near your destination'
          : 'Recommended based on your preferences',
        distance,
        offer: hotel.activeOffers?.[0],
      });
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  // ============================================
  // GENERAL RECOMMENDATIONS
  // ============================================

  private async getGeneralRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get consumer for personalization
    const consumer = await ConsumerModel.findOne({ userId: ctx.userId });

    // Get nearby events
    const events = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 5000,
        },
      },
      startDate: { $gte: new Date() },
    }).limit(5);

    for (const event of events) {
      recommendations.push({
        type: 'event',
        entityId: event.eventId,
        entity: event.toObject(),
        score: 50 + (event.ticketsSold / event.capacity) * 30,
        reason: this.getEventReason(event, consumer),
        distance: this.calculateDistance(ctx.location, event.venue.location),
      });
    }

    // Get popular merchants
    const merchants = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 3000,
        },
      },
    })
      .sort({ 'popularity.dailyFootfall': -1 })
      .limit(10);

    for (const merchant of merchants) {
      recommendations.push({
        type: 'merchant',
        entityId: merchant.merchantId,
        entity: merchant.toObject(),
        score: 40 + merchant.avgRating * 10,
        reason: 'Popular near you',
        distance: this.calculateDistance(ctx.location, merchant.location),
        offer: merchant.activeOffers?.[0],
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, ctx.limit || 15);
  }

  // ============================================
  // NAVIGATION RECOMMENDATIONS (Rider App)
  // ============================================

  private async getNavigationRecommendations(ctx: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // If there's a destination event
    if (ctx.nearbyEventId) {
      const event = await EventModel.findOne({ eventId: ctx.nearbyEventId });
      if (event) {
        recommendations.push({
          type: 'event',
          entityId: event.eventId,
          entity: event.toObject(),
          score: 100,
          reason: 'Your destination event',
          distance: this.calculateDistance(ctx.location, event.venue.location),
        });
      }
    }

    // Add drop-off suggestions near events
    const events = await EventModel.find({
      'venue.location': {
        $nearSphere: {
          $geometry: ctx.location,
          $maxDistance: 500,
        },
      },
    }).limit(3);

    for (const event of events) {
      recommendations.push({
        type: 'event',
        entityId: event.eventId,
        entity: event.toObject(),
        score: 60,
        reason: 'Nearby event - consider for drop-off',
        distance: this.calculateDistance(ctx.location, event.venue.location),
      });
    }

    return recommendations;
  }

  // ============================================
  // CROSS-APP ACTIVITY SYNC
  // ============================================

  async syncCrossAppActivity(
    userId: string,
    app: 'zevents' | 'rezride' | 'merchant' | 'stayown' | 'buzzlocal',
    activity: {
      type: 'event_booked' | 'event_attended' | 'ride_taken' | 'order_placed' | 'hotel_booked';
      amount?: number;
      category?: string;
    }
  ): Promise<void> {
    const consumer = await ConsumerModel.findOne({ userId });
    if (!consumer) return;

    const updates: Record<string, unknown> = {};

    switch (app) {
      case 'zevents':
        updates['crossAppActivity.zeventsScore'] = Math.min(100, (consumer.crossAppActivity?.zeventsScore || 0) + 10);
        if (activity.type === 'event_booked' || activity.type === 'event_attended') {
          updates.totalEventsAttended = (consumer.totalEventsAttended || 0) + 1;
        }
        break;
      case 'rezride':
        updates['crossAppActivity.rezrideScore'] = Math.min(100, (consumer.crossAppActivity?.rezrideScore || 0) + 5);
        if (activity.type === 'ride_taken') {
          updates.totalRidesTaken = (consumer.totalRidesTaken || 0) + 1;
        }
        break;
      case 'merchant':
        updates['crossAppActivity.merchantScore'] = Math.min(100, (consumer.crossAppActivity?.merchantScore || 0) + 5);
        if (activity.type === 'order_placed' && activity.amount) {
          updates.totalOrdersPlaced = (consumer.totalOrdersPlaced || 0) + 1;
          updates.totalSpent = (consumer.totalSpent || 0) + activity.amount;
          updates.avgOrderValue = ((consumer.avgOrderValue || 0) * (consumer.totalOrdersPlaced || 0) + activity.amount) / ((consumer.totalOrdersPlaced || 0) + 1);
        }
        break;
      case 'stayown':
        updates['crossAppActivity.stayownScore'] = Math.min(100, (consumer.crossAppActivity?.stayownScore || 0) + 15);
        if (activity.type === 'hotel_booked' && activity.amount) {
          updates.totalSpent = (consumer.totalSpent || 0) + activity.amount;
        }
        break;
      case 'buzzlocal':
        updates['crossAppActivity.buzzlocalScore'] = Math.min(100, (consumer.crossAppActivity?.buzzlocalScore || 0) + 5);
        break;
    }

    updates.lastActivity = new Date();

    await ConsumerModel.updateOne({ userId }, { $set: updates });
  }

  // ============================================
  // SCORING HELPERS
  // ============================================

  private scoreEventRecommendation(event: InstanceType<typeof EventModel>, consumer, distance: number): number {
    let score = 30;

    // Distance
    score += Math.max(0, (1 - distance / 10000) * 30);

    // Affinity match
    if (consumer?.preferences?.categories?.[event.category]) {
      score += consumer.preferences.categories[event.category] * 30;
    }

    // Popularity
    const popularity = event.ticketsSold / Math.max(1, event.capacity);
    score += popularity * 20;

    return Math.min(100, score);
  }

  private scoreMerchantRecommendation(
    merchant: InstanceType<typeof MerchantModel>,
    context: string,
    consumer,
    distance: number
  ): number {
    let score = 30;

    // Distance
    score += Math.max(0, (1 - distance / 5000) * 30);

    // Rating
    score += (merchant.avgRating / 5) * 15;

    // Offer boost
    if (merchant.activeOffers?.length) {
      score += 10;
    }

    // Price match
    if (consumer?.preferences?.preferredPriceRange === merchant.priceRange) {
      score += 15;
    }

    return Math.min(100, score);
  }

  // ============================================
  // REASON HELPERS
  // ============================================

  private getEventReason(event: InstanceType<typeof EventModel>, consumer): string {
    if (consumer?.preferences?.categories?.[event.category]) {
      return `Matches your ${event.category} interest`;
    }
    if (event.ticketsSold / event.capacity > 0.8) {
      return 'Selling fast - book now';
    }
    if (event.demographicProfile?.spendingTier === 'premium' || event.demographicProfile?.spendingTier === 'luxury') {
      return 'Premium event experience';
    }
    return `Popular ${event.category} event`;
  }

  private getFoodReason(merchant: InstanceType<typeof MerchantModel>, consumer): string {
    const reasons: string[] = [];

    if (merchant.avgRating >= 4.5) {
      reasons.push('Highly rated');
    }
    if (merchant.activeOffers?.length) {
      reasons.push('Has active offers');
    }
    if (merchant.popularity?.peakHours?.includes(new Date().getHours())) {
      reasons.push('Popular right now');
    }
    if (consumer?.preferences?.preferredCuisine?.some((c: string) => merchant.cuisines?.includes(c))) {
      reasons.push('Matches your cuisine preferences');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Recommended for you';
  }

  // ============================================
  // UTILITIES
  // ============================================

  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const [lng1, lat1] = point1.coordinates;
    const [lng2, lat2] = point2.coordinates;

    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const recommendationService = new RecommendationService();

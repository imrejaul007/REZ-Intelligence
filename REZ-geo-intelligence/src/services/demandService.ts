/**
 * REZ Geo Intelligence Core - Demand Prediction Service
 * Predicts demand across zones based on events, time, and patterns
 */

import { EventModel, MerchantModel, ZoneModel, ZoneDemandPredictionModel } from '../models/index.js';
import {
  ZoneDemandPrediction,
  DemandRecommendation,
  GeoPoint,
  EventNode,
} from '../types/index.js';
import logger from '../utils/logger.js';

export class DemandPredictionService {
  // ============================================
  // PREDICTION ENGINE
  // ============================================

  /**
   * Predict demand for a zone at a specific time
   */
  async predictZoneDemand(zoneId: string, timeSlot: Date): Promise<ZoneDemandPrediction> {
    const zone = await ZoneModel.findOne({ zoneId });
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }

    // Find events in this zone at this time
    const events = await EventModel.find({
      'venue.location': {
        $geoWithin: {
          $centerSphere: [zone.center.coordinates, zone.radius / 6378100],
        },
      },
      startDate: { $lte: timeSlot },
      endDate: { $gte: timeSlot },
    });

    // Calculate base demand from time patterns
    const hour = timeSlot.getHours();
    const dayOfWeek = timeSlot.getDay();
    const baseDemand = this.getBaseDemand(hour, dayOfWeek);

    // Calculate event impact
    const eventImpact = this.calculateEventImpact(events);

    // Combine for final prediction
    const predictions = {
      rideDemand: this.clamp(baseDemand.rideDemand * eventImpact.rideMultiplier, 0, 1),
      deliveryDemand: this.clamp(baseDemand.deliveryDemand * eventImpact.deliveryMultiplier, 0, 1),
      restaurantRush: this.clamp(baseDemand.restaurantRush * eventImpact.restaurantMultiplier, 0, 1),
      hotelOccupancy: this.clamp(baseDemand.hotelOccupancy + eventImpact.hotelBoost, 0, 1),
      eventCrowd: eventImpact.hasEvents ? Math.min(1, events.length * 0.2) : 0,
    };

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(zone, events);

    // Generate recommendations
    const recommendations = this.generateRecommendations(zoneId, predictions, events);

    // Check for existing prediction and update, or create new
    const prediction: Partial<ZoneDemandPrediction> = {
      zoneId,
      timeSlot,
      predictions,
      confidence,
      triggeringEvents: events.map((e) => e.eventId),
      triggeringOffers: [],
      recommendations,
    };

    await ZoneDemandPredictionModel.findOneAndUpdate(
      { zoneId, timeSlot },
      { $set: prediction },
      { upsert: true, new: true }
    );

    return prediction as ZoneDemandPrediction;
  }

  /**
   * Predict demand for all zones near a location
   */
  async predictDemandNear(
    location: GeoPoint,
    radiusMeters: number,
    timeSlot: Date
  ): Promise<ZoneDemandPrediction[]> {
    // Find zones near location
    const zones = await ZoneModel.find({
      center: {
        $nearSphere: {
          $geometry: location,
          $maxDistance: radiusMeters,
        },
      },
    });

    // Predict for each zone
    const predictions = await Promise.all(
      zones.map((zone) => this.predictZoneDemand(zone.zoneId, timeSlot))
    );

    return predictions;
  }

  /**
   * Predict demand based on event
   */
  async predictEventDemand(eventId: string): Promise<{
    event: EventNode;
    rideDemand: number;
    restaurantDemand: number;
    hotelDemand: number;
    peakHours: number[];
    recommendations: DemandRecommendation[];
  }> {
    const event = await EventModel.findOne({ eventId });
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const spillover = event.spilloverEffect;

    // Find nearby merchants to understand baseline demand
    const nearbyMerchants = await MerchantModel.find({
      location: {
        $nearSphere: {
          $geometry: event.venue.location,
          $maxDistance: 2000,
        },
      },
    });

    // Calculate baseline from merchants
    const baselineRide = nearbyMerchants.length > 0
      ? nearbyMerchants.reduce((sum, m) => sum + (m.demandMetrics?.rideDemandImpact || 0), 0) / nearbyMerchants.length
      : 0.3;

    // Apply event spillover
    const rideDemand = this.clamp(baselineRide * spillover.rideDemandIncrease, 0, 1);
    const restaurantDemand = this.clamp(0.4 * spillover.restaurantDemandIncrease, 0, 1);
    const hotelDemand = this.clamp(0.2 + spillover.hotelDemandIncrease * 0.3, 0, 1);

    // Calculate peak hours based on event timing
    const eventStartHour = new Date(event.startDate).getHours();
    const peakHours = [
      eventStartHour - 1, // Pre-event
      eventStartHour,     // Event start
      eventStartHour + 2, // Mid event
      new Date(event.endDate).getHours(), // Event end
    ].filter((h) => h >= 0 && h <= 23);

    // Generate recommendations
    const recommendations: DemandRecommendation[] = [];

    if (rideDemand > 0.7) {
      recommendations.push({
        type: 'driver_deployment',
        action: 'Increase driver availability near event venue',
        targetEntity: event.venue.address.city,
        expectedImpact: rideDemand * 0.3,
      });
      recommendations.push({
        type: 'surge_pricing',
        action: 'Apply surge pricing 1 hour before and after event',
        targetEntity: event.venue.address.city,
        expectedImpact: rideDemand * 0.2,
      });
    }

    if (restaurantDemand > 0.6) {
      recommendations.push({
        type: 'merchant_boost',
        action: 'Boost visibility for nearby restaurants',
        targetEntity: event.venue.address.city,
        expectedImpact: restaurantDemand * 0.25,
      });
    }

    if (event.category === 'music') {
      recommendations.push({
        type: 'ad_campaign',
        action: 'Run late-night food delivery campaign',
        targetEntity: event.venue.address.city,
        expectedImpact: 0.3,
      });
    }

    return {
      event: event.toObject() as EventNode,
      rideDemand,
      restaurantDemand,
      hotelDemand,
      peakHours,
      recommendations,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private getBaseDemand(hour: number, dayOfWeek: number): {
    rideDemand: number;
    deliveryDemand: number;
    restaurantRush: number;
    hotelOccupancy: number;
  } {
    // Morning commute
    if (hour >= 7 && hour <= 9) {
      return { rideDemand: 0.6, deliveryDemand: 0.2, restaurantRush: 0.1, hotelOccupancy: 0.3 };
    }
    // Lunch
    if (hour >= 12 && hour <= 14) {
      return { rideDemand: 0.4, deliveryDemand: 0.7, restaurantRush: 0.8, hotelOccupancy: 0.4 };
    }
    // Evening commute
    if (hour >= 17 && hour <= 19) {
      return { rideDemand: 0.7, deliveryDemand: 0.3, restaurantRush: 0.3, hotelOccupancy: 0.4 };
    }
    // Dinner
    if (hour >= 19 && hour <= 22) {
      return { rideDemand: 0.5, deliveryDemand: 0.8, restaurantRush: 0.9, hotelOccupancy: 0.5 };
    }
    // Late night
    if (hour >= 22 || hour <= 5) {
      return { rideDemand: 0.3, deliveryDemand: 0.4, restaurantRush: 0.2, hotelOccupancy: 0.6 };
    }
    // Default business hours
    return { rideDemand: 0.3, deliveryDemand: 0.3, restaurantRush: 0.3, hotelOccupancy: 0.4 };
  }

  private calculateEventImpact(events: InstanceType<typeof EventModel>[]): {
    hasEvents: boolean;
    rideMultiplier: number;
    deliveryMultiplier: number;
    restaurantMultiplier: number;
    hotelBoost: number;
  } {
    if (events.length === 0) {
      return {
        hasEvents: false,
        rideMultiplier: 1,
        deliveryMultiplier: 1,
        restaurantMultiplier: 1,
        hotelBoost: 0,
      };
    }

    // Aggregate spillover from all events
    let totalRide = 1;
    let totalDelivery = 1;
    let totalRestaurant = 1;
    let hotelBoost = 0;

    for (const event of events) {
      const spillover = event.spilloverEffect || { rideDemandIncrease: 1, restaurantDemandIncrease: 1, hotelDemandIncrease: 0.1 };
      totalRide *= spillover.rideDemandIncrease;
      totalDelivery *= spillover.restaurantDemandIncrease;
      totalRestaurant *= spillover.restaurantDemandIncrease;
      hotelBoost += spillover.hotelDemandIncrease * 0.2;
    }

    // Normalize by number of events
    const count = events.length;

    return {
      hasEvents: true,
      rideMultiplier: Math.min(3, Math.pow(totalRide, 1 / count)),
      deliveryMultiplier: Math.min(2, Math.pow(totalDelivery, 1 / count)),
      restaurantMultiplier: Math.min(2, Math.pow(totalRestaurant, 1 / count)),
      hotelBoost: Math.min(0.5, hotelBoost),
    };
  }

  private calculateConfidence(
    zone: InstanceType<typeof ZoneModel>,
    events: InstanceType<typeof EventModel>[]
  ): number {
    // Base confidence from zone data
    let confidence = 0.5;

    // More merchant data = higher confidence
    if (zone.populationDensity && zone.populationDensity > 1000) {
      confidence += 0.1;
    }
    if (zone.commercialDensity && zone.commercialDensity > 0.5) {
      confidence += 0.1;
    }

    // Events increase confidence (we know demand will spike)
    if (events.length > 0) {
      confidence += 0.2;
    }

    // Zone history (if we have aggregate demand data)
    if (zone.aggregateDemand?.avgOrdersPerDay) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  private generateRecommendations(
    zoneId: string,
    predictions: ZoneDemandPrediction['predictions'],
    events: InstanceType<typeof EventModel>[]
  ): DemandRecommendation[] {
    const recommendations: DemandRecommendation[] = [];

    // Surge pricing recommendation
    if (predictions.rideDemand > 0.8) {
      recommendations.push({
        type: 'surge_pricing',
        action: 'Apply surge pricing in this zone',
        targetEntity: zoneId,
        expectedImpact: predictions.rideDemand * 0.2,
      });
    }

    // Driver deployment recommendation
    if (predictions.rideDemand > 0.7) {
      recommendations.push({
        type: 'driver_deployment',
        action: 'Increase driver availability',
        targetEntity: zoneId,
        expectedImpact: predictions.rideDemand * 0.15,
      });
    }

    // Restaurant boost recommendation
    if (predictions.restaurantRush > 0.7) {
      recommendations.push({
        type: 'merchant_boost',
        action: 'Boost nearby restaurant visibility',
        targetEntity: zoneId,
        expectedImpact: predictions.restaurantRush * 0.2,
      });
    }

    // Ad campaign for events
    if (events.length > 0) {
      recommendations.push({
        type: 'ad_campaign',
        action: `Promote ${events[0].title} with targeted ads`,
        targetEntity: events[0].eventId,
        expectedImpact: 0.25,
      });
    }

    return recommendations;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export const demandPredictionService = new DemandPredictionService();

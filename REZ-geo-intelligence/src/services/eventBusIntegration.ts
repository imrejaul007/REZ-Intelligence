/**
 * REZ Geo Intelligence Core - Event Bus Integration
 * Consumes events from REZ Event Bus
 */

import { ConsumerModel, EventModel, GraphEdgeModel } from '../models/index.js';
import { EventNode, GeoPoint } from '../types/index.js';
import logger from '../utils/logger.js';

// Event types we're interested in
export const GEOSUBSCRIBED_EVENTS = [
  'event.booked',
  'event.checkin',
  'event.cancelled',
  'event.viewed',
  'event.shared',
  'user.location_updated',
  'merchant.nearby_event',
] as const;

export interface ZEventsEventPayload {
  eventId: string;
  title: string;
  description?: string;
  category: string;
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
  };
  startDate: string;
  endDate: string;
  ticketsSold?: number;
  organizerTrustScore?: number;
  avgTicketPrice?: number;
}

export interface ZEventsBookingPayload {
  userId: string;
  eventId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  totalAmount: number;
  coinsUsed?: number;
  bookingType: 'solo' | 'couple' | 'group' | 'corporate';
  spendingTier: 'budget' | 'mid' | 'premium' | 'luxury';
  venueLocation: {
    coordinates: [number, number];
  };
  venueCity: string;
  category: string;
  daysInAdvance: number;
  friendsAttending: number;
  timestamp: string;
}

export interface UserLocationPayload {
  userId: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationType: 'home' | 'work' | 'last_known';
  accuracy?: number;
  timestamp: string;
}

export interface ZEventsCheckinPayload {
  userId: string;
  eventId: string;
  timestamp: string;
}

export class EventBusIntegration {
  /**
   * Process event.booked event
   */
  async handleEventBooked(payload: ZEventsBookingPayload): Promise<void> {
    try {
      const startTime = Date.now();

      // 1. Get or create consumer
      let consumer = await ConsumerModel.findOne({ userId: payload.userId });
      if (!consumer) {
        consumer = await ConsumerModel.create({
          nodeId: `consumer_${payload.userId}`,
          type: 'consumer',
          userId: payload.userId,
          primarySource: 'zevents',
          unifiedId: payload.userId,
          segments: [],
          crossAppActivity: { zeventsScore: 0 },
          trustScore: 100,
          kycStatus: 'none',
        });
      }

      // 2. Update consumer affinities
      const category = payload.category;
      const currentAffinities = consumer.affinities || { rideProbability: 0.3, restaurantAffinities: {} };

      // Update ride probability (events predict ride taking)
      const newRideProbability = Math.min(0.95, (currentAffinities.rideProbability || 0.3) + 0.2);

      // Update restaurant affinities
      const restaurantAffinities = { ...(currentAffinities.restaurantAffinities || {}) };
      if (category === 'music') {
        restaurantAffinities['nightlife'] = (restaurantAffinities['nightlife'] || 0) + 0.2;
      }

      // Determine segments
      const segments: string[] = [];
      if (category === 'music') segments.push('music_enthusiast');
      if (category === 'tech' || category === 'business') {
        segments.push('tech_enthusiast', 'business_professional');
      }
      if (category === 'food') segments.push('foodie');
      if (category === 'sports') segments.push('sports_enthusiast');
      if (payload.bookingType === 'group' || payload.bookingType === 'corporate') {
        segments.push('social_booker', 'group_leader');
      }

      // Update consumer
      await ConsumerModel.updateOne(
        { userId: payload.userId },
        {
          $set: {
            affinities: {
              ...currentAffinities,
              rideProbability: newRideProbability,
              restaurantAffinities,
            },
            'crossAppActivity.zeventsScore': Math.min(100, (consumer.crossAppActivity?.zeventsScore || 0) + 10),
            totalEventsAttended: (consumer.totalEventsAttended || 0) + 1,
            totalSpent: (consumer.totalSpent || 0) + payload.totalAmount,
            lastActivity: new Date(),
          },
          $addToSet: { segments: { $each: segments } },
        }
      );

      // 3. Update or create event node
      const eventNodeId = `event_${payload.eventId}`;
      let eventNode = await EventModel.findOne({ eventId: payload.eventId });

      if (!eventNode) {
        eventNode = await EventModel.create({
          nodeId: eventNodeId,
          type: 'event',
          eventId: payload.eventId,
          title: payload.eventId, // Will be enriched by event.sync
          category: payload.category as EventNode['category'],
          venue: {
            name: 'Unknown',
            location: {
              type: 'Point',
              coordinates: payload.venueLocation.coordinates,
            },
            address: {
              area: '',
              city: payload.venueCity,
              state: '',
              pincode: '',
            },
            indoor: true,
            capacity: 0,
          },
          startDate: new Date(),
          endDate: new Date(),
          capacity: 0,
          sourceApp: 'zevents',
        });
      }

      // 4. Create edge: Consumer -> Event (booked)
      await GraphEdgeModel.findOneAndUpdate(
        { source: consumer.nodeId, target: eventNode.nodeId, relationship: 'booked' },
        {
          $set: {
            source: consumer.nodeId,
            target: eventNode.nodeId,
            relationship: 'booked',
            weight: 1,
            metadata: {
              quantity: payload.quantity,
              totalAmount: payload.totalAmount,
              bookingType: payload.bookingType,
            },
          },
        },
        { upsert: true }
      );

      const duration = Date.now() - startTime;
      logger.info('Event booking processed', {
        userId: payload.userId,
        eventId: payload.eventId,
        duration,
      });
    } catch (error) {
      logger.error('Failed to process event booking', { error, payload });
    }
  }

  /**
   * Process event.checkin event
   */
  async handleEventCheckin(payload: ZEventsCheckinPayload): Promise<void> {
    try {
      const consumer = await ConsumerModel.findOne({ userId: payload.userId });
      if (!consumer) return;

      const eventNode = await EventModel.findOne({ eventId: payload.eventId });
      if (!eventNode) return;

      // Update checkin count
      await EventModel.updateOne(
        { eventId: payload.eventId },
        { $inc: { checkinCount: 1 } }
      );

      // Create attended edge
      await GraphEdgeModel.findOneAndUpdate(
        { source: consumer.nodeId, target: eventNode.nodeId, relationship: 'attended' },
        {
          $set: {
            source: consumer.nodeId,
            target: eventNode.nodeId,
            relationship: 'attended',
            weight: 0.8,
          },
        },
        { upsert: true }
      );

      logger.debug('Event checkin processed', { userId: payload.userId, eventId: payload.eventId });
    } catch (error) {
      logger.error('Failed to process event checkin', { error, payload });
    }
  }

  /**
   * Process event.sync event (full event data)
   */
  async handleEventSync(payload: ZEventsEventPayload): Promise<void> {
    try {
      const nodeId = `event_${payload.eventId}`;

      const eventNode: Partial<EventNode> = {
        nodeId,
        type: 'event',
        eventId: payload.eventId,
        title: payload.title,
        description: payload.description,
        category: payload.category as EventNode['category'],
        venue: {
          name: payload.venue.name,
          location: payload.venue.location as GeoPoint,
          address: {
            area: payload.venue.address.area,
            city: payload.venue.address.city,
            state: payload.venue.address.state || '',
            pincode: payload.venue.address.pincode || '',
          },
          indoor: true,
          capacity: payload.venue.capacity,
        },
        coverageRadius: 5000,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        isMultiDay: new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime() > 86400000,
        capacity: payload.venue.capacity,
        ticketsSold: payload.ticketsSold || 0,
        predictedAttendance: payload.ticketsSold || Math.floor(payload.venue.capacity * 0.7),
        organizerTrustScore: payload.organizerTrustScore || 80,
        sourceApp: 'zevents',
        spilloverEffect: this.calculateSpillover(payload.category, payload.avgTicketPrice),
      };

      await EventModel.findOneAndUpdate(
        { eventId: payload.eventId },
        { $set: eventNode },
        { upsert: true, new: true }
      );

      logger.info('Event synced', { eventId: payload.eventId, title: payload.title });
    } catch (error) {
      logger.error('Failed to sync event', { error, payload });
    }
  }

  /**
   * Process user.location_updated event
   */
  async handleUserLocationUpdate(payload: UserLocationPayload): Promise<void> {
    try {
      const consumer = await ConsumerModel.findOne({ userId: payload.userId });
      if (!consumer) return;

      const field = `${payload.locationType}Location`;
      await ConsumerModel.updateOne(
        { userId: payload.userId },
        {
          $set: {
            [field]: payload.location,
            lastKnownLocation: payload.location,
            lastLocationUpdate: new Date(payload.timestamp),
          },
        }
      );

      logger.debug('User location updated', {
        userId: payload.userId,
        locationType: payload.locationType,
      });
    } catch (error) {
      logger.error('Failed to update user location', { error, payload });
    }
  }

  /**
   * Handle incoming event from event bus
   */
  async handleEvent(eventType: string, payload: unknown): Promise<void> {
    switch (eventType) {
      case 'event.booked':
        await this.handleEventBooked(payload as ZEventsBookingPayload);
        break;
      case 'event.checkin':
        await this.handleEventCheckin(payload as ZEventsCheckinPayload);
        break;
      case 'event.sync':
        await this.handleEventSync(payload as ZEventsEventPayload);
        break;
      case 'user.location_updated':
        await this.handleUserLocationUpdate(payload as UserLocationPayload);
        break;
      default:
        logger.debug('Unhandled event type', { eventType });
    }
  }

  /**
   * Calculate spillover effect based on event category
   */
  private calculateSpillover(category: string, avgPrice?: number): EventNode['spilloverEffect'] {
    let rideIncrease = 0.5;
    let restaurantIncrease = 0.3;
    let nightlifeIncrease = 0;
    let hotelIncrease = 0.1;

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
    }

    if (avgPrice && avgPrice > 5000) {
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
}

export const eventBusIntegration = new EventBusIntegration();

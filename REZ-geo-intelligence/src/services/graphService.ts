/**
 * REZ Geo Intelligence Core - Graph Service
 * Unified graph management for consumers, merchants, events, and zones
 */

import { v4 as uuidv4 } from 'uuid';
import { ConsumerModel, MerchantModel, EventModel, ZoneModel, GraphEdgeModel, TrustScoreModel } from '../models/index.js';
import {
  ConsumerNode,
  MerchantNode,
  EventNode,
  ZoneNode,
  GraphEdge,
  EdgeRelationship,
  GeoPoint,
  TrustScore,
} from '../types/index.js';
import logger from '../utils/logger.js';

export class GraphService {
  // ============================================
  // CONSUMER OPERATIONS
  // ============================================

  async upsertConsumer(data: Partial<ConsumerNode>): Promise<ConsumerNode> {
    const nodeId = data.nodeId || `consumer_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const consumer = await ConsumerModel.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          nodeId,
          type: 'consumer',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.debug('Consumer upserted', { nodeId, userId: data.userId });
    return consumer.toObject() as ConsumerNode;
  }

  async getConsumer(nodeId: string): Promise<ConsumerNode | null> {
    const consumer = await ConsumerModel.findOne({ nodeId });
    return consumer ? (consumer.toObject() as ConsumerNode) : null;
  }

  async getConsumerByUserId(userId: string): Promise<ConsumerNode | null> {
    const consumer = await ConsumerModel.findOne({ userId });
    return consumer ? (consumer.toObject() as ConsumerNode) : null;
  }

  async findConsumersNear(point: GeoPoint, radiusMeters: number, filters?: { segments?: string[] }): Promise<ConsumerNode[]> {
    const query: Record<string, unknown> = {
      $or: [
        { homeLocation: { $nearSphere: { $geometry: point, $maxDistance: radiusMeters } } },
        { workLocation: { $nearSphere: { $geometry: point, $maxDistance: radiusMeters } } },
      ],
    };

    if (filters?.segments?.length) {
      query.segments = { $in: filters.segments };
    }

    const consumers = await ConsumerModel.find(query).limit(100);
    return consumers.map((c) => c.toObject() as ConsumerNode);
  }

  async updateConsumerLocation(
    nodeId: string,
    location: GeoPoint,
    locationType: 'home' | 'work' | 'lastKnown'
  ): Promise<void> {
    const field = `${locationType}Location`;
    await ConsumerModel.updateOne(
      { nodeId },
      {
        $set: {
          [field]: location,
          lastLocationUpdate: new Date(),
        },
      }
    );
  }

  // ============================================
  // MERCHANT OPERATIONS
  // ============================================

  async upsertMerchant(data: Partial<MerchantNode>): Promise<MerchantNode> {
    const nodeId = data.nodeId || `merchant_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const merchant = await MerchantModel.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          nodeId,
          type: 'merchant',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.debug('Merchant upserted', { nodeId, merchantId: data.merchantId });
    return merchant.toObject() as MerchantNode;
  }

  async getMerchant(nodeId: string): Promise<MerchantNode | null> {
    const merchant = await MerchantModel.findOne({ nodeId });
    return merchant ? (merchant.toObject() as MerchantNode) : null;
  }

  async getMerchantById(merchantId: string): Promise<MerchantNode | null> {
    const merchant = await MerchantModel.findOne({ merchantId });
    return merchant ? (merchant.toObject() as MerchantNode) : null;
  }

  async findMerchantsNear(
    point: GeoPoint,
    radiusMeters: number,
    filters?: {
      category?: string[];
      priceRange?: string[];
      minRating?: number;
      hasOffers?: boolean;
    }
  ): Promise<MerchantNode[]> {
    const query: Record<string, unknown> = {
      location: { $nearSphere: { $geometry: point, $maxDistance: radiusMeters } },
    };

    if (filters?.category?.length) {
      query.category = { $in: filters.category };
    }
    if (filters?.priceRange?.length) {
      query.priceRange = { $in: filters.priceRange };
    }
    if (filters?.minRating) {
      query.avgRating = { $gte: filters.minRating };
    }
    if (filters?.hasOffers) {
      query['activeOffers.validUntil'] = { $gt: new Date() };
    }

    const merchants = await MerchantModel.find(query).limit(100);
    return merchants.map((m) => m.toObject() as MerchantNode);
  }

  async findMerchantsNearEvent(eventNodeId: string, radiusMeters = 2000): Promise<MerchantNode[]> {
    const event = await EventModel.findOne({ nodeId: eventNodeId });
    if (!event || !event.venue?.location) return [];

    return this.findMerchantsNear(event.venue.location as GeoPoint, radiusMeters);
  }

  async updateMerchantMetrics(
    nodeId: string,
    metrics: Partial<MerchantNode['popularity'] & MerchantNode['demandMetrics']>
  ): Promise<void> {
    await MerchantModel.updateOne({ nodeId }, { $set: metrics });
  }

  async addMerchantOffer(nodeId: string, offer: MerchantNode['activeOffers'][0]): Promise<void> {
    await MerchantModel.updateOne({ nodeId }, { $push: { activeOffers: offer } });
  }

  // ============================================
  // EVENT OPERATIONS
  // ============================================

  async upsertEvent(data: Partial<EventNode>): Promise<EventNode> {
    const nodeId = data.nodeId || `event_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const event = await EventModel.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          nodeId,
          type: 'event',
          sourceApp: 'zevents',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.info('Event upserted in Geo Intelligence', {
      nodeId,
      eventId: data.eventId,
      title: data.title,
    });
    return event.toObject() as EventNode;
  }

  async getEvent(nodeId: string): Promise<EventNode | null> {
    const event = await EventModel.findOne({ nodeId });
    return event ? (event.toObject() as EventNode) : null;
  }

  async getEventById(eventId: string): Promise<EventNode | null> {
    const event = await EventModel.findOne({ eventId });
    return event ? (event.toObject() as EventNode) : null;
  }

  async findEventsNear(
    point: GeoPoint,
    radiusMeters: number,
    filters?: {
      category?: string[];
      fromDate?: Date;
      toDate?: Date;
      minCapacity?: number;
    }
  ): Promise<EventNode[]> {
    const query: Record<string, unknown> = {
      'venue.location': { $nearSphere: { $geometry: point, $maxDistance: radiusMeters } },
    };

    if (filters?.category?.length) {
      query.category = { $in: filters.category };
    }
    if (filters?.fromDate) {
      query.startDate = { $gte: filters.fromDate };
    }
    if (filters?.toDate) {
      query.endDate = { $lte: filters.toDate };
    }
    if (filters?.minCapacity) {
      query.capacity = { $gte: filters.minCapacity };
    }

    const events = await EventModel.find(query).limit(50);
    return events.map((e) => e.toObject() as EventNode);
  }

  async findUpcomingEvents(city: string, limit = 20): Promise<EventNode[]> {
    const events = await EventModel.find({
      'venue.address.city': city,
      startDate: { $gte: new Date() },
    })
      .sort({ startDate: 1 })
      .limit(limit);
    return events.map((e) => e.toObject() as EventNode);
  }

  async updateEventMetrics(
    nodeId: string,
    metrics: { ticketsSold?: number; checkinCount?: number; totalRevenue?: number }
  ): Promise<void> {
    await EventModel.updateOne({ nodeId }, { $set: metrics });
  }

  async computeEventSpillover(nodeId: string): Promise<EventNode['spilloverEffect']> {
    const event = await EventModel.findOne({ nodeId });
    if (!event) throw new Error('Event not found');

    const category = event.category;
    const spendingTier = event.demographicProfile?.spendingTier || 'mid';
    const avgGroupSize = event.demographicProfile?.avgGroupSize || 2;

    // Calculate spillover based on event characteristics
    const isNightlife = category === 'music' || category === 'lifestyle';
    const isFood = category === 'food';
    const isBusiness = category === 'business' || category === 'tech';

    return {
      nearbyMerchantBoost: 0.5 + (isNightlife ? 0.3 : 0),
      restaurantDemandIncrease: isFood ? 0.8 : isNightlife ? 0.6 : 0.3,
      nightlifeDemandIncrease: isNightlife ? 0.8 : 0,
      hotelDemandIncrease: isBusiness ? 0.5 : avgGroupSize > 3 ? 0.2 : 0.1,
      rideDemandIncrease: isNightlife ? 0.9 : 0.6,
    };
  }

  // ============================================
  // ZONE OPERATIONS
  // ============================================

  async upsertZone(data: Partial<ZoneNode>): Promise<ZoneNode> {
    const nodeId = data.nodeId || `zone_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const zone = await ZoneModel.findOneAndUpdate(
      { nodeId },
      {
        $set: {
          ...data,
          nodeId,
          type: 'zone',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return zone.toObject() as ZoneNode;
  }

  async findZonesNear(point: GeoPoint, radiusMeters: number): Promise<ZoneNode[]> {
    const zones = await ZoneModel.find({
      center: { $nearSphere: { $geometry: point, $maxDistance: radiusMeters } },
    }).limit(20);
    return zones.map((z) => z.toObject() as ZoneNode);
  }

  async updateZoneDemand(zoneId: string, demand: ZoneNode['aggregateDemand']): Promise<void> {
    await ZoneModel.updateOne({ zoneId }, { $set: { aggregateDemand: demand } });
  }

  // ============================================
  // EDGE OPERATIONS
  // ============================================

  async createEdge(
    source: string,
    target: string,
    relationship: EdgeRelationship,
    weight = 1,
    metadata?: Record<string, unknown>
  ): Promise<GraphEdge> {
    const edgeId = `edge_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const edge = await GraphEdgeModel.findOneAndUpdate(
      { source, target },
      {
        $set: {
          edgeId,
          source,
          target,
          relationship,
          weight,
          metadata,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return edge.toObject() as GraphEdge;
  }

  async getEdges(nodeId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Promise<GraphEdge[]> {
    const query: Record<string, unknown> = {};
    if (direction === 'outgoing') query.source = nodeId;
    else if (direction === 'incoming') query.target = nodeId;
    else query.$or = [{ source: nodeId }, { target: nodeId }];

    const edges = await GraphEdgeModel.find(query);
    return edges.map((e) => e.toObject() as GraphEdge);
  }

  async getRelatedNodes(
    nodeId: string,
    relationship?: EdgeRelationship,
    limit = 20
  ): Promise<{ nodes: (ConsumerNode | MerchantNode | EventNode | ZoneNode)[]; edges: GraphEdge[] }> {
    const edgeQuery: Record<string, unknown> = {
      $or: [{ source: nodeId }, { target: nodeId }],
    };
    if (relationship) edgeQuery.relationship = relationship;

    const edges = await GraphEdgeModel.find(edgeQuery).limit(limit);
    const relatedNodeIds = edges.map((e) => (e.source === nodeId ? e.target : e.source));

    const [consumers, merchants, events, zones] = await Promise.all([
      ConsumerModel.find({ nodeId: { $in: relatedNodeIds } }),
      MerchantModel.find({ nodeId: { $in: relatedNodeIds } }),
      EventModel.find({ nodeId: { $in: relatedNodeIds } }),
      ZoneModel.find({ nodeId: { $in: relatedNodeIds } }),
    ]);

    const nodes = [...consumers, ...merchants, ...events, ...zones].map((n) => n.toObject());

    return {
      nodes: nodes as (ConsumerNode | MerchantNode | EventNode | ZoneNode)[],
      edges: edges.map((e) => e.toObject() as GraphEdge),
    };
  }

  async deleteEdge(edgeId: string): Promise<void> {
    await GraphEdgeModel.deleteOne({ edgeId });
  }

  // ============================================
  // TRUST OPERATIONS
  // ============================================

  async getTrustScore(entityId: string): Promise<TrustScore | null> {
    const trust = await TrustScoreModel.findOne({ entityId });
    return trust ? (trust.toObject() as TrustScore) : null;
  }

  async updateTrustScore(entityId: string, entityType: TrustScore['entityType'], score: Partial<TrustScore>): Promise<void> {
    await TrustScoreModel.findOneAndUpdate(
      { entityId },
      {
        $set: {
          entityId,
          entityType,
          ...score,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    );
  }

  async addRiskFlag(entityId: string, flag: TrustScore['riskFlags'][0]): Promise<void> {
    await TrustScoreModel.updateOne({ entityId }, { $push: { riskFlags: flag } });
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  async batchUpsertConsumers(consumers: Partial<ConsumerNode>[]): Promise<number> {
    const operations = consumers.map((c) => ({
      updateOne: {
        filter: { userId: c.userId },
        update: { $set: { ...c, type: 'consumer', updatedAt: new Date() } },
        upsert: true,
      },
    }));
    const result = await ConsumerModel.bulkWrite(operations as unknown[]);
    return result.upsertedCount + result.modifiedCount;
  }

  async batchUpsertMerchants(merchants: Partial<MerchantNode>[]): Promise<number> {
    const operations = merchants.map((m) => ({
      updateOne: {
        filter: { merchantId: m.merchantId },
        update: { $set: { ...m, type: 'merchant', updatedAt: new Date() } },
        upsert: true,
      },
    }));
    const result = await MerchantModel.bulkWrite(operations as unknown[]);
    return result.upsertedCount + result.modifiedCount;
  }

  // ============================================
  // GRAPH STATISTICS
  // ============================================

  async getGraphStats(): Promise<{
    consumers: number;
    merchants: number;
    events: number;
    zones: number;
    edges: number;
  }> {
    const [consumers, merchants, events, zones, edges] = await Promise.all([
      ConsumerModel.countDocuments(),
      MerchantModel.countDocuments(),
      EventModel.countDocuments(),
      ZoneModel.countDocuments(),
      GraphEdgeModel.countDocuments(),
    ]);

    return { consumers, merchants, events, zones, edges };
  }
}

export const graphService = new GraphService();

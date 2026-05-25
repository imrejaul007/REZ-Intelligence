/**
 * REZ Geo Intelligence - Zone Hierarchy Service
 * Manages the complete geographic hierarchy: City → District → Neighborhood → Micro-zone → Venue Cluster
 */

import mongoose, { Schema, Model } from 'mongoose';
import {
  ZoneLevel,
  ZoneHierarchyPath,
  ZoneHierarchyResponse,
  CityZone,
  DistrictZone,
  NeighborhoodZone,
  MicroZone,
  VenueCluster,
  CityDemandMetrics,
  DistrictDemandMetrics,
  NeighborhoodDemandMetrics,
  MicroZoneDemand,
  VenueClusterDemand,
  ZONE_LEVEL_PRIORITY,
} from '../types/zoneHierarchy.js';
import logger from '../utils/logger.js';

// ============================================
// MONGOOSE SCHEMAS
// ============================================

const GeoPointSchema = new Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

const GeoPolygonSchema = new Schema({
  type: { type: String, enum: ['Polygon'], required: true },
  coordinates: { type: [[[Number]]], required: true },
}, { _id: false });

// City Schema
const CityZoneSchema = new Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  level: { type: String, enum: ['city'], required: true },
  name: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, default: 'India' },
  boundary: { type: GeoPolygonSchema, required: true },
  center: { type: GeoPointSchema, required: true },
  population: { type: Number, default: 0 },
  areaSqKm: { type: Number, default: 0 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  metroStatus: { type: String, enum: ['metro', 'major', 'tier2', 'tier3'], default: 'tier2' },
  aggregateDemand: {
    avgDailyRides: { type: Number, default: 0 },
    avgDailyOrders: { type: Number, default: 0 },
    avgDailyEvents: { type: Number, default: 0 },
    peakHour: { type: Number, default: 19 },
    busiestDay: { type: Number, default: 6 },
  },
  districtIds: [{ type: String }],
  metadata: {
    tier: { type: Number, enum: [1, 2, 3], default: 2 },
    regions: [String],
    primaryLanguages: [String],
    crimeIndex: { type: Number, default: 50 },
    womenSafetyScore: { type: Number, default: 70 },
  },
}, { timestamps: true });

CityZoneSchema.index({ 'center': '2dsphere' });
CityZoneSchema.index({ 'boundary': '2dsphere' });
CityZoneSchema.index({ name: 'text' });

// District Schema
const DistrictZoneSchema = new Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  level: { type: String, enum: ['district'], required: true },
  name: { type: String, required: true },
  cityId: { type: String, required: true, index: true },
  boundary: { type: GeoPolygonSchema, required: true },
  center: { type: GeoPointSchema, required: true },
  radiusMeters: { type: Number, default: 5000 },
  areaType: {
    type: String,
    enum: ['residential', 'commercial', 'mixed', 'industrial', 'entertainment', 'corporate'],
    default: 'mixed',
  },
  characteristics: {
    isTechHub: { type: Boolean, default: false },
    isFoodDestination: { type: Boolean, default: false },
    isNightlifeHub: { type: Boolean, default: false },
    isShoppingDistrict: { type: Boolean, default: false },
    hasCoworking: { type: Boolean, default: false },
    hasMetro: { type: Boolean, default: false },
    hasMalls: { type: Boolean, default: false },
    hasStreetFood: { type: Boolean, default: false },
  },
  aggregateDemand: {
    avgDailyRides: { type: Number, default: 0 },
    avgDailyOrders: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    rideDemand: { type: Number, default: 0.5 },
    deliveryDemand: { type: Number, default: 0.5 },
    eventAttendance: { type: Number, default: 0 },
    footfall: { type: Number, default: 0 },
  },
  neighborhoodIds: [{ type: String }],
  performanceIndex: { type: Number, default: 50 },
}, { timestamps: true });

DistrictZoneSchema.index({ 'center': '2dsphere' });
DistrictZoneSchema.index({ 'boundary': '2dsphere' });
DistrictZoneSchema.index({ cityId: 1, name: 1 });

// Neighborhood Schema
const NeighborhoodZoneSchema = new Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  level: { type: String, enum: ['neighborhood'], required: true },
  name: { type: String, required: true },
  districtId: { type: String, required: true, index: true },
  cityId: { type: String, required: true, index: true },
  boundary: { type: GeoPolygonSchema, required: true },
  center: { type: GeoPointSchema, required: true },
  radiusMeters: { type: Number, default: 1000 },
  characteristics: {
    vibe: { type: String, enum: ['upscale', 'trendy', 'traditional', 'bustling', 'quiet', 'familial'], default: 'bustling' },
    priceLevel: { type: String, enum: ['budget', 'mid', 'upscale', 'premium'], default: 'mid' },
    footTrafficLevel: { type: String, enum: ['low', 'moderate', 'high', 'very_high'], default: 'moderate' },
    noiseLevel: { type: String, enum: ['quiet', 'moderate', 'loud', 'very_loud'], default: 'moderate' },
    parkingDifficulty: { type: String, enum: ['easy', 'moderate', 'difficult', 'very_difficult'], default: 'moderate' },
  },
  aggregateDemand: {
    avgDailyOrders: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    dominantCuisine: [String],
    peakHours: [Number],
    deliveryRadius: { type: Number, default: 3000 },
    avgDeliveryTime: { type: Number, default: 30 },
  },
  microZoneIds: [{ type: String }],
  demographics: {
    avgAge: { type: Number, default: 30 },
    avgIncome: { type: Number, default: 50000 },
    dominantAgeGroup: { type: String, enum: ['young', 'adult', 'middle_aged', 'senior'], default: 'adult' },
    workingProfessionalRatio: { type: Number, default: 0.5 },
  },
}, { timestamps: true });

NeighborhoodZoneSchema.index({ 'center': '2dsphere' });
NeighborhoodZoneSchema.index({ districtId: 1, name: 1 });

// Micro-zone Schema
const MicroZoneSchema = new Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  level: { type: String, enum: ['micro_zone'], required: true },
  name: { type: String, required: true },
  neighborhoodId: { type: String, required: true, index: true },
  districtId: { type: String, required: true, index: true },
  cityId: { type: String, required: true, index: true },
  boundary: { type: GeoPolygonSchema, required: true },
  center: { type: GeoPointSchema, required: true },
  radiusMeters: { type: Number, default: 200 },
  microType: {
    type: String,
    enum: ['residential_complex', 'commercial_pocket', 'mixed_use', 'transit_hub', 'market_area'],
    default: 'mixed_use',
  },
  attributes: {
    hasMetroStation: { type: Boolean, default: false },
    hasBusStop: { type: Boolean, default: false },
    hasAutoStand: { type: Boolean, default: false },
    hasParking: { type: Boolean, default: false },
    hasATMs: { type: Boolean, default: false },
    hasRestrooms: { type: Boolean, default: false },
    lightingQuality: { type: String, enum: ['poor', 'moderate', 'good', 'excellent'], default: 'good' },
    roadCondition: { type: String, enum: ['poor', 'moderate', 'good'], default: 'good' },
    crowdDensity: { type: String, enum: ['sparse', 'moderate', 'dense', 'very_dense'], default: 'moderate' },
  },
  currentDemand: {
    timestamp: { type: Date, default: Date.now },
    rideDemand: { type: Number, default: 0.5 },
    deliveryDemand: { type: Number, default: 0.5 },
    footfall: { type: Number, default: 0 },
    activeDrivers: { type: Number, default: 0 },
    waitTimeEstimate: { type: Number, default: 300 },
    surgeMultiplier: { type: Number, default: 1.0 },
    confidence: { type: Number, default: 0.5 },
  },
  historicalDemand: {
    avgWeekday: { type: Number, default: 50 },
    avgWeekend: { type: Number, default: 60 },
    peakHour: { type: Number, default: 19 },
    troughHour: { type: Number, default: 4 },
    volatilityScore: { type: Number, default: 0.3 },
  },
  venueClusterIds: [{ type: String }],
}, { timestamps: true });

MicroZoneSchema.index({ 'center': '2dsphere' });
MicroZoneSchema.index({ neighborhoodId: 1, name: 1 });

// Venue Cluster Schema
const VenueClusterSchema = new Schema({
  zoneId: { type: String, required: true, unique: true, index: true },
  level: { type: String, enum: ['venue_cluster'], required: true },
  name: { type: String, required: true },
  microZoneId: { type: String, required: true, index: true },
  neighborhoodId: { type: String, required: true, index: true },
  districtId: { type: String, required: true, index: true },
  cityId: { type: String, required: true, index: true },
  center: { type: GeoPointSchema, required: true },
  radiusMeters: { type: Number, default: 100 },
  venueIds: [{ type: String }],
  clusterType: {
    type: String,
    enum: ['restaurant_row', 'bar_district', 'food_court', 'market', 'mall_area', 'standalone'],
    default: 'standalone',
  },
  dominantCategory: { type: String, default: 'restaurant' },
  operatingHours: {
    opensAt: { type: Number, default: 9 },
    closesAt: { type: Number, default: 22 },
    is24Hours: { type: Boolean, default: false },
    hasLateNight: { type: Boolean, default: false },
  },
  aggregateDemand: {
    avgOrdersPerHour: { type: Number, default: 0 },
    peakHourOrders: { type: Number, default: 0 },
    avgBasketSize: { type: Number, default: 0 },
    avgPrepTime: { type: Number, default: 30 },
    fulfillmentRate: { type: Number, default: 0.95 },
  },
  performanceIndex: { type: Number, default: 50 },
}, { timestamps: true });

VenueClusterSchema.index({ 'center': '2dsphere' });
VenueClusterSchema.index({ microZoneId: 1, name: 1 });

// ============================================
// MODELS
// ============================================

export const CityZoneModel: Model<CityZone> = mongoose.model<CityZone>('CityZone', CityZoneSchema);
export const DistrictZoneModel: Model<DistrictZone> = mongoose.model<DistrictZone>('DistrictZone', DistrictZoneSchema);
export const NeighborhoodZoneModel: Model<NeighborhoodZone> = mongoose.model<NeighborhoodZone>('NeighborhoodZone', NeighborhoodZoneSchema);
export const MicroZoneModel: Model<MicroZone> = mongoose.model<MicroZone>('MicroZone', MicroZoneSchema);
export const VenueClusterModel: Model<VenueCluster> = mongoose.model<VenueCluster>('VenueCluster', VenueClusterSchema);

// ============================================
// ZONE HIERARCHY SERVICE
// ============================================

export class ZoneHierarchyService {
  // ============================================
  // CITY OPERATIONS
  // ============================================

  /**
   * Create or update a city zone
   */
  async upsertCity(city: Partial<CityZone> & { zoneId: string; name: string; state: string }): Promise<CityZone> {
    const result = await CityZoneModel.findOneAndUpdate(
      { zoneId: city.zoneId },
      { $set: city },
      { upsert: true, new: true }
    );
    logger.info('City zone upserted', { zoneId: city.zoneId, name: city.name });
    return result.toObject() as CityZone;
  }

  /**
   * Get city by ID
   */
  async getCity(zoneId: string): Promise<CityZone | null> {
    const city = await CityZoneModel.findOne({ zoneId });
    return city ? (city.toObject() as CityZone) : null;
  }

  /**
   * Get all cities
   */
  async getAllCities(): Promise<CityZone[]> {
    const cities = await CityZoneModel.find();
    return cities.map((c) => c.toObject() as CityZone);
  }

  /**
   * Find cities near a location
   */
  async findCitiesNear(lng: number, lat: number, maxDistanceMeters = 100000): Promise<CityZone[]> {
    const cities = await CityZoneModel.find({
      center: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistanceMeters,
        },
      },
    });
    return cities.map((c) => c.toObject() as CityZone);
  }

  // ============================================
  // DISTRICT OPERATIONS
  // ============================================

  /**
   * Create or update a district zone
   */
  async upsertDistrict(district: Partial<DistrictZone> & { zoneId: string; name: string; cityId: string }): Promise<DistrictZone> {
    const result = await DistrictZoneModel.findOneAndUpdate(
      { zoneId: district.zoneId },
      { $set: district },
      { upsert: true, new: true }
    );

    // Update parent's districtIds
    await CityZoneModel.updateOne(
      { zoneId: district.cityId },
      { $addToSet: { districtIds: district.zoneId } }
    );

    logger.info('District zone upserted', { zoneId: district.zoneId, name: district.name });
    return result.toObject() as DistrictZone;
  }

  /**
   * Get district by ID
   */
  async getDistrict(zoneId: string): Promise<DistrictZone | null> {
    const district = await DistrictZoneModel.findOne({ zoneId });
    return district ? (district.toObject() as DistrictZone) : null;
  }

  /**
   * Get districts in a city
   */
  async getDistrictsByCity(cityId: string): Promise<DistrictZone[]> {
    const districts = await DistrictZoneModel.find({ cityId });
    return districts.map((d) => d.toObject() as DistrictZone);
  }

  /**
   * Find district containing a point
   */
  async findDistrictAtPoint(lng: number, lat: number): Promise<DistrictZone | null> {
    const district = await DistrictZoneModel.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    });
    return district ? (district.toObject() as DistrictZone) : null;
  }

  // ============================================
  // NEIGHBORHOOD OPERATIONS
  // ============================================

  /**
   * Create or update a neighborhood zone
   */
  async upsertNeighborhood(
    neighborhood: Partial<NeighborhoodZone> & { zoneId: string; name: string; districtId: string; cityId: string }
  ): Promise<NeighborhoodZone> {
    const result = await NeighborhoodZoneModel.findOneAndUpdate(
      { zoneId: neighborhood.zoneId },
      { $set: neighborhood },
      { upsert: true, new: true }
    );

    // Update parent's neighborhoodIds
    await DistrictZoneModel.updateOne(
      { zoneId: neighborhood.districtId },
      { $addToSet: { neighborhoodIds: neighborhood.zoneId } }
    );

    logger.info('Neighborhood zone upserted', { zoneId: neighborhood.zoneId, name: neighborhood.name });
    return result.toObject() as NeighborhoodZone;
  }

  /**
   * Get neighborhood by ID
   */
  async getNeighborhood(zoneId: string): Promise<NeighborhoodZone | null> {
    const neighborhood = await NeighborhoodZoneModel.findOne({ zoneId });
    return neighborhood ? (neighborhood.toObject() as NeighborhoodZone) : null;
  }

  /**
   * Get neighborhoods in a district
   */
  async getNeighborhoodsByDistrict(districtId: string): Promise<NeighborhoodZone[]> {
    const neighborhoods = await NeighborhoodZoneModel.find({ districtId });
    return neighborhoods.map((n) => n.toObject() as NeighborhoodZone);
  }

  // ============================================
  // MICRO-ZONE OPERATIONS
  // ============================================

  /**
   * Create or update a micro-zone
   */
  async upsertMicroZone(
    microZone: Partial<MicroZone> & { zoneId: string; name: string; neighborhoodId: string; districtId: string; cityId: string }
  ): Promise<MicroZone> {
    const result = await MicroZoneModel.findOneAndUpdate(
      { zoneId: microZone.zoneId },
      { $set: microZone },
      { upsert: true, new: true }
    );

    // Update parent's microZoneIds
    await NeighborhoodZoneModel.updateOne(
      { zoneId: microZone.neighborhoodId },
      { $addToSet: { microZoneIds: microZone.zoneId } }
    );

    logger.info('Micro-zone upserted', { zoneId: microZone.zoneId, name: microZone.name });
    return result.toObject() as MicroZone;
  }

  /**
   * Get micro-zone by ID
   */
  async getMicroZone(zoneId: string): Promise<MicroZone | null> {
    const microZone = await MicroZoneModel.findOne({ zoneId });
    return microZone ? (microZone.toObject() as MicroZone) : null;
  }

  /**
   * Get micro-zones in a neighborhood
   */
  async getMicroZonesByNeighborhood(neighborhoodId: string): Promise<MicroZone[]> {
    const microZones = await MicroZoneModel.find({ neighborhoodId });
    return microZones.map((m) => m.toObject() as MicroZone);
  }

  /**
   * Find micro-zone at a point (most granular level)
   */
  async findMicroZoneAtPoint(lng: number, lat: number): Promise<MicroZone | null> {
    const microZone = await MicroZoneModel.findOne({
      center: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 500, // Max 500m radius
        },
      },
    });
    return microZone ? (microZone.toObject() as MicroZone) : null;
  }

  // ============================================
  // VENUE CLUSTER OPERATIONS
  // ============================================

  /**
   * Create or update a venue cluster
   */
  async upsertVenueCluster(
    cluster: Partial<VenueCluster> & { zoneId: string; name: string; microZoneId: string; neighborhoodId: string; districtId: string; cityId: string }
  ): Promise<VenueCluster> {
    const result = await VenueClusterModel.findOneAndUpdate(
      { zoneId: cluster.zoneId },
      { $set: cluster },
      { upsert: true, new: true }
    );

    // Update parent's venueClusterIds
    await MicroZoneModel.updateOne(
      { zoneId: cluster.microZoneId },
      { $addToSet: { venueClusterIds: cluster.zoneId } }
    );

    logger.info('Venue cluster upserted', { zoneId: cluster.zoneId, name: cluster.name });
    return result.toObject() as VenueCluster;
  }

  /**
   * Get venue cluster by ID
   */
  async getVenueCluster(zoneId: string): Promise<VenueCluster | null> {
    const cluster = await VenueClusterModel.findOne({ zoneId });
    return cluster ? (cluster.toObject() as VenueCluster) : null;
  }

  /**
   * Get venue clusters in a micro-zone
   */
  async getVenueClustersByMicroZone(microZoneId: string): Promise<VenueCluster[]> {
    const clusters = await VenueClusterModel.find({ microZoneId });
    return clusters.map((c) => c.toObject() as VenueCluster);
  }

  // ============================================
  // HIERARCHY TRAVERSAL
  // ============================================

  /**
   * Get full hierarchy path for a zone
   */
  async getHierarchyPath(zoneId: string, level: ZoneLevel): Promise<ZoneHierarchyPath> {
    switch (level) {
      case 'city':
        return this.getCityPath(zoneId);

      case 'district':
        const district = await this.getDistrict(zoneId);
        if (!district) throw new Error(`District not found: ${zoneId}`);
        const city = await this.getCity(district.cityId);
        return {
          cityId: district.cityId,
          cityName: city?.name || '',
          districtId: district.zoneId,
          districtName: district.name,
        };

      case 'neighborhood':
        const neighborhood = await this.getNeighborhood(zoneId);
        if (!neighborhood) throw new Error(`Neighborhood not found: ${zoneId}`);
        const parentDistrict = await this.getDistrict(neighborhood.districtId);
        const parentCity = await this.getCity(neighborhood.cityId);
        return {
          cityId: neighborhood.cityId,
          cityName: parentCity?.name || '',
          districtId: neighborhood.districtId,
          districtName: parentDistrict?.name || '',
          neighborhoodId: neighborhood.zoneId,
          neighborhoodName: neighborhood.name,
        };

      case 'micro_zone':
        const microZone = await this.getMicroZone(zoneId);
        if (!microZone) throw new Error(`Micro-zone not found: ${zoneId}`);
        const parentNeighborhood = await this.getNeighborhood(microZone.neighborhoodId);
        const parentDistrict2 = await this.getDistrict(microZone.districtId);
        const parentCity2 = await this.getCity(microZone.cityId);
        return {
          cityId: microZone.cityId,
          cityName: parentCity2?.name || '',
          districtId: microZone.districtId,
          districtName: parentDistrict2?.name || '',
          neighborhoodId: microZone.neighborhoodId,
          neighborhoodName: parentNeighborhood?.name || '',
          microZoneId: microZone.zoneId,
          microZoneName: microZone.name,
        };

      case 'venue_cluster':
        const cluster = await this.getVenueCluster(zoneId);
        if (!cluster) throw new Error(`Venue cluster not found: ${zoneId}`);
        const parentMicroZone = await this.getMicroZone(cluster.microZoneId);
        const parentNeighborhood2 = await this.getNeighborhood(cluster.neighborhoodId);
        const parentDistrict3 = await this.getDistrict(cluster.districtId);
        const parentCity3 = await this.getCity(cluster.cityId);
        return {
          cityId: cluster.cityId,
          cityName: parentCity3?.name || '',
          districtId: cluster.districtId,
          districtName: parentDistrict3?.name || '',
          neighborhoodId: cluster.neighborhoodId,
          neighborhoodName: parentNeighborhood2?.name || '',
          microZoneId: cluster.microZoneId,
          microZoneName: parentMicroZone?.name || '',
          venueClusterId: cluster.zoneId,
          venueClusterName: cluster.name,
        };

      default:
        throw new Error(`Unknown zone level: ${level}`);
    }
  }

  private async getCityPath(cityId: string): Promise<ZoneHierarchyPath> {
    const city = await this.getCity(cityId);
    if (!city) throw new Error(`City not found: ${cityId}`);
    return {
      cityId: city.zoneId,
      cityName: city.name,
      districtId: '',
      districtName: '',
    };
  }

  /**
   * Get full hierarchy response for a zone
   */
  async getZoneHierarchy(zoneId: string, level: ZoneLevel): Promise<ZoneHierarchyResponse> {
    const path = await this.getHierarchyPath(zoneId, level);
    const children = await this.getZoneChildren(zoneId, level);

    // Get siblings at same level
    const siblings = await this.getZoneSiblings(zoneId, level, path);

    // Get the zone itself
    let zone: ZoneHierarchyResponse['zone'] | null = null;
    switch (level) {
      case 'city':
        zone = await this.getCity(zoneId);
        break;
      case 'district':
        zone = await this.getDistrict(zoneId);
        break;
      case 'neighborhood':
        zone = await this.getNeighborhood(zoneId);
        break;
      case 'micro_zone':
        zone = await this.getMicroZone(zoneId);
        break;
      case 'venue_cluster':
        zone = await this.getVenueCluster(zoneId);
        break;
    }

    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`);
    }

    return {
      zone,
      path,
      children,
      siblings,
    };
  }

  /**
   * Get children of a zone
   */
  async getZoneChildren(zoneId: string, level: ZoneLevel): Promise<ZoneHierarchyResponse['children'] | []> {
    const nextLevel = this.getNextLevel(level);
    if (!nextLevel) return [];

    switch (level) {
      case 'city': {
        const districts = await this.getDistrictsByCity(zoneId);
        return [{
          level: nextLevel,
          count: districts.length,
          ids: districts.map((d) => d.zoneId),
        }];
      }
      case 'district': {
        const neighborhoods = await this.getNeighborhoodsByDistrict(zoneId);
        return [{
          level: nextLevel,
          count: neighborhoods.length,
          ids: neighborhoods.map((n) => n.zoneId),
        }];
      }
      case 'neighborhood': {
        const microZones = await this.getMicroZonesByNeighborhood(zoneId);
        return [{
          level: nextLevel,
          count: microZones.length,
          ids: microZones.map((m) => m.zoneId),
        }];
      }
      case 'micro_zone': {
        const clusters = await this.getVenueClustersByMicroZone(zoneId);
        return [{
          level: nextLevel,
          count: clusters.length,
          ids: clusters.map((c) => c.zoneId),
        }];
      }
      default:
        return [];
    }
  }

  /**
   * Get siblings of a zone (zones at same level with same parent)
   */
  async getZoneSiblings(
    zoneId: string,
    level: ZoneLevel,
    path: ZoneHierarchyPath
  ): Promise<ZoneHierarchyResponse['siblings']> {
    const parentId = this.getParentId(level, path);
    if (!parentId) return [];

    let siblings: { zoneId: string; name: string; center: { coordinates: number[] } }[];

    switch (level) {
      case 'district':
        siblings = await DistrictZoneModel.find({ cityId: parentId });
        break;
      case 'neighborhood':
        siblings = await NeighborhoodZoneModel.find({ districtId: parentId });
        break;
      case 'micro_zone':
        siblings = await MicroZoneModel.find({ neighborhoodId: parentId });
        break;
      case 'venue_cluster':
        siblings = await VenueClusterModel.find({ microZoneId: parentId });
        break;
      default:
        return [];
    }

    // Calculate distances from center of target zone
    let targetCenter: { coordinates: number[] } | undefined;
    switch (level) {
      case 'district':
        const district = await this.getDistrict(zoneId);
        targetCenter = district?.center;
        break;
      case 'neighborhood':
        const neighborhood = await this.getNeighborhood(zoneId);
        targetCenter = neighborhood?.center;
        break;
      case 'micro_zone':
        const microZone = await this.getMicroZone(zoneId);
        targetCenter = microZone?.center;
        break;
      case 'venue_cluster':
        const cluster = await this.getVenueCluster(zoneId);
        targetCenter = cluster?.center;
        break;
    }

    return siblings
      .filter((s) => s.zoneId !== zoneId)
      .map((s) => ({
        zoneId: s.zoneId,
        name: s.name,
        distance: targetCenter
          ? this.calculateDistance(
              targetCenter.coordinates[1],
              targetCenter.coordinates[0],
              s.center.coordinates[1],
              s.center.coordinates[0]
            )
          : 0,
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  private getParentId(level: ZoneLevel, path: ZoneHierarchyPath): string | null {
    switch (level) {
      case 'city':
        return null;
      case 'district':
        return path.cityId;
      case 'neighborhood':
        return path.districtId;
      case 'micro_zone':
        return path.neighborhoodId || null;
      case 'venue_cluster':
        return path.microZoneId || null;
      default:
        return null;
    }
  }

  private getNextLevel(level: ZoneLevel): ZoneLevel | null {
    switch (level) {
      case 'city':
        return 'district';
      case 'district':
        return 'neighborhood';
      case 'neighborhood':
        return 'micro_zone';
      case 'micro_zone':
        return 'venue_cluster';
      default:
        return null;
    }
  }

  // ============================================
  // GEOCODING & LOOKUP
  // ============================================

  /**
   * Find zone hierarchy for a given point (reverse geocode)
   */
  async findZonesAtPoint(lng: number, lat: number): Promise<{
    city?: CityZone;
    district?: DistrictZone;
    neighborhood?: NeighborhoodZone;
    microZone?: MicroZone;
    venueCluster?: VenueCluster;
  }> {
    // Try venue cluster first (most granular)
    const cluster = await VenueClusterModel.findOne({
      center: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 100,
        },
      },
    });

    // Try micro-zone
    const microZone = await MicroZoneModel.findOne({
      center: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 500,
        },
      },
    });

    // Try neighborhood
    const neighborhood = await NeighborhoodZoneModel.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    });

    // Try district
    const district = await DistrictZoneModel.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    });

    // Try city
    const city = await CityZoneModel.findOne({
      boundary: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    });

    return {
      city: city ? (city.toObject() as CityZone) : undefined,
      district: district ? (district.toObject() as DistrictZone) : undefined,
      neighborhood: neighborhood ? (neighborhood.toObject() as NeighborhoodZone) : undefined,
      microZone: microZone ? (microZone.toObject() as MicroZone) : undefined,
      venueCluster: cluster ? (cluster.toObject() as VenueCluster) : undefined,
    };
  }

  /**
   * Get all zones within a radius of a point
   */
  async getZonesInRadius(lng: number, lat: number, radiusMeters: number): Promise<{
    districts: DistrictZone[];
    neighborhoods: NeighborhoodZone[];
    microZones: MicroZone[];
  }> {
    const [districts, neighborhoods, microZones] = await Promise.all([
      DistrictZoneModel.find({
        center: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      }),
      NeighborhoodZoneModel.find({
        center: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      }),
      MicroZoneModel.find({
        center: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusMeters,
          },
        },
      }),
    ]);

    return {
      districts: districts.map((d) => d.toObject() as DistrictZone),
      neighborhoods: neighborhoods.map((n) => n.toObject() as NeighborhoodZone),
      microZones: microZones.map((m) => m.toObject() as MicroZone),
    };
  }

  // ============================================
  // SEED DATA
  // ============================================

  /**
   * Seed Bangalore zones for Koramangala example
   */
  async seedKoramangala(): Promise<void> {
    const cityId = 'bangalore';
    const districtId = 'koramangala';
    const neighborhoodId = 'koramangala-5th-block';

    // Create city
    await this.upsertCity({
      zoneId: cityId,
      level: 'city',
      name: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      boundary: {
        type: 'Polygon',
        coordinates: [[[77.35, 12.8], [77.8, 12.8], [77.8, 13.2], [77.35, 13.2], [77.35, 12.8]]],
      },
      center: { type: 'Point', coordinates: [77.61, 12.97] },
      population: 13000000,
      areaSqKm: 2196,
      timezone: 'Asia/Kolkata',
      metroStatus: 'metro',
      aggregateDemand: {
        avgDailyRides: 250000,
        avgDailyOrders: 180000,
        avgDailyEvents: 45,
        peakHour: 19,
        busiestDay: 6,
      },
      districtIds: [],
      metadata: {
        tier: 1,
        regions: ['Electronic City', 'Whitefield', 'MG Road', 'Indiranagar'],
        primaryLanguages: ['Kannada', 'English', 'Hindi', 'Tamil', 'Telugu'],
        crimeIndex: 35,
        womenSafetyScore: 72,
      },
    });

    // Create district
    await this.upsertDistrict({
      zoneId: districtId,
      level: 'district',
      name: 'Koramangala',
      cityId,
      boundary: {
        type: 'Polygon',
        coordinates: [[[77.58, 12.93], [77.64, 12.93], [77.64, 12.98], [77.58, 12.98], [77.58, 12.93]]],
      },
      center: { type: 'Point', coordinates: [77.61, 12.95] },
      radiusMeters: 8000,
      areaType: 'mixed',
      characteristics: {
        isTechHub: true,
        isFoodDestination: true,
        isNightlifeHub: true,
        isShoppingDistrict: true,
        hasCoworking: true,
        hasMetro: true,
        hasMalls: true,
        hasStreetFood: true,
      },
      aggregateDemand: {
        avgDailyRides: 15000,
        avgDailyOrders: 12000,
        avgOrderValue: 450,
        rideDemand: 0.75,
        deliveryDemand: 0.85,
        eventAttendance: 500,
        footfall: 5000,
      },
      neighborhoodIds: [],
      performanceIndex: 88,
    });

    // Create neighborhood
    await this.upsertNeighborhood({
      zoneId: neighborhoodId,
      level: 'neighborhood',
      name: '5th Block Koramangala',
      districtId,
      cityId,
      boundary: {
        type: 'Polygon',
        coordinates: [[[77.595, 12.935], [77.615, 12.935], [77.615, 12.95], [77.595, 12.95], [77.595, 12.935]]],
      },
      center: { type: 'Point', coordinates: [77.605, 12.942] },
      radiusMeters: 1500,
      characteristics: {
        vibe: 'trendy',
        priceLevel: 'upscale',
        footTrafficLevel: 'very_high',
        noiseLevel: 'loud',
        parkingDifficulty: 'very_difficult',
      },
      aggregateDemand: {
        avgDailyOrders: 2500,
        avgOrderValue: 550,
        dominantCuisine: ['Italian', 'American', 'Asian Fusion', 'Cafe'],
        peakHours: [12, 13, 19, 20, 21],
        deliveryRadius: 3500,
        avgDeliveryTime: 28,
      },
      microZoneIds: [],
      demographics: {
        avgAge: 28,
        avgIncome: 120000,
        dominantAgeGroup: 'young',
        workingProfessionalRatio: 0.75,
      },
    });

    logger.info('Koramangala zones seeded successfully');
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const zoneHierarchyService = new ZoneHierarchyService();

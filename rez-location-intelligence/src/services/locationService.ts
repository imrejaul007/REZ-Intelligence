/**
 * Location Service
 * Core service for managing location visits and user profiles
 */

import { LocationVisitModel, UserLocationProfileModel, LocationZoneModel } from '../models/index.js';
import { detectAllPatterns, getPrimaryPattern } from './patternDetectionService.js';
import { classifyUserSegments } from './segmentService.js';
import type {
  LocationVisit,
  VisitInput,
  UserLocationProfile,
  FootfallQuery,
  FootfallResult,
  DwellTimeAnalytics,
  HeatmapPoint,
  Coordinates
} from '../types/index.js';
import logger from './utils/logger';

export class LocationService {
  /**
   * Record a new location visit
   */
  async recordVisit(input: VisitInput): Promise<LocationVisit> {
    const visit = new LocationVisitModel({
      ...input,
      timestamp: new Date()
    });

    await visit.save();
    logger.info(`Recorded visit for user ${input.userId} at ${input.locationName}`);

    // Update user profile
    await this.updateUserProfile(input.userId);

    return visit.toObject();
  }

  /**
   * Record multiple visits in batch
   */
  async recordVisitBatch(inputs: VisitInput[]): Promise<LocationVisit[]> {
    const visits = inputs.map(input => ({
      ...input,
      timestamp: new Date()
    }));

    const result = await LocationVisitModel.insertMany(visits);
    logger.info(`Recorded ${result.length} visits in batch`);

    // Update unique user profiles
    const uniqueUserIds = [...new Set(inputs.map(v => v.userId))];
    for (const userId of uniqueUserIds) {
      await this.updateUserProfile(userId);
    }

    return result;
  }

  /**
   * Get user location profile
   */
  async getUserProfile(userId: string): Promise<UserLocationProfile | null> {
    const profile = await UserLocationProfileModel.findOne({ userId });
    return profile ? profile.toObject() : null;
  }

  /**
   * Get user's visit history
   */
  async getUserVisits(
    userId: string,
    options: { limit?: number; startDate?: Date; endDate?: Date; locationType?: string } = {}
  ): Promise<LocationVisit[]> {
    const query: Record<string, unknown> = { userId };

    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) (query.timestamp as Record<string, Date>).$gte = options.startDate;
      if (options.endDate) (query.timestamp as Record<string, Date>).$lte = options.endDate;
    }

    if (options.locationType) {
      query.locationType = options.locationType;
    }

    const visits = await LocationVisitModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options.limit || 100);

    return visits.map(v => v.toObject());
  }

  /**
   * Get user's detected patterns
   */
  async getUserPatterns(userId: string): Promise<LocationVisit[]> {
    const visits = await this.getUserVisits(userId, { limit: 500 });
    return visits;
  }

  /**
   * Update user profile with latest patterns and segments
   */
  async updateUserProfile(userId: string): Promise<UserLocationProfile> {
    // Get recent visits (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const visits = await LocationVisitModel
      .find({
        userId,
        timestamp: { $gte: thirtyDaysAgo }
      })
      .sort({ timestamp: -1 });

    // Detect patterns
    const visitObjects = visits.map(v => v.toObject());
    const patterns = detectAllPatterns(visitObjects);
    const primaryPattern = getPrimaryPattern(visitObjects);

    // Classify segments
    const segments = classifyUserSegments(visitObjects, patterns);

    // Calculate favorite zones
    const zoneCounts = new Map<string, number>();
    for (const visit of visits) {
      zoneCounts.set(visit.zone, (zoneCounts.get(visit.zone) || 0) + 1);
    }
    const favoriteZones = Array.from(zoneCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([zone]) => zone);

    // Update or create profile
    const profile = await UserLocationProfileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          patterns,
          segments,
          totalVisits: visits.length,
          favoriteZones,
          lastVisit: visits[0]?.timestamp || null,
          lastUpdated: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info(`Updated profile for user ${userId}: ${patterns.length} patterns, ${segments.length} segments`);

    return profile.toObject();
  }

  /**
   * Get users by segment
   */
  async getUsersBySegment(segment: string, options: { limit?: number } = {}): Promise<string[]> {
    const profiles = await UserLocationProfileModel
      .find({ segments: segment })
      .select('userId')
      .limit(options.limit || 100);

    return profiles.map(p => p.userId);
  }

  /**
   * Get users in a zone
   */
  async getUsersInZone(zone: string, options: { since?: Date; limit?: number } = {}): Promise<string[]> {
    const query: Record<string, unknown> = { zone };

    if (options.since) {
      query.timestamp = { $gte: options.since };
    }

    const visits = await LocationVisitModel.distinct('userId', query);

    return visits.slice(0, options.limit || visits.length);
  }

  /**
   * Get footfall analytics
   */
  async getFootfallAnalytics(query: FootfallQuery): Promise<FootfallResult[]> {
    const match: Record<string, unknown> = {};

    if (query.startDate || query.endDate) {
      match.timestamp = {};
      if (query.startDate) (match.timestamp as Record<string, Date>).$gte = query.startDate;
      if (query.endDate) (match.timestamp as Record<string, Date>).$lte = query.endDate;
    }

    if (query.zone) {
      match.zone = query.zone;
    }

    if (query.locationType) {
      match.locationType = query.locationType;
    }

    const groupBy = query.granularity === 'hourly' ? { $hour: '$timestamp' } :
                     query.granularity === 'weekly' ? { $isoWeek: '$timestamp', $year: '$timestamp' } :
                     query.granularity === 'monthly' ? { $month: '$timestamp', $year: '$timestamp' } :
                     { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };

    const results = await LocationVisitModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupBy,
          visits: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          avgDwellTime: { $avg: '$dwellTimeMinutes' }
        }
      },
      {
        $project: {
          date: '$_id',
          visits: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          avgDwellTime: { $round: ['$avgDwellTime', 1] }
        }
      },
      { $sort: { date: 1 } }
    ]);

    return results;
  }

  /**
   * Get dwell time analytics by location
   */
  async getDwellTimeAnalytics(options: {
    locationId?: string;
    zone?: string;
    locationType?: string;
    limit?: number;
  } = {}): Promise<DwellTimeAnalytics[]> {
    const match: Record<string, unknown> = {
      dwellTimeMinutes: { $exists: true, $ne: null }
    };

    if (options.locationId) match.locationId = options.locationId;
    if (options.zone) match.zone = options.zone;
    if (options.locationType) match.locationType = options.locationType;

    const results = await LocationVisitModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$locationId',
          locationName: { $first: '$locationName' },
          avgDwellTime: { $avg: '$dwellTimeMinutes' },
          minDwellTime: { $min: '$dwellTimeMinutes' },
          maxDwellTime: { $max: '$dwellTimeMinutes' },
          visitCount: { $sum: 1 }
        }
      },
      {
        $project: {
          locationId: '$_id',
          locationName: 1,
          avgDwellTime: { $round: ['$avgDwellTime', 1] },
          minDwellTime: 1,
          maxDwellTime: 1,
          medianDwellTime: '$avgDwellTime',
          visitCount: 1
        }
      },
      { $sort: { visitCount: -1 } },
      { $limit: options.limit || 50 }
    ]);

    return results;
  }

  /**
   * Generate heatmap data for visualization
   */
  async getHeatmapData(options: {
    zone?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<HeatmapPoint[]> {
    const match: Record<string, unknown> = {
      coordinates: { $exists: true }
    };

    if (options.zone) match.zone = options.zone;
    if (options.startDate || options.endDate) {
      match.timestamp = {};
      if (options.startDate) (match.timestamp as Record<string, Date>).$gte = options.startDate;
      if (options.endDate) (match.timestamp as Record<string, Date>).$lte = options.endDate;
    }

    const results = await LocationVisitModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            lat: { $round: ['$coordinates.lat', 3] },
            lng: { $round: ['$coordinates.lng', 3] }
          },
          visitCount: { $sum: 1 },
          zone: { $first: '$zone' }
        }
      },
      {
        $project: {
          _id: 0,
          coordinates: '$_id',
          intensity: '$visitCount',
          visitCount: 1,
          zone: 1
        }
      }
    ]);

    return results;
  }

  /**
   * Zone management
   */
  async createZone(data: Partial<LocationZoneModel>): Promise<LocationZoneModel> {
    const zone = new LocationZoneModel({
      ...data,
      lastUpdated: new Date()
    });
    await zone.save();
    return zone;
  }

  async getZone(zoneId: string): Promise<LocationZoneModel | null> {
    return LocationZoneModel.findOne({ zoneId });
  }

  async getAllZones(options: { type?: string; premium?: boolean } = {}): Promise<LocationZoneModel[]> {
    const query: Record<string, unknown> = {};
    if (options.type) query.type = options.type;
    if (options.premium !== undefined) query['attributes.premium'] = options.premium;

    return LocationZoneModel.find(query);
  }

  async updateZone(zoneId: string, data: Partial<LocationZoneModel>): Promise<LocationZoneModel | null> {
    return LocationZoneModel.findOneAndUpdate(
      { zoneId },
      { $set: { ...data, lastUpdated: new Date() } },
      { new: true }
    );
  }

  async updateZoneFootfall(zoneId: string): Promise<void> {
    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);

    const [daily, weekly, monthly, active] = await Promise.all([
      LocationVisitModel.countDocuments({ zone: zoneId, timestamp: { $gte: dayStart } }),
      LocationVisitModel.countDocuments({ zone: zoneId, timestamp: { $gte: weekStart } }),
      LocationVisitModel.countDocuments({ zone: zoneId, timestamp: { $gte: monthStart } }),
      LocationVisitModel.distinct('userId', { zone: zoneId, timestamp: { $gte: dayStart } })
    ]);

    await LocationZoneModel.updateOne(
      { zoneId },
      {
        $set: {
          dailyFootfall: daily,
          weeklyFootfall: weekly,
          monthlyFootfall: monthly,
          activeUsers: active.length,
          lastUpdated: new Date()
        }
      }
    );
  }
}

export const locationService = new LocationService();

/**
 * Analytics Service
 * Aggregate analytics and reporting
 */

import { LocationVisitModel, UserLocationProfileModel, LocationZoneModel } from '../models/index.js';
import type { FootfallQuery, FootfallResult, DwellTimeAnalytics } from '../types/index.js';

interface ZoneAnalytics {
  zone: string;
  totalVisits: number;
  uniqueUsers: number;
  avgDwellTime: number;
  topLocations: { locationId: string; locationName: string; visits: number }[];
  locationTypeBreakdown: Record<string, number>;
  hourlyDistribution: number[];
  dailyDistribution: number[];
}

interface UserSegmentAnalytics {
  segment: string;
  userCount: number;
  avgVisitsPerUser: number;
  topZones: string[];
  primaryLocationType: string;
}

export class AnalyticsService {
  /**
   * Get comprehensive zone analytics
   */
  async getZoneAnalytics(
    zone: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<ZoneAnalytics> {
    const match: Record<string, unknown> = { zone };

    if (options.startDate || options.endDate) {
      match.timestamp = {};
      if (options.startDate) (match.timestamp as Record<string, Date>).$gte = options.startDate;
      if (options.endDate) (match.timestamp as Record<string, Date>).$lte = options.endDate;
    }

    const [locationStats, typeStats, hourlyStats, dailyStats] = await Promise.all([
      // Top locations
      LocationVisitModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { locationId: '$locationId', locationName: '$locationName' },
            visits: { $sum: 1 }
          }
        },
        { $sort: { visits: -1 } },
        { $limit: 10 }
      ]),

      // Location type breakdown
      LocationVisitModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$locationType',
            count: { $sum: 1 }
          }
        }
      ]),

      // Hourly distribution (0-23)
      LocationVisitModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $hour: '$timestamp' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Daily distribution (Mon-Sun)
      LocationVisitModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dayOfWeek: '$timestamp' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    // Fill in missing hours/days with 0
    const hourlyDistribution = new Array(24).fill(0);
    for (const stat of hourlyStats) {
      hourlyDistribution[stat._id] = stat.count;
    }

    const dailyDistribution = new Array(7).fill(0);
    for (const stat of dailyStats) {
      // dayOfWeek returns 1 (Sunday) to 7 (Saturday)
      dailyDistribution[stat._id - 1] = stat.count;
    }

    // Summary stats
    const summary = await LocationVisitModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          avgDwellTime: { $avg: '$dwellTimeMinutes' }
        }
      }
    ]);

    const { totalVisits = 0, uniqueUsers = [], avgDwellTime = 0 } = summary[0] || {};

    return {
      zone,
      totalVisits,
      uniqueUsers: uniqueUsers.length,
      avgDwellTime: Math.round(avgDwellTime * 10) / 10,
      topLocations: locationStats.map(l => ({
        locationId: l._id.locationId,
        locationName: l._id.locationName,
        visits: l.visits
      })),
      locationTypeBreakdown: Object.fromEntries(
        typeStats.map(t => [t._id, t.count])
      ),
      hourlyDistribution,
      dailyDistribution
    };
  }

  /**
   * Get segment analytics
   */
  async getSegmentAnalytics(): Promise<UserSegmentAnalytics[]> {
    const profiles = await UserLocationProfileModel.find({
      segments: { $exists: true, $ne: [] }
    });

    const segmentStats = new Map<string, {
      userCount: number;
      totalVisits: number;
      zones: Map<string, number>;
      locationTypes: Map<string, number>;
    }>();

    for (const profile of profiles) {
      for (const segment of profile.segments) {
        const stats = segmentStats.get(segment) || {
          userCount: 0,
          totalVisits: 0,
          zones: new Map(),
          locationTypes: new Map()
        };

        stats.userCount++;
        stats.totalVisits += profile.totalVisits;

        for (const zone of profile.favoriteZones.slice(0, 3)) {
          stats.zones.set(zone, (stats.zones.get(zone) || 0) + 1);
        }

        segmentStats.set(segment, stats);
      }
    }

    // Get most common location type per segment from recent visits
    const result: UserSegmentAnalytics[] = [];

    for (const [segment, stats] of segmentStats) {
      const profilesForSegment = profiles.filter(p => p.segments.includes(segment as unknown));
      const userIds = profilesForSegment.slice(0, 50).map(p => p.userId);

      let primaryLocationType = 'other';
      if (userIds.length > 0) {
        const locationTypes = await LocationVisitModel.aggregate([
          { $match: { userId: { $in: userIds } } },
          {
            $group: {
              _id: '$locationType',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]);

        if (locationTypes.length > 0) {
          primaryLocationType = locationTypes[0]._id;
        }
      }

      const topZones = Array.from(stats.zones.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([zone]) => zone);

      result.push({
        segment,
        userCount: stats.userCount,
        avgVisitsPerUser: Math.round(stats.totalVisits / stats.userCount),
        topZones,
        primaryLocationType
      });
    }

    return result.sort((a, b) => b.userCount - a.userCount);
  }

  /**
   * Get cross-location analysis (users who visit multiple zone types)
   */
  async getCrossLocationAnalysis(options: {
    minZones?: number;
    limit?: number;
  } = {}): Promise<{
    userId: string;
    visitedZoneTypes: string[];
    totalVisits: number;
  }[]> {
    const minZones = options.minZones || 2;

    const userZoneTypes = await LocationVisitModel.aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            zoneType: '$zone'
          },
          visits: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.userId',
          visitedZoneTypes: { $push: '$_id.zoneType' },
          totalVisits: { $sum: '$visits' }
        }
      },
      {
        $match: {
          $expr: { $gte: [{ $size: '$visitedZoneTypes' }, minZones] }
        }
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          visitedZoneTypes: 1,
          totalVisits: 1
        }
      },
      { $sort: { totalVisits: -1 } },
      { $limit: options.limit || 100 }
    ]);

    return userZoneTypes;
  }

  /**
   * Get trend analysis (comparing current vs previous period)
   */
  async getTrendAnalysis(
    zone?: string,
    metrics: ('visits' | 'users' | 'dwellTime')[] = ['visits', 'users', 'dwellTime']
  ): Promise<Record<string, {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }>> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const match: Record<string, unknown> = { zone };

    const results: Record<string, { current: number; previous: number; change: number; changePercent: number }> = {};

    for (const metric of metrics) {
      // Current period
      const currentMatch = { ...match, timestamp: { $gte: dayAgo } };
      const prevMatch = { ...match, timestamp: { $gte: twoDaysAgo, $lt: dayAgo } };

      let current: number;
      let previous: number;

      if (metric === 'visits') {
        current = await LocationVisitModel.countDocuments(currentMatch);
        previous = await LocationVisitModel.countDocuments(prevMatch);
      } else if (metric === 'users') {
        current = (await LocationVisitModel.distinct('userId', currentMatch)).length;
        previous = (await LocationVisitModel.distinct('userId', prevMatch)).length;
      } else {
        const currentDocs = await LocationVisitModel.aggregate([
          { $match: { ...currentMatch, dwellTimeMinutes: { $exists: true } } },
          { $group: { _id: null, avg: { $avg: '$dwellTimeMinutes' } } }
        ]);
        const prevDocs = await LocationVisitModel.aggregate([
          { $match: { ...prevMatch, dwellTimeMinutes: { $exists: true } } },
          { $group: { _id: null, avg: { $avg: '$dwellTimeMinutes' } } }
        ]);
        current = currentDocs[0]?.avg || 0;
        previous = prevDocs[0]?.avg || 0;
      }

      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;

      results[metric] = {
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 10) / 10
      };
    }

    return results;
  }
}

export const analyticsService = new AnalyticsService();

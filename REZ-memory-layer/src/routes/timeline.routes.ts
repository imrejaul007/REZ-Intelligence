/**
 * REZ Memory Layer - Timeline Routes
 * API endpoints for timeline queries
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { timelineAggregator } from '../services/timelineAggregator';
import { TimelineEventModel } from '../models/TimelineEvent';
import { UserProfile } from '../models/UserProfile';
import { ApiResponse, TimelineEntry, UserTimeline, TimelineSummary, ActivityMetrics, EventCategory, EventSource } from '../types/timeline';
import { logger } from '../config/logger';

const router = Router();

// Query options schema
const TimelineQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sources: z.string().transform(s => s.split(',') as EventSource[]).optional(),
  categories: z.string().transform(s => s.split(',') as EventCategory[]).optional(),
  types: z.string().transform(s => s.split(',')).optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// Request ID middleware
function addRequestId(req: Request, res: Response, next: Function): void {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
}

/**
 * GET /api/timeline/:userId
 * Get user timeline
 */
router.get('/:userId', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    // Parse query options
    const queryResult = TimelineQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid query parameters',
          details: queryResult.error.errors
        },
        metadata: {
          timestamp: new Date(),
          requestId
        }
      };
      res.status(400).json(response);
      return;
    }

    const options = queryResult.data;

    // Build timeline
    const events = await timelineAggregator.buildTimeline(userId, options.limit);

    // Filter if needed
    let filteredEvents = events;
    if (options.sources) {
      filteredEvents = filteredEvents.filter(e =>
        options.sources!.includes(e.event.source)
      );
    }
    if (options.categories) {
      filteredEvents = filteredEvents.filter(e =>
        options.categories!.includes(e.event.category)
      );
    }
    if (options.types) {
      filteredEvents = filteredEvents.filter(e =>
        options.types!.includes(e.event.type)
      );
    }

    // Apply offset
    const paginatedEvents = filteredEvents.slice(
      options.offset,
      options.offset + options.limit
    );

    const response: ApiResponse<TimelineEntry[]> = {
      success: true,
      data: paginatedEvents,
      metadata: {
        timestamp: new Date(),
        requestId,
        pagination: {
          total: filteredEvents.length,
          limit: options.limit,
          offset: options.offset,
          hasMore: options.offset + options.limit < filteredEvents.length
        }
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get timeline:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve timeline'
      }
    });
  }
});

/**
 * GET /api/timeline/:userId/summary
 * Get timeline summary
 */
router.get('/:userId/summary', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    // Get event counts
    const [totalEvents, byCategory, bySource, last24h, last7d, last30d] = await Promise.all([
      TimelineEventModel.getEventCountByUserId(userId),
      TimelineEventModel.getEventCountByCategory(userId),
      TimelineEventModel.getEventCountBySource(userId),
      TimelineEventModel.getRecentActivity(userId, 24),
      TimelineEventModel.getRecentActivity(userId, 24 * 7),
      TimelineEventModel.getRecentActivity(userId, 24 * 30)
    ]);

    // Calculate percentages for categories
    const categoryStats = byCategory.map(cat => ({
      category: cat._id as EventCategory,
      count: cat.count,
      percentage: (cat.count / Math.max(totalEvents, 1)) * 100
    })).sort((a, b) => b.count - a.count);

    // Calculate percentages for sources
    const sourceStats = bySource.map(src => ({
      source: src._id as EventSource,
      count: src.count,
      percentage: (src.count / Math.max(totalEvents, 1)) * 100
    })).sort((a, b) => b.count - a.count);

    // Get recent activity
    const recentEvent = await TimelineEventModel.findOne({ userId })
      .sort({ timestamp: -1 })
      .select('timestamp');

    // Get profile for engagement info
    const profile = await UserProfile.findOne({ userId });

    // Calculate activity streak (simplified)
    const uniqueDays = await TimelineEventModel.getUniqueActiveDays(userId, 30);
    const activityStreak = uniqueDays[0]?.uniqueDays || 0;

    // Predict interests based on top categories
    const predictedInterests = categoryStats.slice(0, 5).map(c => c.category);

    const summary: TimelineSummary = {
      userId,
      totalEvents,
      eventBreakdown: {
        byCategory: Object.fromEntries(byCategory.map((c: any) => [c._id, c.count])) as any,
        bySource: Object.fromEntries(bySource.map((s: any) => [s._id, s.count])) as any,
        last24Hours: last24h,
        last7Days: last7d,
        last30Days: last30d
      },
      topCategories: categoryStats,
      topSources: sourceStats,
      recentActivity: recentEvent?.timestamp || new Date(),
      activityStreak,
      predictedInterests
    };

    const response: ApiResponse<TimelineSummary> = {
      success: true,
      data: summary,
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get timeline summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve timeline summary'
      }
    });
  }
});

/**
 * GET /api/timeline/:userId/segments
 * Get computed segments
 */
router.get('/:userId/segments', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;
    const forceRefresh = req.query.refresh === 'true';

    // Get or compute segments
    const segments = await timelineAggregator.computeSegments(userId);

    // Optionally refresh
    if (forceRefresh) {
      await timelineAggregator.updateUserProfile(userId);
      const refreshedSegments = await timelineAggregator.computeSegments(userId);

      const response: ApiResponse<typeof refreshedSegments> = {
        success: true,
        data: refreshedSegments,
        metadata: {
          timestamp: new Date(),
          requestId
        }
      };

      res.json(response);
      return;
    }

    const response: ApiResponse<typeof segments> = {
      success: true,
      data: segments,
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get segments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve segments'
      }
    });
  }
});

/**
 * GET /api/timeline/:userId/preferences
 * Get detected preferences
 */
router.get('/:userId/preferences', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    const preferences = await timelineAggregator.computePreferences(userId);

    const response: ApiResponse<typeof preferences> = {
      success: true,
      data: preferences,
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get preferences:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve preferences'
      }
    });
  }
});

/**
 * POST /api/timeline/:userId/events
 * Manual event ingestion
 */
router.post('/:userId/events', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    const EventSchema = z.object({
      type: z.string().min(1),
      category: z.enum(['commerce', 'engagement', 'identity', 'loyalty', 'intelligence', 'support', 'marketing', 'notification']),
      source: z.enum(['whatsapp', 'support', 'order', 'payment', 'loyalty', 'campaign', 'qr', 'ai', 'push', 'auth', 'catalog', 'search', 'delivery', 'booking', 'dooh']),
      data: z.record(z.unknown()).optional().default({}),
      metadata: z.object({
        sessionId: z.string().optional(),
        deviceId: z.string().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional()
      }).optional().default({}),
      timestamp: z.string().datetime().optional()
    });

    const bodyResult = EventSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EVENT',
          message: 'Invalid event data',
          details: bodyResult.error.errors
        }
      });
      return;
    }

    const eventData = bodyResult.data;
    const eventId = uuidv4();

    // Create event
    const doc = new TimelineEventModel({
      id: eventId,
      userId,
      type: eventData.type,
      category: eventData.category,
      source: eventData.source,
      timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
      data: eventData.data,
      metadata: {
        ...eventData.metadata,
        correlationId: requestId
      }
    });

    await doc.save();

    // Update user profile asynchronously
    timelineAggregator.updateUserProfile(userId).catch(err => {
      logger.error('Failed to update profile:', err);
    });

    res.status(201).json({
      success: true,
      data: {
        eventId,
        userId
      },
      metadata: {
        timestamp: new Date(),
        requestId
      }
    });
  } catch (error) {
    logger.error('Failed to ingest event:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to ingest event'
      }
    });
  }
});

/**
 * GET /api/timeline/:userId/activity
 * Get activity metrics
 */
router.get('/:userId/activity', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Get all events in period
    const events = await TimelineEventModel.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });

    // Calculate metrics
    const totalEvents = events.length;
    const uniqueDays = new Set(
      events.map(e => e.timestamp.toISOString().split('T')[0])
    ).size;
    const avgEventsPerDay = totalEvents / Math.max(uniqueDays, 1);

    // Peak activity hour
    const hourCounts = new Map<number, number>();
    for (const event of events) {
      const hour = event.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    let peakActivityHour = 0;
    let maxCount = 0;
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        peakActivityHour = hour;
      }
    }

    // Most active day
    const dayCounts = new Map<string, number>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const event of events) {
      const day = dayNames[event.timestamp.getDay()];
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
    let mostActiveDay = 'Unknown';
    maxCount = 0;
    for (const [day, count] of dayCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = day;
      }
    }

    // Category distribution
    const categoryDistribution: Record<EventCategory, number> = {
      commerce: 0,
      engagement: 0,
      identity: 0,
      loyalty: 0,
      intelligence: 0,
      support: 0,
      marketing: 0,
      notification: 0
    };
    for (const event of events) {
      categoryDistribution[event.category as EventCategory]++;
    }

    // Engagement score (simplified)
    const engagementScore = Math.min(100, (totalEvents / days) * 5);

    // Purchase frequency
    const orderEvents = events.filter(e => e.type.includes('order'));
    const purchaseFrequency = orderEvents.length / Math.max(days / 30, 1);

    const metrics: ActivityMetrics = {
      userId,
      period: { start: startDate, end: endDate },
      metrics: {
        totalEvents,
        uniqueDays,
        avgEventsPerDay: Math.round(avgEventsPerDay * 100) / 100,
        peakActivityHour,
        mostActiveDay,
        categoryDistribution,
        engagementScore: Math.round(engagementScore * 100) / 100,
        purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
        averageSessionDuration: 0 // Would need session data to calculate
      }
    };

    const response: ApiResponse<ActivityMetrics> = {
      success: true,
      data: metrics,
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get activity metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve activity metrics'
      }
    });
  }
});

/**
 * GET /api/timeline/:userId/full
 * Get complete user timeline with segments and preferences
 */
router.get('/:userId/full', addRequestId, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestId = req.headers['x-request-id'] as string;

    const timeline = await timelineAggregator.buildUserTimeline(userId);

    const response: ApiResponse<UserTimeline> = {
      success: true,
      data: timeline,
      metadata: {
        timestamp: new Date(),
        requestId
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get full timeline:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve full timeline'
      }
    });
  }
});

export default router;

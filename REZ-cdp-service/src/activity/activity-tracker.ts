import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

/**
 * Activity types
 */
export type ActivityType =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'purchase'
  | 'search'
  | 'login'
  | 'logout'
  | 'signup'
  | 'email_open'
  | 'email_click'
  | 'app_open'
  | 'custom';

/**
 * Activity channel
 */
export type ActivityChannel = 'web' | 'mobile' | 'email' | 'api' | 'offline';

/**
 * Activity entity
 */
export interface Activity {
  id: string;
  profileId: string;
  type: ActivityType;
  channel: ActivityChannel;
  timestamp: string;
  sessionId?: string;
  eventName?: string;
  properties: Record<string, unknown>;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    referrer?: string;
    url?: string;
  };
  revenue?: {
    amount: number;
    currency: string;
  };
  duration?: number;
  tags?: string[];
}

/**
 * Activity query options
 */
export interface ActivityQuery {
  startDate?: string;
  endDate?: string;
  type?: ActivityType;
  channel?: ActivityChannel;
  limit?: number;
  offset?: number;
  sessionId?: string;
  tags?: string[];
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  date: string;
  activities: Activity[];
  summary: {
    totalEvents: number;
    totalRevenue: number;
    uniqueChannels: ActivityChannel[];
    topTypes: Array<{ type: ActivityType; count: number }>;
  };
}

/**
 * Activity aggregation
 */
export interface ActivityAggregation {
  total: number;
  byType: Record<ActivityType, number>;
  byChannel: Record<ActivityChannel, number>;
  totalRevenue: number;
  averagePerDay: number;
  peakHour?: { hour: number; count: number };
}

/**
 * Activity Tracker - Track and query customer activities
 */
export class ActivityTracker {
  private activities: Map<string, Activity> = new Map();
  private profileActivities: Map<string, Set<string>> = new Map();
  private sessionActivities: Map<string, Set<string>> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeSampleActivities();
  }

  /**
   * Initialize with sample activity data
   */
  private initializeSampleActivities(): void {
    const sampleActivities: Activity[] = [
      {
        id: 'act_001',
        profileId: 'prof_001',
        type: 'page_view',
        channel: 'web',
        timestamp: new Date('2024-06-10T10:30:00Z').toISOString(),
        sessionId: 'sess_001',
        eventName: 'Home Page View',
        properties: {
          page: '/',
          title: 'Home',
          duration: 45
        },
        metadata: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          url: 'https://example.com/',
          referrer: 'https://google.com'
        }
      },
      {
        id: 'act_002',
        profileId: 'prof_001',
        type: 'purchase',
        channel: 'web',
        timestamp: new Date('2024-06-10T11:15:00Z').toISOString(),
        sessionId: 'sess_001',
        eventName: 'Order Completed',
        properties: {
          orderId: 'ORD-12345',
          items: [
            { productId: 'prod_001', name: 'Product A', quantity: 2, price: 29.99 },
            { productId: 'prod_002', name: 'Product B', quantity: 1, price: 49.99 }
          ]
        },
        metadata: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          url: 'https://example.com/checkout/confirmation'
        },
        revenue: {
          amount: 109.97,
          currency: 'USD'
        }
      },
      {
        id: 'act_003',
        profileId: 'prof_001',
        type: 'email_open',
        channel: 'email',
        timestamp: new Date('2024-06-09T09:00:00Z').toISOString(),
        eventName: 'Newsletter Open',
        properties: {
          campaignId: 'camp_001',
          campaignName: 'June Newsletter'
        },
        metadata: {}
      },
      {
        id: 'act_004',
        profileId: 'prof_002',
        type: 'app_open',
        channel: 'mobile',
        timestamp: new Date('2024-06-08T08:30:00Z').toISOString(),
        sessionId: 'sess_002',
        properties: {
          appVersion: '2.1.0',
          platform: 'iOS'
        },
        metadata: {
          location: {
            country: 'US',
            region: 'NY',
            city: 'New York'
          }
        }
      },
      {
        id: 'act_005',
        profileId: 'prof_002',
        type: 'search',
        channel: 'mobile',
        timestamp: new Date('2024-06-08T08:32:00Z').toISOString(),
        sessionId: 'sess_002',
        properties: {
          query: 'summer dress',
          resultsCount: 42,
          filters: {
            category: 'clothing',
            priceRange: '50-100'
          }
        },
        metadata: {}
      }
    ];

    sampleActivities.forEach(activity => {
      this.activities.set(activity.id, activity);
      this.addToProfileIndex(activity);
      if (activity.sessionId) {
        this.addToSessionIndex(activity);
      }
    });

    this.logger.info('Activity tracker initialized with sample data', { count: sampleActivities.length });
  }

  /**
   * Add activity to profile index
   */
  private addToProfileIndex(activity: Activity): void {
    if (!this.profileActivities.has(activity.profileId)) {
      this.profileActivities.set(activity.profileId, new Set());
    }
    this.profileActivities.get(activity.profileId)!.add(activity.id);
  }

  /**
   * Add activity to session index
   */
  private addToSessionIndex(activity: Activity): void {
    if (!this.sessionActivities.has(activity.sessionId!)) {
      this.sessionActivities.set(activity.sessionId!, new Set());
    }
    this.sessionActivities.get(activity.sessionId!)!.add(activity.id);
  }

  /**
   * Track a single activity
   */
  async track(data: {
    profileId: string;
    type: ActivityType;
    channel?: ActivityChannel;
    sessionId?: string;
    eventName?: string;
    properties?: Record<string, unknown>;
    metadata?: Activity['metadata'];
    revenue?: { amount: number; currency: string };
    duration?: number;
    tags?: string[];
    timestamp?: string;
  }): Promise<Activity> {
    const id = `act_${uuidv4().slice(0, 8)}`;

    const activity: Activity = {
      id,
      profileId: data.profileId,
      type: data.type,
      channel: data.channel || 'web',
      timestamp: data.timestamp || new Date().toISOString(),
      sessionId: data.sessionId,
      eventName: data.eventName,
      properties: data.properties || {},
      metadata: data.metadata || {},
      revenue: data.revenue,
      duration: data.duration,
      tags: data.tags
    };

    this.activities.set(id, activity);
    this.addToProfileIndex(activity);
    if (activity.sessionId) {
      this.addToSessionIndex(activity);
    }

    this.logger.info('Activity tracked', {
      id,
      profileId: data.profileId,
      type: data.type
    });

    return activity;
  }

  /**
   * Track multiple activities (batch)
   */
  async trackBatch(activities: Activity[]): Promise<{
    successful: number;
    failed: number;
    activities: Activity[];
    errors: string[];
  }> {
    const results: {
      successful: number;
      failed: number;
      activities: Activity[];
      errors: string[];
    } = {
      successful: 0,
      failed: 0,
      activities: [],
      errors: []
    };

    for (const data of activities) {
      try {
        const activity = await this.track({
          profileId: data.profileId,
          type: data.type,
          channel: data.channel,
          sessionId: data.sessionId,
          eventName: data.eventName,
          properties: data.properties,
          metadata: data.metadata,
          revenue: data.revenue,
          duration: data.duration,
          tags: data.tags,
          timestamp: data.timestamp
        });
        results.activities.push(activity);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to track activity: ${error}`);
      }
    }

    this.logger.info('Batch activities tracked', {
      successful: results.successful,
      failed: results.failed
    });

    return results;
  }

  /**
   * Get activities for a profile
   */
  async getActivities(profileId: string, options?: ActivityQuery): Promise<Activity[]> {
    const activityIds = this.profileActivities.get(profileId);
    if (!activityIds) {
      return [];
    }

    let activities = Array.from(activityIds)
      .map(id => this.activities.get(id))
      .filter((a): a is Activity => a !== undefined);

    // Apply filters
    if (options?.startDate) {
      activities = activities.filter(a => a.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      activities = activities.filter(a => a.timestamp <= options.endDate!);
    }
    if (options?.type) {
      activities = activities.filter(a => a.type === options.type);
    }
    if (options?.channel) {
      activities = activities.filter(a => a.channel === options.channel);
    }
    if (options?.sessionId) {
      activities = activities.filter(a => a.sessionId === options.sessionId);
    }
    if (options?.tags && options.tags.length > 0) {
      activities = activities.filter(a =>
        a.tags?.some(t => options.tags!.includes(t))
      );
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return activities.slice(offset, offset + limit);
  }

  /**
   * Get activity timeline for a profile
   */
  async getTimeline(profileId: string, options?: {
    days?: number;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{
    profileId: string;
    startDate: string;
    endDate: string;
    events: TimelineEvent[];
    summary: {
      totalActivities: number;
      totalRevenue: number;
      mostActiveDay: string;
      topActivities: Array<{ type: ActivityType; count: number }>;
    };
  }> {
    const days = options?.days || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const activities = await this.getActivities(profileId, {
      startDate,
      endDate,
      limit: 1000
    });

    // Group activities by day
    const groupedByDate = new Map<string, Activity[]>();
    for (const activity of activities) {
      const date = activity.timestamp.split('T')[0];
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)!.push(activity);
    }

    // Create timeline events
    const events: TimelineEvent[] = [];
    let totalRevenue = 0;
    const activityTypeCount = new Map<ActivityType, number>();

    for (const [date, dayActivities] of groupedByDate) {
      const byType = new Map<ActivityType, number>();
      const channels = new Set<ActivityChannel>();

      for (const activity of dayActivities) {
        byType.set(activity.type, (byType.get(activity.type) || 0) + 1);
        channels.add(activity.channel);
        if (activity.revenue) {
          totalRevenue += activity.revenue.amount;
        }
        activityTypeCount.set(activity.type, (activityTypeCount.get(activity.type) || 0) + 1);
      }

      events.push({
        date,
        activities: dayActivities,
        summary: {
          totalEvents: dayActivities.length,
          totalRevenue: dayActivities.reduce((sum, a) => sum + (a.revenue?.amount || 0), 0),
          uniqueChannels: Array.from(channels),
          topTypes: Array.from(byType.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
        }
      });
    }

    // Sort events by date
    events.sort((a, b) => b.date.localeCompare(a.date));

    // Find most active day
    let mostActiveDay = events[0]?.date || '';
    let maxActivities = 0;
    for (const event of events) {
      if (event.summary.totalEvents > maxActivities) {
        maxActivities = event.summary.totalEvents;
        mostActiveDay = event.date;
      }
    }

    return {
      profileId,
      startDate,
      endDate,
      events,
      summary: {
        totalActivities: activities.length,
        totalRevenue,
        mostActiveDay,
        topActivities: Array.from(activityTypeCount.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      }
    };
  }

  /**
   * Get session activities
   */
  async getSessionActivities(sessionId: string): Promise<Activity[]> {
    const activityIds = this.sessionActivities.get(sessionId);
    if (!activityIds) {
      return [];
    }

    return Array.from(activityIds)
      .map(id => this.activities.get(id))
      .filter((a): a is Activity => a !== undefined)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get activity aggregation for a profile
   */
  async getAggregation(profileId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ActivityAggregation> {
    const activities = await this.getActivities(profileId, {
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: 10000
    });

    const byType: Record<ActivityType, number> = {} as Record<ActivityType, number>;
    const byChannel: Record<ActivityChannel, number> = {} as Record<ActivityChannel, number>;
    let totalRevenue = 0;
    const hourCounts = new Map<number, number>();

    for (const activity of activities) {
      byType[activity.type] = (byType[activity.type] || 0) + 1;
      byChannel[activity.channel] = (byChannel[activity.channel] || 0) + 1;
      if (activity.revenue) {
        totalRevenue += activity.revenue.amount;
      }

      const hour = new Date(activity.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find peak hour
    let peakHour: { hour: number; count: number } | undefined;
    for (const [hour, count] of hourCounts) {
      if (!peakHour || count > peakHour.count) {
        peakHour = { hour, count };
      }
    }

    // Calculate average per day
    const startDate = options?.startDate
      ? new Date(options.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options?.endDate ? new Date(options.endDate) : new Date();
    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      total: activities.length,
      byType,
      byChannel,
      totalRevenue,
      averagePerDay: activities.length / days,
      peakHour
    };
  }

  /**
   * Delete activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    const activity = this.activities.get(activityId);
    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    // Remove from profile index
    const profileSet = this.profileActivities.get(activity.profileId);
    if (profileSet) {
      profileSet.delete(activityId);
    }

    // Remove from session index
    if (activity.sessionId) {
      const sessionSet = this.sessionActivities.get(activity.sessionId);
      if (sessionSet) {
        sessionSet.delete(activityId);
      }
    }

    this.activities.delete(activityId);
    this.logger.info('Activity deleted', { id: activityId });
  }

  /**
   * Delete all activities for a profile
   */
  async deleteProfileActivities(profileId: string): Promise<number> {
    const activityIds = this.profileActivities.get(profileId);
    if (!activityIds) {
      return 0;
    }

    let count = 0;
    for (const activityId of activityIds) {
      const activity = this.activities.get(activityId);
      if (activity) {
        // Remove from session index
        if (activity.sessionId) {
          const sessionSet = this.sessionActivities.get(activity.sessionId);
          if (sessionSet) {
            sessionSet.delete(activityId);
          }
        }
        this.activities.delete(activityId);
        count++;
      }
    }

    this.profileActivities.delete(profileId);
    this.logger.info('Profile activities deleted', { profileId, count });

    return count;
  }

  /**
   * Get activity count for a profile
   */
  async getActivityCount(profileId: string): Promise<number> {
    return this.profileActivities.get(profileId)?.size || 0;
  }

  /**
   * Get last activity for a profile
   */
  async getLastActivity(profileId: string): Promise<Activity | null> {
    const activities = await this.getActivities(profileId, { limit: 1 });
    return activities[0] || null;
  }

  /**
   * Search activities by property value
   */
  async searchActivities(profileId: string, searchTerm: string): Promise<Activity[]> {
    const activities = await this.getActivities(profileId, { limit: 1000 });
    const lowerSearch = searchTerm.toLowerCase();

    return activities.filter(activity => {
      // Search in properties
      const propertiesStr = JSON.stringify(activity.properties).toLowerCase();
      if (propertiesStr.includes(lowerSearch)) return true;

      // Search in event name
      if (activity.eventName?.toLowerCase().includes(lowerSearch)) return true;

      // Search in tags
      if (activity.tags?.some(t => t.toLowerCase().includes(lowerSearch))) return true;

      return false;
    });
  }

  /**
   * Get recent activities across all profiles
   */
  async getRecentActivities(limit: number = 50): Promise<Activity[]> {
    const allActivities = Array.from(this.activities.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return allActivities.slice(0, limit);
  }
}

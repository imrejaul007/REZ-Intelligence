/**
 * REZ Memory Layer - Timeline Aggregator
 * Aggregate events, compute segments, detect preferences
 */

import { TimelineEvent, TimelineEntry, UserTimeline, ComputedSegment, ComputedPreferences, BehavioralPattern, CategoryPreference, BrandPreference, ChannelPreference, TimePattern } from '../types/timeline';
import { cacheService } from './cacheService';
import { enrichmentEngine } from './enrichmentEngine';
import { UserProfile, IUserProfileDocument } from '../models/UserProfile';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { logger } from '../config/logger';

export class TimelineAggregator {
  private readonly logger = logger;

  /**
   * Build a complete timeline for a user
   */
  async buildTimeline(userId: string, limit: number = 100): Promise<TimelineEntry[]> {
    // Try cache first
    const cached = await cacheService.getCachedTimeline(userId);
    if (cached && cached.length > 0) {
      this.logger.debug(`Cache hit for timeline ${userId}`);
      return cached.slice(0, limit);
    }

    // Fetch from MongoDB
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
    const events = await TimelineEventModel.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 }).limit(limit);

    // Convert to timeline entries with enrichments
    const entries = await this.buildTimelineEntries(events);

    // Cache the results
    await cacheService.cacheTimeline(userId, entries);

    return entries;
  }

  /**
   * Build timeline entries from events with enrichments
   */
  private async buildTimelineEntries(events: TimelineEventModel[]): Promise<TimelineEntry[]> {
    const entries: TimelineEntry[] = [];

    for (const event of events) {
      // Enrich event
      const enrichments = await enrichmentEngine.enrichEvent(this.modelToEvent(event));

      // Generate tags
      const tags = this.generateTags(event);

      // Calculate score (recency + importance)
      const score = this.calculateEventScore(event);

      entries.push({
        event: this.modelToEvent(event),
        enrichments,
        tags,
        score
      });
    }

    return entries;
  }

  /**
   * Convert MongoDB model to TimelineEvent
   */
  private modelToEvent(model: TimelineEventModel): TimelineEvent {
    return {
      id: model.id,
      userId: model.userId,
      type: model.type,
      category: model.category as TimelineEvent['category'],
      source: model.source as TimelineEvent['source'],
      timestamp: model.timestamp,
      data: model.data as Record<string, unknown>,
      metadata: model.metadata
    };
  }

  /**
   * Generate tags for an event
   */
  private generateTags(event: TimelineEventModel): string[] {
    const tags: string[] = [];

    // Add category tag
    tags.push(`category:${event.category}`);

    // Add source tag
    tags.push(`source:${event.source}`);

    // Add time-based tags
    const hour = event.timestamp.getHours();
    if (hour >= 6 && hour < 12) tags.push('time:morning');
    else if (hour >= 12 && hour < 17) tags.push('time:afternoon');
    else if (hour >= 17 && hour < 21) tags.push('time:evening');
    else tags.push('time:night');

    // Add day-based tags
    const day = event.timestamp.getDay();
    if (day === 0 || day === 6) tags.push('time:weekend');
    else tags.push('time:weekday');

    // Add event-type specific tags
    const typeLower = event.type.toLowerCase();
    if (typeLower.includes('purchase') || typeLower.includes('order')) {
      tags.push('intent:purchase');
    }
    if (typeLower.includes('view') || typeLower.includes('browse')) {
      tags.push('intent:browse');
    }
    if (typeLower.includes('cart') || typeLower.includes('add')) {
      tags.push('intent:consider');
    }

    return tags;
  }

  /**
   * Calculate importance score for an event
   */
  private calculateEventScore(event: TimelineEventModel): number {
    let score = 50; // Base score

    // Recency boost (0-30 points)
    const ageHours = (Date.now() - event.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours < 1) score += 30;
    else if (ageHours < 24) score += 20;
    else if (ageHours < 168) score += 10; // 1 week

    // Commerce events are more important
    if (event.category === 'commerce') score += 15;

    // Engagement events get medium boost
    if (event.category === 'engagement') score += 5;

    // Order completed is very important
    if (event.type === 'order_completed' || event.type === 'order_placed') {
      score += 20;
    }

    // Payment is important
    if (event.type.includes('payment')) score += 10;

    return Math.min(100, score);
  }

  /**
   * Compute segments for a user based on their events
   */
  async computeSegments(userId: string): Promise<ComputedSegment[]> {
    // Try cache first
    const cached = await cacheService.getCachedSegments(userId);
    if (cached) {
      return cached;
    }

    // Fetch recent events
    const events = await TimelineEventModel.findByUserId(userId, {
      limit: 1000,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const segments: ComputedSegment[] = [];
    const categoryCount: Record<string, number> = {};
    const sourceCount: Record<string, number> = {};
    const eventTypes: Set<string> = new Set();

    // Analyze events
    for (const event of events) {
      const category = event.category;
      const source = event.source;

      categoryCount[category] = (categoryCount[category] || 0) + 1;
      sourceCount[source] = (sourceCount[source] || 0) + 1;
      eventTypes.add(event.type);
    }

    const totalEvents = events.length || 1;

    // High-value customer segment
    const commerceCount = categoryCount['commerce'] || 0;
    if (commerceCount >= 10) {
      segments.push({
        segmentId: 'high_value',
        segmentName: 'High Value Customer',
        confidence: Math.min(1, commerceCount / 50),
        lastTriggered: new Date(),
        triggers: ['frequent_purchases', 'order_completed']
      });
    }

    // Engaged user segment
    const engagementCount = categoryCount['engagement'] || 0;
    if (engagementCount >= 20) {
      segments.push({
        segmentId: 'highly_engaged',
        segmentName: 'Highly Engaged',
        confidence: Math.min(1, engagementCount / 100),
        lastTriggered: new Date(),
        triggers: ['frequent_interactions']
      });
    }

    // Omnichannel user segment
    const sourceCountKeys = Object.keys(sourceCount).length;
    if (sourceCountKeys >= 5) {
      segments.push({
        segmentId: 'omnichannel',
        segmentName: 'Omnichannel User',
        confidence: Math.min(1, sourceCountKeys / 10),
        lastTriggered: new Date(),
        triggers: Object.keys(sourceCount)
      });
    }

    // AI Power User
    const aiCount = sourceCount['ai'] || 0;
    if (aiCount >= 5) {
      segments.push({
        segmentId: 'ai_power_user',
        segmentName: 'AI Power User',
        confidence: Math.min(1, aiCount / 20),
        lastTriggered: new Date(),
        triggers: ['ai_interactions']
      });
    }

    // Loyalty Champion
    const loyaltyCount = categoryCount['loyalty'] || 0;
    if (loyaltyCount >= 10) {
      segments.push({
        segmentId: 'loyalty_champion',
        segmentName: 'Loyalty Champion',
        confidence: Math.min(1, loyaltyCount / 30),
        lastTriggered: new Date(),
        triggers: ['points_earned', 'rewards_redeemed']
      });
    }

    // Category-based segments
    for (const [category, count] of Object.entries(categoryCount)) {
      const percentage = count / totalEvents;
      if (percentage > 0.5) {
        segments.push({
          segmentId: `prefers_${category}`,
          segmentName: `Prefers ${category}`,
          confidence: percentage,
          lastTriggered: new Date(),
          triggers: [`high_${category}_activity`]
        });
      }
    }

    // Cache segments
    await cacheService.cacheSegments(userId, segments);

    return segments;
  }

  /**
   * Compute preferences for a user
   */
  async computePreferences(userId: string): Promise<ComputedPreferences> {
    // Try cache first
    const cached = await cacheService.getCachedPreferences(userId);
    if (cached) {
      return cached;
    }

    // Fetch recent events
    const events = await TimelineEventModel.findByUserId(userId, {
      limit: 500,
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    });

    const preferences: ComputedPreferences = {
      categories: [],
      brands: [],
      priceRanges: [],
      channels: [],
      timePatterns: []
    };

    // Category preferences
    const categoryMap = new Map<string, { count: number; lastInteraction: Date }>();
    const brandMap = new Map<string, { count: number; total: number }>();
    const channelMap = new Map<string, number>();
    const hourMap = new Map<number, number>();

    // Process events
    for (const event of events) {
      // Category
      const existing = categoryMap.get(event.category) || { count: 0, lastInteraction: new Date(0) };
      existing.count += 1;
      if (event.timestamp > existing.lastInteraction) {
        existing.lastInteraction = event.timestamp;
      }
      categoryMap.set(event.category, existing);

      // Channel (source)
      channelMap.set(event.source, (channelMap.get(event.source) || 0) + 1);

      // Time patterns
      const hour = event.timestamp.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

      // Extract data-specific preferences
      const data = event.data as Record<string, unknown>;

      if (data.category || data.productCategory) {
        const cat = String(data.category || data.productCategory);
        const catExisting = categoryMap.get(cat) || { count: 0, lastInteraction: new Date(0) };
        catExisting.count += 1;
        catExisting.lastInteraction = event.timestamp;
        categoryMap.set(cat, catExisting);
      }

      if (data.brand) {
        const brand = String(data.brand);
        const brandExisting = brandMap.get(brand) || { count: 0, total: 0 };
        brandExisting.count += 1;
        brandExisting.total += Number(data.price || 0);
        brandMap.set(brand, brandExisting);
      }

      if (data.amount || data.total) {
        const amount = Number(data.amount || data.total);
        if (amount > 0) {
          const range = this.getPriceRange(amount);
          const rangeExisting = brandMap.get(range) || { count: 0, total: 0 };
          rangeExisting.count += 1;
          rangeExisting.total += amount;
          brandMap.set(range, rangeExisting);
        }
      }
    }

    // Convert category map to preferences
    const totalCategoryEvents = Array.from(categoryMap.values()).reduce((sum, v) => sum + v.count, 0);
    for (const [category, data] of categoryMap.entries()) {
      preferences.categories.push({
        category,
        score: data.count / Math.max(totalCategoryEvents, 1),
        eventCount: data.count,
        lastInteraction: data.lastInteraction
      });
    }

    // Sort by score
    preferences.categories.sort((a, b) => b.score - a.score);
    preferences.categories = preferences.categories.slice(0, 10); // Top 10

    // Brand preferences
    for (const [brand, data] of brandMap.entries()) {
      if (brand.startsWith('₹') || /^\d+-\d+$/.test(brand)) {
        // It's a price range
        preferences.priceRanges.push({
          range: brand,
          score: data.count / Math.max(events.length, 1),
          percentage: (data.count / Math.max(events.length, 1)) * 100
        });
      } else {
        // It's a brand
        preferences.brands.push({
          brand,
          score: data.count / Math.max(events.length, 1),
          purchaseCount: data.count,
          avgOrderValue: data.total / Math.max(data.count, 1)
        });
      }
    }

    preferences.brands.sort((a, b) => b.score - a.score);
    preferences.brands = preferences.brands.slice(0, 10);

    preferences.priceRanges.sort((a, b) => b.percentage - a.percentage);
    preferences.priceRanges = preferences.priceRanges.slice(0, 5);

    // Channel preferences
    const totalChannelEvents = Array.from(channelMap.values()).reduce((sum, v) => sum + v, 0);
    for (const [channel, count] of channelMap.entries()) {
      preferences.channels.push({
        channel,
        score: count / Math.max(totalChannelEvents, 1),
        interactionCount: count
      });
    }

    preferences.channels.sort((a, b) => b.score - a.score);

    // Time patterns
    const maxHourCount = Math.max(...Array.from(hourMap.values()), 1);

    const timePatternMap = new Map<string, { score: number; peakHour?: number }>();

    // Morning (6-12)
    const morningHours = [6, 7, 8, 9, 10, 11];
    const morningCount = morningHours.reduce((sum, h) => sum + (hourMap.get(h) || 0), 0);
    if (morningCount > 0) {
      timePatternMap.set('morning', {
        score: morningCount / Math.max(events.length, 1),
        peakHour: this.getPeakHour(morningHours, hourMap)
      });
    }

    // Afternoon (12-17)
    const afternoonHours = [12, 13, 14, 15, 16];
    const afternoonCount = afternoonHours.reduce((sum, h) => sum + (hourMap.get(h) || 0), 0);
    if (afternoonCount > 0) {
      timePatternMap.set('afternoon', {
        score: afternoonCount / Math.max(events.length, 1),
        peakHour: this.getPeakHour(afternoonHours, hourMap)
      });
    }

    // Evening (17-21)
    const eveningHours = [17, 18, 19, 20];
    const eveningCount = eveningHours.reduce((sum, h) => sum + (hourMap.get(h) || 0), 0);
    if (eveningCount > 0) {
      timePatternMap.set('evening', {
        score: eveningCount / Math.max(events.length, 1),
        peakHour: this.getPeakHour(eveningHours, hourMap)
      });
    }

    // Night (21-6)
    const nightHours = [21, 22, 23, 0, 1, 2, 3, 4, 5];
    const nightCount = nightHours.reduce((sum, h) => sum + (hourMap.get(h) || 0), 0);
    if (nightCount > 0) {
      timePatternMap.set('night', {
        score: nightCount / Math.max(events.length, 1),
        peakHour: this.getPeakHour(nightHours, hourMap)
      });
    }

    for (const [pattern, data] of timePatternMap.entries()) {
      preferences.timePatterns.push({
        pattern: pattern as TimePattern['pattern'],
        score: data.score,
        peakHour: data.peakHour
      });
    }

    preferences.timePatterns.sort((a, b) => b.score - a.score);

    // Cache preferences
    await cacheService.cachePreferences(userId, preferences);

    return preferences;
  }

  /**
   * Get price range string from amount
   */
  private getPriceRange(amount: number): string {
    if (amount <= 100) return '₹0-100';
    if (amount <= 500) return '₹101-500';
    if (amount <= 1000) return '₹501-1000';
    if (amount <= 2500) return '₹1001-2500';
    if (amount <= 5000) return '₹2501-5000';
    return '₹5000+';
  }

  /**
   * Get peak hour from a list of hours
   */
  private getPeakHour(hours: number[], hourMap: Map<number, number>): number {
    let peakHour = hours[0];
    let maxCount = 0;

    for (const hour of hours) {
      const count = hourMap.get(hour) || 0;
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    }

    return peakHour;
  }

  /**
   * Build complete user timeline
   */
  async buildUserTimeline(userId: string): Promise<UserTimeline> {
    const [events, segments, preferences, patterns] = await Promise.all([
      this.buildTimeline(userId, 100),
      this.computeSegments(userId),
      this.computePreferences(userId),
      this.detectBehavioralPatterns(userId)
    ]);

    return {
      userId,
      events,
      computedSegments: segments,
      computedPreferences: preferences,
      behavioralPatterns: patterns,
      lastUpdated: new Date(),
      eventCount: events.length
    };
  }

  /**
   * Detect behavioral patterns
   */
  async detectBehavioralPatterns(userId: string): Promise<BehavioralPattern[]> {
    const events = await TimelineEventModel.findByUserId(userId, {
      limit: 500,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const patterns: BehavioralPattern[] = [];

    // Analyze purchase patterns
    const orderEvents = events.filter(e => e.type.includes('order'));
    if (orderEvents.length >= 3) {
      patterns.push({
        patternId: 'regular_buyer',
        patternType: 'purchase_frequency',
        description: 'Makes regular purchases',
        confidence: Math.min(1, orderEvents.length / 10),
        occurrences: orderEvents.length,
        lastObserved: orderEvents[0]?.timestamp || new Date()
      });
    }

    // Analyze time patterns
    const hourCounts = new Map<number, number>();
    for (const event of events) {
      const hour = event.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find peak hours
    const sortedHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedHours.length > 0) {
      const [peakHour] = sortedHours[0];
      const peakPercentage = sortedHours[0][1] / events.length;

      if (peakPercentage > 0.3) {
        let timeOfDay: string;
        if (peakHour >= 6 && peakHour < 12) timeOfDay = 'morning';
        else if (peakHour >= 12 && peakHour < 17) timeOfDay = 'afternoon';
        else if (peakHour >= 17 && peakHour < 21) timeOfDay = 'evening';
        else timeOfDay = 'night';

        patterns.push({
          patternId: `${timeOfDay}_shopper`,
          patternType: 'time_preference',
          description: `Most active during ${timeOfDay}`,
          confidence: peakPercentage,
          occurrences: sortedHours[0][1],
          lastObserved: new Date()
        });
      }
    }

    return patterns;
  }

  /**
   * Update user profile with computed data
   */
  async updateUserProfile(userId: string): Promise<IUserProfileDocument> {
    const [segments, preferences, patterns, eventCount, lastEvent] = await Promise.all([
      this.computeSegments(userId),
      this.computePreferences(userId),
      this.detectBehavioralPatterns(userId),
      TimelineEventModel.getEventCountByUserId(userId),
      TimelineEventModel.findOne({ userId }).sort({ timestamp: -1 }).select('timestamp')
    ]);

    const profile = await UserProfile.findOrCreateByUserId(userId);

    profile.segments = segments;
    profile.preferences = preferences;
    profile.behavioralPatterns = patterns;
    profile.eventCount = eventCount;
    profile.lastEventTimestamp = lastEvent?.timestamp || null;
    profile.lastComputed = new Date();

    // Calculate engagement score
    profile.engagementScore = this.calculateEngagementScore(profile);

    await profile.save();

    return profile;
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(profile: IUserProfileDocument): number {
    let score = 0;

    // Event count (max 30 points)
    score += Math.min(30, profile.eventCount / 10);

    // Segment diversity (max 20 points)
    score += Math.min(20, profile.segments.length * 5);

    // Category breadth (max 25 points)
    score += Math.min(25, profile.preferences.categories.length * 3);

    // Recency (max 25 points)
    if (profile.lastEventTimestamp) {
      const daysSinceLastEvent = (Date.now() - profile.lastEventTimestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastEvent < 1) score += 25;
      else if (daysSinceLastEvent < 7) score += 20;
      else if (daysSinceLastEvent < 30) score += 10;
    }

    return Math.round(score);
  }
}

export const timelineAggregator = new TimelineAggregator();

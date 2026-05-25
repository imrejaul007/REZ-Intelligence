/**
 * REZ Memory Layer - Timeline Aggregator
 * Aggregate events, compute segments, detect preferences
 */

import { cacheService } from './cacheService';
import { enrichmentEngine } from './enrichmentEngine';
import { UserProfile } from '../models/UserProfile';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { logger } from '../config/logger';

export class TimelineAggregator {
  private readonly logger = logger;

  async buildTimeline(userId: string, limit: number = 100): Promise<unknown[]> {
    const cached = await cacheService.getCachedTimeline(userId);
    if (cached && cached.length > 0) {
      this.logger.debug(`Cache hit for timeline ${userId}`);
      return cached.slice(0, limit);
    }

    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const events = await TimelineEventModel.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 }).limit(limit);

    const entries = await this.buildTimelineEntries(events);
    await cacheService.cacheTimeline(userId, entries);
    return entries;
  }

  private async buildTimelineEntries(events: unknown[]): Promise<unknown[]> {
    const entries: unknown[] = [];
    for (const event of events) {
      const enrichments = await enrichmentEngine.enrichEvent(event);
      const tags = this.generateTags(event);
      const score = this.calculateEventScore(event);
      entries.push({ event, enrichments, tags, score });
    }
    return entries;
  }

  private generateTags(event): string[] {
    const tags: string[] = [];
    if (event.category === 'commerce') tags.push('commerce');
    if (event.category === 'engagement') tags.push('engagement');
    if (event.type?.includes('order')) tags.push('order');
    if (event.type?.includes('payment')) tags.push('payment');
    return tags;
  }

  private calculateEventScore(event): number {
    let score = 50;
    if (event.category === 'commerce') score += 20;
    const hoursOld = (Date.now() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24) score += 20;
    else if (hoursOld < 168) score += 10;
    return Math.min(100, score);
  }

  async computeSegments(userId: string): Promise<unknown[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await TimelineEventModel.find({ userId, timestamp: { $gte: thirtyDaysAgo } });
    const segments: unknown[] = [];
    const categoryCounts: Record<string, number> = {};
    for (const event of events) {
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
    }
    if (categoryCounts.commerce > 10) segments.push({ segmentId: 'active_shopper', segmentName: 'Active Shopper', confidence: 0.8, lastTriggered: new Date(), triggers: [] });
    if (categoryCounts.loyalty > 5) segments.push({ segmentId: 'loyal_user', segmentName: 'Loyal User', confidence: 0.7, lastTriggered: new Date(), triggers: [] });
    return segments;
  }

  async computePreferences(userId: string): Promise<unknown> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const events = await TimelineEventModel.find({ userId, timestamp: { $gte: sixtyDaysAgo } });
    const preferences: unknown = { categories: [], brands: [], priceRanges: [], channels: [], timePatterns: [] };
    const categoryCount: Record<string, number> = {};
    for (const event of events) {
      categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
    }
    const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [cat, count] of sorted) {
      preferences.categories.push({ category: cat, score: count, eventCount: count, lastInteraction: new Date() });
    }
    preferences.channels.push({ channel: 'whatsapp', score: 100 });
    return preferences;
  }
}

export const timelineAggregator = new TimelineAggregator();

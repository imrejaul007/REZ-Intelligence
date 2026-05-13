import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, AnalyticsResult } from '../types';
export interface TrackEventOptions {
    event: string;
    data?: Record<string, unknown>;
    userId?: string;
    sessionId?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
}
export interface UserPropertyUpdate {
    userId: string;
    properties: Record<string, unknown>;
    timestamp?: string;
}
export interface ConversionEvent {
    event: string;
    userId?: string;
    sessionId?: string;
    value?: number;
    currency?: string;
    properties?: Record<string, unknown>;
}
export interface AnalyticsQuery {
    event: string;
    fromDate: string;
    toDate: string;
    filters?: Record<string, unknown>;
    groupBy?: string;
    aggregation?: 'count' | 'sum' | 'average' | 'min' | 'max';
}
export interface AnalyticsQueryResult {
    event: string;
    results: {
        date: string;
        value: number;
    }[];
    total: number;
    aggregation: string;
}
export interface FunnelStep {
    event: string;
    name: string;
}
export interface FunnelResult {
    funnelId: string;
    steps: {
        event: string;
        name: string;
        users: number;
        conversionRate: number;
    }[];
    overallConversionRate: number;
    dateRange: {
        from: string;
        to: string;
    };
}
export interface RetentionCohort {
    cohortDate: string;
    period: number;
    users: number;
    retentionRate: number;
}
export interface RetentionResult {
    event: string;
    cohorts: RetentionCohort[];
    averageRetention: number;
}
export interface RealTimeMetrics {
    activeUsers: number;
    eventsPerMinute: number;
    conversions: {
        total: number;
        rate: number;
    };
    topEvents: {
        event: string;
        count: number;
    }[];
    timestamp: string;
}
export declare class AnalyticsConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Track an event
     */
    trackEvent(options: TrackEventOptions): Promise<AnalyticsResult>;
    /**
     * Track multiple events
     */
    trackEvents(events: TrackEventOptions[]): Promise<{
        successful: number;
        failed: number;
        results: AnalyticsResult[];
    }>;
    /**
     * Track conversion
     */
    trackConversion(conversion: ConversionEvent): Promise<AnalyticsResult>;
    /**
     * Update user properties
     */
    updateUserProperties(update: UserPropertyUpdate): Promise<void>;
    /**
     * Identify user
     */
    identifyUser(userId: string, properties?: Record<string, unknown>): Promise<void>;
    /**
     * Query analytics data
     */
    query(query: AnalyticsQuery): Promise<AnalyticsQueryResult>;
    /**
     * Get funnel analysis
     */
    getFunnel(name: string, steps: FunnelStep[], fromDate: string, toDate: string, filters?: Record<string, unknown>): Promise<FunnelResult>;
    /**
     * Get retention analysis
     */
    getRetention(event: string, fromDate: string, toDate: string, cohortType?: 'daily' | 'weekly' | 'monthly'): Promise<RetentionResult>;
    /**
     * Get real-time metrics
     */
    getRealTimeMetrics(): Promise<RealTimeMetrics>;
    /**
     * Get event counts
     */
    getEventCounts(event: string, fromDate: string, toDate: string, granularity?: 'hour' | 'day' | 'week' | 'month'): Promise<{
        event: string;
        counts: {
            date: string;
            count: number;
        }[];
        total: number;
    }>;
    /**
     * Get unique users count
     */
    getUniqueUsers(fromDate: string, toDate: string, event?: string): Promise<{
        uniqueUsers: number;
        fromDate: string;
        toDate: string;
    }>;
    /**
     * Get dashboard summary
     */
    getDashboardSummary(fromDate: string, toDate: string): Promise<{
        totalEvents: number;
        uniqueUsers: number;
        pageViews: number;
        conversions: {
            total: number;
            rate: number;
        };
        revenue: {
            total: number;
            currency: string;
        };
        topEvents: {
            event: string;
            count: number;
        }[];
        dateRange: {
            from: string;
            to: string;
        };
    }>;
    /**
     * Get user timeline
     */
    getUserTimeline(userId: string, options?: {
        fromDate?: string;
        toDate?: string;
        limit?: number;
    }): Promise<{
        userId: string;
        events: {
            event: string;
            timestamp: string;
            properties: Record<string, unknown>;
        }[];
    }>;
}
export declare function createAnalyticsConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): AnalyticsConnector;
//# sourceMappingURL=analytics.d.ts.map
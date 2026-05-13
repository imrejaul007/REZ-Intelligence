import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  TrackEventRequest,
  AnalyticsResult,
  HttpResponse,
} from '../types';

// ============================================================================
// Analytics Service Types
// ============================================================================

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

// ============================================================================
// Analytics Connector
// ============================================================================

export class AnalyticsConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('analytics-service', baseUrl, authToken, options);
  }

  /**
   * Track an event
   */
  async trackEvent(options: TrackEventOptions): Promise<AnalyticsResult> {
    this.logger.debug('Tracking event', {
      event: options.event,
      userId: options.userId,
    });

    const request: TrackEventRequest = {
      event: options.event,
      data: options.data || {},
      timestamp: options.timestamp || new Date().toISOString(),
      userId: options.userId,
      sessionId: options.sessionId,
    };

    const response = await this.post<AnalyticsResult>('/events/track', request);
    return response.data;
  }

  /**
   * Track multiple events
   */
  async trackEvents(
    events: TrackEventOptions[],
  ): Promise<{
    successful: number;
    failed: number;
    results: AnalyticsResult[];
  }> {
    this.logger.debug('Tracking batch events', { count: events.length });

    const requests: TrackEventRequest[] = events.map((event) => ({
      event: event.event,
      data: event.data || {},
      timestamp: event.timestamp || new Date().toISOString(),
      userId: event.userId,
      sessionId: event.sessionId,
    }));

    const response = await this.post<{
      successful: number;
      failed: number;
      results: AnalyticsResult[];
    }>('/events/track/batch', { events: requests });
    return response.data;
  }

  /**
   * Track conversion
   */
  async trackConversion(conversion: ConversionEvent): Promise<AnalyticsResult> {
    this.logger.debug('Tracking conversion', {
      event: conversion.event,
      userId: conversion.userId,
      value: conversion.value,
    });

    const response = await this.post<AnalyticsResult>('/events/conversion', conversion);
    return response.data;
  }

  /**
   * Update user properties
   */
  async updateUserProperties(update: UserPropertyUpdate): Promise<void> {
    this.logger.debug('Updating user properties', {
      userId: update.userId,
      propertyCount: Object.keys(update.properties).length,
    });

    await this.post('/users/properties', update);
  }

  /**
   * Identify user
   */
  async identifyUser(
    userId: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug('Identifying user', { userId });

    await this.post('/users/identify', {
      userId,
      properties,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Query analytics data
   */
  async query(query: AnalyticsQuery): Promise<AnalyticsQueryResult> {
    this.logger.debug('Querying analytics', {
      event: query.event,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    const response = await this.post<AnalyticsQueryResult>('/analytics/query', query);
    return response.data;
  }

  /**
   * Get funnel analysis
   */
  async getFunnel(
    name: string,
    steps: FunnelStep[],
    fromDate: string,
    toDate: string,
    filters?: Record<string, unknown>,
  ): Promise<FunnelResult> {
    this.logger.debug('Getting funnel analysis', {
      name,
      stepCount: steps.length,
      fromDate,
      toDate,
    });

    const response = await this.post<FunnelResult>('/analytics/funnel', {
      name,
      steps,
      fromDate,
      toDate,
      filters,
    });
    return response.data;
  }

  /**
   * Get retention analysis
   */
  async getRetention(
    event: string,
    fromDate: string,
    toDate: string,
    cohortType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<RetentionResult> {
    this.logger.debug('Getting retention analysis', {
      event,
      fromDate,
      toDate,
      cohortType,
    });

    const response = await this.post<RetentionResult>('/analytics/retention', {
      event,
      fromDate,
      toDate,
      cohortType,
    });
    return response.data;
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    this.logger.debug('Getting real-time metrics');

    const response = await this.get<RealTimeMetrics>('/analytics/realtime');
    return response.data;
  }

  /**
   * Get event counts
   */
  async getEventCounts(
    event: string,
    fromDate: string,
    toDate: string,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<{
    event: string;
    counts: { date: string; count: number }[];
    total: number;
  }> {
    this.logger.debug('Getting event counts', {
      event,
      fromDate,
      toDate,
      granularity,
    });

    const response = await this.get<{
      event: string;
      counts: { date: string; count: number }[];
      total: number;
    }>('/analytics/counts', {
      event,
      fromDate,
      toDate,
      granularity,
    });
    return response.data;
  }

  /**
   * Get unique users count
   */
  async getUniqueUsers(
    fromDate: string,
    toDate: string,
    event?: string,
  ): Promise<{
    uniqueUsers: number;
    fromDate: string;
    toDate: string;
  }> {
    this.logger.debug('Getting unique users', {
      fromDate,
      toDate,
      event,
    });

    const params: Record<string, string> = { fromDate, toDate };
    if (event) params.event = event;

    const response = await this.get<{
      uniqueUsers: number;
      fromDate: string;
      toDate: string;
    }>('/analytics/unique-users', params);
    return response.data;
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(
    fromDate: string,
    toDate: string,
  ): Promise<{
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
  }> {
    this.logger.debug('Getting dashboard summary', { fromDate, toDate });

    const response = await this.get<{
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
    }>('/analytics/dashboard', { fromDate, toDate });
    return response.data;
  }

  /**
   * Get user timeline
   */
  async getUserTimeline(
    userId: string,
    options?: {
      fromDate?: string;
      toDate?: string;
      limit?: number;
    },
  ): Promise<{
    userId: string;
    events: {
      event: string;
      timestamp: string;
      properties: Record<string, unknown>;
    }[];
  }> {
    this.logger.debug('Getting user timeline', { userId });

    const params: Record<string, string> = {};
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;
    if (options?.limit) params.limit = String(options.limit);

    const response = await this.get<{
      userId: string;
      events: {
        event: string;
        timestamp: string;
        properties: Record<string, unknown>;
      }[];
    }>(`/analytics/users/${userId}/timeline`, params);
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAnalyticsConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): AnalyticsConnector {
  return new AnalyticsConnector(baseUrl, authToken, options);
}

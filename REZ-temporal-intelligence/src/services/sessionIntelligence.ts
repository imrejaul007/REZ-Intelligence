import type {
  BehaviorEvent,
  UserSession as UserSessionType,
  SessionIntelligence as SessionIntelligenceType,
  SessionComparison,
  SessionType,
  DayOfWeek,
  ActionType
} from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * SessionIntelligence - Analyzes user session patterns and behavior
 *
 * Implements:
 * - Session segmentation
 * - Behavioral segment classification
 * - Anomaly detection
 * - Session comparison
 * - Engagement metrics
 */
export class SessionIntelligence {
  private sessionTimeout: number; // Max time between events to consider same session (ms)
  private minSessionEvents: number;

  constructor(options?: {
    sessionTimeout?: number;
    minSessionEvents?: number;
  }) {
    this.sessionTimeout = options?.sessionTimeout || 30 * 60 * 1000; // 30 minutes default
    this.minSessionEvents = options?.minSessionEvents || 2;
  }

  /**
   * Analyze complete session intelligence
   */
  public analyzeSessionIntelligence(
    userId: string,
    events: BehaviorEvent[]
  ): SessionIntelligenceType {
    const startTime = Date.now();

    // Build sessions from events
    const sessions = this.buildSessions(events);

    // Calculate session statistics
    const sessionStats = this.calculateSessionStats(sessions);

    // Identify behavioral segments
    const behavioralSegments = this.identifyBehavioralSegments(events, sessions);

    // Calculate engagement indicators
    const engagementIndicators = this.calculateEngagementIndicators(events, sessions);

    // Detect anomalies
    const anomalies = this.detectAnomalies(sessions);

    logger.info('Session intelligence analyzed', {
      userId,
      sessions: sessions.length,
      anomalies: anomalies.length,
      durationMs: Date.now() - startTime
    });

    return {
      userId,
      analyzedAt: new Date(),
      sessionStats,
      behavioralSegments,
      engagementIndicators,
      anomalies
    };
  }

  /**
   * Build sessions from raw events
   */
  public buildSessions(events: BehaviorEvent[]): UserSessionType[] {
    if (events.length === 0) return [];

    // Sort events by timestamp
    const sorted = [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions: UserSessionType[] = [];
    let currentSession: BehaviorEvent[] = [];
    let currentSessionId: string | null = null;

    sorted.forEach((event, index) => {
      const eventTime = new Date(event.timestamp).getTime();

      // Check if this event belongs to current session
      if (currentSession.length > 0) {
        const lastEventTime = new Date(currentSession[currentSession.length - 1].timestamp).getTime();
        const gap = eventTime - lastEventTime;

        // If same session ID or within timeout, add to current session
        if (event.sessionId === currentSessionId || gap < this.sessionTimeout) {
          currentSession.push(event);
        } else {
          // End current session and start new one
          if (currentSession.length >= this.minSessionEvents) {
            sessions.push(this.createSession(currentSession));
          }
          currentSession = [event];
          currentSessionId = event.sessionId;
        }
      } else {
        // Start first session
        currentSession.push(event);
        currentSessionId = event.sessionId;
      }

      // Handle last event
      if (index === sorted.length - 1 && currentSession.length >= this.minSessionEvents) {
        sessions.push(this.createSession(currentSession));
      }
    });

    return sessions;
  }

  /**
   * Create a UserSession from events
   */
  private createSession(events: BehaviorEvent[]): UserSessionType {
    const sorted = events.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const startTime = new Date(sorted[0].timestamp);
    const endTime = new Date(sorted[sorted.length - 1].timestamp);
    const totalDuration = endTime.getTime() - startTime.getTime();

    // Determine session type
    const actions = sorted.map(e => e.action);
    const sessionType = this.determineSessionType(actions);

    return {
      sessionId: sorted[0].sessionId,
      userId: sorted[0].userId,
      startTime,
      endTime,
      sessionType,
      deviceType: sorted[0].deviceType,
      location: sorted[0].location,
      isActive: false,
      totalDuration,
      eventCount: events.length,
      actions: [...new Set(actions)],
      events: sorted // Include the events array
    };
  }

  /**
   * Determine session type based on actions
   */
  private determineSessionType(actions: ActionType[]): SessionType {
    const hasPurchase = actions.includes('complete_purchase');
    const hasCart = actions.includes('add_to_cart');
    const hasSearch = actions.includes('search');
    const hasBrowse = actions.includes('browse');

    if (hasPurchase) return 'purchase';
    if (hasCart && !hasPurchase) return 'abandoned';
    if (hasSearch) return 'search';
    if (hasBrowse && actions.length > 5) return 'browse';
    return 'mixed';
  }

  /**
   * Calculate session statistics
   */
  private calculateSessionStats(sessions: UserSessionType[]): SessionIntelligenceType['sessionStats'] {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        averageSessionDuration: 0,
        averageEventsPerSession: 0,
        mostActiveDay: 'monday',
        mostActiveHour: 12,
        sessionTypes: {
          browse: 0,
          search: 0,
          purchase: 0,
          abandoned: 0,
          mixed: 0
        }
      };
    }

    // Calculate averages
    const totalDuration = sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s.eventCount, 0);

    // Calculate most active day and hour
    const dayCounts = new Map<DayOfWeek, number>();
    const hourCounts = new Map<number, number>();
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    days.forEach(day => dayCounts.set(day, 0));
    for (let i = 0; i < 24; i++) hourCounts.set(i, 0);

    sessions.forEach(session => {
      const dayOfWeek = session.startTime.getDay();
      const day = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);

      const hour = session.startTime.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    // Find most active
    let mostActiveDay: DayOfWeek = 'monday';
    let maxDayCount = 0;
    dayCounts.forEach((count, day) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostActiveDay = day;
      }
    });

    let mostActiveHour = 12;
    let maxHourCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        mostActiveHour = hour;
      }
    });

    // Count session types
    const sessionTypes: Record<SessionType, number> = {
      browse: 0,
      search: 0,
      purchase: 0,
      abandoned: 0,
      mixed: 0
    };
    sessions.forEach(session => {
      sessionTypes[session.sessionType]++;
    });

    return {
      totalSessions: sessions.length,
      averageSessionDuration: totalDuration / sessions.length,
      averageEventsPerSession: totalEvents / sessions.length,
      mostActiveDay,
      mostActiveHour,
      sessionTypes
    };
  }

  /**
   * Identify behavioral segments
   */
  private identifyBehavioralSegments(
    events: BehaviorEvent[],
    sessions: UserSessionType[]
  ): SessionIntelligenceType['behavioralSegments'] {
    const segments: SessionIntelligenceType['behavioralSegments'] = [];

    // Calculate key metrics
    const browseEvents = events.filter(e => e.action === 'browse' || e.action === 'view_product').length;
    const cartEvents = events.filter(e => e.action === 'add_to_cart').length;
    const purchaseEvents = events.filter(e => e.action === 'complete_purchase').length;
    const engagementEvents = events.filter(e => 
      ['review', 'share', 'add_to_wishlist'].includes(e.action)
    ).length;

    // Browse ratio
    if (events.length > 0) {
      const browseRatio = browseEvents / events.length;
      
      if (browseRatio > 0.7) {
        segments.push({
          segment: 'heavy_browser',
          score: browseRatio,
          description: 'User primarily browses without purchasing'
        });
      } else if (purchaseEvents > 0 && browseEvents / purchaseEvents < 5) {
        segments.push({
          segment: 'efficient_shopper',
          score: purchaseEvents / Math.max(browseEvents, 1),
          description: 'User converts quickly with minimal browsing'
        });
      }
    }

    // Cart behavior
    if (cartEvents > 0) {
      const abandonmentRate = 1 - (purchaseEvents / cartEvents);
      
      if (abandonmentRate > 0.7) {
        segments.push({
          segment: 'cart_abandoner',
          score: abandonmentRate,
          description: 'High cart abandonment rate detected'
        });
      } else if (abandonmentRate < 0.3) {
        segments.push({
          segment: 'committed_buyer',
          score: 1 - abandonmentRate,
          description: 'High cart-to-purchase conversion'
        });
      }
    }

    // Engagement score
    const engagementScore = (engagementEvents / Math.max(events.length, 1)) * 100;
    if (engagementScore > 10) {
      segments.push({
        segment: 'engaged_user',
        score: engagementScore / 100,
        description: 'User frequently engages with reviews, shares, and wishlists'
      });
    }

    // Session frequency
    if (sessions.length > 0) {
      const now = new Date();
      const oldestSession = sessions.reduce((oldest, s) => 
        s.startTime < oldest ? s.startTime : oldest, sessions[0].startTime
      );
      const daysDiff = (now.getTime() - oldestSession.getTime()) / (1000 * 60 * 60 * 24);
      const sessionsPerWeek = sessions.length / Math.max(daysDiff / 7, 1);

      if (sessionsPerWeek > 5) {
        segments.push({
          segment: 'frequent_visitor',
          score: Math.min(sessionsPerWeek / 10, 1),
          description: 'User visits frequently'
        });
      } else if (sessionsPerWeek < 1) {
        segments.push({
          segment: 'occasional_visitor',
          score: sessionsPerWeek,
          description: 'User visits occasionally'
        });
      }
    }

    // Session length
    if (sessions.length > 0) {
      const avgLength = sessions.reduce((sum, s) => sum + s.eventCount, 0) / sessions.length;
      
      if (avgLength > 20) {
        segments.push({
          segment: 'deep_explorer',
          score: Math.min(avgLength / 50, 1),
          description: 'User explores extensively during sessions'
        });
      } else if (avgLength < 5) {
        segments.push({
          segment: 'quick_visitor',
          score: 1 - (avgLength / 5),
          description: 'User completes tasks quickly'
        });
      }
    }

    return segments;
  }

  /**
   * Calculate engagement indicators
   */
  private calculateEngagementIndicators(
    events: BehaviorEvent[],
    sessions: UserSessionType[]
  ): SessionIntelligenceType['engagementIndicators'] {
    const browseToCart = events.filter(e => e.action === 'browse' || e.action === 'view_product').length;
    const cartAdds = events.filter(e => e.action === 'add_to_cart').length;
    const purchases = events.filter(e => e.action === 'complete_purchase').length;
    const refunds = events.filter(e => e.action === 'refund').length;

    // Browse to cart rate
    const browseToCartRate = browseToCart > 0 ? cartAdds / browseToCart : 0;

    // Cart to purchase rate
    const cartToPurchaseRate = cartAdds > 0 ? purchases / cartAdds : 0;

    // Average time to purchase (if purchase exists)
    let avgTimeToPurchase = 0;
    if (purchases > 0) {
      const purchaseTimes = events.filter(e => e.action === 'complete_purchase')
        .map(e => new Date(e.timestamp).getTime());
      const addToCartTimes = events.filter(e => e.action === 'add_to_cart')
        .map(e => new Date(e.timestamp).getTime());

      if (addToCartTimes.length > 0 && purchaseTimes.length > 0) {
        const times: number[] = [];
        purchaseTimes.forEach(pt => {
          const closestCart = addToCartTimes
            .filter(ct => ct < pt)
            .sort((a, b) => pt - a - (pt - b))[0];
          if (closestCart) {
            times.push(pt - closestCart);
          }
        });
        avgTimeToPurchase = times.length > 0 
          ? times.reduce((a, b) => a + b, 0) / times.length 
          : 0;
      }
    }

    // Return rate
    const returnRate = purchases > 0 ? refunds / purchases : 0;

    // Session frequency (sessions per week)
    let sessionFrequency = 0;
    if (sessions.length > 1) {
      const sortedSessions = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const firstSession = sortedSessions[0].startTime;
      const lastSession = sortedSessions[sortedSessions.length - 1].startTime;
      const weeksDiff = Math.max((lastSession.getTime() - firstSession.getTime()) / (1000 * 60 * 60 * 24 * 7), 1);
      sessionFrequency = sessions.length / weeksDiff;
    }

    return {
      browseToCartRate,
      cartToPurchaseRate,
      averageTimeToPurchase: avgTimeToPurchase,
      returnRate,
      sessionFrequency
    };
  }

  /**
   * Detect anomalies in sessions
   */
  private detectAnomalies(sessions: UserSessionType[]): SessionIntelligenceType['anomalies'] {
    const anomalies: SessionIntelligenceType['anomalies'] = [];

    if (sessions.length < 2) return anomalies;

    // Calculate baseline metrics
    const durations = sessions.map(s => s.totalDuration || 0);
    const eventCounts = sessions.map(s => s.eventCount);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgEvents = eventCounts.reduce((a, b) => a + b, 0) / eventCounts.length;

    const durationStdDev = Math.sqrt(
      durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
    );
    const eventsStdDev = Math.sqrt(
      eventCounts.reduce((sum, e) => sum + Math.pow(e - avgEvents, 2), 0) / eventCounts.length
    );

    // Detect unusually long sessions
    sessions.forEach(session => {
      const duration = session.totalDuration || 0;
      if (duration > avgDuration + 3 * durationStdDev) {
        anomalies.push({
          type: 'unusually_long_session',
          description: `Session lasted ${Math.round(duration / 60000)} minutes (avg: ${Math.round(avgDuration / 60000)} min)`,
          severity: 'medium',
          detectedAt: session.endTime || session.startTime
        });
      }

      // Detect unusually short sessions
      if (duration < avgDuration - 2 * durationStdDev && duration > 0) {
        anomalies.push({
          type: 'quick_exit',
          description: `Session lasted only ${Math.round(duration / 1000)} seconds`,
          severity: 'low',
          detectedAt: session.endTime || session.startTime
        });
      }

      // Detect high event count sessions
      if (session.eventCount > avgEvents + 3 * eventsStdDev) {
        anomalies.push({
          type: 'high_activity_session',
          description: `Session had ${session.eventCount} events (avg: ${Math.round(avgEvents)})`,
          severity: 'low',
          detectedAt: session.endTime || session.startTime
        });
      }
    });

    // Detect sudden changes in session frequency
    if (sessions.length >= 5) {
      const sortedSessions = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      const gaps: number[] = [];
      
      for (let i = 1; i < sortedSessions.length; i++) {
        const gap = sortedSessions[i].startTime.getTime() - sortedSessions[i - 1].endTime?.getTime()!;
        if (sortedSessions[i - 1].endTime) {
          gaps.push(gap);
        }
      }

      if (gaps.length > 0) {
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const gapStdDev = Math.sqrt(
          gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length
        );

        gaps.forEach((gap, index) => {
          if (gap > avgGap + 3 * gapStdDev) {
            anomalies.push({
              type: 'dormancy_period',
              description: `Unusual gap of ${Math.round(gap / (1000 * 60 * 60 * 24))} days before session`,
              severity: 'medium',
              detectedAt: sortedSessions[index + 1].startTime
            });
          }
        });
      }
    }

    // Detect session type imbalance
    const sessionTypes: Record<string, number> = {};
    sessions.forEach(s => {
      sessionTypes[s.sessionType] = (sessionTypes[s.sessionType] || 0) + 1;
    });

    const abandonedSessions = sessionTypes['abandoned'] || 0;
    const purchaseSessions = sessionTypes['purchase'] || 0;

    if (abandonedSessions > sessions.length * 0.7 && sessions.length >= 3) {
      anomalies.push({
        type: 'cart_abandonment_pattern',
        description: `${abandonedSessions} of ${sessions.length} sessions are abandoned`,
        severity: 'high',
        detectedAt: new Date()
      });
    }

    return anomalies;
  }

  /**
   * Compare current session with historical average
   */
  public compareSession(
    userId: string,
    currentSession: UserSessionType,
    historicalSessions: UserSessionType[]
  ): SessionComparison {
    if (historicalSessions.length === 0) {
      return {
        userId,
        comparedAt: new Date(),
        currentSession,
        historicalAverage: {
          duration: currentSession.totalDuration || 0,
          events: currentSession.eventCount,
          actions: currentSession.actions
        },
        deviation: {
          durationDeviation: 0,
          eventDeviation: 0,
          engagementScore: 1
        },
        isAnomalous: false
      };
    }

    // Calculate historical averages
    const avgDuration = historicalSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / historicalSessions.length;
    const avgEvents = historicalSessions.reduce((sum, s) => sum + s.eventCount, 0) / historicalSessions.length;

    // Calculate deviations
    const durationDeviation = avgDuration > 0 
      ? ((currentSession.totalDuration || 0) - avgDuration) / avgDuration * 100 
      : 0;
    const eventDeviation = avgEvents > 0 
      ? (currentSession.eventCount - avgEvents) / avgEvents * 100 
      : 0;

    // Calculate engagement score (higher is more engaged)
    const currentEngagement = this.calculateSessionEngagement(currentSession);
    const avgEngagement = historicalSessions.reduce((sum, s) => 
      sum + this.calculateSessionEngagement(s), 0) / historicalSessions.length;
    const engagementScore = avgEngagement > 0 ? currentEngagement / avgEngagement : 1;

    // Determine if anomalous
    const isAnomalous = Math.abs(durationDeviation) > 100 || Math.abs(eventDeviation) > 100;
    
    let anomalyReason: string | undefined;
    if (isAnomalous) {
      if (durationDeviation > 100) {
        anomalyReason = 'Session duration significantly exceeds average';
      } else if (durationDeviation < -100) {
        anomalyReason = 'Session ended unusually quickly';
      } else if (eventDeviation > 100) {
        anomalyReason = 'Session has unusually high event count';
      } else if (eventDeviation < -100) {
        anomalyReason = 'Session has unusually low event count';
      }
    }

    return {
      userId,
      comparedAt: new Date(),
      currentSession,
      historicalAverage: {
        duration: avgDuration,
        events: avgEvents,
        actions: []
      },
      deviation: {
        durationDeviation,
        eventDeviation,
        engagementScore
      },
      isAnomalous,
      anomalyReason
    };
  }

  /**
   * Calculate session engagement score
   */
  private calculateSessionEngagement(session: UserSessionType): number {
    // Base score on event count
    let score = Math.log(session.eventCount + 1) * 10;
    
    // Bonus for purchases
    if (session.sessionType === 'purchase') {
      score *= 1.5;
    }

    // Bonus for long sessions (but not too long)
    const duration = session.totalDuration || 0;
    if (duration > 60000 && duration < 1800000) { // 1-30 minutes
      score *= 1.2;
    }

    return score;
  }
}

export default SessionIntelligence;

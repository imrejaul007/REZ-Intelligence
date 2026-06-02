import type {
  ActionType,
  BehaviorEvent,
  NextActionPrediction,
  TimeBasedPrediction,
  SessionPrediction,
  MarkovChainModel,
  ConfidenceLevel,
  DayOfWeek
} from '../types/index.js';
import logger from '../utils/logger.js';
import { SequenceAnalyzer } from './sequenceAnalyzer.js';

/**
 * TemporalPredictor - Time-based predictions for user behavior
 * 
 * Implements:
 * - Next action prediction using Markov chains
 * - Time-of-day/day-of-week patterns
 * - Session timing predictions
 * - Optimal engagement window calculation
 */
export class TemporalPredictor {
  private sequenceAnalyzer: SequenceAnalyzer;
  private timeHorizon: number; // Time horizon in ms for predictions

  constructor(options?: {
    timeHorizon?: number;
    markovOrder?: number;
  }) {
    this.sequenceAnalyzer = new SequenceAnalyzer({ order: options?.markovOrder || 1 });
    this.timeHorizon = options?.timeHorizon || 3600000; // Default 1 hour
  }

  /**
   * Predict the next action for a user
   */
  public predictNextAction(
    userId: string,
    events: BehaviorEvent[],
    markovModel?: MarkovChainModel
  ): NextActionPrediction {
    const startTime = Date.now();

    if (events.length === 0) {
      return this.createEmptyPrediction(userId);
    }

    // Get most recent event
    const sortedEvents = [...events].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastEvent = sortedEvents[0];
    const currentState = lastEvent.action;

    // Build Markov model if not provided
    const model = markovModel || this.buildModelFromEvents(userId, events);

    // Get predictions
    const predictions = this.sequenceAnalyzer.predictNextAction(model, currentState);

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(events.length, model.entropy);

    // Estimate time until action
    const estimatedTime = this.estimateTimeUntilAction(events);

    // Identify factors
    const factors = this.identifyFactors(events, predictions);

    // Get session context
    const sessionContext = this.getSessionContext(events, lastEvent.sessionId);

    logger.logPrediction(
      userId,
      predictions[0]?.action || 'unknown',
      confidence === 'VERY_HIGH' ? 0.95 : confidence === 'HIGH' ? 0.8 : 0.5,
      Date.now() - startTime
    );

    return {
      userId,
      predictedAt: new Date(),
      currentState,
      predictions: predictions.slice(0, 5).map(p => ({
        action: p.action,
        probability: p.probability,
        confidence,
        estimatedTime,
        context: this.getContextDescription(p.action, currentState)
      })),
      timeUntilPrediction: this.timeHorizon,
      factors,
      lastEvent,
      sessionContext
    };
  }

  /**
   * Predict time-based patterns
   */
  public predictTimeBased(
    userId: string,
    events: BehaviorEvent[]
  ): TimeBasedPrediction {
    const startTime = Date.now();

    // Analyze temporal distribution
    const hourlyDistribution = this.analyzeHourlyDistribution(events);
    const dailyDistribution = this.analyzeDailyDistribution(events);

    // Find optimal engagement windows
    const optimalWindows = this.findOptimalEngagementWindows(hourlyDistribution, dailyDistribution);

    // Generate predictions for next 24 hours
    const predictions = this.generateHourlyPredictions(hourlyDistribution);

    // Identify factors
    const factors = this.analyzeTimeFactors(events, hourlyDistribution, dailyDistribution);

    return {
      userId,
      predictionType: 'engagement',
      predictedAt: new Date(),
      predictions,
      optimalEngagementWindow: optimalWindows[0] || {
        start: new Date(),
        end: new Date(Date.now() + 3600000),
        probability: 0
      },
      factors
    };
  }

  /**
   * Predict next session details
   */
  public predictSession(
    userId: string,
    events: BehaviorEvent[]
  ): SessionPrediction {
    const startTime = Date.now();

    // Analyze session patterns
    const sessionPatterns = this.analyzeSessionPatterns(events);

    // Predict next session
    const nextSession = this.predictNextSessionDetails(sessionPatterns);

    return {
      userId,
      predictedAt: new Date(),
      nextSession,
      sessionPatterns
    };
  }

  /**
   * Build Markov model from events
   */
  private buildModelFromEvents(userId: string, events: BehaviorEvent[]): MarkovChainModel {
    // Group by session
    const sessionMap = new Map<string, BehaviorEvent[]>();
    events.forEach(event => {
      const existing = sessionMap.get(event.sessionId);
      if (existing) {
        existing.push(event);
      } else {
        sessionMap.set(event.sessionId, [event]);
      }
    });

    // Create sequences
    const sequences: ActionType[][] = [];
    sessionMap.forEach(sessionEvents => {
      const sorted = sessionEvents.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      sequences.push(sorted.map(e => e.action));
    });

    return this.sequenceAnalyzer.buildMarkovModel({ userId, sequences });
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(eventCount: number, entropy: number): ConfidenceLevel {
    // High entropy = less predictable
    if (eventCount < 10) return 'LOW';
    if (eventCount < 50) return entropy > 2 ? 'LOW' : 'MEDIUM';
    if (eventCount < 100) return entropy > 2.5 ? 'MEDIUM' : 'HIGH';
    return entropy > 3 ? 'HIGH' : 'VERY_HIGH';
  }

  /**
   * Estimate time until next action
   */
  private estimateTimeUntilAction(events: BehaviorEvent[]): number {
    if (events.length < 2) return 300000; // 5 minutes default

    const sorted = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate average time between events
    let totalTime = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalTime += new Date(sorted[i].timestamp).getTime() - 
                   new Date(sorted[i - 1].timestamp).getTime();
    }

    return Math.round(totalTime / (sorted.length - 1));
  }

  /**
   * Identify factors influencing predictions
   */
  private identifyFactors(
    events: BehaviorEvent[],
    predictions: Array<{ action: ActionType; probability: number }>
  ): NextActionPrediction['factors'] {
    const factors: NextActionPrediction['factors'] = [];

    // Recent activity factor
    const recentEvents = events.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 3600000 // Last hour
    );
    if (recentEvents.length > 5) {
      factors.push({
        name: 'high_recent_activity',
        impact: 0.3,
        description: 'High activity in the last hour suggests continued engagement'
      });
    }

    // Cart state factor
    const hasCartActivity = events.some(e => e.action === 'add_to_cart');
    const hasPurchase = events.some(e => e.action === 'complete_purchase');
    if (hasCartActivity && !hasPurchase) {
      factors.push({
        name: 'cart_pending',
        impact: 0.4,
        description: 'User has items in cart but no recent purchase'
      });
    }

    // Prediction confidence factor
    if (predictions.length > 0 && predictions[0].probability > 0.5) {
      factors.push({
        name: 'high_prediction_confidence',
        impact: 0.2,
        description: 'Strong historical pattern for next action'
      });
    }

    // Time of day factor
    const hour = new Date().getHours();
    if (hour >= 18 && hour <= 22) {
      factors.push({
        name: 'evening_session',
        impact: 0.2,
        description: 'Evening hours typically see higher conversion'
      });
    }

    return factors;
  }

  /**
   * Get session context
   */
  private getSessionContext(events: BehaviorEvent[], sessionId: string): NextActionPrediction['sessionContext'] {
    const sessionEvents = events.filter(e => e.sessionId === sessionId);
    
    if (sessionEvents.length === 0) {
      return undefined;
    }

    const sorted = sessionEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const start = new Date(sorted[0].timestamp).getTime();
    const end = new Date(sorted[sorted.length - 1].timestamp).getTime();

    return {
      sessionId,
      eventsInSession: sessionEvents.length,
      sessionDuration: end - start
    };
  }

  /**
   * Analyze hourly distribution of events
   */
  private analyzeHourlyDistribution(events: BehaviorEvent[]): Map<number, number> {
    const distribution = new Map<number, number>();
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      distribution.set(i, 0);
    }

    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      distribution.set(hour, (distribution.get(hour) || 0) + 1);
    });

    return distribution;
  }

  /**
   * Analyze daily distribution of events
   */
  private analyzeDailyDistribution(events: BehaviorEvent[]): Map<DayOfWeek, number> {
    const distribution = new Map<DayOfWeek, number>();
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => distribution.set(day, 0));

    events.forEach(event => {
      const dayOfWeek = new Date(event.timestamp).getDay();
      const day = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // Convert to Monday = 0
      distribution.set(day, (distribution.get(day) || 0) + 1);
    });

    return distribution;
  }

  /**
   * Find optimal engagement windows
   */
  private findOptimalEngagementWindows(
    hourly: Map<number, number>,
    _daily: Map<DayOfWeek, number>
  ): Array<{ start: Date; end: Date; probability: number }> {
    const windows: Array<{ start: Date; end: Date; probability: number }> = [];

    // Find peak hours
    const sortedHours = [...hourly.entries()].sort((a, b) => b[1] - a[1]);
    const peakHours = sortedHours.slice(0, 3);

    peakHours.forEach(([hour, count]) => {
      if (count > 0) {
        const start = new Date();
        start.setHours(hour, 0, 0, 0);

        // If hour has passed today, schedule for tomorrow
        if (start.getTime() < Date.now()) {
          start.setDate(start.getDate() + 1);
        }

        const end = new Date(start);
        end.setHours(end.getHours() + 1);

        windows.push({
          start,
          end,
          probability: Math.min(count / 10, 1)
        });
      }
    });

    return windows;
  }

  /**
   * Generate hourly predictions for next 24 hours
   */
  private generateHourlyPredictions(
    hourly: Map<number, number>
  ): TimeBasedPrediction['predictions'] {
    const predictions: TimeBasedPrediction['predictions'] = [];
    const now = new Date();
    
    // Find max count for normalization
    const maxCount = Math.max(...hourly.values(), 1);

    for (let i = 0; i < 24; i++) {
      const targetHour = (now.getHours() + i) % 24;
      const count = hourly.get(targetHour) || 0;
      
      const predictionTime = new Date(now);
      predictionTime.setHours(targetHour, 0, 0, 0);
      if (predictionTime.getTime() <= now.getTime()) {
        predictionTime.setDate(predictionTime.getDate() + 1);
      }

      predictions.push({
        timestamp: predictionTime,
        probability: count / maxCount,
        confidence: count > 20 ? 'HIGH' : count > 5 ? 'MEDIUM' : 'LOW'
      });
    }

    return predictions;
  }

  /**
   * Analyze time factors
   */
  private analyzeTimeFactors(
    events: BehaviorEvent[],
    hourly: Map<number, number>,
    daily: Map<DayOfWeek, number>
  ): TimeBasedPrediction['factors'] {
    const factors: TimeBasedPrediction['factors'] = [];

    // Peak hour analysis
    let peakHour = 0;
    let maxHourCount = 0;
    hourly.forEach((count, hour) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = hour;
      }
    });

    if (maxHourCount > 0) {
      factors.push({
        name: 'peak_hour',
        impact: maxHourCount / events.length
      });
    }

    // Peak day analysis
    let peakDay: DayOfWeek = 'monday';
    let maxDayCount = 0;
    daily.forEach((count, day) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        peakDay = day;
      }
    });

    if (maxDayCount > 0) {
      factors.push({
        name: 'peak_day',
        impact: maxDayCount / events.length
      });
    }

    return factors;
  }

  /**
   * Analyze session patterns
   */
  private analyzeSessionPatterns(
    events: BehaviorEvent[]
  ): SessionPrediction['sessionPatterns'] {
    const sessionMap = new Map<string, BehaviorEvent[]>();
    
    events.forEach(event => {
      const existing = sessionMap.get(event.sessionId);
      if (existing) {
        existing.push(event);
      } else {
        sessionMap.set(event.sessionId, [event]);
      }
    });

    const patterns: SessionPrediction['sessionPatterns'] = [];
    const hourDayMap = new Map<string, { hour: number; day: DayOfWeek; count: number }>();

    sessionMap.forEach(sessionEvents => {
      if (sessionEvents.length < 2) return;

      const sorted = sessionEvents.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const startTime = new Date(sorted[0].timestamp);
      const hour = startTime.getHours();
      const dayOfWeek = startTime.getDay();
      const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const day = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

      const key = `${day}-${hour}`;
      const existing = hourDayMap.get(key);
      
      const endTime = new Date(sorted[sorted.length - 1].timestamp);
      const duration = endTime.getTime() - startTime.getTime();

      if (existing) {
        existing.count++;
      } else {
        hourDayMap.set(key, { hour, day, count: 1 });
      }

      // Update duration
      const current = hourDayMap.get(key);
      if (current) {
        (current as unknown as { totalDuration: number }).totalDuration = 
          ((current as unknown as { totalDuration?: number }).totalDuration || 0) + duration;
      }
    });

    hourDayMap.forEach((data) => {
      patterns.push({
        dayOfWeek: data.day,
        hourOfDay: data.hour,
        frequency: data.count,
        averageDuration: ((data as unknown as { totalDuration?: number }).totalDuration || 0) / data.count
      });
    });

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Predict next session details
   */
  private predictNextSessionDetails(
    patterns: SessionPrediction['sessionPatterns']
  ): SessionPrediction['nextSession'] {
    if (patterns.length === 0) {
      return {
        predictedStart: new Date(),
        predictedDuration: 300000, // 5 minutes
        predictedType: 'browse',
        predictedActions: ['browse', 'view_product'],
        confidence: 'LOW'
      };
    }

    // Find most frequent pattern
    const topPattern = patterns[0];
    
    // Predict next session time
    const now = new Date();
    const predictedStart = new Date(now);
    predictedStart.setHours(topPattern.hourOfDay, 0, 0, 0);
    
    if (predictedStart.getTime() <= now.getTime()) {
      predictedStart.setDate(predictedStart.getDate() + 1);
    }

    return {
      predictedStart,
      predictedDuration: topPattern.averageDuration,
      predictedType: 'browse',
      predictedActions: ['browse', 'view_product', 'add_to_cart'],
      confidence: patterns.length > 5 ? 'HIGH' : 'MEDIUM'
    };
  }

  /**
   * Get context description for prediction
   */
  private getContextDescription(predictedAction: ActionType, currentAction: ActionType): string {
    const descriptions: Record<string, string> = {
      'view_product': 'User is browsing products',
      'add_to_cart': 'User adding item to cart',
      'view_cart': 'User reviewing cart',
      'initiate_checkout': 'User starting checkout process',
      'complete_purchase': 'User completing purchase',
      'add_to_wishlist': 'User saving item for later',
      'search': 'User searching for products'
    };

    return descriptions[predictedAction] || `Transition from ${currentAction}`;
  }

  /**
   * Create empty prediction
   */
  private createEmptyPrediction(userId: string): NextActionPrediction {
    return {
      userId,
      predictedAt: new Date(),
      currentState: 'browse',
      predictions: [],
      timeUntilPrediction: this.timeHorizon,
      factors: [{
        name: 'insufficient_data',
        impact: 0,
        description: 'Not enough historical data to make prediction'
      }]
    };
  }
}

export default TemporalPredictor;

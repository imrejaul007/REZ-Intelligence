import { v4 as uuidv4 } from 'uuid';
import type {
  BehaviorEvent,
  TemporalPattern,
  PeriodicPattern,
  PatternDetectionResult,
  PatternType,
  DayOfWeek,
  ConfidenceLevel
} from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * PatternDetector - Detects recurring patterns in user behavior
 * 
 * Implements:
 * - Fourier transform for periodic pattern detection
 * - Sequential pattern detection
 * - Temporal pattern analysis (time-of-day, day-of-week)
 * - Funnel and abandonment pattern detection
 */
export class PatternDetector {
  private minOccurrences: number;
  private fourierEnabled: boolean;

  constructor(options?: {
    minOccurrences?: number;
    enableFourier?: boolean;
  }) {
    this.minOccurrences = options?.minOccurrences || 3;
    this.fourierEnabled = options?.enableFourier !== false;
  }

  /**
   * Detect all patterns in user behavior data
   */
  public detectPatterns(
    userId: string,
    events: BehaviorEvent[],
    options?: {
      patternTypes?: PatternType[];
      minOccurrences?: number;
    }
  ): PatternDetectionResult {
    const startTime = Date.now();
    const minOcc = options?.minOccurrences || this.minOccurrences;
    const patternTypes = options?.patternTypes || [
      'sequential', 'periodic', 'temporal', 'session', 'funnel', 'abandonment', 'engagement'
    ];

    const patterns: TemporalPattern[] = [];
    const periodicPatterns: PeriodicPattern[] = [];

    // Sequential patterns
    if (patternTypes.includes('sequential')) {
      patterns.push(...this.detectSequentialPatterns(userId, events, minOcc));
    }

    // Temporal patterns (time-of-day, day-of-week)
    if (patternTypes.includes('temporal')) {
      patterns.push(...this.detectTemporalPatterns(userId, events, minOcc));
    }

    // Periodic patterns using Fourier transform
    if (patternTypes.includes('periodic') && this.fourierEnabled) {
      periodicPatterns.push(...this.detectPeriodicPatterns(userId, events));
    }

    // Session patterns
    if (patternTypes.includes('session')) {
      patterns.push(...this.detectSessionPatterns(userId, events, minOcc));
    }

    // Engagement patterns
    if (patternTypes.includes('engagement')) {
      patterns.push(...this.detectEngagementPatterns(userId, events, minOcc));
    }

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(patterns, periodicPatterns);

    // Generate summary
    const summary = this.generateSummary(patterns, periodicPatterns);

    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, periodicPatterns);

    logger.logPatternDetection(
      userId,
      patternTypes.join(','),
      confidence === 'VERY_HIGH' ? 0.95 : confidence === 'HIGH' ? 0.8 : 0.5,
      Date.now() - startTime
    );

    return {
      userId,
      detectedAt: new Date(),
      patterns,
      periodicPatterns,
      confidence,
      summary,
      recommendations
    };
  }

  /**
   * Detect sequential patterns (A -> B -> C)
   */
  private detectSequentialPatterns(
    userId: string,
    events: BehaviorEvent[],
    minOccurrences: number
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];
    const sequenceMap = new Map<string, Date[]>();

    // Group by session
    const sessions = this.groupBySession(events);

    sessions.forEach(session => {
      const sorted = session.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Look for common sequences
      for (let len = 2; len <= 4; len++) {
        for (let start = 0; start <= sorted.length - len; start++) {
          const sequence = sorted.slice(start, start + len).map(e => e.action);
          const key = sequence.join(' -> ');
          
          const existing = sequenceMap.get(key);
          if (existing) {
            existing.push(new Date(sorted[start].timestamp));
          } else {
            sequenceMap.set(key, [new Date(sorted[start].timestamp)]);
          }
        }
      }
    });

    // Convert to TemporalPattern
    sequenceMap.forEach((occurrences, sequence) => {
      if (occurrences.length >= minOccurrences) {
        patterns.push({
          patternId: uuidv4(),
          userId,
          patternType: 'sequential',
          description: `Sequence: ${sequence}`,
          confidence: Math.min(occurrences.length / 10, 1),
          occurrences,
          frequency: this.determineFrequency(occurrences),
          detectedAt: new Date()
        });
      }
    });

    return patterns.sort((a, b) => b.occurrences.length - a.occurrences.length).slice(0, 20);
  }

  /**
   * Detect temporal patterns (time-of-day, day-of-week)
   */
  private detectTemporalPatterns(
    userId: string,
    events: BehaviorEvent[],
    minOccurrences: number
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    // Analyze hourly patterns
    const hourlyBuckets = new Map<number, BehaviorEvent[]>();
    for (let i = 0; i < 24; i++) {
      hourlyBuckets.set(i, []);
    }

    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyBuckets.get(hour)?.push(event);
    });

    // Find peak hours
    const hourlyCounts = Array.from(hourlyBuckets.entries())
      .map(([hour, evts]) => ({ hour, count: evts.length }))
      .filter(h => h.count >= minOccurrences)
      .sort((a, b) => b.count - a.count);

    if (hourlyCounts.length > 0) {
      const peakHours = hourlyCounts.slice(0, 3).map(h => h.hour);
      const totalEvents = hourlyCounts.reduce((sum, h) => sum + h.count, 0);
      
      patterns.push({
        patternId: uuidv4(),
        userId,
        patternType: 'temporal',
        description: `Peak activity hours: ${peakHours.join(', ')}`,
        confidence: Math.min(totalEvents / 50, 1),
        occurrences: events.map(e => new Date(e.timestamp)),
        frequency: 'daily',
        peakTimes: {
          hourOfDay: peakHours
        },
        detectedAt: new Date()
      });
    }

    // Analyze day-of-week patterns
    const dayBuckets = new Map<DayOfWeek, BehaviorEvent[]>();
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => dayBuckets.set(day, []));

    events.forEach(event => {
      const dayOfWeek = new Date(event.timestamp).getDay();
      const day = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
      dayBuckets.get(day)?.push(event);
    });

    const dailyCounts = Array.from(dayBuckets.entries())
      .map(([day, evts]) => ({ day, count: evts.length }))
      .filter(d => d.count >= minOccurrences)
      .sort((a, b) => b.count - a.count);

    if (dailyCounts.length > 0) {
      const peakDays = dailyCounts.slice(0, 3).map(d => d.day);
      const totalEvents = dailyCounts.reduce((sum, d) => sum + d.count, 0);

      patterns.push({
        patternId: uuidv4(),
        userId,
        patternType: 'temporal',
        description: `Most active days: ${peakDays.join(', ')}`,
        confidence: Math.min(totalEvents / 50, 1),
        occurrences: events.map(e => new Date(e.timestamp)),
        frequency: 'weekly',
        peakTimes: {
          dayOfWeek: peakDays
        },
        detectedAt: new Date()
      });
    }

    return patterns;
  }

  /**
   * Detect periodic patterns using Fourier transform
   */
  private detectPeriodicPatterns(
    userId: string,
    events: BehaviorEvent[]
  ): PeriodicPattern[] {
    const patterns: PeriodicPattern[] = [];

    if (events.length < 20) {
      return patterns; // Need sufficient data for Fourier
    }

    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Create time series (event count per hour)
    const startTime = new Date(sorted[0].timestamp).getTime();
    const endTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const hourSpan = Math.max(24, Math.ceil((endTime - startTime) / (1000 * 60 * 60)));

    const timeSeries: number[] = new Array(hourSpan).fill(0);
    sorted.forEach(event => {
      const hour = Math.floor((new Date(event.timestamp).getTime() - startTime) / (1000 * 60 * 60));
      if (hour >= 0 && hour < hourSpan) {
        timeSeries[hour]++;
      }
    });

    // Apply Fourier Transform
    const frequencies = this.simpleFourierTransform(timeSeries);

    // Find dominant frequencies
    const dominantFreqs = frequencies
      .map((magnitude, index) => ({ magnitude, period: hourSpan / (index + 1), index }))
      .filter(f => f.magnitude > 0.1 && f.period >= 2) // Ignore DC and very short periods
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5);

    dominantFreqs.forEach(freq => {
      // Only keep significant periods (daily, weekly)
      if (freq.period >= 20 && freq.period <= 200) {
        patterns.push({
          patternId: uuidv4(),
          userId,
          period: Math.round(freq.period),
          strength: freq.magnitude,
          phase: 0, // Would need more complex calculation
          amplitude: freq.magnitude * Math.max(...timeSeries),
          confidence: Math.min(freq.magnitude, 1),
          examples: this.getPeriodicExamples(sorted, Math.round(freq.period))
        });
      }
    });

    // Also check for daily patterns
    if (hourSpan >= 24) {
      const dailyPattern = this.detectDailyPeriodicity(timeSeries, userId);
      if (dailyPattern) {
        patterns.push(dailyPattern);
      }
    }

    return patterns;
  }

  /**
   * Simple Fourier Transform implementation
   */
  private simpleFourierTransform(signal: number[]): number[] {
    const n = signal.length;
    const frequencies: number[] = new Array(n).fill(0);
    const mean = signal.reduce((a, b) => a + b, 0) / n;
    const centered = signal.map(x => x - mean);

    for (let k = 0; k < n; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += centered[t] * Math.cos(angle);
        imag -= centered[t] * Math.sin(angle);
      }

      frequencies[k] = Math.sqrt(real * real + imag * imag) / n;
    }

    return frequencies;
  }

  /**
   * Detect daily periodicity
   */
  private detectDailyPeriodicity(
    timeSeries: number[],
    userId: string
  ): PeriodicPattern | null {
    if (timeSeries.length < 48) return null;

    const n = timeSeries.length;
    const dailyStrength = this.calculateCorrelation(
      timeSeries.slice(0, 24),
      timeSeries.slice(24, 48)
    );

    if (dailyStrength > 0.3) {
      return {
        patternId: uuidv4(),
        userId,
        period: 24,
        strength: dailyStrength,
        phase: 0,
        amplitude: Math.max(...timeSeries.slice(0, 24)),
        confidence: Math.min(dailyStrength, 1),
        examples: []
      };
    }

    return null;
  }

  /**
   * Calculate correlation between two arrays
   */
  private calculateCorrelation(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    const n = a.length;
    const meanA = a.reduce((sum, x) => sum + x, 0) / n;
    const meanB = b.reduce((sum, x) => sum + x, 0) / n;

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;

    for (let i = 0; i < n; i++) {
      const diffA = a[i] - meanA;
      const diffB = b[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }

    const denom = Math.sqrt(denomA * denomB);
    return denom === 0 ? 0 : numerator / denom;
  }

  /**
   * Get example timestamps for periodic pattern
   */
  private getPeriodicExamples(events: BehaviorEvent[], period: number): Date[] {
    const examples: Date[] = [];
    const periodMs = period * 60 * 60 * 1000;

    if (events.length === 0) return examples;

    let lastExample = new Date(events[0].timestamp);
    examples.push(lastExample);

    for (let i = 1; i < events.length && examples.length < 5; i++) {
      const eventTime = new Date(events[i].timestamp).getTime();
      if (eventTime - lastExample.getTime() >= periodMs * 0.8) {
        examples.push(new Date(eventTime));
        lastExample = new Date(eventTime);
      }
    }

    return examples;
  }

  /**
   * Detect session patterns
   */
  private detectSessionPatterns(
    userId: string,
    events: BehaviorEvent[],
    minOccurrences: number
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];
    const sessions = this.groupBySession(events);

    // Analyze session lengths
    const sessionLengths = sessions.map(s => s.length);
    const avgLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
    const stdDev = Math.sqrt(
      sessionLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sessionLengths.length
    );

    // Group sessions by length category
    const shortSessions = sessions.filter(s => s.length < avgLength - stdDev);
    const longSessions = sessions.filter(s => s.length > avgLength + stdDev);

    if (shortSessions.length >= minOccurrences) {
      patterns.push({
        patternId: uuidv4(),
        userId,
        patternType: 'session',
        description: `${shortSessions.length} short sessions (${Math.round(avgLength - stdDev)} events or less)`,
        confidence: Math.min(shortSessions.length / 10, 1),
        occurrences: shortSessions.map(s => new Date(s[0].timestamp)),
        frequency: 'daily',
        detectedAt: new Date()
      });
    }

    if (longSessions.length >= minOccurrences) {
      patterns.push({
        patternId: uuidv4(),
        userId,
        patternType: 'session',
        description: `${longSessions.length} extended sessions (${Math.round(avgLength + stdDev)} events or more)`,
        confidence: Math.min(longSessions.length / 10, 1),
        occurrences: longSessions.map(s => new Date(s[0].timestamp)),
        frequency: 'daily',
        detectedAt: new Date()
      });
    }

    return patterns;
  }

  /**
   * Detect engagement patterns
   */
  private detectEngagementPatterns(
    userId: string,
    events: BehaviorEvent[],
    minOccurrences: number
  ): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    // Look for engagement actions
    const engagementActions = ['review', 'share', 'add_to_wishlist'];
    const engagementEvents = events.filter(e => engagementActions.includes(e.action));

    if (engagementEvents.length >= minOccurrences) {
      // Time distribution of engagement
      const hourlyEngagement = new Map<number, number>();
      for (let i = 0; i < 24; i++) hourlyEngagement.set(i, 0);

      engagementEvents.forEach(e => {
        const hour = new Date(e.timestamp).getHours();
        hourlyEngagement.set(hour, (hourlyEngagement.get(hour) || 0) + 1);
      });

      const peakHours = Array.from(hourlyEngagement.entries())
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour);

      patterns.push({
        patternId: uuidv4(),
        userId,
        patternType: 'engagement',
        description: `${engagementEvents.length} engagement actions detected`,
        confidence: Math.min(engagementEvents.length / 20, 1),
        occurrences: engagementEvents.map(e => new Date(e.timestamp)),
        frequency: 'weekly',
        peakTimes: peakHours.length > 0 ? { hourOfDay: peakHours } : undefined,
        detectedAt: new Date()
      });
    }

    return patterns;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    patterns: TemporalPattern[],
    periodicPatterns: PeriodicPattern[]
  ): ConfidenceLevel {
    const totalPatterns = patterns.length + periodicPatterns.length;
    
    if (totalPatterns === 0) return 'LOW';
    if (totalPatterns < 3) return 'LOW';
    if (totalPatterns < 5) return 'MEDIUM';
    
    const avgConfidence = [
      ...patterns.map(p => p.confidence),
      ...periodicPatterns.map(p => p.confidence)
    ].reduce((a, b) => a + b, 0) / totalPatterns;

    if (avgConfidence >= 0.8) return 'VERY_HIGH';
    if (avgConfidence >= 0.6) return 'HIGH';
    if (avgConfidence >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate summary of detected patterns
   */
  private generateSummary(
    patterns: TemporalPattern[],
    periodicPatterns: PeriodicPattern[]
  ): string {
    const parts: string[] = [];

    if (patterns.length > 0) {
      const temporalCount = patterns.filter(p => p.patternType === 'temporal').length;
      const sequentialCount = patterns.filter(p => p.patternType === 'sequential').length;
      
      if (temporalCount > 0) {
        parts.push(`${temporalCount} temporal patterns found`);
      }
      if (sequentialCount > 0) {
        parts.push(`${sequentialCount} sequential patterns detected`);
      }
    }

    if (periodicPatterns.length > 0) {
      const dailyPatterns = periodicPatterns.filter(p => p.period <= 24);
      if (dailyPatterns.length > 0) {
        parts.push(`${dailyPatterns.length} daily periodic patterns`);
      }
    }

    return parts.length > 0 
      ? `Analysis found ${parts.join(', ')}.`
      : 'No significant patterns detected. More data may be needed.';
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(
    patterns: TemporalPattern[],
    periodicPatterns: PeriodicPattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for temporal patterns
    const temporalPatterns = patterns.filter(p => p.patternType === 'temporal');
    temporalPatterns.forEach(pattern => {
      if (pattern.peakTimes?.hourOfDay) {
        const hours = pattern.peakTimes.hourOfDay;
        recommendations.push(
          `Send notifications between ${Math.min(...hours)}:00 and ${Math.max(...hours)}:00 for optimal engagement`
        );
      }
      if (pattern.peakTimes?.dayOfWeek) {
        recommendations.push(
          `Schedule campaigns for ${pattern.peakTimes.dayOfWeek.join(', ')} for maximum reach`
        );
      }
    });

    // Check for periodic patterns
    if (periodicPatterns.length > 0) {
      const weeklyPattern = periodicPatterns.find(p => p.period >= 160 && p.period <= 200);
      if (weeklyPattern) {
        recommendations.push(
          `User shows weekly engagement pattern. Consider weekly loyalty campaigns.`
        );
      }
    }

    // Check for sequential patterns
    const sequentialPatterns = patterns.filter(p => p.patternType === 'sequential');
    if (sequentialPatterns.length > 0) {
      recommendations.push(
        `User has ${sequentialPatterns.length} consistent behavior sequences. Personalize based on sequence position.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Collect more data to generate actionable recommendations');
    }

    return recommendations;
  }

  /**
   * Determine frequency based on occurrences
   */
  private determineFrequency(occurrences: Date[]): 'hourly' | 'daily' | 'weekly' | 'monthly' {
    if (occurrences.length < 2) return 'daily';

    const sorted = [...occurrences].sort((a, b) => a.getTime() - b.getTime());
    const first = sorted[0].getTime();
    const last = sorted[sorted.length - 1].getTime();
    const avgGap = (last - first) / (sorted.length - 1);

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;

    if (avgGap < 6 * hourMs) return 'hourly';
    if (avgGap < 2 * dayMs) return 'daily';
    if (avgGap < 2 * weekMs) return 'weekly';
    return 'monthly';
  }

  /**
   * Group events by session
   */
  private groupBySession(events: BehaviorEvent[]): BehaviorEvent[][] {
    const sessionMap = new Map<string, BehaviorEvent[]>();

    events.forEach(event => {
      const existing = sessionMap.get(event.sessionId);
      if (existing) {
        existing.push(event);
      } else {
        sessionMap.set(event.sessionId, [event]);
      }
    });

    return Array.from(sessionMap.values());
  }
}

export default PatternDetector;

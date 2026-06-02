/**
 * Demand Forecaster Service
 * Predicts demand based on historical data, real-time signals, and patterns
 */

import {
  DemandContext,
  HistoricalPriceData,
  TimeContext,
} from '../types/index.js';

interface DemandForecastConfig {
  lookbackDays: number;
  predictionHorizonHours: number;
  seasonalityWeight: number;
  trendWeight: number;
  realtimeWeight: number;
}

const DEFAULT_FORECAST_CONFIG: DemandForecastConfig = {
  lookbackDays: 30,
  predictionHorizonHours: 24,
  seasonalityWeight: 0.35,
  trendWeight: 0.30,
  realtimeWeight: 0.35,
};

export interface DemandForecastResult {
  currentDemand: number;
  predictedDemand: number;
  historicalAverage: number;
  realTimeInterest: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
  factors: {
    seasonal: number;
    trend: number;
    realtime: number;
  };
  nextPeakTime?: Date;
  nextLowTime?: Date;
}

export interface DemandSignal {
  type: 'search' | 'view' | 'cart' | 'purchase' | 'wishlist' | 'social';
  count: number;
  weight: number;
  timestamp: Date;
}

export class DemandForecaster {
  private config: DemandForecastConfig;
  private historicalData: Map<string, HistoricalPriceData[]>;
  private realtimeSignals: Map<string, DemandSignal[]>;

  constructor(config: Partial<DemandForecastConfig> = {}) {
    this.config = { ...DEFAULT_FORECAST_CONFIG, ...config };
    this.historicalData = new Map();
    this.realtimeSignals = new Map();
  }

  /**
   * Get complete demand context for a product
   */
  async getDemandContext(
    productId: string,
    time: TimeContext
  ): Promise<DemandContext> {
    const forecast = await this.forecastDemand(productId, time);

    return {
      currentDemand: forecast.currentDemand,
      predictedDemand: forecast.predictedDemand,
      historicalAverage: forecast.historicalAverage,
      realTimeInterest: forecast.realTimeInterest,
      trend: forecast.trend,
      confidence: forecast.confidence,
    };
  }

  /**
   * Forecast demand for a product
   */
  async forecastDemand(
    productId: string,
    time: TimeContext
  ): Promise<DemandForecastResult> {
    // Get historical data for this product
    const history = this.getHistoricalData(productId);

    // Calculate seasonal factor
    const seasonalFactor = this.calculateSeasonalFactor(productId, time, history);

    // Calculate trend factor
    const trendFactor = this.calculateTrendFactor(productId, history);

    // Calculate realtime interest
    const realtimeFactor = this.calculateRealtimeFactor(productId);

    // Combine factors with weights
    const weightedFactor =
      seasonalFactor * this.config.seasonalityWeight +
      trendFactor * this.config.trendWeight +
      realtimeFactor * this.config.realtimeWeight;

    // Calculate historical average
    const historicalAverage = this.calculateHistoricalAverage(history);

    // Current demand based on real-time signals and recent history
    const currentDemand = this.normalizeDemand(
      this.calculateCurrentDemand(history, realtimeFactor)
    );

    // Predicted demand incorporates seasonal patterns
    const predictedDemand = this.normalizeDemand(
      weightedFactor * historicalAverage * 1.1
    );

    // Determine trend
    const trend = this.determineTrend(history);

    // Calculate confidence
    const confidence = this.calculateConfidence(history, productId);

    // Find next peak and low times
    const { nextPeakTime, nextLowTime } = this.findNextPeakAndLow(time);

    return {
      currentDemand,
      predictedDemand,
      historicalAverage,
      realTimeInterest: realtimeFactor,
      trend,
      confidence,
      factors: {
        seasonal: seasonalFactor,
        trend: trendFactor,
        realtime: realtimeFactor,
      },
      nextPeakTime,
      nextLowTime,
    };
  }

  /**
   * Calculate seasonal demand factor
   */
  private calculateSeasonalFactor(
    _productId: string,
    time: TimeContext,
    _history: HistoricalPriceData[]
  ): number {
    // Day of week patterns
    const dayOfWeekDemand: Record<number, number> = {
      0: 1.2,  // Sunday
      1: 0.8,  // Monday
      2: 0.9,  // Tuesday
      3: 0.7,  // Wednesday - typically lowest
      4: 0.95, // Thursday
      5: 1.3,  // Friday
      6: 1.25, // Saturday
    };

    // Hour of day patterns (simplified for retail)
    const hourDemandFactor: Record<number, number> = {
      6: 0.3, 7: 0.4, 8: 0.5, 9: 0.7, 10: 0.85,
      11: 0.95, 12: 1.0, 13: 0.95, 14: 0.9, 15: 0.85,
      16: 0.9, 17: 1.0, 18: 1.1, 19: 1.2, 20: 1.15,
      21: 1.0, 22: 0.7, 23: 0.4, 0: 0.2, 1: 0.15,
      2: 0.1, 3: 0.1, 4: 0.15, 5: 0.2,
    };

    const dayFactor = dayOfWeekDemand[time.dayOfWeek] || 1.0;
    const hourFactor = hourDemandFactor[time.hourOfDay] || 0.5;

    // Season adjustment
    const seasonFactors: Record<string, number> = {
      spring: 1.0,
      summer: time.hourOfDay >= 10 && time.hourOfDay <= 16 ? 1.2 : 0.95,
      autumn: 1.0,
      winter: 1.15, // Winter typically higher demand
    };
    const seasonFactor = seasonFactors[time.season] || 1.0;

    // Event/Holiday boost
    const eventFactor = time.isHoliday || time.isEventDay ? 1.5 : 1.0;

    // Combine factors
    return dayFactor * hourFactor * seasonFactor * eventFactor;
  }

  /**
   * Calculate demand trend from historical data
   */
  private calculateTrendFactor(
    _productId: string,
    history: HistoricalPriceData[]
  ): number {
    if (history.length < 7) {
      return 1.0; // Insufficient data
    }

    // Calculate week-over-week change
    const recentWeeks = this.groupByWeek(history, 2);
    if (recentWeeks.length < 2) {
      return 1.0;
    }

    const currentWeekAvg = recentWeeks[0].reduce((sum, d) => sum + d.demand, 0) / recentWeeks[0].length;
    const previousWeekAvg = recentWeeks[1].reduce((sum, d) => sum + d.demand, 0) / recentWeeks[1].length;

    const trendRatio = currentWeekAvg / (previousWeekAvg || 1);

    // Bound the trend factor
    return Math.max(0.5, Math.min(1.5, trendRatio));
  }

  /**
   * Calculate real-time interest factor
   */
  private calculateRealtimeFactor(productId: string): number {
    const signals = this.realtimeSignals.get(productId) || [];

    // Weight signals by recency
    const now = Date.now();
    const recentSignals = signals.filter(s => {
      const age = now - s.timestamp.getTime();
      return age < 3600000; // Within last hour
    });

    if (recentSignals.length === 0) {
      return 0.5; // Neutral
    }

    // Calculate weighted score
    const weightedScore = recentSignals.reduce((sum, signal) => {
      const ageWeight = Math.max(0.1, 1 - (now - signal.timestamp.getTime()) / 3600000);
      return sum + signal.count * signal.weight * ageWeight;
    }, 0);

    // Normalize to 0-1 range (capped)
    return Math.min(1, weightedScore / 100);
  }

  /**
   * Add real-time demand signal
   */
  addRealtimeSignal(productId: string, signal: DemandSignal): void {
    const signals = this.realtimeSignals.get(productId) || [];
    signals.push({ ...signal, timestamp: new Date() });
    this.realtimeSignals.set(productId, signals);

    // Keep only last 100 signals
    if (signals.length > 100) {
      this.realtimeSignals.set(productId, signals.slice(-100));
    }
  }

  /**
   * Get historical data for a product
   */
  private getHistoricalData(productId: string): HistoricalPriceData[] {
    return this.historicalData.get(productId) || this.generateMockHistory(productId);
  }

  /**
   * Add historical data
   */
  addHistoricalData(data: HistoricalPriceData): void {
    const history = this.historicalData.get(data.productId) || [];
    history.push(data);
    // Keep last 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const filtered = history.filter(d => d.date >= cutoff);
    this.historicalData.set(data.productId, filtered);
  }

  /**
   * Calculate historical average demand
   */
  private calculateHistoricalAverage(history: HistoricalPriceData[]): number {
    if (history.length === 0) {
      return 0.5;
    }
    const sum = history.reduce((acc, d) => acc + d.demand, 0);
    return sum / history.length;
  }

  /**
   * Calculate current demand
   */
  private calculateCurrentDemand(
    history: HistoricalPriceData[],
    realtimeFactor: number
  ): number {
    if (history.length === 0) {
      return realtimeFactor;
    }

    // Use last 7 days average as current demand base
    const recentData = history.slice(-7);
    const recentAvg = recentData.reduce((sum, d) => sum + d.demand, 0) / recentData.length;

    // Blend with realtime
    return recentAvg * 0.7 + realtimeFactor * 0.3;
  }

  /**
   * Normalize demand to 0-1 range
   */
  private normalizeDemand(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Determine demand trend
   */
  private determineTrend(history: HistoricalPriceData[]): 'increasing' | 'stable' | 'decreasing' {
    if (history.length < 14) {
      return 'stable';
    }

    const recentWeeks = this.groupByWeek(history, 2);
    if (recentWeeks.length < 2) {
      return 'stable';
    }

    const currentWeek = recentWeeks[0].reduce((sum, d) => sum + d.demand, 0) / recentWeeks[0].length;
    const previousWeek = recentWeeks[1].reduce((sum, d) => sum + d.demand, 0) / recentWeeks[1].length;

    const change = (currentWeek - previousWeek) / previousWeek;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate forecast confidence
   */
  private calculateConfidence(history: HistoricalPriceData[], productId: string): number {
    let confidence = 0.3; // Base confidence

    // History length factor
    confidence += Math.min(0.3, history.length / 100);

    // Real-time signals availability
    const signals = this.realtimeSignals.get(productId) || [];
    if (signals.length > 10) {
      confidence += 0.2;
    } else if (signals.length > 0) {
      confidence += 0.1;
    }

    // Trend consistency
    const variance = this.calculateVariance(history.map(d => d.demand));
    if (variance < 0.1) {
      confidence += 0.2; // Stable patterns = higher confidence
    }

    return Math.min(1, confidence);
  }

  /**
   * Find next peak and low demand times
   */
  private findNextPeakAndLow(time: TimeContext): { nextPeakTime?: Date; nextLowTime?: Date } {
    const now = new Date();
    const currentHour = time.hourOfDay;

    // Find next peak hour (typically 18:00 or 12:00)
    const peakHours = [12, 18];
    let nextPeakHour = peakHours.find(h => h > currentHour);
    if (!nextPeakHour) nextPeakHour = peakHours[0];

    const nextPeakTime = new Date(now);
    nextPeakTime.setHours(nextPeakHour, 0, 0, 0);
    if (nextPeakTime <= now) {
      nextPeakTime.setDate(nextPeakTime.getDate() + 1);
    }

    // Find next low hour (typically 3:00 or 6:00)
    const lowHours = [3, 6];
    let nextLowHour = lowHours.find(h => h > currentHour);
    if (!nextLowHour) nextLowHour = lowHours[0];

    const nextLowTime = new Date(now);
    nextLowTime.setHours(nextLowHour, 0, 0, 0);
    if (nextLowTime <= now) {
      nextLowTime.setDate(nextLowTime.getDate() + 1);
    }

    return { nextPeakTime, nextLowTime };
  }

  /**
   * Group data by week
   */
  private groupByWeek(data: HistoricalPriceData[], weeks: number): HistoricalPriceData[][] {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const groups: HistoricalPriceData[][] = [];

    for (let i = 0; i < weeks; i++) {
      const weekStart = now - (i + 1) * weekMs;
      const weekEnd = now - i * weekMs;
      const weekData = data.filter(d => {
        const dTime = d.date.getTime();
        return dTime >= weekStart && dTime < weekEnd;
      });
      groups.push(weekData);
    }

    return groups;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Generate mock historical data for testing
   */
  private generateMockHistory(productId: string): HistoricalPriceData[] {
    const history: HistoricalPriceData[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 90; i >= 0; i--) {
      const date = new Date(now - i * dayMs);
      const dayOfWeek = date.getDay();
      const baseDemand = 0.5 + Math.random() * 0.3;
      const dayFactor = [1.2, 0.8, 0.9, 0.7, 0.95, 1.3, 1.25][dayOfWeek];

      history.push({
        productId,
        date,
        price: 10 + Math.random() * 2,
        demand: baseDemand * dayFactor,
        sales: Math.floor(50 + Math.random() * 100),
        competitorAvg: 10.5 + Math.random() * 1,
      });
    }

    return history;
  }
}

export default DemandForecaster;

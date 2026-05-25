/**
 * REZ Visit Probability Model
 *
 * Predicts when and where users will visit merchants.
 *
 * This enables:
 * - Pre-targeting of likely visitors
 * - Dynamic ad scheduling
 * - Merchant demand forecasting
 * - Personalized offers
 */

import axios from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const GRAPH_SERVICE_URL = process.env.GRAPH_SERVICE_URL || 'http://localhost:4129';
const INTENT_SERVICE_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';

// ============================================================================
// Types
// ============================================================================

export interface VisitPrediction {
  userId: string;
  merchantId: string;
  probability: number; // 0-1
  estimatedTime: {
    day: string; // e.g., "Saturday"
    hour: number; // e.g., 19
  };
  confidence: number; // 0-1
  factors: {
    factor: string;
    contribution: number;
  }[];
  recommendedAction: 'target_now' | 'target_evening' | 'target_weekend' | 'no_action';
}

export interface VisitProfile {
  userId: string;
  patterns: {
    avgVisitsPerWeek: number;
    avgSpendPerVisit: number;
    preferredDays: string[];
    preferredHours: number[];
    preferredCategories: string[];
    avgTimeBetweenVisits: number; // days
    seasonalityFactor: number;
  };
  predictions: VisitPrediction[];
  riskFactors: {
    factor: string;
    score: number; // higher = more likely to churn
  }[];
}

export interface MerchantForecast {
  merchantId: string;
  forecasts: {
    date: string;
    predictedVisits: number;
    predictedRevenue: number;
    confidence: number;
  }[];
  busyHours: number[];
  slowHours: number[];
  recommendations: string[];
}

// ============================================================================
// Visit Probability Calculator
// ============================================================================

class VisitProbabilityCalculator {
  /**
   * Calculate visit probability for user to merchant
   */
  calculate(
    userId: string,
    merchantId: string,
    userProfile,
    merchantProfile: unknown
  ): VisitPrediction {
    const factors: { factor: string; contribution: number }[] = [];
    let baseProbability = 0.5;

    // Factor 1: Historical visits
    if (userProfile?.patterns?.visits) {
      const visitFrequency = userProfile.patterns.visits / userProfile.patterns.days;
      const frequencyContribution = Math.min(visitFrequency * 0.1, 0.2);
      baseProbability += frequencyContribution;
      factors.push({
        factor: 'Historical visits',
        contribution: frequencyContribution
      });
    }

    // Factor 2: Recency
    if (userProfile?.patterns?.lastVisit) {
      const daysSinceVisit = this.daysSince(userProfile.patterns.lastVisit);
      const recencyContribution = daysSinceVisit > 14 ? 0.15 : -0.05;
      baseProbability += recencyContribution;
      factors.push({
        factor: `Days since last visit: ${daysSinceVisit}`,
        contribution: recencyContribution
      });
    }

    // Factor 3: Day of week
    const today = new Date().getDay();
    if (userProfile?.patterns?.preferredDays?.includes(this.dayName(today))) {
      baseProbability += 0.1;
      factors.push({
        factor: 'Preferred day matches today',
        contribution: 0.1
      });
    }

    // Factor 4: Time of day
    const hour = new Date().getHours();
    if (userProfile?.patterns?.preferredHours?.includes(hour)) {
      baseProbability += 0.08;
      factors.push({
        factor: 'Preferred time matches current',
        contribution: 0.08
      });
    }

    // Factor 5: Category affinity
    if (merchantProfile?.category &&
        userProfile?.patterns?.preferredCategories?.includes(merchantProfile.category)) {
      baseProbability += 0.12;
      factors.push({
        factor: `Likes ${merchantProfile.category}`,
        contribution: 0.12
      });
    }

    // Factor 6: Distance
    if (userProfile?.location && merchantProfile?.location) {
      const distance = this.calculateDistance(
        userProfile.location,
        merchantProfile.location
      );
      if (distance < 1) {
        baseProbability += 0.1;
        factors.push({
          factor: 'Very nearby (< 1km)',
          contribution: 0.1
        });
      } else if (distance > 5) {
        baseProbability -= 0.15;
        factors.push({
          factor: 'Far away (> 5km)',
          contribution: -0.15
        });
      }
    }

    // Factor 7: Expiring incentives
    if (userProfile?.wallet?.expiringCoins > 0) {
      baseProbability += 0.08;
      factors.push({
        factor: `${userProfile.wallet.expiringCoins} coins expiring`,
        contribution: 0.08
      });
    }

    // Clamp probability
    const probability = Math.max(0, Math.min(1, baseProbability));

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(userProfile);

    // Determine recommended action
    const action = this.determineAction(probability, hour);

    return {
      userId,
      merchantId,
      probability,
      estimatedTime: {
        day: this.dayName((today + 1) % 7),
        hour: userProfile?.patterns?.preferredHours?.[0] || 19
      },
      confidence,
      factors: factors.sort((a, b) => b.contribution - a.contribution),
      recommendedAction: action
    };
  }

  /**
   * Build visit profile for user
   */
  buildVisitProfile(userId: string, visitHistory: unknown[]): VisitProfile {
    if (visitHistory.length === 0) {
      return {
        userId,
        patterns: {
          avgVisitsPerWeek: 0,
          avgSpendPerVisit: 0,
          preferredDays: [],
          preferredHours: [],
          preferredCategories: [],
          avgTimeBetweenVisits: 0,
          seasonalityFactor: 1
        },
        predictions: [],
        riskFactors: []
      };
    }

    // Calculate patterns
    const visitsByDay = this.groupBy(visitHistory, 'dayOfWeek');
    const visitsByHour = this.groupBy(visitHistory, 'hour');
    const visitsByCategory = this.groupBy(visitHistory, 'category');

    const totalSpend = visitHistory.reduce((sum, v) => sum + (v.spend || 0), 0);
    const days = visitHistory.length;
    const weeks = Math.max(1, Math.ceil(days / 7));

    return {
      userId,
      patterns: {
        avgVisitsPerWeek: Math.round(visitHistory.length / weeks * 10) / 10,
        avgSpendPerVisit: Math.round(totalSpend / visitHistory.length),
        preferredDays: Object.keys(visitsByDay)
          .sort((a, b) => visitsByDay[b] - visitsByDay[a])
          .slice(0, 3),
        preferredHours: Object.keys(visitsByHour)
          .map(Number)
          .sort((a, b) => visitsByHour[b] - visitsByHour[a])
          .slice(0, 3),
        preferredCategories: Object.keys(visitsByCategory)
          .sort((a, b) => visitsByCategory[b] - visitsByCategory[a])
          .slice(0, 5),
        avgTimeBetweenVisits: Math.round(days / Math.max(1, visitHistory.length)),
        seasonalityFactor: this.calculateSeasonality(visitHistory)
      },
      predictions: [],
      riskFactors: this.identifyRiskFactors(visitHistory)
    };
  }

  /**
   * Forecast visits for merchant
   */
  forecastMerchantVisits(merchantId: string, history: unknown[]): MerchantForecast {
    const today = new Date();
    const forecasts = [];

    // Generate 7-day forecast
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseVisits = this.getAverageVisits(history, date.getDay());
      const weekendMultiplier = isWeekend ? 1.3 : 1;

      forecasts.push({
        date: date.toISOString().split('T')[0],
        predictedVisits: Math.round(baseVisits * weekendMultiplier),
        predictedRevenue: Math.round(baseVisits * weekendMultiplier * this.getAverageSpend(history)),
        confidence: 0.7 + (Math.random() * 0.2)
      });
    }

    const hourlyVisits = this.getHourlyDistribution(history);

    return {
      merchantId,
      forecasts,
      busyHours: hourlyVisits.filter(h => h.visits > 10).map(h => h.hour),
      slowHours: hourlyVisits.filter(h => h.visits < 3).map(h => h.hour),
      recommendations: this.generateRecommendations(forecasts, hourlyVisits)
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const today = new Date();
    return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private dayName(dayNum: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  }

  private calculateDistance(loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number {
    // Haversine formula
    const R = 6371; // km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateConfidence(profile): number {
    let score = 0.5;
    if (profile?.patterns?.visits > 10) score += 0.2;
    if (profile?.patterns?.lastVisit) score += 0.15;
    if (profile?.wallet) score += 0.1;
    return Math.min(score, 0.95);
  }

  private determineAction(probability: number, hour: number): VisitPrediction['recommendedAction'] {
    if (probability > 0.7) return 'target_now';
    if (probability > 0.5 && hour < 17) return 'target_evening';
    if (probability > 0.4) return 'target_weekend';
    return 'no_action';
  }

  private groupBy(items: unknown[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateSeasonality(history: unknown[]): number {
    // Simple seasonality: compare weekday vs weekend visits
    const weekdayVisits = history.filter(v => v.dayOfWeek >= 1 && v.dayOfWeek <= 5).length;
    const weekendVisits = history.filter(v => v.dayOfWeek === 0 || v.dayOfWeek === 6).length;
    const weekdayAvg = weekdayVisits / 5;
    const weekendAvg = weekendVisits / 2;
    return weekendAvg > weekdayAvg ? 1.2 : 0.9;
  }

  private getAverageVisits(history: unknown[], dayOfWeek: number): number {
    const dayHistory = history.filter(v => v.dayOfWeek === dayOfWeek);
    const weekCount = Math.max(1, Math.ceil(history.length / 7));
    return dayHistory.length / weekCount;
  }

  private getAverageSpend(history: unknown[]): number {
    if (history.length === 0) return 300;
    return history.reduce((sum, v) => sum + (v.spend || 300), 0) / history.length;
  }

  private getHourlyDistribution(history: unknown[]): { hour: number; visits: number }[] {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    history.forEach(v => {
      hours[v.hour] = (hours[v.hour] || 0) + 1;
    });
    return Object.entries(hours).map(([hour, visits]) => ({ hour: Number(hour), visits }));
  }

  private identifyRiskFactors(history: unknown[]): VisitProfile['riskFactors'] {
    const risks: VisitProfile['riskFactors'] = [];

    if (history.length === 0) {
      risks.push({ factor: 'No visit history', score: 1.0 });
      return risks;
    }

    const daysSinceLast = this.daysSince(history[history.length - 1]?.date);
    if (daysSinceLast > 30) {
      risks.push({ factor: `No visit in ${daysSinceLast} days`, score: 0.9 });
    } else if (daysSinceLast > 14) {
      risks.push({ factor: `No visit in ${daysSinceLast} days`, score: 0.6 });
    }

    return risks;
  }

  private generateRecommendations(forecasts: unknown[], busyHours: number[]): string[] {
    const recs = [];

    const peakHour = busyHours.find(h => h.visits === Math.max(...busyHours.map(h => h.visits)));
    if (peakHour && peakHour.hour > 21) {
      recs.push('Consider extending evening hours to capture late-night demand');
    }

    const slowDay = forecasts.reduce((min, f) => f.predictedVisits < min.predictedVisits ? f : min);
    if (slowDay?.predictedVisits < 5) {
      recs.push(`Consider promotions for ${slowDay.date} (predicted low traffic)`);
    }

    if (recs.length === 0) {
      recs.push('Traffic patterns look healthy');
    }

    return recs;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const visitPredictionService = new VisitProbabilityCalculator();
export default visitPredictionService;

/**
 * REZ Context Engine - Unified Context Service
 * Combines weather, holiday, and traffic context for demand prediction
 */

import { weatherService, WeatherData, WeatherMultiplier } from './weatherService.js';
import { holidayService, HolidayContext, Holiday } from './holidayService.js';
import { trafficService, TrafficData, TimeSlotMultiplier } from './trafficService.js';
import { logger } from './utils/logger';

export interface UnifiedContext {
  timestamp: Date;
  city: string;
  coordinates?: { lat: number; lon: number };

  // Weather context
  weather: WeatherData | null;
  weatherMultiplier: WeatherMultiplier | null;

  // Holiday context
  holiday: HolidayContext;

  // Traffic context
  traffic: TrafficData | null;
  timeSlot: TimeSlotMultiplier;

  // Combined multipliers
  multipliers: CategoryMultipliers;

  // Demand indicators
  demandIndicators: DemandIndicators;
}

export interface CategoryMultipliers {
  outdoor: number;
  indoor: number;
  delivery: number;
  ride: number;
  restaurant: number;
  retail: number;
  entertainment: number;
  travel: number;
}

export interface DemandIndicators {
  overallDemand: 'low' | 'normal' | 'high' | 'surge' | 'extreme';
  demandScore: number; // 0-100
  peakWindow: boolean;
  bestCategories: string[];
  worstCategories: string[];
  insights: string[];
}

const DEMAND_THRESHOLDS = {
  extreme: 80,
  surge: 60,
  high: 40,
  normal: 20
};

export class ContextService {
  /**
   * Get unified context for a location
   */
  async getContext(
    city: string,
    coordinates?: { lat: number; lon: number },
    date?: Date
  ): Promise<UnifiedContext> {
    const timestamp = date || new Date();

    try {
      // Fetch all context data in parallel
      const [weather, holiday, trafficResult] = await Promise.all([
        weatherService.getWeather(city, coordinates),
        Promise.resolve(holidayService.getContext(timestamp)),
        trafficService.getCombinedMultiplier(city, 'delivery')
      ]);

      const weatherMultiplier = weather ? weatherService.getMultipliers(weather) : null;

      // Combine all multipliers
      const multipliers = this.calculateMultipliers(
        weatherMultiplier,
        holiday.multipliers,
        trafficResult.baseMultiplier,
        trafficResult.timeMultiplier
      );

      // Calculate demand indicators
      const demandIndicators = this.calculateDemandIndicators(
        multipliers,
        holiday,
        trafficResult.timeSlot
      );

      return {
        timestamp,
        city,
        coordinates,
        weather,
        weatherMultiplier,
        holiday,
        traffic: trafficResult.traffic,
        timeSlot: trafficResult.timeSlot,
        multipliers,
        demandIndicators
      };
    } catch (error) {
      logger.error('Failed to get unified context', { city, error });
      throw error;
    }
  }

  /**
   * Get context for a specific category
   */
  async getCategoryContext(
    city: string,
    category: keyof CategoryMultipliers,
    coordinates?: { lat: number; lon: number }
  ): Promise<{
    multiplier: number;
    reason: string;
    breakdown: {
      weather: number;
      holiday: number;
      traffic: number;
    };
  }> {
    const context = await this.getContext(city, coordinates);

    const weatherFactor = context.weatherMultiplier
      ? this.getCategoryWeatherFactor(category, context.weatherMultiplier)
      : 1.0;

    const holidayFactor = this.getCategoryHolidayFactor(category, context.holiday);
    const trafficFactor = this.getCategoryTrafficFactor(category, context);

    const multiplier = weatherFactor * holidayFactor * trafficFactor;

    const reasons: string[] = [];
    if (weatherFactor !== 1.0 && context.weather) {
      reasons.push(context.weatherMultiplier?.reason || '');
    }
    if (holidayFactor !== 1.0) {
      reasons.push(context.holiday.multipliers.description);
    }
    if (trafficFactor !== 1.0) {
      reasons.push(context.timeSlot.description);
    }

    return {
      multiplier: Math.round(multiplier * 100) / 100,
      reason: reasons.filter(Boolean).join('. ') || 'Normal conditions',
      breakdown: {
        weather: Math.round(weatherFactor * 100) / 100,
        holiday: Math.round(holidayFactor * 100) / 100,
        traffic: Math.round(trafficFactor * 100) / 100
      }
    };
  }

  /**
   * Get event demand prediction (for Z-Events)
   */
  async getEventContext(
    city: string,
    eventDate: Date,
    isOutdoor: boolean,
    coordinates?: { lat: number; lon: number }
  ): Promise<{
    baseMultiplier: number;
    weatherImpact: number;
    holidayImpact: number;
    dayOfWeekImpact: number;
    demandForecast: 'low' | 'moderate' | 'high' | 'sold_out';
    recommendations: string[];
  }> {
    const context = await this.getContext(city, coordinates, eventDate);

    const category = isOutdoor ? 'outdoor' : 'indoor';
    const baseMultiplier = context.multipliers[category];

    // Calculate individual impacts
    const weatherImpact = context.weatherMultiplier
      ? context.weatherMultiplier[category === 'outdoor' ? 'outdoorMultiplier' : 'indoorMultiplier']
      : 1.0;

    const holidayImpact = isOutdoor
      ? context.holiday.multipliers.entertainmentMultiplier
      : context.holiday.multipliers.restaurantMultiplier;

    const dayOfWeekImpact = this.getDayOfWeekImpact(eventDate);

    // Generate recommendations
    const recommendations: string[] = [];

    if (context.weather && context.weather.condition === 'rain') {
      recommendations.push('Rain expected - indoor venues may see higher walk-ins');
    }
    if (context.weather && context.weather.condition === 'hot') {
      recommendations.push('Hot weather - consider evening timings for outdoor events');
    }
    if (context.holiday.isHoliday) {
      recommendations.push(`${context.holiday.holiday?.name} - expect higher attendance`);
    }
    if (context.holiday.isNearHoliday) {
      recommendations.push(`${context.holiday.daysToHoliday} days before ${context.holiday.holiday?.name}`);
    }
    if (context.timeSlot.slot === 'dinner') {
      recommendations.push('Dinner time - consider staggered entry to manage crowds');
    }

    // Demand forecast
    const combinedDemand = baseMultiplier * dayOfWeekImpact;
    let demandForecast: 'low' | 'moderate' | 'high' | 'sold_out';

    if (combinedDemand >= 2.0) {
      demandForecast = 'sold_out';
      recommendations.push('HIGH DEMAND - Consider adding more inventory');
    } else if (combinedDemand >= 1.5) {
      demandForecast = 'high';
    } else if (combinedDemand >= 1.0) {
      demandForecast = 'moderate';
    } else {
      demandForecast = 'low';
      recommendations.push('Lower demand expected - focus on marketing/promotions');
    }

    return {
      baseMultiplier: Math.round(baseMultiplier * 100) / 100,
      weatherImpact: Math.round(weatherImpact * 100) / 100,
      holidayImpact: Math.round(holidayImpact * 100) / 100,
      dayOfWeekImpact,
      demandForecast,
      recommendations
    };
  }

  /**
   * Get spillover prediction for nearby merchants (from events)
   */
  async getSpilloverContext(
    eventCity: string,
    eventDate: Date,
    category: 'restaurant' | 'retail' | 'transport' = 'restaurant'
  ): Promise<{
    spilloverMultiplier: number;
    peakHours: number[];
    recommendedPromotions: string[];
  }> {
    const context = await this.getContext(eventCity, undefined, eventDate);

    // Spillover is strongest for restaurants near event venues
    let spilloverMultiplier: number;

    switch (category) {
      case 'restaurant':
        spilloverMultiplier = context.multipliers.restaurant * (context.holiday.isHoliday ? 1.3 : 1.0);
        break;
      case 'retail':
        spilloverMultiplier = context.multipliers.retail * (context.holiday.isHoliday ? 1.5 : 1.0);
        break;
      case 'transport':
        spilloverMultiplier = context.multipliers.ride * (context.holiday.isHoliday ? 1.4 : 1.0);
        break;
      default:
        spilloverMultiplier = 1.0;
    }

    const recommendedPromotions: string[] = [];

    if (spilloverMultiplier > 1.5) {
      recommendedPromotions.push('Partner with nearby restaurants for event deals');
      recommendedPromotions.push('Offer pre-event dining packages');
    }
    if (context.holiday.isHoliday) {
      recommendedPromotions.push('Holiday bundle deals');
    }
    if (context.timeSlot.slot === 'dinner') {
      recommendedPromotions.push('Post-event dinner promotions');
    }

    return {
      spilloverMultiplier: Math.round(spilloverMultiplier * 100) / 100,
      peakHours: trafficService.getPeakHours().dinner,
      recommendedPromotions
    };
  }

  private calculateMultipliers(
    weather: WeatherMultiplier | null,
    holiday: { retailMultiplier: number; restaurantMultiplier: number; deliveryMultiplier: number; rideMultiplier: number; entertainmentMultiplier: number; travelMultiplier: number },
    trafficMultiplier: number,
    timeMultiplier: number
  ): CategoryMultipliers {
    return {
      outdoor: weather ? weather.outdoorMultiplier : 1.0,
      indoor: weather ? weather.indoorMultiplier : 1.0,
      delivery: (weather ? weather.deliveryMultiplier : 1.0) * trafficMultiplier * timeMultiplier,
      ride: (weather ? weather.rideMultiplier : 1.0) * trafficMultiplier,
      restaurant: holiday.restaurantMultiplier * timeMultiplier,
      retail: holiday.retailMultiplier,
      entertainment: holiday.entertainmentMultiplier,
      travel: holiday.travelMultiplier
    };
  }

  private calculateDemandIndicators(
    multipliers: CategoryMultipliers,
    holiday: HolidayContext,
    timeSlot: TimeSlotMultiplier
  ): DemandIndicators {
    const values = Object.values(multipliers);
    const avgMultiplier = values.reduce((a, b) => a + b, 0) / values.length;
    const maxMultiplier = Math.max(...values);
    const minMultiplier = Math.min(...values);

    let demandScore: number;
    if (avgMultiplier >= 1.8) demandScore = 90;
    else if (avgMultiplier >= 1.5) demandScore = 75;
    else if (avgMultiplier >= 1.2) demandScore = 55;
    else if (avgMultiplier >= 1.0) demandScore = 35;
    else demandScore = 15;

    let overallDemand: DemandIndicators['overallDemand'];
    if (demandScore >= DEMAND_THRESHOLDS.extreme) overallDemand = 'extreme';
    else if (demandScore >= DEMAND_THRESHOLDS.surge) overallDemand = 'surge';
    else if (demandScore >= DEMAND_THRESHOLDS.high) overallDemand = 'high';
    else if (demandScore >= DEMAND_THRESHOLDS.normal) overallDemand = 'normal';
    else overallDemand = 'low';

    const sortedCategories = Object.entries(multipliers)
      .sort(([, a], [, b]) => b - a)
      .map(([k]) => k);

    const bestCategories = sortedCategories.slice(0, 3);
    const worstCategories = sortedCategories.slice(-2).reverse();

    const insights: string[] = [];
    if (maxMultiplier > 1.5) {
      insights.push(`Strong demand for ${bestCategories[0]} (${maxMultiplier.toFixed(1)}x)`);
    }
    if (holiday.isHoliday) {
      insights.push(`${holiday.holiday?.name} driving overall demand`);
    }
    if (holiday.isNearHoliday) {
      insights.push(`Pre-${holiday.holiday?.name} buildup starting`);
    }
    if (timeSlot.slot === 'dinner' || timeSlot.slot === 'lunch') {
      insights.push(`${timeSlot.slot} peak period active`);
    }

    return {
      overallDemand,
      demandScore,
      peakWindow: timeSlot.slot !== 'normal',
      bestCategories,
      worstCategories,
      insights
    };
  }

  private getCategoryWeatherFactor(category: keyof CategoryMultipliers, weather: WeatherMultiplier): number {
    switch (category) {
      case 'outdoor': return weather.outdoorMultiplier;
      case 'indoor': return weather.indoorMultiplier;
      case 'delivery': return weather.deliveryMultiplier;
      case 'ride': return weather.rideMultiplier;
      default: return 1.0;
    }
  }

  private getCategoryHolidayFactor(category: keyof CategoryMultipliers, holiday: HolidayContext): number {
    const multipliers = holiday.multipliers;
    switch (category) {
      case 'retail': return multipliers.retailMultiplier;
      case 'restaurant': return multipliers.restaurantMultiplier;
      case 'delivery': return multipliers.deliveryMultiplier;
      case 'ride': return multipliers.rideMultiplier;
      case 'entertainment': return multipliers.entertainmentMultiplier;
      case 'travel': return multipliers.travelMultiplier;
      default: return 1.0;
    }
  }

  private getCategoryTrafficFactor(category: keyof CategoryMultipliers, context: UnifiedContext): number {
    switch (category) {
      case 'delivery':
        return context.timeSlot.deliveryMultiplier;
      case 'ride':
        return context.timeSlot.rideMultiplier;
      case 'restaurant':
        return context.timeSlot.diningMultiplier;
      default:
        return 1.0;
    }
  }

  private getDayOfWeekImpact(date: Date): number {
    const day = date.getDay();
    if (day === 0 || day === 6) return 1.3; // Weekend
    if (day === 5) return 1.2; // Friday
    if (day === 1) return 0.9; // Monday - post weekend
    return 1.0;
  }
}

export const contextService = new ContextService();

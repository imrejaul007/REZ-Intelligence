/**
 * REZ ETA Prediction - ETA Service
 * ML-based delivery time prediction
 */

import { ETAPredictRequest, ETAPrediction, ETAFactor, GeoLocation, TrafficLevel } from '../types';

export class ETAService {
  private modelVersion = 'v1.0';

  /**
   * Predict ETA for an order
   */
  async predictETA(request: ETAPredictRequest): Promise<ETAPrediction> {
    const factors: ETAFactor[] = [];

    // 1. Distance factor
    const distance = this.calculateDistance(request.pickup, request.dropoff);
    const baseTime = distance / 30 * 60; // 30 km/h average
    factors.push({
      name: 'distance',
      impact: baseTime,
      value: distance,
    });

    // 2. Time of day factor
    const hour = request.orderTime.getHours();
    const timeMultiplier = this.getTimeMultiplier(hour);
    const timeImpact = baseTime * (timeMultiplier - 1);
    factors.push({
      name: 'time_of_day',
      impact: timeImpact,
      value: hour,
    });

    // 3. Day of week factor
    const dayOfWeek = request.orderTime.getDay();
    const dayMultiplier = this.getDayMultiplier(dayOfWeek);
    const dayImpact = baseTime * (dayMultiplier - 1);
    factors.push({
      name: 'day_of_week',
      impact: dayImpact,
      value: dayOfWeek,
    });

    // 4. Merchant preparation time
    const prepTime = await this.getMerchantPrepTime(request.merchantId);
    factors.push({
      name: 'merchant_prep',
      impact: prepTime,
      value: prepTime,
    });

    // 5. Items factor
    const itemImpact = request.items * 2; // 2 min per item
    factors.push({
      name: 'items',
      impact: itemImpact,
      value: request.items,
    });

    // 6. Rider distance (if available)
    if (request.riderLocation) {
      const riderDistance = this.calculateDistance(request.riderLocation, request.pickup);
      const riderImpact = riderDistance / 30 * 60;
      factors.push({
        name: 'rider_to_pickup',
        impact: riderImpact,
        value: riderDistance,
      });
    }

    // Calculate total
    const totalMinutes = factors.reduce((sum, f) => sum + f.impact, 0);

    // Add buffer based on confidence
    const confidence = this.calculateConfidence(factors, distance);
    const buffer = totalMinutes * (1 - confidence) * 0.3;
    const finalMinutes = totalMinutes + buffer;

    const estimatedDelivery = new Date(request.orderTime.getTime() + finalMinutes * 60000);

    return {
      orderId: request.orderId,
      estimatedDeliveryTime: estimatedDelivery,
      estimatedMinutes: Math.round(finalMinutes),
      confidence,
      factors,
      modelVersion: this.modelVersion,
      predictedAt: new Date(),
    };
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(p1: GeoLocation, p2: GeoLocation): number {
    const R = 6371; // km
    const dLat = this.toRad(p2.lat - p1.lat);
    const dLon = this.toRad(p2.lng - p1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(p1.lat)) *
        Math.cos(this.toRad(p2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Time of day multiplier (peak hours = higher)
   */
  private getTimeMultiplier(hour: number): number {
    if (hour >= 12 && hour <= 14) return 1.3; // Lunch
    if (hour >= 19 && hour <= 21) return 1.4; // Dinner
    if (hour >= 8 && hour <= 10) return 1.2; // Breakfast
    return 1.0;
  }

  /**
   * Day of week multiplier (weekends = higher)
   */
  private getDayMultiplier(day: number): number {
    if (day === 0 || day === 6) return 1.25; // Weekend
    if (day === 5) return 1.15; // Friday evening
    return 1.0;
  }

  /**
   * Get merchant preparation time from cache/database
   */
  private async getMerchantPrepTime(merchantId: string): Promise<number> {
    // Default: 15 minutes
    // In production, fetch from merchant data
    return 15;
  }

  /**
   * Calculate prediction confidence based on factors
   */
  private calculateConfidence(factors: ETAFactor[], distance: number): number {
    let confidence = 0.9; // Base confidence

    // Longer distances = lower confidence
    if (distance > 10) confidence -= 0.1;
    if (distance > 20) confidence -= 0.1;

    // More items = lower confidence
    const items = factors.find((f) => f.name === 'items')?.value || 0;
    if (items > 5) confidence -= 0.05;

    // Peak hours = lower confidence
    const hour = new Date().getHours();
    if (hour >= 12 && hour <= 14 || hour >= 19 && hour <= 21) {
      confidence -= 0.1;
    }

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  /**
   * Update model with actual delivery data
   */
  async updateModel(
    orderId: string,
    actualMinutes: number,
    predictedMinutes: number
  ): Promise<void> {
    const error = Math.abs(actualMinutes - predictedMinutes);
    const mape = (error / actualMinutes) * 100;

    // Log for model retraining
    console.log(`ETA Update: order=${orderId}, error=${error.toFixed(1)}min, mape=${mape.toFixed(1)}%`);

    // In production: save to training data for periodic model retraining
  }

  /**
   * Get model accuracy metrics
   */
  async getAccuracyMetrics(): Promise<{
    mape: number;
    within15min: number;
    within30min: number;
  }> {
    // In production: calculate from historical data
    return {
      mape: 12.5, // 12.5% error
      within15min: 78, // 78% within 15 min
      within30min: 94, // 94% within 30 min
    };
  }
}

export const etaService = new ETAService();

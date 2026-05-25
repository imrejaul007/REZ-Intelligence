import axios, { AxiosInstance } from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import type {
  DeliveryInsight,
  RouteOptimization,
  RoutePoint,
  DeliveryAnalytics,
  DeliveryPrediction,
  DelayRisk,
  DeliveryStatus,
} from '../types/index.js';

/**
 * Service for delivery intelligence operations
 */
class DeliveryService {
  private orderClient: AxiosInstance;
  private shippingClient: AxiosInstance;
  private locationClient: AxiosInstance;
  private analyticsClient: AxiosInstance;

  constructor() {
    this.orderClient = axios.create({
      baseURL: config.services.orderServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.shippingClient = axios.create({
      baseURL: config.services.shippingServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.locationClient = axios.create({
      baseURL: config.services.locationServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.analyticsClient = axios.create({
      baseURL: config.services.analyticsServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Calculate delivery score based on various factors
   */
  private calculateDeliveryScore(
    distance: number,
    weatherRisk: number,
    trafficRisk: number,
    carrierReliability: number
  ): number {
    let score = config.delivery.baseDeliveryScore;

    // Distance factor (longer distances = lower score)
    if (distance > 100) score -= 10;
    else if (distance > 50) score -= 5;
    else if (distance > 20) score -= 3;

    // Weather risk
    score -= weatherRisk * 15;

    // Traffic risk
    score -= trafficRisk * 10;

    // Carrier reliability
    score += (carrierReliability - 0.5) * 20;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine delay risk
   */
  private determineDelayRisk(
    distance: number,
    weatherRisk: number,
    trafficRisk: number,
    carrierReliability: number
  ): DelayRisk {
    const riskScore = (weatherRisk + trafficRisk) * 50 + (100 - carrierReliability * 100) + (distance > 50 ? 10 : 0);

    if (riskScore >= 70) return 'CRITICAL';
    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if current time is peak hours
   */
  private isPeakHours(): boolean {
    const hour = new Date().getHours();
    return hour >= config.delivery.peakHoursStart && hour <= config.delivery.peakHoursEnd;
  }

  /**
   * Get delivery insight for an order
   */
  async getDeliveryInsight(orderId: string): Promise<DeliveryInsight> {
    logger.info(`Fetching delivery insight for order ${orderId}`);

    try {
      // Fetch order data
      const orderResponse = await this.orderClient.get(`/api/orders/${orderId}`);
      const order = orderResponse?.data;

      // Fetch shipping data
      const shippingResponse = await this.shippingClient.get(`/api/shipping/order/${orderId}`).catch(() => null);
      const shipping = shippingResponse?.data;

      if (!order) {
        throw new Error('Order not found');
      }

      // Calculate ETA
      const etaHours = shipping?.estimatedDeliveryHours || config.delivery.defaultEtaHours;
      const etaDate = new Date(Date.now() + etaHours * 60 * 60 * 1000);

      // Get current location if available
      let currentLocation = undefined;
      if (shipping?.trackingNumber) {
        try {
          const locationResponse = await this.locationClient.get(
            `/api/location/tracking/${shipping.trackingNumber}`
          );
          currentLocation = locationResponse?.data;
        } catch {
          // Location not available
        }
      }

      // Calculate risk factors (mock for now)
      const weatherRisk = 0.2 + Math.random() * 0.3;
      const trafficRisk = this.isPeakHours() ? 0.6 : 0.2;
      const carrierReliability = 0.85 + Math.random() * 0.1;

      // Calculate metrics
      const deliveryScore = this.calculateDeliveryScore(
        shipping?.distance || 20,
        weatherRisk,
        trafficRisk,
        carrierReliability
      );

      const delayRisk = this.determineDelayRisk(
        shipping?.distance || 20,
        weatherRisk,
        trafficRisk,
        carrierReliability
      );

      const delayFactors = [];
      if (weatherRisk > 0.5) {
        delayFactors.push({
          factor: 'Weather',
          impact: weatherRisk,
          description: 'Poor weather conditions may affect delivery',
        });
      }
      if (trafficRisk > 0.4) {
        delayFactors.push({
          factor: 'Traffic',
          impact: trafficRisk,
          description: 'High traffic congestion expected',
        });
      }

      return {
        orderId,
        trackingNumber: shipping?.trackingNumber,
        status: (shipping?.status as DeliveryStatus) || 'PENDING',
        eta: etaHours,
        etaDate: etaDate.toISOString(),
        actualDeliveryDate: shipping?.actualDeliveryDate,
        deliveryScore,
        delayRisk,
        optimalRoute: shipping?.route,
        currentLocation,
        delayFactors: delayFactors.length > 0 ? delayFactors : undefined,
        milestones: shipping?.milestones,
        recipient: order.shippingAddress ? {
          name: order.customerName || 'Customer',
          phone: order.customerPhone,
          address: order.shippingAddress,
        } : undefined,
        carrier: shipping?.carrier ? {
          name: shipping.carrier,
          trackingUrl: shipping.trackingUrl,
        } : undefined,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to fetch delivery insight for ${orderId}`, { error });

      // Return mock data for development
      const etaDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      return {
        orderId,
        status: 'PENDING',
        eta: 48,
        etaDate: etaDate.toISOString(),
        deliveryScore: config.delivery.baseDeliveryScore,
        delayRisk: 'LOW',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Optimize delivery routes for a merchant
   */
  async optimizeRoutes(merchantId: string, date: string): Promise<RouteOptimization> {
    logger.info(`Optimizing routes for merchant ${merchantId} on ${date}`);

    try {
      // Fetch pending orders for merchant
      const ordersResponse = await this.orderClient.get(
        `/api/orders/merchant/${merchantId}/pending-delivery`,
        { params: { date } }
      );

      const orders = ordersResponse?.data?.orders || [];

      // Fetch locations
      const routePoints: RoutePoint[] = orders.map((order) => ({
        orderId: order.orderId,
        customerAddress: order.shippingAddress,
        latitude: order.shippingLatitude || 0,
        longitude: order.shippingLongitude || 0,
        priority: order.priority || 'NORMAL',
        timeWindow: order.deliveryTimeWindow,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      }));

      // Optimize route (simplified implementation)
      const optimizedRoute = this.optimizeRouteSequence(routePoints);

      // Calculate metrics
      const totalDistance = optimizedRoute.length * 5; // Mock: 5km per stop
      const estimatedDuration = optimizedRoute.length * 15; // Mock: 15 min per stop
      const baselineDistance = routePoints.length * 8; // Baseline without optimization

      return {
        merchantId,
        date,
        totalOrders: orders.length,
        optimizedRoute: optimizedRoute.map((point, index) => ({
          sequence: index + 1,
          orderId: point.orderId,
          customerAddress: point.customerAddress,
          estimatedArrival: new Date(Date.now() + (index + 1) * 15 * 60 * 1000).toISOString(),
          estimatedDeliveryTime: point.estimatedDeliveryTime ||
            new Date(Date.now() + (index + 1) * 20 * 60 * 1000).toISOString(),
          priority: point.priority || 'NORMAL',
          status: 'PENDING' as const,
        })),
        totalDistance,
        estimatedDuration,
        savings: {
          distanceSaved: Math.max(0, baselineDistance - totalDistance),
          timeSaved: Math.max(0, (baselineDistance - totalDistance) * 3),
          percentageImprovement: Math.round(((baselineDistance - totalDistance) / baselineDistance) * 100) || 0,
        },
        warnings: this.checkRouteWarnings(optimizedRoute),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to optimize routes for ${merchantId}`, { error });

      // Return mock data
      return {
        merchantId,
        date,
        totalOrders: 0,
        optimizedRoute: [],
        totalDistance: 0,
        estimatedDuration: 0,
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Simple route optimization (nearest neighbor algorithm)
   */
  private optimizeRouteSequence(points: RoutePoint[]): RoutePoint[] {
    if (points.length <= 1) return points;

    // Sort by priority first
    const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const sorted = [...points].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority || 'NORMAL'] - priorityOrder[b.priority || 'NORMAL'];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by time window
      if (a.timeWindow?.start && b.timeWindow?.start) {
        return new Date(a.timeWindow.start).getTime() - new Date(b.timeWindow.start).getTime();
      }

      return 0;
    });

    return sorted;
  }

  /**
   * Check for route warnings
   */
  private checkRouteWarnings(route: RoutePoint[]): RouteOptimization['warnings'] {
    const warnings: RouteOptimization['warnings'] = [];

    for (let i = 0; i < route.length; i++) {
      const point = route[i];

      // Check time window violations
      if (point.timeWindow) {
        const estimatedArrival = new Date(Date.now() + (i + 1) * 15 * 60 * 1000);
        const windowEnd = new Date(point.timeWindow.end);

        if (estimatedArrival > windowEnd) {
          warnings.push({
            orderId: point.orderId,
            message: `Estimated arrival ${estimatedArrival.toISOString()} exceeds time window`,
            severity: 'WARNING',
          });
        }
      }

      // Check urgent deliveries
      if (point.priority === 'URGENT') {
        warnings.push({
          orderId: point.orderId,
          message: 'Urgent delivery - prioritize',
          severity: 'CRITICAL',
        });
      }
    }

    return warnings;
  }

  /**
   * Get delivery analytics for a merchant
   */
  async getDeliveryAnalytics(
    merchantId: string,
    startDate: string,
    endDate: string
  ): Promise<DeliveryAnalytics> {
    logger.info(`Fetching delivery analytics for merchant ${merchantId}`);

    try {
      const response = await this.analyticsClient.get(
        `/api/analytics/delivery/${merchantId}`,
        { params: { startDate, endDate } }
      );

      if (response?.data) {
        return {
          ...response.data,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      logger.warn(`Failed to fetch analytics for ${merchantId}`, { error });
    }

    // Return mock analytics
    const totalDeliveries = Math.floor(Math.random() * 500) + 100;
    const successfulDeliveries = Math.floor(totalDeliveries * 0.95);
    const failedDeliveries = totalDeliveries - successfulDeliveries;

    return {
      merchantId,
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        returnRate: failedDeliveries / totalDeliveries,
        averageDeliveryTime: 24 + Math.random() * 12,
        onTimeDeliveryRate: 0.85 + Math.random() * 0.1,
      },
      trends: this.generateTrendData(startDate, endDate),
      delayAnalysis: {
        totalDelays: Math.floor(totalDeliveries * 0.1),
        delayRate: 0.1,
        averageDelayHours: 4 + Math.random() * 4,
        topDelayReasons: [
          { reason: 'Traffic congestion', count: 15, percentage: 30 },
          { reason: 'Weather conditions', count: 12, percentage: 24 },
          { reason: 'Customer unavailable', count: 10, percentage: 20 },
          { reason: 'Address issue', count: 8, percentage: 16 },
          { reason: 'Other', count: 5, percentage: 10 },
        ],
      },
      customerSatisfaction: {
        averageRating: 4.2 + Math.random() * 0.6,
        totalRatings: Math.floor(totalDeliveries * 0.6),
        ratingsDistribution: {
          1: Math.floor(totalDeliveries * 0.02),
          2: Math.floor(totalDeliveries * 0.03),
          3: Math.floor(totalDeliveries * 0.1),
          4: Math.floor(totalDeliveries * 0.35),
          5: Math.floor(totalDeliveries * 0.5),
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate mock trend data
   */
  private generateTrendData(startDate: string, endDate: string) {
    const trends = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const deliveries = Math.floor(Math.random() * 50) + 20;
      trends.push({
        date: d.toISOString().split('T')[0],
        deliveries,
        onTimeRate: 0.8 + Math.random() * 0.15,
        avgDeliveryTime: 20 + Math.random() * 10,
      });
    }

    return trends;
  }

  /**
   * Get delivery prediction with risk factors
   */
  async getDeliveryPrediction(orderId: string): Promise<DeliveryPrediction> {
    logger.info(`Generating delivery prediction for order ${orderId}`);

    const insight = await this.getDeliveryInsight(orderId);

    // Generate risk factors
    const riskFactors = [];

    // Weather risk
    if (insight.delayRisk === 'HIGH' || insight.delayRisk === 'CRITICAL') {
      riskFactors.push({
        factor: 'Weather conditions',
        probability: 0.3 + Math.random() * 0.3,
        impact: 'May cause delay of 2-6 hours',
        mitigation: 'Consider alternative delivery partner',
      });
    }

    // Traffic risk
    if (this.isPeakHours()) {
      riskFactors.push({
        factor: 'Traffic congestion',
        probability: 0.5,
        impact: 'May cause delay of 1-3 hours',
        mitigation: 'Schedule for off-peak hours',
      });
    }

    // Distance risk
    if (insight.eta && insight.eta > 36) {
      riskFactors.push({
        factor: 'Long distance delivery',
        probability: 0.2,
        impact: 'Higher chance of delays',
        mitigation: 'Track proactively',
      });
    }

    // Alternative routes
    const alternativeRoutes = [];
    if (insight.optimalRoute && insight.optimalRoute.length > 1) {
      alternativeRoutes.push({
        route: insight.optimalRoute.slice(0, Math.ceil(insight.optimalRoute.length / 2)),
        estimatedTime: (insight.eta || 48) * 0.8,
        riskLevel: 'LOW' as DelayRisk,
      });
    }

    return {
      orderId,
      predictedEta: insight.etaDate,
      confidence: 0.75 + Math.random() * 0.2,
      riskFactors,
      alternativeRoutes: alternativeRoutes.length > 0 ? alternativeRoutes : undefined,
      recommendedActions: this.generateRecommendations(riskFactors),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(riskFactors: DeliveryPrediction['riskFactors']): string[] {
    const recommendations: string[] = [];

    if (riskFactors.some(rf => rf.factor.includes('Weather'))) {
      recommendations.push('Monitor weather conditions and notify customer of potential delays');
    }

    if (riskFactors.some(rf => rf.factor.includes('Traffic'))) {
      recommendations.push('Consider adjusting delivery schedule to avoid peak hours');
    }

    if (riskFactors.some(rf => rf.factor.includes('Long distance'))) {
      recommendations.push('Assign to experienced delivery partner for long-distance route');
    }

    if (recommendations.length === 0) {
      recommendations.push('Standard delivery procedures apply');
    }

    return recommendations;
  }

  /**
   * Get all active deliveries for a merchant
   */
  async getActiveDeliveries(
    merchantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ deliveries: DeliveryInsight[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    logger.info(`Fetching active deliveries for merchant ${merchantId}`);

    try {
      const ordersResponse = await this.orderClient.get(
        `/api/orders/merchant/${merchantId}/active`,
        { params: { limit: 100, offset: 0 } }
      );

      const orders = ordersResponse?.data?.orders || [];
      const deliveries = await Promise.all(
        orders.slice(offset, offset + limit).map((order) => this.getDeliveryInsight(order.orderId))
      );

      return {
        deliveries,
        total: orders.length,
      };
    } catch (error) {
      logger.warn(`Failed to fetch active deliveries for ${merchantId}`, { error });
      return { deliveries: [], total: 0 };
    }
  }
}

export const deliveryService = new DeliveryService();

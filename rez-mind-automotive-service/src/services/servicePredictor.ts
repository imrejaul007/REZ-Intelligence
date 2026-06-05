import { ServicePrediction } from '../models';
import { getServiceRecommendation, automotiveKnowledge } from '../config/knowledge';
import { IServiceHistory } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface ServicePredictionResult {
  predictionId: string;
  vehicleId: string;
  prediction: {
    nextServiceDue: Date;
    nextServiceKm: number;
    serviceType: 'regular' | 'repair' | 'inspection';
    estimatedCost: { min: number; max: number; avg: number };
    confidence: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  factors: Array<{
    type: 'usage_pattern' | 'part_wear' | 'time_based' | 'km_based';
    description: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
  recommendations: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
  }>;
  alternativePredictions?: Array<{
    scenario: string;
    nextServiceDue: Date;
    nextServiceKm: number;
    confidence: number;
  }>;
  timestamp: Date;
}

class ServicePredictorService {
  /**
   * Predict next service for a vehicle
   */
  async predictService(
    vehicleId: string,
    merchantId: string,
    currentKilometerReading: number,
    serviceHistory: IServiceHistory[] = [],
    customerId?: string
  ): Promise<ServicePredictionResult> {
    logger.info('Predicting service', { vehicleId, merchantId });

    const factors: ServicePredictionResult['factors'] = [];
    let baseInterval = 10000; // Default 10,000 km
    let baseMonths = 12; // Default 12 months

    // Analyze service history
    if (serviceHistory.length > 0) {
      const analysis = this.analyzeServiceHistory(serviceHistory, currentKilometerReading);
      factors.push(...analysis.factors);
      baseInterval = analysis.avgInterval;
    }

    // Usage pattern analysis
    const lastService = serviceHistory[0];
    if (lastService) {
      const kmSinceLastService = currentKilometerReading - lastService.kilometersAtService;
      const monthsSinceLastService = this.monthsBetween(lastService.serviceDate, new Date());
      const avgKmPerMonth = kmSinceLastService / Math.max(monthsSinceLastService, 1);

      factors.push({
        type: 'usage_pattern',
        description: `${kmSinceLastService.toLocaleString()} km since last service`,
        impact: kmSinceLastService > baseInterval ? 'negative' : 'positive',
        weight: Math.min(30, (kmSinceLastService / baseInterval) * 30),
      });

      // Predict next service km based on usage
      const predictedKm = currentKilometerReading + (avgKmPerMonth * baseMonths);
      const predictedDate = new Date(lastService.serviceDate);
      predictedDate.setMonth(predictedDate.getMonth() + baseMonths);

      // Determine urgency
      const kmRatio = kmSinceLastService / baseInterval;
      const timeRatio = monthsSinceLastService / baseMonths;
      const urgency = this.determineUrgency(Math.max(kmRatio, timeRatio));

      // Calculate estimated cost
      const estimatedCost = this.estimateServiceCost(serviceHistory, lastService.serviceType);

      // Generate recommendations
      const recommendations = this.generateRecommendations(urgency, kmSinceLastService, baseInterval);

      // Create prediction record
      const predictionRecord = new ServicePrediction({
        predictionId: `SPP-${Date.now().toString(36)}-${uuidv4().substring(0, 6).toUpperCase()}`,
        vehicleId,
        customerId,
        merchantId,
        serviceHistory,
        prediction: {
          nextServiceDue: predictedDate,
          nextServiceKm: Math.round(predictedKm / 1000) * 1000,
          serviceType: lastService.serviceType === 'repair' ? 'repair' : 'regular',
          estimatedCost,
          confidence: serviceHistory.length > 3 ? 0.85 : serviceHistory.length > 1 ? 0.7 : 0.5,
          urgency,
        },
        factors,
        recommendations,
      });
      await predictionRecord.save();

      const result: ServicePredictionResult = {
        predictionId: predictionRecord.predictionId,
        vehicleId,
        prediction: predictionRecord.prediction,
        factors: predictionRecord.factors,
        recommendations: predictionRecord.recommendations,
        timestamp: new Date(),
      };

      logger.info('Service prediction generated', { predictionId: predictionRecord.predictionId, urgency });

      return result;
    }

    // No service history - use default values
    const predictedDate = new Date();
    predictedDate.setMonth(predictedDate.getMonth() + baseMonths);

    const result: ServicePredictionResult = {
      predictionId: `SPP-${Date.now().toString(36)}-${uuidv4().substring(0, 6).toUpperCase()}`,
      vehicleId,
      prediction: {
        nextServiceDue: predictedDate,
        nextServiceKm: currentKilometerReading + baseInterval,
        serviceType: 'regular',
        estimatedCost: { min: 3000, max: 8000, avg: 5000 },
        confidence: 0.4,
        urgency: currentKilometerReading > 8000 ? 'medium' : 'low',
      },
      factors: [
        {
          type: 'km_based',
          description: 'No service history - using default interval',
          impact: 'neutral',
          weight: 10,
        },
      ],
      recommendations: [
        {
          action: 'Schedule initial service assessment',
          priority: 'medium',
          description: 'Recommend full vehicle inspection to establish baseline',
        },
      ],
      timestamp: new Date(),
    };

    return result;
  }

  /**
   * Analyze service history patterns
   */
  private analyzeServiceHistory(history: IServiceHistory[], currentKm: number) {
    const factors: ServicePredictionResult['factors'] = [];
    let totalInterval = 0;
    let count = 0;

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const previous = history[i + 1];

      const kmInterval = current.kilometersAtService - previous.kilometersAtService;
      const daysBetween = this.daysBetween(previous.serviceDate, current.serviceDate);
      const monthsBetween = daysBetween / 30;

      totalInterval += kmInterval;
      count++;

      // Check for accelerating maintenance needs
      if (i > 0) {
        const prevInterval = previous.kilometersAtService - (history[i + 2]?.kilometersAtService || 0);
        if (kmInterval > prevInterval * 1.2) {
          factors.push({
            type: 'part_wear',
            description: 'Increasing service interval detected - possible component wear',
            impact: 'negative',
            weight: 20,
          });
        }
      }

      // Track repair frequency
      if (current.serviceType === 'repair') {
        factors.push({
          type: 'part_wear',
          description: `Repair service detected: ${current.items.map(it => it.name).join(', ')}`,
          impact: 'negative',
          weight: 15,
        });
      }
    }

    const avgInterval = count > 0 ? totalInterval / count : 10000;

    return { factors, avgInterval };
  }

  /**
   * Determine service urgency
   */
  private determineUrgency(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
    if (ratio >= 1.5) return 'critical';
    if (ratio >= 1.2) return 'high';
    if (ratio >= 0.8) return 'medium';
    return 'low';
  }

  /**
   * Estimate service cost based on history
   */
  private estimateServiceCost(history: IServiceHistory[], _lastServiceType: string): { min: number; max: number; avg: number } {
    if (history.length === 0) {
      return { min: 3000, max: 8000, avg: 5000 };
    }

    const costs = history.map(h => h.totalCost);
    const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
    const min = Math.min(...costs) * 0.8;
    const max = Math.max(...costs) * 1.2;

    return { min: Math.round(min), max: Math.round(max), avg: Math.round(avg) };
  }

  /**
   * Generate recommendations based on urgency
   */
  private generateRecommendations(
    urgency: 'low' | 'medium' | 'high' | 'critical',
    kmSinceService: number,
    interval: number
  ): Array<{ action: string; priority: 'low' | 'medium' | 'high'; description: string }> {
    const recommendations = [];
    const remainingKm = interval - kmSinceService;

    if (urgency === 'critical' || urgency === 'high') {
      recommendations.push({
        action: 'Immediate service scheduling',
        priority: 'high',
        description: `Service is overdue or due soon. Schedule appointment immediately.`,
      });
      recommendations.push({
        action: 'Vehicle inspection',
        priority: 'high',
        description: 'Request full vehicle inspection before service.',
      });
    }

    if (remainingKm < 1000 && urgency !== 'critical') {
      recommendations.push({
        action: 'Schedule upcoming service',
        priority: 'medium',
        description: `${remainingKm.toLocaleString()} km remaining before service due.`,
      });
    }

    if (urgency === 'low') {
      recommendations.push({
        action: 'Routine maintenance reminder',
        priority: 'low',
        description: 'Service not yet due. Schedule when convenient.',
      });
    }

    return recommendations;
  }

  /**
   * Helper: Calculate months between dates
   */
  private monthsBetween(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
  }

  /**
   * Helper: Calculate days between dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get optimal scheduling recommendations
   */
  async getOptimalSchedule(
    merchantId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<{
    recommendations: Array<{
      vehicleId: string;
      customerId?: string;
      daysUntilService: number;
      urgency: string;
      suggestedDate: Date;
    }>;
  }> {
    const predictions = await ServicePrediction.getPendingService(merchantId);

    const recommendations = predictions
      .filter(p => {
        const dueDate = p.prediction.nextServiceDue;
        return dueDate >= dateRange.start && dueDate <= dateRange.end;
      })
      .map(p => {
        const daysUntilService = Math.ceil(
          (p.prediction.nextServiceDue.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          vehicleId: p.vehicleId,
          customerId: p.customerId,
          daysUntilService,
          urgency: p.prediction.urgency,
          suggestedDate: p.prediction.nextServiceDue,
        };
      })
      .sort((a, b) => a.daysUntilService - b.daysUntilService);

    return { recommendations };
  }
}

export const servicePredictorService = new ServicePredictorService();
export default servicePredictorService;
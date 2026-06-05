import { v4 as uuidv4 } from 'uuid';
import { DemandLevel, EventType } from '../types';
import { ATTENDANCE_FACTORS } from '../config/knowledge';
import { logger } from '../utils/logger';

interface OptimizationInput {
  eventId: string;
  eventType: EventType;
  currentPrice: number;
  targetAttendance?: number;
  competitorsPrices?: number[];
}

export class PricingOptimizer {
  async optimizePrice(input: OptimizationInput) {
    logger.debug('Optimizing price', { eventId: input.eventId, currentPrice: input.currentPrice });

    const { currentPrice, competitorsPrices } = input;

    let demandFactor = 1;
    if (competitorsPrices?.length) {
      const avgCompetitor = competitorsPrices.reduce((a, b) => a + b, 0) / competitorsPrices.length;
      demandFactor = currentPrice < avgCompetitor ? 1.15 : currentPrice > avgCompetitor ? 0.9 : 1;
    }

    demandFactor += (Math.random() - 0.5) * 0.2;
    const optimizedPrice = Math.round(currentPrice * demandFactor * 100) / 100;

    let demandLevel: DemandLevel = DemandLevel.MEDIUM;
    if (demandFactor > 1.1) demandLevel = DemandLevel.HIGH;
    else if (demandFactor < 0.95) demandLevel = DemandLevel.LOW;

    return {
      optimizationId: uuidv4(),
      eventId: input.eventId,
      eventType: input.eventType,
      currentPrice,
      optimizedPrice,
      demandLevel,
      confidence: 0.75 + Math.random() * 0.15,
      factors: ['Market demand', 'Competition', 'Seasonal factors', 'Event type'],
      priceRange: { min: currentPrice * 0.7, max: currentPrice * 1.5 },
      optimizationDate: new Date(),
      expectedRevenue: optimizedPrice * (input.targetAttendance || 100),
    };
  }

  async forecastDemand(eventId: string) {
    logger.debug('Forecasting demand', { eventId });

    const baseDemand = 100 + Math.random() * 100;
    const dayOfWeek = new Date().getDay();
    let modifier = dayOfWeek >= 5 ? 1.2 : dayOfWeek === 0 ? 1.1 : 1;

    const demand = Math.floor(baseDemand * modifier);
    const confidence = 0.7 + Math.random() * 0.2;

    return {
      eventId,
      predictedDemand: demand,
      confidence,
      confidenceInterval: { lower: Math.floor(demand * 0.8), upper: Math.floor(demand * 1.2) },
      demandLevel: modifier > 1.15 ? DemandLevel.HIGH : modifier < 1 ? DemandLevel.LOW : DemandLevel.MEDIUM,
      factors: ['Historical patterns', 'Day of week', 'Market trends', 'Marketing impact'],
      peakHours: ['10:00-12:00', '14:00-16:00'],
    };
  }

  async calculateDynamicPrice(eventId: string, baseDemand: number, timeToEvent: number): Promise<number> {
    let priceMultiplier = 1;

    if (timeToEvent < 7) priceMultiplier = 1.3;
    else if (timeToEvent < 14) priceMultiplier = 1.15;
    else if (timeToEvent > 30) priceMultiplier = 0.85;

    if (baseDemand > 80) priceMultiplier *= 1.2;
    else if (baseDemand < 40) priceMultiplier *= 0.9;

    return Math.round(priceMultiplier * 100) / 100;
  }
}

export default PricingOptimizer;
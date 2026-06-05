import { v4 as uuidv4 } from 'uuid';
import { EventType, EventDetails, DemandLevel } from '../types';
import { EVENT_TYPES, ATTENDANCE_FACTORS, PRICING_FACTORS, MARKETING_CHANNELS } from '../config/knowledge';
import { logger } from '../utils/logger';

export class EventsIntelligence {
  async analyzeEvent(eventId: string, eventDetails?: EventDetails) {
    logger.debug('Analyzing event', { eventId });

    const eventType = eventDetails?.type || EventType.CORPORATE;
    const attendance = this.predictAttendance(eventId, eventType, eventDetails);
    const pricing = this.optimizePricing(eventId, eventType, eventDetails?.budget || 100);
    const vendorMatches = await this.findVendorMatches(eventId, eventType);
    const marketing = this.generateMarketingCampaign({ eventId, budget: 5000, targetReach: 10000 });
    const satisfaction = this.predictSatisfaction(eventId, eventType);

    return { attendancePrediction: attendance, pricingOptimization: pricing, vendorMatches, marketingCampaign: marketing, guestSatisfaction: satisfaction };
  }

  private predictAttendance(eventId: string, eventType: EventType, eventDetails?: EventDetails): any {
    const typeData = EVENT_TYPES[eventType];
    const baseAttendance = typeData.avgAttendance;
    let modifier = 1;

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) modifier += ATTENDANCE_FACTORS.weekend.impact / 100;
    modifier += Math.random() * 0.2 - 0.1;

    const predicted = Math.floor(baseAttendance * modifier);
    const confidence = 0.7 + Math.random() * 0.2;

    return {
      predictionId: uuidv4(), eventId, predictedAttendance: predicted,
      confidence, confidenceInterval: { lower: Math.floor(predicted * 0.85), upper: Math.floor(predicted * 1.15) },
      demandLevel: modifier > 1.1 ? DemandLevel.HIGH : modifier < 0.9 ? DemandLevel.LOW : DemandLevel.MEDIUM,
      factors: ['Historical data', 'Seasonal patterns', 'Event type impact'], predictionDate: new Date(),
    };
  }

  private optimizePricing(eventId: string, eventType: EventType, basePrice?: number): any {
    const typeData = EVENT_TYPES[eventType];
    const minPrice = typeData.priceRange.min;
    const maxPrice = typeData.priceRange.max;
    const currentPrice = basePrice || (minPrice + maxPrice) / 2;

    const demandFactor = 0.9 + Math.random() * 0.3;
    const optimizedPrice = Math.round(currentPrice * demandFactor * 100) / 100;
    const expectedRevenue = optimizedPrice * (typeData.avgAttendance * demandFactor);

    return {
      optimizationId: uuidv4(), eventId, eventType, currentPrice, optimizedPrice,
      demandLevel: demandFactor > 1.1 ? DemandLevel.HIGH : demandFactor < 0.95 ? DemandLevel.LOW : DemandLevel.MEDIUM,
      confidence: 0.75 + Math.random() * 0.15, factors: ['Event type', 'Market conditions', 'Competition'],
      priceRange: { min: minPrice, max: maxPrice }, optimizationDate: new Date(), expectedRevenue,
    };
  }

  async findVendorMatches(eventId: string, eventType: EventType): Promise<any[]> {
    const matches = [];
    const vendors = ['Premier Catering Co', 'Event Spaces Inc', 'Creative Decorators', 'AV Solutions', 'Capture Moments Photography', 'Party Entertainment'];

    for (let i = 0; i < 4; i++) {
      matches.push({
        matchId: uuidv4(), eventId,
        vendorId: `vendor-${i}`, vendorName: vendors[i] || `Vendor ${i}`,
        category: ['catering', 'venue', 'decoration', 'audio_visual'][i] || 'catering',
        matchScore: 70 + Math.random() * 25,
        compatibility: ['Reliable service', 'Quality assurance', 'Competitive pricing'],
        pricing: { min: 1000 + Math.random() * 5000, max: 10000 + Math.random() * 20000 },
        performance: { reliability: 80 + Math.random() * 15, quality: 75 + Math.random() * 20, value: 70 + Math.random() * 25 },
        recommendations: ['Book early for availability', 'Request package deals'],
      });
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  generateMarketingCampaign(input: { eventId: string; budget: number; targetReach: number; timeline?: any }): any {
    const channels = Object.keys(MARKETING_CHANNELS);
    const allocation: Record<string, number> = {};

    channels.forEach(channel => {
      allocation[channel] = Math.round(input.budget * (MARKETING_CHANNELS as any)[channel].effectiveness * 100) / 100;
    });

    return {
      campaignId: uuidv4(), eventId: input.eventId,
      channels, budgetAllocation: allocation, expectedReach: input.targetReach,
      timeline: { start: input.timeline?.start || new Date(), end: input.timeline?.end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      recommendations: ['Focus on social media', 'Early bird promotion', 'Influencer partnerships'],
      estimatedROI: 2.5 + Math.random() * 1.5,
    };
  }

  private predictSatisfaction(eventId: string, eventType: EventType): any {
    const baseSatisfaction = 75 + Math.random() * 20;
    return {
      predictionId: uuidv4(), eventId, predictedSatisfaction: Math.round(baseSatisfaction),
      confidence: 0.72 + Math.random() * 0.15,
      factors: [
        { name: 'Venue Quality', impact: 25 }, { name: 'Catering', impact: 20 },
        { name: 'Entertainment', impact: 15 }, { name: 'Timing', impact: 15 },
        { name: 'Value', impact: 15 }, { name: 'Service', impact: 10 },
      ],
      recommendations: ['Focus on venue selection', 'Prioritize guest experience', 'Quality catering is key'],
    };
  }

  async getMarketingInsights(eventId: string): Promise<any> {
    return {
      eventId, optimalPostingTimes: ['9am', '12pm', '7pm'], bestChannels: ['social_media', 'email', 'influencer'],
      audienceEngagement: 65 + Math.random() * 25, conversionPotential: 70 + Math.random() * 20,
      recommendations: ['Post 3 times per week', 'Use video content', 'Partner with local influencers'],
    };
  }
}

export default EventsIntelligence;
import { v4 as uuidv4 } from 'uuid';
import {
  Opportunity,
  Recommendation,
  Channel,
  CampaignFromInsightRequest,
  CampaignFromInsightResponse,
} from '../types/index.js';
import { opportunityService } from './opportunityService.js';
import { businessAnalysisService } from './businessAnalysisService.js';
import { cacheGet, cacheSet } from '../utils/redis.js';
import { CACHE_TTL } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'CampaignRecommendationService' });

interface CampaignDraft {
  campaignId: string;
  name: string;
  type: string;
  targetSegments: string[];
  channels: Channel[];
  recommendations: CampaignRecommendation[];
  estimatedReach: number;
  estimatedRevenue: number;
  timeline: CampaignTimeline;
  budget: number;
  kpis: KeyPerformanceIndicator[];
}

interface CampaignRecommendation {
  type: 'primary' | 'secondary' | 'follow-up';
  channel: Channel;
  message: string;
  timing: string;
  priority: number;
}

interface CampaignTimeline {
  startDate: Date;
  endDate: Date;
  phases: Array<{
    name: string;
    startDay: number;
    endDay: number;
    activities: string[];
  }>;
}

interface KeyPerformanceIndicator {
  name: string;
  target: number;
  current?: number;
  unit: string;
}

class CampaignRecommendationService {
  async createCampaignFromInsight(
    request: CampaignFromInsightRequest
  ): Promise<CampaignFromInsightResponse> {
    log.info('Creating campaign from insight', { request });

    const opportunity = await opportunityService.findById(request.opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity not found: ${request.opportunityId}`);
    }

    const campaignDraft = await this.generateCampaignDraft(opportunity, request);

    // In production, this would create the campaign in the AI campaign builder service
    const campaignId = uuidv4();

    log.info('Campaign draft generated', { campaignId, opportunityId: request.opportunityId });

    return {
      campaignId,
      campaignName: campaignDraft.name,
      opportunityId: request.opportunityId,
      status: 'draft',
      recommendations: opportunity.recommendations,
      createdAt: new Date(),
    };
  }

  async generateCampaignDraft(
    opportunity: Opportunity,
    request: CampaignFromInsightRequest
  ): Promise<CampaignDraft> {
    const channels = opportunity.recommendations.map((r) => r.channel);
    const targetSegments = [...new Set(opportunity.recommendations.map((r) => r.targetSegment))];

    const totalReach = opportunity.recommendations.reduce((sum, r) => sum + r.estimatedReach, 0);
    const avgConversion = opportunity.recommendations.reduce(
      (sum, r) => sum + r.estimatedConversion,
      0
    ) / opportunity.recommendations.length;

    const estimatedRevenue = totalReach * (avgConversion / 100) * 100; // Assuming avg order value of 100

    const timeline = this.generateTimeline(opportunity.type, request.startDate);

    const kpis = this.generateKPIs(opportunity.type, totalReach, avgConversion);

    return {
      campaignId: uuidv4(),
      name: request.campaignName || this.generateCampaignName(opportunity),
      type: opportunity.type,
      targetSegments,
      channels,
      recommendations: this.generateDetailedRecommendations(opportunity.recommendations),
      estimatedReach: totalReach,
      estimatedRevenue,
      timeline,
      budget: request.budget || this.estimateBudget(channels),
      kpis,
    };
  }

  private generateCampaignName(opportunity: Opportunity): string {
    const prefixes: Record<string, string> = {
      campaign: 'Campaign',
      product: 'Product Launch',
      segment: 'Segment Focus',
      retention: 'Retention Drive',
      upsell: 'Upsell Push',
      market: 'Market Expansion',
    };

    const prefix = prefixes[opportunity.type] || 'Campaign';
    const date = new Date().toISOString().split('T')[0];

    return `${prefix} - ${date}`;
  }

  private generateTimeline(opportunityType: string, startDate?: Date): CampaignTimeline {
    const now = new Date();
    const start = startDate || now;
    const durationDays = this.getCampaignDuration(opportunityType);
    const endDate = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const phases = this.generatePhases(durationDays, opportunityType);

    return { startDate: start, endDate, phases };
  }

  private getCampaignDuration(opportunityType: string): number {
    const durations: Record<string, number> = {
      campaign: 14,
      product: 21,
      segment: 28,
      retention: 14,
      upsell: 21,
      market: 90,
    };

    return durations[opportunityType] || 14;
  }

  private generatePhases(durationDays: number, opportunityType: string): CampaignTimeline['phases'] {
    const phases: CampaignTimeline['phases'] = [];

    // Phase 1: Awareness/Launch
    phases.push({
      name: 'Launch',
      startDay: 1,
      endDay: Math.ceil(durationDays * 0.2),
      activities: ['Initial outreach', 'Channel activation', 'Teaser content'],
    });

    // Phase 2: Engagement
    phases.push({
      name: 'Engagement',
      startDay: Math.ceil(durationDays * 0.2) + 1,
      endDay: Math.ceil(durationDays * 0.6),
      activities: ['Follow-up messages', 'Personalized offers', 'Engagement campaigns'],
    });

    // Phase 3: Conversion
    phases.push({
      name: 'Conversion',
      startDay: Math.ceil(durationDays * 0.6) + 1,
      endDay: Math.ceil(durationDays * 0.9),
      activities: ['Limited time offers', 'Urgency messaging', 'Final push'],
    });

    // Phase 4: Wrap-up
    phases.push({
      name: 'Wrap-up',
      startDay: Math.ceil(durationDays * 0.9) + 1,
      endDay: durationDays,
      activities: ['Results summary', 'Thank you messages', 'Future offer preview'],
    });

    return phases;
  }

  private generateDetailedRecommendations(
    recommendations: Recommendation[]
  ): CampaignRecommendation[] {
    return recommendations.map((rec, index) => ({
      type: index === 0 ? 'primary' : index === 1 ? 'secondary' : 'follow-up',
      channel: rec.channel,
      message: rec.action,
      timing: rec.timing,
      priority: recommendations.length - index,
    }));
  }

  private generateKPIs(
    opportunityType: string,
    reach: number,
    conversionRate: number
  ): KeyPerformanceIndicator[] {
    const kpis: KeyPerformanceIndicator[] = [
      {
        name: 'Total Reach',
        target: reach,
        unit: 'users',
      },
      {
        name: 'Conversion Rate',
        target: conversionRate,
        unit: 'percentage',
      },
      {
        name: 'Revenue Generated',
        target: reach * (conversionRate / 100) * 100,
        unit: 'INR',
      },
    ];

    switch (opportunityType) {
      case 'retention':
        kpis.push({
          name: 'Retention Rate',
          target: 15,
          unit: 'percentage',
        });
        kpis.push({
          name: 'Churn Prevention',
          target: 10,
          unit: 'customers',
        });
        break;
      case 'upsell':
        kpis.push({
          name: 'Upsell Rate',
          target: 8,
          unit: 'percentage',
        });
        kpis.push({
          name: 'Average Order Value Increase',
          target: 20,
          unit: 'percentage',
        });
        break;
      case 'segment':
        kpis.push({
          name: 'Segment Engagement',
          target: 25,
          unit: 'percentage',
        });
        kpis.push({
          name: 'Segment Revenue',
          target: 50000,
          unit: 'INR',
        });
        break;
      default:
        kpis.push({
          name: 'Click-through Rate',
          target: 3,
          unit: 'percentage',
        });
        kpis.push({
          name: 'Return on Ad Spend',
          target: 300,
          unit: 'percentage',
        });
    }

    return kpis;
  }

  private estimateBudget(channels: Channel[]): number {
    const channelCosts: Record<Channel, number> = {
      whatsapp: 0.05, // per message
      email: 0.01,
      sms: 0.03,
      push: 0.02,
      voice: 0.10,
      dooh: 50.00, // per day per screen
    };

    // Base estimate: 10,000 impressions per channel
    const baseEstimate = channels.reduce((sum, channel) => {
      return sum + 10000 * (channelCosts[channel] || 0.05);
    }, 0);

    // Add 20% buffer
    return Math.ceil(baseEstimate * 1.2);
  }

  async getChannelRecommendations(
    opportunityType: string,
    targetSegment: string
  ): Promise<Array<{ channel: Channel; score: number; reason: string }>> {
    const recommendations: Array<{ channel: Channel; score: number; reason: string }> = [];

    const businessData = businessAnalysisService.getDataForAI();
    const channelPerformance = businessData.channelEffectiveness;

    for (const channel of Object.values(Channel)) {
      const performance = channelPerformance.find((c) => c.channel === channel);
      const score = performance ? (performance.roi + performance.conversionRate * 100) / 2 : 50;

      let reason = '';
      switch (channel) {
        case Channel.WHATSAPP:
          reason = 'High engagement and conversion rates for direct communication';
          break;
        case Channel.EMAIL:
          reason = 'Cost-effective for nurture campaigns and detailed content';
          break;
        case Channel.SMS:
          reason = 'Best for time-sensitive offers and urgent communications';
          break;
        case Channel.PUSH:
          reason = 'High visibility and immediate user engagement';
          break;
        case Channel.VOICE:
          reason = 'Premium channel for high-value customer outreach';
          break;
        case Channel.DOOH:
          reason = 'Physical world advertising for brand awareness';
          break;
      }

      recommendations.push({ channel, score, reason });
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }
}

export const campaignRecommendationService = new CampaignRecommendationService();
export default campaignRecommendationService;

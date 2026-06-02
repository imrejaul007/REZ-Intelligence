import { CustomerContext, NextBestAction, Recommendation, ChannelOptimization, TimingOptimization } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class NextBestActionService {
  private modelVersion = '1.0.0';

  generateRecommendations(context: CustomerContext): NextBestAction {
    logger.info(`Generating next best action for customer: ${context.customerId}`);

    const recommendations = this.createRecommendations(context);
    const optimizedChannel = this.optimizeChannel(context);
    const optimalTiming = this.determineOptimalTiming(context);
    const selectedOffer = this.selectOffer(context, recommendations);
    const reasoning = this.generateReasoning(context, recommendations, optimizedChannel);
    const confidence = this.calculateConfidence(context);

    return {
      customerId: context.customerId,
      recommendations,
      optimizedChannel,
      optimalTiming,
      selectedOffer,
      reasoning,
      confidence,
      modelVersion: this.modelVersion,
      generatedAt: new Date().toISOString(),
    };
  }

  private createRecommendations(context: CustomerContext): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (context.churnRisk > 0.7) {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Win-back campaign with personalized offer',
        type: 'retention',
        priority: 1,
        expectedImpact: 0.85,
        reason: 'High churn risk detected - immediate retention action required',
        constraints: ['Budget limit: $50', 'Max 1 per customer per month'],
      });
    } else if (context.churnRisk > 0.4) {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Proactive engagement with exclusive benefits',
        type: 'retention',
        priority: 2,
        expectedImpact: 0.65,
        reason: 'Moderate churn risk - engage before escalation',
        constraints: ['Exclusive to high-value segments'],
      });
    }

    if (context.ltv > 5000) {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Premium upsell opportunity',
        type: 'upsell',
        priority: 3,
        expectedImpact: 0.45,
        reason: 'High-value customer - expand wallet share',
        constraints: ['Requires product education'],
      });
    } else if (context.ltv > 1000) {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Cross-sell complementary products',
        type: 'upsell',
        priority: 4,
        expectedImpact: 0.35,
        reason: 'Medium-value customer with growth potential',
        constraints: ['Product affinity matching required'],
      });
    }

    if (context.segment === 'inactive') {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Re-engagement campaign with incentives',
        type: 'reengagement',
        priority: 2,
        expectedImpact: 0.55,
        reason: 'Inactive customer - time to reconnect',
        constraints: ['Max 3 contact attempts'],
      });
    }

    if (context.segment === 'new') {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Onboarding program completion',
        type: 'loyalty',
        priority: 1,
        expectedImpact: 0.70,
        reason: 'New customer - establish relationship early',
        constraints: ['Time-sensitive (first 30 days)'],
      });
    }

    if (context.segment === 'vip') {
      recommendations.push({
        actionId: uuidv4(),
        action: 'VIP exclusive early access',
        type: 'loyalty',
        priority: 3,
        expectedImpact: 0.60,
        reason: 'VIP customer - maintain loyalty and advocacy',
        constraints: ['Exclusive to VIP tier'],
      });
    }

    if (context.averageOrderValue && context.averageOrderValue > 100) {
      recommendations.push({
        actionId: uuidv4(),
        action: 'Bundle promotion for higher AOV',
        type: 'upsell',
        priority: 5,
        expectedImpact: 0.30,
        reason: 'High AOV customer - encourage larger orders',
        constraints: ['Minimum order threshold applies'],
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private optimizeChannel(context: CustomerContext): string {
    if (context.preferences?.preferredChannel) {
      return context.preferences.preferredChannel;
    }

    const channelScores: Record<string, number> = {
      email: 0.7,
      sms: 0.65,
      push: 0.55,
      whatsapp: 0.75,
      'in-app': 0.6,
    };

    if (context.churnRisk > 0.6) {
      channelScores.whatsapp = 0.9;
      channelScores.sms = 0.85;
    }

    if (context.segment === 'vip') {
      channelScores.whatsapp = 0.95;
      channelScores.push = 0.8;
    }

    if (context.segment === 'new') {
      channelScores.email = 0.85;
      channelScores.push = 0.8;
    }

    return Object.entries(channelScores).sort((a, b) => b[1] - a[1])[0][0];
  }

  private determineOptimalTiming(context: CustomerContext): { bestTime: string; bestDayOfWeek: number; windowStart: string; windowEnd: string; timezone: string; confidence: number } {
    if (context.preferences?.preferredTime) {
      const timeMap: Record<string, { bestTime: string; bestDayOfWeek: number }> = {
        morning: { bestTime: '09:00', bestDayOfWeek: 2 },
        afternoon: { bestTime: '14:00', bestDayOfWeek: 3 },
        evening: { bestTime: '19:00', bestDayOfWeek: 4 },
        night: { bestTime: '21:00', bestDayOfWeek: 5 },
      };
      const pref = timeMap[context.preferences.preferredTime];
      return {
        ...pref,
        windowStart: `${pref.bestTime.slice(0, 2)}:00`,
        windowEnd: `${parseInt(pref.bestTime.slice(0, 2)) + 2}:00`,
        timezone: 'UTC',
        confidence: 0.85,
      };
    }

    if (context.churnRisk > 0.6) {
      return {
        bestTime: '10:00',
        bestDayOfWeek: 2,
        windowStart: '09:00',
        windowEnd: '12:00',
        timezone: 'UTC',
        confidence: 0.75,
      };
    }

    if (context.segment === 'vip') {
      return {
        bestTime: '18:00',
        bestDayOfWeek: 4,
        windowStart: '17:00',
        windowEnd: '20:00',
        timezone: 'UTC',
        confidence: 0.8,
      };
    }

    return {
      bestTime: '10:00',
      bestDayOfWeek: 3,
      windowStart: '09:00',
      windowEnd: '12:00',
      timezone: 'UTC',
      confidence: 0.65,
    };
  }

  private selectOffer(context: CustomerContext, recommendations: Recommendation[]): { offerId: string; offerType: 'discount' | 'freebie' | 'loyalty_points' | 'early_access' | 'personalized'; value: number; cost: number; roi: number; eligibility: boolean } {
    if (context.churnRisk > 0.7) {
      return {
        offerId: uuidv4(),
        offerType: 'discount',
        value: 15,
        cost: 15,
        roi: 3.5,
        eligibility: true,
      };
    }

    if (context.segment === 'vip') {
      return {
        offerId: uuidv4(),
        offerType: 'early_access',
        value: 100,
        cost: 0,
        roi: 10,
        eligibility: true,
      };
    }

    if (context.ltv > 3000) {
      return {
        offerId: uuidv4(),
        offerType: 'loyalty_points',
        value: 500,
        cost: 5,
        roi: 8,
        eligibility: true,
      };
    }

    if (context.segment === 'new') {
      return {
        offerId: uuidv4(),
        offerType: 'freebie',
        value: 25,
        cost: 8,
        roi: 4,
        eligibility: true,
      };
    }

    return {
      offerId: uuidv4(),
      offerType: 'personalized',
      value: 10,
      cost: 5,
      roi: 3,
      eligibility: true,
    };
  }

  private generateReasoning(context: CustomerContext, recommendations: Recommendation[], channel: string): string {
    const topRecommendation = recommendations[0];
    if (!topRecommendation) {
      return 'No specific action recommended - customer is in stable state';
    }

    return `Based on customer's ${context.segment} segment with ${context.churnRisk > 0.5 ? 'high' : 'moderate'} churn risk (${Math.round(context.churnRisk * 100)}%) and LTV of $${context.ltv}, the top priority action is: "${topRecommendation.action}". This action should be delivered via ${channel} for optimal engagement.`;
  }

  private calculateConfidence(context: CustomerContext): number {
    let confidence = 0.5;

    if (context.preferences?.preferredChannel) confidence += 0.15;
    if (context.preferences?.preferredTime) confidence += 0.1;
    if (context.recentInteractions && context.recentInteractions.length >= 3) confidence += 0.15;
    if (context.ltv > 0) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  optimizeChannels(contexts: CustomerContext[]): ChannelOptimization[] {
    const channels = ['email', 'sms', 'push', 'whatsapp', 'in-app'] as const;
    const baseMetrics: Record<string, { effectiveness: number; costPerContact: number; conversionRate: number; reach: number }> = {
      email: { effectiveness: 0.7, costPerContact: 0.01, conversionRate: 0.03, reach: 0.9 },
      sms: { effectiveness: 0.65, costPerContact: 0.05, conversionRate: 0.08, reach: 0.7 },
      push: { effectiveness: 0.55, costPerContact: 0.02, conversionRate: 0.05, reach: 0.6 },
      whatsapp: { effectiveness: 0.85, costPerContact: 0.08, conversionRate: 0.12, reach: 0.5 },
      'in-app': { effectiveness: 0.75, costPerContact: 0, conversionRate: 0.15, reach: 0.3 },
    };

    const highRiskCount = contexts.filter(c => c.churnRisk > 0.6).length;
    const vipCount = contexts.filter(c => c.segment === 'vip').length;

    return channels.map(channel => {
      const metrics = { ...baseMetrics[channel] };
      let score = metrics.effectiveness;

      if (highRiskCount > contexts.length / 2 && (channel === 'sms' || channel === 'whatsapp')) {
        score += 0.15;
      }

      if (vipCount > contexts.length / 3 && channel === 'whatsapp') {
        score += 0.1;
      }

      return {
        channel,
        effectiveness: Math.round(score * 100) / 100,
        costPerContact: metrics.costPerContact,
        conversionRate: metrics.conversionRate,
        reach: metrics.reach,
        recommended: score > 0.7,
      };
    }).sort((a, b) => b.effectiveness - a.effectiveness);
  }

  optimizeTiming(contexts: CustomerContext[]): TimingOptimization[] {
    const optimizations: TimingOptimization[] = [];

    for (let day = 1; day <= 7; day++) {
      for (let hour = 8; hour <= 21; hour++) {
        let conversionRate = 0.03;
        let engagementScore = 0.5;

        if (day >= 2 && day <= 4) {
          conversionRate += 0.02;
          engagementScore += 0.1;
        }

        if (hour >= 10 && hour <= 12) {
          conversionRate += 0.03;
          engagementScore += 0.15;
        } else if (hour >= 17 && hour <= 20) {
          conversionRate += 0.02;
          engagementScore += 0.1;
        }

        if (day === 6 || day === 7) {
          conversionRate -= 0.01;
          engagementScore -= 0.05;
        }

        optimizations.push({
          dayOfWeek: day,
          hourOfDay: hour,
          conversionRate: Math.round(conversionRate * 1000) / 1000,
          engagementScore: Math.round(engagementScore * 100) / 100,
          recommended: conversionRate > 0.05 && engagementScore > 0.6,
        });
      }
    }

    return optimizations.sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 10);
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}

export const nextBestActionService = new NextBestActionService();

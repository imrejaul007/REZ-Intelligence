import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import {
  Opportunity,
  OpportunityType,
  ExpectedImpact,
  OpportunityStatus,
  Recommendation,
  Channel,
} from '../types/index.js';
import { businessAnalysisService, competitorAnalysisService, opportunityService, alertService } from '../services/index.js';
import { OPPORTUNITY_SYSTEM_PROMPT, OPPORTUNITY_USER_PROMPT } from '../prompts/opportunityPrompt.js';
import { THRESHOLDS } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'OpportunityAgent' });

interface OpportunityGenerationResult {
  opportunities: Opportunity[];
  summary: string;
  highPriorityCount: number;
}

class OpportunityAgent {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateOpportunities(): Promise<OpportunityGenerationResult> {
    log.info('Starting opportunity generation');

    try {
      // Gather data for analysis
      const [businessData, competitorData] = await Promise.all([
        businessAnalysisService.analyze({}),
        competitorAnalysisService.analyze({}),
      ]);

      // Generate opportunities using AI
      const opportunities = await this.identifyOpportunitiesWithAI(businessData, competitorData);

      // Save opportunities to database
      const savedOpportunities: Opportunity[] = [];
      for (const opp of opportunities) {
        const saved = await opportunityService.create(opp);
        savedOpportunities.push(saved);

        // Create alerts for high-confidence opportunities
        if (saved.confidence >= THRESHOLDS.OPPORTUNITY.MIN_CONFIDENCE) {
          await alertService.createOpportunityAlert(saved.title, saved.id, saved.confidence);
        }
      }

      const highPriorityCount = savedOpportunities.filter(
        (o) => o.expectedImpact === ExpectedImpact.HIGH && o.confidence >= 60
      ).length;

      log.info('Opportunity generation completed', {
        total: savedOpportunities.length,
        highPriority: highPriorityCount,
      });

      return {
        opportunities: savedOpportunities,
        summary: `Generated ${savedOpportunities.length} opportunities, ${highPriorityCount} with high priority.`,
        highPriorityCount,
      };
    } catch (error) {
      log.error('Opportunity generation failed', { error: (error as Error).message });
      throw error;
    }
  }

  private async identifyOpportunitiesWithAI(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never,
    competitorData: ReturnType<typeof competitorAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): Promise<Omit<Opportunity, 'id' | 'createdAt'>[]> {
    const prompt = OPPORTUNITY_USER_PROMPT
      .replace('{{BUSINESS_DATA}}', JSON.stringify(businessData, null, 2))
      .replace('{{COMPETITOR_DATA}}', JSON.stringify(competitorData, null, 2))
      .replace('{{THRESHOLDS}}', JSON.stringify(THRESHOLDS.OPPORTUNITY, null, 2));

    try {
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: OPPORTUNITY_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.openai.maxTokens * 2, // Double for opportunity generation
        temperature: config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseOpportunitiesFromResponse(content, businessData);
    } catch (error) {
      log.error('AI opportunity identification failed, using fallback', {
        error: (error as Error).message,
      });
      return this.generateFallbackOpportunities(businessData, competitorData);
    }
  }

  private parseOpportunitiesFromResponse(
    content: string,
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): Omit<Opportunity, 'id' | 'createdAt'>[] {
    const opportunities: Omit<Opportunity, 'id' | 'createdAt'>[] = [];

    // Parse structured opportunities from the AI response
    // Look for patterns like "## Opportunity 1:" or numbered items
    const sections = content.split(/(?:^|\n)(?:#{1,3}\s*(?:Opportunity|REC|\d+)|^\d+\.\s)/i);

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];

      const typeMatch = section.match(/type[:\s]*(\w+)/i);
      const titleMatch = section.match(/title[:\s]*([^\n]+)/i);
      const descriptionMatch = section.match(/description[:\s]*([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i);
      const impactMatch = section.match(/impact[:\s]*(low|medium|high)/i);
      const confidenceMatch = section.match(/confidence[:\s]*(\d+)/i);

      if (titleMatch || descriptionMatch) {
        const type = this.parseOpportunityType(typeMatch?.[1] || 'campaign');
        const targetSegment = this.extractTargetSegment(section);

        const opportunity: Omit<Opportunity, 'id' | 'createdAt'> = {
          type,
          title: titleMatch?.[1]?.trim() || `Opportunity ${i}`,
          description: descriptionMatch?.[1]?.trim() || 'Opportunity identified through analysis',
          expectedImpact: this.parseImpact(impactMatch?.[1]),
          confidence: this.parseConfidence(confidenceMatch?.[1]),
          data: {
            sourceSection: section.substring(0, 500),
            targetSegment,
          },
          recommendations: this.extractRecommendations(section, type, targetSegment),
          status: OpportunityStatus.IDENTIFIED,
        };

        opportunities.push(opportunity);
      }
    }

    // If no structured opportunities found, generate fallback
    if (opportunities.length === 0) {
      return this.generateFallbackOpportunities(businessData, {} as ReturnType<typeof competitorAnalysisService.analyze> extends Promise<infer T> ? T : never);
    }

    return opportunities.slice(0, 10); // Limit to 10 opportunities
  }

  private parseOpportunityType(typeStr: string): OpportunityType {
    const typeMap: Record<string, OpportunityType> = {
      campaign: OpportunityType.CAMPAIGN,
      product: OpportunityType.PRODUCT,
      segment: OpportunityType.SEGMENT,
      retention: OpportunityType.RETENTION,
      upsell: OpportunityType.UPSELL,
      market: OpportunityType.MARKET,
    };

    return typeMap[typeStr.toLowerCase()] || OpportunityType.CAMPAIGN;
  }

  private parseImpact(impactStr: string | undefined): ExpectedImpact {
    if (!impactStr) return ExpectedImpact.MEDIUM;

    const impactMap: Record<string, ExpectedImpact> = {
      low: ExpectedImpact.LOW,
      medium: ExpectedImpact.MEDIUM,
      high: ExpectedImpact.HIGH,
    };

    return impactMap[impactStr.toLowerCase()] || ExpectedImpact.MEDIUM;
  }

  private parseConfidence(confidenceStr: string | undefined): number {
    if (!confidenceStr) return THRESHOLDS.OPPORTUNITY.MIN_CONFIDENCE;

    const confidence = parseInt(confidenceStr, 10);
    return Math.max(0, Math.min(100, confidence));
  }

  private extractTargetSegment(content: string): string {
    const segmentMatch = content.match(/segment[:\s]*([^\n,]+)/i);
    if (segmentMatch) {
      return segmentMatch[1].trim();
    }

    // Default segments
    const segments = ['VIP', 'Regular', 'New', 'At-Risk', 'High-Value'];
    return segments[Math.floor(Math.random() * segments.length)];
  }

  private extractRecommendations(
    content: string,
    type: OpportunityType,
    targetSegment: string
  ): Recommendation[] {
    // Use the service to generate recommendations
    return opportunityService.generateRecommendations(type, targetSegment);
  }

  private generateFallbackOpportunities(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never,
    competitorData: ReturnType<typeof competitorAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): Omit<Opportunity, 'id' | 'createdAt'>[] {
    const opportunities: Omit<Opportunity, 'id' | 'createdAt'>[] = [];

    // Analyze business data for opportunities
    const customerBehavior = businessData.customerBehavior || [];
    const productPerformance = businessData.productPerformance || [];
    const channelEffectiveness = businessData.channelEffectiveness || [];
    const gaps = competitorData?.gaps || [];

    // Retention opportunity
    const atRiskSegment = customerBehavior.find((c: { churnRate: number }) => c.churnRate > 0.2);
    if (atRiskSegment) {
      opportunities.push({
        type: OpportunityType.RETENTION,
        title: `Retention Campaign for ${atRiskSegment.segmentName} Segment`,
        description: `The ${atRiskSegment.segmentName} segment has a churn rate of ${(atRiskSegment.churnRate * 100).toFixed(1)}%. Implement a targeted retention campaign to reduce churn.`,
        expectedImpact: ExpectedImpact.HIGH,
        confidence: 75,
        data: { segmentId: atRiskSegment.segmentId, currentChurnRate: atRiskSegment.churnRate },
        recommendations: opportunityService.generateRecommendations(OpportunityType.RETENTION, atRiskSegment.segmentName),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    // Upsell opportunity
    const topProduct = productPerformance.find((p: { trend: string }) => p.trend === 'rising');
    if (topProduct) {
      opportunities.push({
        type: OpportunityType.UPSELL,
        title: `Upsell Campaign for ${topProduct.name}`,
        description: `${topProduct.name} is showing strong growth (${(topProduct.growthRate * 100).toFixed(1)}%). Create an upsell campaign to capitalize on momentum.`,
        expectedImpact: ExpectedImpact.MEDIUM,
        confidence: 70,
        data: { productId: topProduct.productId, growthRate: topProduct.growthRate },
        recommendations: opportunityService.generateRecommendations(OpportunityType.UPSELL, 'High-Value'),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    // Channel optimization opportunity
    const lowPerformingChannel = channelEffectiveness.find((c: { conversionRate: number }) => c.conversionRate < 0.05);
    if (lowPerformingChannel) {
      opportunities.push({
        type: OpportunityType.CAMPAIGN,
        title: `Optimize ${lowPerformingChannel.channel} Channel Performance`,
        description: `${lowPerformingChannel.channel} has a conversion rate of ${(lowPerformingChannel.conversionRate * 100).toFixed(1)}%, below industry average. Optimize content and timing.`,
        expectedImpact: ExpectedImpact.MEDIUM,
        confidence: 65,
        data: { channel: lowPerformingChannel.channel, currentConversion: lowPerformingChannel.conversionRate },
        recommendations: opportunityService.generateRecommendations(OpportunityType.CAMPAIGN, 'Regular'),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    // Market gap opportunity
    const pricingGap = gaps.find((g: { type: string }) => g.type === 'pricing');
    if (pricingGap) {
      opportunities.push({
        type: OpportunityType.MARKET,
        title: 'Capture Mid-Market Segment',
        description: pricingGap.opportunity,
        expectedImpact: ExpectedImpact.HIGH,
        confidence: pricingGap.confidence,
        data: { gapType: 'pricing', opportunity: pricingGap.opportunity },
        recommendations: opportunityService.generateRecommendations(OpportunityType.MARKET, 'New'),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    // New customer acquisition
    const newCustomerSegment = customerBehavior.find((c: { segmentName: string }) => c.segmentName === 'New');
    if (newCustomerSegment) {
      opportunities.push({
        type: OpportunityType.SEGMENT,
        title: `Scale New Customer Acquisition`,
        description: `New customer segment shows ${newCustomerSegment.activeCustomers} active customers with potential for growth.`,
        expectedImpact: ExpectedImpact.MEDIUM,
        confidence: 60,
        data: { segmentId: newCustomerSegment.segmentId, activeCustomers: newCustomerSegment.activeCustomers },
        recommendations: opportunityService.generateRecommendations(OpportunityType.SEGMENT, 'New'),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    // Product gap opportunity
    const featureGap = gaps.find((g: { type: string }) => g.type === 'features');
    if (featureGap) {
      opportunities.push({
        type: OpportunityType.PRODUCT,
        title: 'Develop Differentiating Features',
        description: featureGap.opportunity,
        expectedImpact: ExpectedImpact.HIGH,
        confidence: featureGap.confidence,
        data: { gapType: 'features', opportunity: featureGap.opportunity },
        recommendations: opportunityService.generateRecommendations(OpportunityType.PRODUCT, 'VIP'),
        status: OpportunityStatus.IDENTIFIED,
      });
    }

    return opportunities;
  }

  async scoreOpportunity(opportunity: Opportunity): Promise<{
    score: number;
    factors: Array<{ factor: string; impact: number; reason: string }>;
  }> {
    const factors: Array<{ factor: string; impact: number; reason: string }> = [];
    let score = 0;

    // Confidence factor (30% weight)
    const confidenceScore = (opportunity.confidence / 100) * 30;
    factors.push({
      factor: 'Confidence',
      impact: 30,
      reason: `Confidence of ${opportunity.confidence}% contributes ${confidenceScore.toFixed(1)} points`,
    });
    score += confidenceScore;

    // Impact factor (30% weight)
    const impactScores: Record<ExpectedImpact, number> = {
      [ExpectedImpact.HIGH]: 30,
      [ExpectedImpact.MEDIUM]: 20,
      [ExpectedImpact.LOW]: 10,
    };
    const impactScore = impactScores[opportunity.expectedImpact];
    factors.push({
      factor: 'Impact',
      impact: 30,
      reason: `${opportunity.expectedImpact} impact contributes ${impactScore} points`,
    });
    score += impactScore;

    // Recommendations factor (20% weight)
    const recCount = opportunity.recommendations.length;
    const recScore = Math.min(recCount * 4, 20);
    factors.push({
      factor: 'Recommendations',
      impact: 20,
      reason: `${recCount} recommendations contributes ${recScore} points`,
    });
    score += recScore;

    // Data quality factor (20% weight)
    const dataKeys = Object.keys(opportunity.data).length;
    const dataScore = Math.min(dataKeys * 4, 20);
    factors.push({
      factor: 'Data Quality',
      impact: 20,
      reason: `${dataKeys} data points contributes ${dataScore} points`,
    });
    score += dataScore;

    return {
      score: Math.round(score),
      factors,
    };
  }
}

export const opportunityAgent = new OpportunityAgent();
export default opportunityAgent;

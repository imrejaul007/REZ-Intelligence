import OpenAI from 'openai';
import config from '../config/index.js';
import {
  BusinessAnalysisResponse,
  CompetitorAnalysisResponse,
  SegmentAnalysisResponse,
  InsightSection,
} from '../types/index.js';
import { businessAnalysisService, competitorAnalysisService } from '../services/index.js';
import { RESEARCH_SYSTEM_PROMPT, RESEARCH_USER_PROMPT } from '../prompts/researchPrompt.js';
import logger from './utils/logger.js';

const log = logger.child({ context: 'ResearchAgent' });

interface ResearchResult {
  summary: string;
  sections: InsightSection[];
  metrics: Record<string, number>;
  insights: string[];
  generatedAt: Date;
}

class ResearchAgent {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async conductFullAnalysis(): Promise<ResearchResult> {
    log.info('Starting full business research analysis');

    try {
      // Gather data from all sources
      const [businessData, competitorData] = await Promise.all([
        businessAnalysisService.analyze({}),
        competitorAnalysisService.analyze({}),
      ]);

      // Generate AI insights
      const aiAnalysis = await this.analyzeWithAI(businessData, competitorData);

      log.info('Research analysis completed');
      return {
        summary: aiAnalysis.summary,
        sections: aiAnalysis.sections,
        metrics: this.extractMetrics(businessData, competitorData),
        insights: aiAnalysis.insights,
        generatedAt: new Date(),
      };
    } catch (error) {
      log.error('Research analysis failed', { error: (error as Error).message });
      throw error;
    }
  }

  async analyzeCompetitors(): Promise<{
    summary: string;
    gaps: Array<{ type: string; opportunity: string; confidence: number }>;
    recommendations: string[];
  }> {
    log.info('Starting competitor analysis');

    try {
      const competitorData = await competitorAnalysisService.analyze({});

      const prompt = `
Analyze the following competitor data and market trends:

COMPETITOR DATA:
${JSON.stringify(competitorData.competitors, null, 2)}

MARKET TRENDS:
${JSON.stringify(competitorData.marketTrends, null, 2)}

PRICE POSITIONS:
${JSON.stringify(competitorData.pricePositions, null, 2)}

IDENTIFIED GAPS:
${JSON.stringify(competitorData.gaps, null, 2)}

Provide:
1. A strategic summary of the competitive landscape
2. Key gaps and opportunities
3. Recommended actions for competitive advantage
`;

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content || '';
      const lines = content.split('\n').filter((l) => l.trim());

      return {
        summary: lines.slice(0, 3).join('\n'),
        gaps: competitorData.gaps.map((g) => ({
          type: g.type,
          opportunity: g.opportunity,
          confidence: g.confidence,
        })),
        recommendations: lines.slice(-5),
      };
    } catch (error) {
      log.error('Competitor analysis failed', { error: (error as Error).message });
      throw error;
    }
  }

  async analyzeSegments(): Promise<{
    summary: string;
    segments: Array<{
      id: string;
      name: string;
      opportunities: string[];
      recommendedActions: string[];
    }>;
  }> {
    log.info('Starting segment analysis');

    try {
      const businessData = businessAnalysisService.getDataForAI();

      const segments = businessData.customerBehavior.map((segment) => {
        const opportunities: string[] = [];
        const recommendedActions: string[] = [];

        // Analyze retention
        if (segment.retentionRate > 0.7) {
          opportunities.push('High retention indicates strong loyalty potential');
          recommendedActions.push('Launch loyalty reward program');
        } else if (segment.retentionRate < 0.4) {
          opportunities.push('Low retention presents improvement opportunity');
          recommendedActions.push('Implement retention campaign');
        }

        // Analyze growth
        if (segment.trends.growth > 0.2) {
          opportunities.push('Strong growth momentum');
          recommendedActions.push('Scale successful initiatives');
        }

        // Analyze order value
        if (segment.avgOrderValue > 1000) {
          recommendedActions.push('Focus on upselling high-value customers');
        }

        return {
          id: segment.segmentId,
          name: segment.segmentName,
          opportunities,
          recommendedActions,
        };
      });

      const summary = `Analyzed ${segments.length} customer segments. ` +
        `${segments.filter((s) => s.opportunities.length > 0).length} segments show clear opportunities.`;

      return { summary, segments };
    } catch (error) {
      log.error('Segment analysis failed', { error: (error as Error).message });
      throw error;
    }
  }

  private async analyzeWithAI(
    businessData: BusinessAnalysisResponse,
    competitorData: CompetitorAnalysisResponse
  ): Promise<{ summary: string; sections: InsightSection[]; insights: string[] }> {
    const prompt = RESEARCH_USER_PROMPT
      .replace('{{CUSTOMER_BEHAVIOR}}', JSON.stringify(businessData.customerBehavior, null, 2))
      .replace('{{PURCHASE_PATTERNS}}', JSON.stringify(businessData.purchasePatterns, null, 2))
      .replace('{{PRODUCT_PERFORMANCE}}', JSON.stringify(businessData.productPerformance, null, 2))
      .replace('{{CHANNEL_EFFECTIVENESS}}', JSON.stringify(businessData.channelEffectiveness, null, 2))
      .replace('{{COMPETITORS}}', JSON.stringify(competitorData.competitors, null, 2))
      .replace('{{MARKET_TRENDS}}', JSON.stringify(competitorData.marketTrends, null, 2))
      .replace('{{MARKET_GAPS}}', JSON.stringify(competitorData.gaps, null, 2));

    try {
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content || '';

      // Parse the AI response into structured sections
      const sections = this.parseResponseIntoSections(content);

      return {
        summary: this.extractSummary(content),
        sections,
        insights: this.extractInsights(content),
      };
    } catch (error) {
      log.error('AI analysis failed, using fallback', { error: (error as Error).message });
      return this.generateFallbackAnalysis(businessData, competitorData);
    }
  }

  private parseResponseIntoSections(content: string): InsightSection[] {
    const sections: InsightSection[] = [];

    // Try to identify section headers
    const headers = ['Executive Summary', 'Customer Insights', 'Product Analysis', 'Channel Performance', 'Competitive Landscape', 'Opportunities', 'Recommendations'];

    for (const header of headers) {
      const regex = new RegExp(`${header}[:\\s]*(.*?)(?=\\n\\n|\\n[A-Z]|$)`, 'is');
      const match = content.match(regex);
      if (match) {
        sections.push({
          title: header,
          content: match[1].trim(),
          type: this.getSectionType(header),
        });
      }
    }

    // If no sections found, create a single summary section
    if (sections.length === 0) {
      sections.push({
        title: 'Analysis Summary',
        content: content.substring(0, 2000),
        type: 'analysis',
      });
    }

    return sections;
  }

  private getSectionType(header: string): 'analysis' | 'opportunity' | 'alert' | 'metric' {
    if (header.toLowerCase().includes('opportunity') || header.toLowerCase().includes('recommendation')) {
      return 'opportunity';
    }
    if (header.toLowerCase().includes('alert') || header.toLowerCase().includes('risk')) {
      return 'alert';
    }
    if (header.toLowerCase().includes('metric') || header.toLowerCase().includes('performance')) {
      return 'metric';
    }
    return 'analysis';
  }

  private extractSummary(content: string): string {
    const firstParagraph = content.split('\n\n')[0] || content.substring(0, 500);
    return firstParagraph.trim();
  }

  private extractInsights(content: string): string[] {
    const insights: string[] = [];

    // Look for bullet points or numbered items
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(/^[-*•]|^\\d+\\./)) {
        insights.push(line.replace(/^[-*•\\d.]/, '').trim());
      }
    }

    return insights.slice(0, 10); // Limit to 10 insights
  }

  private extractMetrics(
    businessData: BusinessAnalysisResponse,
    competitorData: CompetitorAnalysisResponse
  ): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Business metrics
    if (businessData.purchasePatterns.length > 0) {
      const latestPattern = businessData.purchasePatterns[0];
      metrics.totalRevenue = latestPattern.totalRevenue;
      metrics.avgOrderValue = latestPattern.avgOrderValue;
      metrics.totalOrders = latestPattern.totalOrders;
      metrics.repeatPurchaseRate = latestPattern.repeatPurchaseRate * 100;
    }

    // Customer metrics
    if (businessData.customerBehavior.length > 0) {
      const avgRetention = businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) /
        businessData.customerBehavior.length;
      metrics.avgRetentionRate = avgRetention * 100;
      metrics.totalCustomers = businessData.customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0);
    }

    // Channel metrics
    if (businessData.channelEffectiveness.length > 0) {
      const topChannel = businessData.channelEffectiveness.sort((a, b) => b.roi - a.roi)[0];
      metrics.topChannelRoi = topChannel.roi;
      metrics.topChannelConversion = topChannel.conversionRate * 100;
    }

    // Competitor metrics
    metrics.competitorCount = competitorData.competitors.length;
    metrics.marketTrendCount = competitorData.marketTrends.length;
    metrics.gapCount = competitorData.gaps.length;

    return metrics;
  }

  private generateFallbackAnalysis(
    businessData: BusinessAnalysisResponse,
    competitorData: CompetitorAnalysisResponse
  ): { summary: string; sections: InsightSection[]; insights: string[] } {
    const insights: string[] = [];

    // Generate insights from data
    if (businessData.purchasePatterns.length > 0) {
      const pattern = businessData.purchasePatterns[0];
      if (pattern.repeatPurchaseRate > 0.4) {
        insights.push('High repeat purchase rate indicates strong customer loyalty');
      }
      if (pattern.avgOrderValue > 800) {
        insights.push('Above average order value suggests premium positioning');
      }
    }

    if (businessData.channelEffectiveness.length > 0) {
      const topChannel = businessData.channelEffectiveness.sort((a, b) => b.roi - a.roi)[0];
      insights.push(`${topChannel.channel} is the most effective channel with ${topChannel.roi.toFixed(1)}% ROI`);
    }

    const sections: InsightSection[] = [
      {
        title: 'Executive Summary',
        content: 'Analysis based on current business and market data.',
        type: 'analysis',
      },
      {
        title: 'Key Insights',
        content: insights.join('. '),
        type: 'analysis',
      },
      {
        title: 'Opportunities',
        content: competitorData.gaps.map((g) => g.opportunity).join('. '),
        type: 'opportunity',
      },
    ];

    return {
      summary: sections[0].content,
      sections,
      insights,
    };
  }
}

export const researchAgent = new ResearchAgent();
export default researchAgent;

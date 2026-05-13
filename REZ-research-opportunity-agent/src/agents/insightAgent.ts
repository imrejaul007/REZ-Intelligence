import OpenAI from 'openai';
import config from '../config/index.js';
import {
  NaturalLanguageQueryRequest,
  NaturalLanguageQueryResponse,
  InsightReport,
  Alert,
} from '../types/index.js';
import { businessAnalysisService, competitorAnalysisService, opportunityService, alertService } from '../services/index.js';
import { InsightReportModel } from '../models/InsightReport.js';
import { INSIGHT_SYSTEM_PROMPT, INSIGHT_USER_PROMPT } from '../prompts/insightPrompt.js';
import { cacheGet, cacheSet } from '../utils/redis.js';
import { CACHE_TTL, API_LIMITS } from '../constants/thresholds.js';
import { v4 as uuidv4 } from 'uuid';
import { Opportunity } from '../types/index.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'InsightAgent' });

interface DailyInsight {
  summary: string;
  metrics: Record<string, number>;
  alerts: Alert[];
  opportunities: Array<{ id: string; title: string; confidence: number }>;
  recommendations: string[];
}

class InsightAgent {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async query(request: NaturalLanguageQueryRequest): Promise<NaturalLanguageQueryResponse> {
    log.info('Processing natural language query', { query: request.query.substring(0, 100) });

    const cacheKey = `insight_query:${Buffer.from(request.query).toString('base64').substring(0, 50)}`;
    const cached = await cacheGet<NaturalLanguageQueryResponse>(cacheKey);
    if (cached) {
      log.info('Returning cached query response');
      return cached;
    }

    try {
      // Gather relevant data based on the query
      const contextData = await this.gatherContextData(request.query);

      const prompt = INSIGHT_USER_PROMPT
        .replace('{{QUERY}}', request.query)
        .replace('{{CONTEXT_DATA}}', JSON.stringify(contextData, null, 2))
        .replace('{{REQUEST_CONTEXT}}', JSON.stringify(request.context || {}, null, 2));

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
      });

      const content = response.choices[0]?.message?.content || '';
      const parsed = this.parseQueryResponse(content);

      const result: NaturalLanguageQueryResponse = {
        answer: parsed.answer,
        confidence: parsed.confidence,
        sources: parsed.sources,
        relatedMetrics: parsed.metrics,
        suggestedActions: parsed.actions,
      };

      await cacheSet(cacheKey, result, CACHE_TTL.INSIGHTS);

      log.info('Query processed successfully', { confidence: parsed.confidence });
      return result;
    } catch (error) {
      log.error('Query processing failed', { error: (error as Error).message });
      throw error;
    }
  }

  async generateDailyInsight(): Promise<DailyInsight> {
    log.info('Generating daily insight briefing');

    const cacheKey = `daily_insight:${new Date().toISOString().split('T')[0]}`;
    const cached = await cacheGet<DailyInsight>(cacheKey);
    if (cached) {
      log.info('Returning cached daily insight');
      return cached;
    }

    try {
      // Gather all data
      const [businessData, competitorData, activeAlerts, activeOpportunities] = await Promise.all([
        businessAnalysisService.analyze({}),
        competitorAnalysisService.analyze({}),
        alertService.findActive(),
        opportunityService.findActive(),
      ]);

      // Generate AI-powered summary
      const prompt = `
Generate a concise daily briefing based on the following data:

BUSINESS METRICS:
- Total Revenue: ₹${(businessData.purchasePatterns[0]?.totalRevenue || 0).toLocaleString()}
- Average Order Value: ₹${(businessData.purchasePatterns[0]?.avgOrderValue || 0).toFixed(2)}
- Repeat Purchase Rate: ${((businessData.purchasePatterns[0]?.repeatPurchaseRate || 0) * 100).toFixed(1)}%
- Total Customers: ${businessData.customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0)}
- Average Retention Rate: ${((businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) / businessData.customerBehavior.length) * 100).toFixed(1)}%

TOP PERFORMING PRODUCTS:
${businessData.productPerformance.slice(0, 3).map((p) => `- ${p.name}: ₹${p.revenue.toLocaleString()} (${(p.growthRate * 100).toFixed(1)}% growth)`).join('\n')}

CHANNEL PERFORMANCE:
${businessData.channelEffectiveness.map((c) => `- ${c.channel}: ${c.roi.toFixed(1)}% ROI`).join('\n')}

ACTIVE ALERTS:
${activeAlerts.length > 0 ? activeAlerts.slice(0, 5).map((a) => `- [${a.severity}] ${a.title}`).join('\n') : 'No active alerts'}

TOP OPPORTUNITIES:
${activeOpportunities.slice(0, 3).map((o) => `- ${o.title} (${o.confidence}% confidence)`).join('\n') || 'No active opportunities'}

COMPETITOR ACTIVITY:
${competitorData.gaps.slice(0, 2).map((g) => `- ${g.type}: ${g.opportunity.substring(0, 100)}...`).join('\n')}

Provide a brief daily briefing with:
1. Key highlights
2. Important metrics
3. Actionable recommendations
`;

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: 'You are a concise business analyst. Provide brief, actionable insights.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.6,
      });

      const content = response.choices[0]?.message?.content || '';

      const result: DailyInsight = {
        summary: content,
        metrics: {
          revenue: businessData.purchasePatterns[0]?.totalRevenue || 0,
          avgOrderValue: businessData.purchasePatterns[0]?.avgOrderValue || 0,
          repeatPurchaseRate: (businessData.purchasePatterns[0]?.repeatPurchaseRate || 0) * 100,
          totalCustomers: businessData.customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0),
          retentionRate: (businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) / businessData.customerBehavior.length) * 100,
          activeAlerts: activeAlerts.length,
          activeOpportunities: activeOpportunities.length,
        },
        alerts: activeAlerts.slice(0, 5),
        opportunities: activeOpportunities.slice(0, 5).map((o) => ({
          id: o.id,
          title: o.title,
          confidence: o.confidence,
        })),
        recommendations: this.extractRecommendations(content),
      };

      await cacheSet(cacheKey, result, CACHE_TTL.INSIGHTS);

      log.info('Daily insight generated successfully');
      return result;
    } catch (error) {
      log.error('Daily insight generation failed', { error: (error as Error).message });
      throw error;
    }
  }

  async generateWeeklyReport(): Promise<InsightReport> {
    log.info('Generating weekly report');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [businessData, competitorData, activeAlerts, activeOpportunities, highImpactOpps] = await Promise.all([
      businessAnalysisService.analyze({}),
      competitorAnalysisService.analyze({}),
      alertService.findActive(),
      opportunityService.findActive(),
      opportunityService.findHighImpact(),
    ]);

    const sections = this.generateReportSections(businessData, competitorData, activeAlerts, highImpactOpps);

    const report: Omit<InsightReport, 'id'> = {
      title: `Weekly Business Intelligence Report - ${now.toLocaleDateString()}`,
      type: 'weekly',
      summary: this.generateExecutiveSummary(businessData, competitorData, highImpactOpps),
      sections,
      metrics: {
        weeklyRevenue: businessData.purchasePatterns[0]?.totalRevenue || 0,
        weeklyOrders: businessData.purchasePatterns[0]?.totalOrders || 0,
        avgOrderValue: businessData.purchasePatterns[0]?.avgOrderValue || 0,
        customerRetention: (businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) / businessData.customerBehavior.length) * 100,
        topChannelRoi: Math.max(...businessData.channelEffectiveness.map((c) => c.roi)),
        opportunitiesIdentified: highImpactOpps.length,
        activeAlerts: activeAlerts.length,
      },
      opportunities: highImpactOpps.map((o) => o.id),
      alerts: activeAlerts.map((a) => a.id),
      periodStart: weekAgo,
      periodEnd: now,
      createdBy: 'system',
      createdAt: now,
    };

    // Save to database
    const savedReport = await InsightReportModel.create({
      id: uuidv4(),
      ...report,
    });

    log.info('Weekly report generated', { reportId: savedReport.id });
    return savedReport.toJSON();
  }

  private async gatherContextData(query: string): Promise<Record<string, unknown>> {
    const contextData: Record<string, unknown> = {};

    const queryLower = query.toLowerCase();

    // Include relevant data based on query keywords
    if (
      queryLower.includes('customer') ||
      queryLower.includes('segment') ||
      queryLower.includes('retention')
    ) {
      contextData.customerBehavior = businessAnalysisService.getDataForAI().customerBehavior;
    }

    if (queryLower.includes('revenue') || queryLower.includes('sales') || queryLower.includes('order')) {
      contextData.purchasePatterns = businessAnalysisService.getDataForAI().purchasePatterns;
    }

    if (queryLower.includes('product')) {
      contextData.productPerformance = businessAnalysisService.getDataForAI().productPerformance;
    }

    if (queryLower.includes('channel') || queryLower.includes('campaign')) {
      contextData.channelEffectiveness = businessAnalysisService.getDataForAI().channelEffectiveness;
    }

    if (
      queryLower.includes('competitor') ||
      queryLower.includes('market') ||
      queryLower.includes('pricing')
    ) {
      contextData.competitors = competitorAnalysisService.getCompetitorData();
      contextData.marketTrends = competitorAnalysisService.getMarketTrends();
    }

    if (queryLower.includes('opportunity')) {
      contextData.opportunities = await opportunityService.findActive();
    }

    if (queryLower.includes('alert') || queryLower.includes('issue') || queryLower.includes('problem')) {
      contextData.alerts = await alertService.findActive();
    }

    return contextData;
  }

  private parseQueryResponse(
    content: string
  ): {
    answer: string;
    confidence: number;
    sources: string[];
    metrics?: Record<string, number>;
    actions?: string[];
  } {
    const lines = content.split('\n');

    // Try to extract structured data
    const sources: string[] = [];
    const metrics: Record<string, number> = {};
    const actions: string[] = [];

    for (const line of lines) {
      if (line.match(/source[:\s]/i)) {
        sources.push(line.replace(/source[:\s]*/i, '').trim());
      }
      if (line.match(/metric[:\s]*/i)) {
        const match = line.match(/([a-zA-Z\s]+)[:\s]*(\d+\.?\d*)/i);
        if (match) {
          metrics[match[1].trim()] = parseFloat(match[2]);
        }
      }
      if (line.match(/action[:\s]*/i)) {
        actions.push(line.replace(/action[:\s]*/i, '').trim());
      }
    }

    // Calculate confidence based on how well we parsed the response
    let confidence = 70; // Base confidence
    if (sources.length > 0) confidence += 5;
    if (Object.keys(metrics).length > 0) confidence += 10;
    if (actions.length > 0) confidence += 10;
    confidence = Math.min(confidence, 95);

    return {
      answer: content.substring(0, API_LIMITS.MAX_QUERY_LENGTH),
      confidence,
      sources,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];

    // Look for action-oriented sentences
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (
        sentence.match(/\b(consider|recommend|suggest|implement|launch|create|focus on|prioritize)\b/i) ||
        sentence.match(/\bshould\b/i)
      ) {
        recommendations.push(sentence.trim());
      }
    }

    return recommendations.slice(0, 5);
  }

  private generateReportSections(
    businessData: Awaited<ReturnType<typeof businessAnalysisService.analyze>>,
    competitorData: Awaited<ReturnType<typeof competitorAnalysisService.analyze>>,
    alerts: Alert[],
    opportunities: Opportunity[]
  ): InsightReport['sections'] {
    return [
      {
        title: 'Executive Summary',
        content: this.generateExecutiveSummary(businessData, competitorData, opportunities),
        type: 'analysis',
      },
      {
        title: 'Key Metrics',
        content: this.formatMetricsForReport(businessData),
        type: 'metric',
        data: this.extractKeyMetrics(businessData),
      },
      {
        title: 'Customer Insights',
        content: this.generateCustomerInsights(businessData),
        type: 'analysis',
        data: { segments: businessData.customerBehavior },
      },
      {
        title: 'Product Performance',
        content: this.generateProductInsights(businessData),
        type: 'metric',
        data: { products: businessData.productPerformance },
      },
      {
        title: 'Channel Effectiveness',
        content: this.generateChannelInsights(businessData),
        type: 'metric',
        data: { channels: businessData.channelEffectiveness },
      },
      {
        title: 'Competitive Landscape',
        content: this.generateCompetitorInsights(competitorData),
        type: 'analysis',
        data: { gaps: competitorData.gaps },
      },
      {
        title: 'Active Alerts',
        content: alerts.length > 0 ? alerts.map((a) => `[${a.severity}] ${a.title}`).join('\n') : 'No active alerts',
        type: 'alert',
        data: { alerts: alerts.slice(0, 10) },
      },
      {
        title: 'Top Opportunities',
        content: opportunities.length > 0 ? opportunities.map((o) => `${o.title} (${o.confidence}% confidence)`).join('\n') : 'No high-priority opportunities',
        type: 'opportunity',
        data: { opportunities: opportunities.slice(0, 10) },
      },
    ];
  }

  private generateExecutiveSummary(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never,
    competitorData: ReturnType<typeof competitorAnalysisService.analyze> extends Promise<infer T> ? T : never,
    opportunities: Awaited<ReturnType<typeof opportunityService.findHighImpact>>
  ): string {
    const totalRevenue = businessData.purchasePatterns[0]?.totalRevenue || 0;
    const avgOrderValue = businessData.purchasePatterns[0]?.avgOrderValue || 0;
    const retentionRate = (businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) / businessData.customerBehavior.length) * 100;
    const topChannel = businessData.channelEffectiveness.sort((a, b) => b.roi - a.roi)[0];

    return `This week's business intelligence summary:

Revenue Performance: Generated ₹${totalRevenue.toLocaleString()} with an average order value of ₹${avgOrderValue.toFixed(2)}.

Customer Metrics: Customer retention stands at ${retentionRate.toFixed(1)}% across ${businessData.customerBehavior.length} segments.

Channel Performance: ${topChannel.channel} leads with ${topChannel.roi.toFixed(1)}% ROI.

Market Position: ${competitorData.competitors.length} competitors analyzed with ${competitorData.gaps.length} market gaps identified.

Opportunities: ${opportunities.length} high-impact opportunities identified requiring attention.`;
  }

  private formatMetricsForReport(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): string {
    const metrics = [
      `Total Revenue: ₹${(businessData.purchasePatterns[0]?.totalRevenue || 0).toLocaleString()}`,
      `Average Order Value: ₹${(businessData.purchasePatterns[0]?.avgOrderValue || 0).toFixed(2)}`,
      `Total Orders: ${businessData.purchasePatterns[0]?.totalOrders || 0}`,
      `Repeat Purchase Rate: ${((businessData.purchasePatterns[0]?.repeatPurchaseRate || 0) * 100).toFixed(1)}%`,
      `Total Customers: ${businessData.customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0)}`,
    ];

    return metrics.join('\n');
  }

  private extractKeyMetrics(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): Record<string, number> {
    return {
      revenue: businessData.purchasePatterns[0]?.totalRevenue || 0,
      avgOrderValue: businessData.purchasePatterns[0]?.avgOrderValue || 0,
      totalOrders: businessData.purchasePatterns[0]?.totalOrders || 0,
      repeatPurchaseRate: (businessData.purchasePatterns[0]?.repeatPurchaseRate || 0) * 100,
      totalCustomers: businessData.customerBehavior.reduce((sum, c) => sum + c.totalCustomers, 0),
      retentionRate: (businessData.customerBehavior.reduce((sum, c) => sum + c.retentionRate, 0) / businessData.customerBehavior.length) * 100,
    };
  }

  private generateCustomerInsights(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): string {
    const insights: string[] = [];

    for (const segment of businessData.customerBehavior) {
      if (segment.retentionRate > 0.8) {
        insights.push(`${segment.segmentName} shows exceptional retention at ${(segment.retentionRate * 100).toFixed(0)}%`);
      } else if (segment.retentionRate < 0.5) {
        insights.push(`${segment.segmentName} needs attention with ${(segment.retentionRate * 100).toFixed(0)}% retention`);
      }
    }

    return insights.length > 0 ? insights.join('\n') : 'Customer segments are performing within expected ranges.';
  }

  private generateProductInsights(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): string {
    const topProducts = businessData.productPerformance
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    return topProducts.map((p) => `${p.name}: ₹${p.revenue.toLocaleString()} (${(p.growthRate * 100).toFixed(1)}% ${p.trend})`).join('\n');
  }

  private generateChannelInsights(
    businessData: ReturnType<typeof businessAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): string {
    const sortedChannels = [...businessData.channelEffectiveness].sort((a, b) => b.roi - a.roi);

    return sortedChannels
      .map((c) => `${c.channel}: ${c.roi.toFixed(1)}% ROI, ${(c.conversionRate * 100).toFixed(1)}% conversion`)
      .join('\n');
  }

  private generateCompetitorInsights(
    competitorData: ReturnType<typeof competitorAnalysisService.analyze> extends Promise<infer T> ? T : never
  ): string {
    const insights: string[] = [];

    if (competitorData.gaps.length > 0) {
      insights.push(`${competitorData.gaps.length} market gaps identified:`);
      competitorData.gaps.slice(0, 3).forEach((gap) => {
        insights.push(`  - ${gap.type}: ${gap.opportunity.substring(0, 80)}...`);
      });
    }

    if (competitorData.marketTrends.length > 0) {
      const significantTrends = competitorData.marketTrends.filter((t) => t.significance === 'high');
      if (significantTrends.length > 0) {
        insights.push(`\n${significantTrends.length} significant market trends to watch.`);
      }
    }

    return insights.join('\n');
  }
}

export const insightAgent = new InsightAgent();
export default insightAgent;

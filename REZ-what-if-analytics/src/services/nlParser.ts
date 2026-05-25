import { Scenario, ScenarioType, MetricType, TimeHorizon } from '../types/index.js';

export class NLParser {
  parseQuery(query: string): Partial<Scenario> {
    const lowerQuery = query.toLowerCase();

    const type = this.detectScenarioType(lowerQuery);
    const metric = this.detectMetric(lowerQuery);
    const changePercent = this.extractChangePercent(lowerQuery);
    const timeHorizon = this.detectTimeHorizon(lowerQuery);

    return {
      name: query.substring(0, 200),
      description: `What-if analysis: ${query}`,
      type,
      assumptions: {},
      parameters: {
        metric: metric || 'revenue',
        changePercent: changePercent || 10,
        timeHorizon: timeHorizon || 'month',
        confidenceLevel: 0.95
      }
    };
  }

  private detectScenarioType(query: string): ScenarioType {
    const patterns: Record<string, ScenarioType> = {
      pricing: ['price', 'pricing', 'cost', 'fee', 'charge', 'discount', 'markup'],
      demand: ['demand', 'traffic', 'visitors', 'footfall', 'customers', 'demand spike', 'demand drop'],
      promotion: ['promotion', 'offer', 'deal', 'campaign', 'discount', 'coupon', 'sale', 'advertising'],
      inventory: ['inventory', 'stock', 'supply', 'product', 'sku', 'warehouse'],
      customer: ['customer', 'retention', 'churn', 'loyalty', 'acquisition', 'new customer'],
      marketing: ['marketing', 'ads', 'campaign', 'reach', 'brand', 'awareness'],
      operational: ['staff', 'employee', 'hours', 'operation', 'efficiency', 'process'],
      financial: ['revenue', 'profit', 'margin', 'cost', 'expense', 'financial', 'budget']
    };

    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return type;
      }
    }

    return 'demand';
  }

  private detectMetric(query: string): MetricType | null {
    const patterns: Record<string, MetricType> = {
      revenue: ['revenue', 'sales', 'income'],
      margin: ['margin', 'profit margin', 'gross margin'],
      units_sold: ['units', 'quantity', 'products sold', 'orders'],
      customers: ['customers', 'users', 'visitors'],
      conversion_rate: ['conversion', 'conversion rate', 'cvr'],
      avg_order_value: ['aov', 'average order', 'basket size', 'cart value'],
      retention_rate: ['retention', 'retention rate', 'repeat rate'],
      acquisition_cost: ['cac', 'acquisition cost', 'cost to acquire'],
      ltv: ['ltv', 'lifetime value', 'clv', 'customer value'],
      market_share: ['market share', 'share', 'competitiveness']
    };

    for (const [metric, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return metric;
      }
    }

    return null;
  }

  private extractChangePercent(query: string): number {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*(?:percent|%)/i,
      /(?:increase|grow|rise|go up|boost|improve)(?:by)?\s*(\d+(?:\.\d+)?)/i,
      /(?:decrease|drop|fall|reduce|decline|cut)(?:by)?\s*(\d+(?:\.\d+)?)/i,
      /(?:change|shift|adjust)(?:by)?\s*(\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        let value = parseFloat(match[1]);

        if (query.includes('double') || query.includes('2x') || query.includes('twice')) {
          value = 100;
        } else if (query.includes('triple') || query.includes('3x')) {
          value = 200;
        } else if (query.includes('half') || query.includes('50%')) {
          value = -50;
        }

        if (query.includes('decrease') || query.includes('drop') || query.includes('fall') ||
            query.includes('reduce') || query.includes('decline') || query.includes('cut')) {
          value = -value;
        }

        return value;
      }
    }

    return 10;
  }

  private detectTimeHorizon(query: string): TimeHorizon {
    if (query.includes('today') || query.includes('day') || query.includes('daily')) {
      return 'day';
    }
    if (query.includes('week') || query.includes('weekly')) {
      return 'week';
    }
    if (query.includes('quarter') || query.includes('q1') || query.includes('q2') || query.includes('q3') || query.includes('q4')) {
      return 'quarter';
    }
    if (query.includes('year') || query.includes('annual') || query.includes('yearly')) {
      return 'year';
    }

    return 'month';
  }

  generateNaturalLanguageResult(result: {
    scenarioName: string;
    baseline: Record<string, number>;
    projected: Record<string, number>;
    deltas: Record<string, number>;
    recommendations: Array<{ action: string; impact: string }>;
  }): string {
    const parts: string[] = [];

    parts.push(`**Scenario: ${result.scenarioName}**\n\n`);

    parts.push('**Impact Summary:**\n');
    for (const [metric, delta] of Object.entries(result.deltas)) {
      const sign = delta >= 0 ? '+' : '';
      parts.push(`- ${metric}: ${sign}${delta.toFixed(2)} (${sign}${(delta / (result.baseline[metric] || 1) * 100).toFixed(1)}%)`);
    }

    if (result.recommendations.length > 0) {
      parts.push('\n**Recommendations:**\n');
      result.recommendations.forEach((rec, i) => {
        parts.push(`${i + 1}. ${rec.action} (${rec.impact} impact)`);
      });
    }

    return parts.join('\n');
  }
}

export const nlParser = new NLParser();

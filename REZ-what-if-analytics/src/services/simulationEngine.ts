import crypto from 'crypto';
import { Scenario, ScenarioResult, MetricType, MonteCarloParams, MonteCarloResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class SimulationEngine {
  private baselineMetrics: Map<string, Record<MetricType, number>> = new Map();

  async initializeBaseline(businessId: string, metrics: Record<MetricType, number>): Promise<void> {
    this.baselineMetrics.set(businessId, metrics);
    logger.info(`Baseline initialized for business: ${businessId}`);
  }

  async runScenario(scenario: Scenario): Promise<ScenarioResult> {
    const startTime = Date.now();
    const businessId = scenario.baselineId || 'default';

    const baseline = this.baselineMetrics.get(businessId) || this.getDefaultBaseline(scenario.parameters.metric);
    const projectedMetrics = this.projectMetrics(baseline, scenario);
    const deltas = this.calculateDeltas(baseline, projectedMetrics);
    const percentChanges = this.calculatePercentChanges(baseline, projectedMetrics);

    const result: ScenarioResult = {
      scenarioId: scenario.id || crypto.randomUUID(),
      baselineMetrics: baseline,
      projectedMetrics,
      deltas,
      percentChanges,
      confidenceInterval: this.calculateConfidenceInterval(projectedMetrics, scenario.parameters.confidenceLevel),
      riskScore: this.calculateRiskScore(deltas, scenario.parameters.changePercent),
      recommendations: this.generateRecommendations(scenario, projectedMetrics, deltas),
      simulatedAt: new Date()
    };

    logger.info(`Scenario ${result.scenarioId} completed in ${Date.now() - startTime}ms`);
    return result;
  }

  async runMonteCarlo(params: MonteCarloParams): Promise<MonteCarloResult> {
    const simulations = params.simulations;
    const results: number[] = [];
    const metric = params.metric;

    for (let i = 0; i < simulations; i++) {
      let value = 0;
      for (const [variable, dist] of Object.entries(params.inputDistributions)) {
        value += this.sampleFromDistribution(dist.type, dist.params);
      }
      results.push(value);
    }

    results.sort((a, b) => a - b);

    const sum = results.reduce((a, b) => a + b, 0);
    const mean = sum / results.length;
    const median = results[Math.floor(results.length / 2)];

    const squaredDiffs = results.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / results.length;
    const stdDev = Math.sqrt(variance);

    const percentiles: Record<number, number> = {};
    [5, 10, 25, 50, 75, 90, 95].forEach(p => {
      const idx = Math.floor((p / 100) * results.length);
      percentiles[p] = results[idx];
    });

    const histogram = this.generateHistogram(results, 10);

    let probabilityOfGoal = 0;
    if (params.goalThreshold !== undefined) {
      probabilityOfGoal = results.filter(v => v >= params.goalThreshold!).length / results.length;
    }

    return {
      metric,
      mean,
      median,
      stdDev,
      percentiles,
      histogram,
      probabilityOfGoal
    };
  }

  private getDefaultBaseline(metric: MetricType): Record<MetricType, number> {
    const defaults: Record<MetricType, number> = {
      revenue: 100000,
      margin: 30,
      units_sold: 1000,
      customers: 500,
      conversion_rate: 3.5,
      avg_order_value: 200,
      retention_rate: 85,
      acquisition_cost: 50,
      ltv: 500,
      market_share: 5
    };
    return defaults;
  }

  private projectMetrics(baseline: Record<MetricType, number>, scenario: Scenario): Record<MetricType, number> {
    const projected: Record<MetricType, number> = { ...baseline };
    const changePercent = scenario.parameters.changePercent / 100;
    const metric = scenario.parameters.metric;

    projected[metric] = baseline[metric] * (1 + changePercent);

    const crossImpacts: Record<MetricType, Record<MetricType, number>> = {
      pricing: { revenue: 1.2, margin: 1.5, conversion_rate: -0.8, units_sold: -0.3 },
      demand: { revenue: 1.0, units_sold: 1.0, customers: 0.8 },
      promotion: { revenue: 0.9, units_sold: 1.3, customers: 1.2, margin: -0.2 },
      inventory: { units_sold: 0.5, revenue: 0.5, margin: 0.1 },
      customer: { customers: 1.0, ltv: 0.8, retention_rate: 0.9 },
      marketing: { customers: 1.0, acquisition_cost: -0.3, revenue: 0.7 },
      operational: { margin: 0.8, revenue: 0.5, units_sold: 0.4 },
      financial: { margin: 1.0, revenue: 0.6, ltv: 0.4 }
    };

    const impacts = crossImpacts[scenario.type];
    if (impacts) {
      for (const [impactedMetric, factor] of Object.entries(impacts)) {
        if (impactedMetric !== metric) {
          projected[impactedMetric as MetricType] *= (1 + changePercent * factor);
        }
      }
    }

    return projected;
  }

  private calculateDeltas(baseline: Record<MetricType, number>, projected: Record<MetricType, number>): Record<MetricType, number> {
    const deltas: Record<string, number> = {};
    for (const key of Object.keys(baseline)) {
      deltas[key] = projected[key] - baseline[key];
    }
    return deltas;
  }

  private calculatePercentChanges(baseline: Record<MetricType, number>, projected: Record<MetricType, number>): Record<MetricType, number> {
    const changes: Record<string, number> = {};
    for (const key of Object.keys(baseline)) {
      if (baseline[key] !== 0) {
        changes[key] = ((projected[key] - baseline[key]) / baseline[key]) * 100;
      }
    }
    return changes;
  }

  private calculateConfidenceInterval(
    projected: Record<MetricType, number>,
    confidenceLevel: number
  ): { lower: Record<MetricType, number>; upper: Record<MetricType, number> } {
    const zScore = this.getZScore(confidenceLevel);
    const lower: Record<string, number> = {};
    const upper: Record<string, number> = {};

    for (const [key, value] of Object.entries(projected)) {
      const margin = value * 0.1 * zScore;
      lower[key] = value - margin;
      upper[key] = value + margin;
    }

    return { lower: lower as Record<MetricType, number>, upper: upper as Record<MetricType, number> };
  }

  private getZScore(confidence: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidence] || 1.96;
  }

  private calculateRiskScore(deltas: Record<MetricType, number>, expectedChange: number): number {
    let riskScore = 0;
    const totalImpact = Object.values(deltas).reduce((sum, v) => sum + Math.abs(v), 0);
    const volatility = totalImpact / (Object.keys(deltas).length || 1);
    riskScore = Math.min(100, Math.max(0, Math.abs(volatility - expectedChange) * 2));
    return riskScore;
  }

  private generateRecommendations(
    scenario: Scenario,
    projected: Record<MetricType, number>,
    deltas: Record<MetricType, number>
  ): Array<{ action: string; impact: 'high' | 'medium' | 'low'; confidence: number }> {
    const recommendations: Array<{ action: string; impact: 'high' | 'medium' | 'low'; confidence: number }> = [];
    const metric = scenario.parameters.metric;

    if (deltas[metric] > 0) {
      recommendations.push({
        action: `Positive impact of ${deltas[metric].toFixed(2)} on ${metric} - consider scaling this initiative`,
        impact: 'high',
        confidence: 0.85
      });
    }

    if (scenario.type === 'promotion' && deltas.margin < 0) {
      recommendations.push({
        action: 'Margin erosion detected - optimize promotion efficiency or bundle with higher-margin products',
        impact: 'medium',
        confidence: 0.78
      });
    }

    if (scenario.type === 'pricing' && deltas.conversion_rate < -10) {
      recommendations.push({
        action: 'Significant conversion drop expected - consider tiered pricing or gradual increase',
        impact: 'high',
        confidence: 0.82
      });
    }

    if (scenario.parameters.changePercent > 50) {
      recommendations.push({
        action: 'Large change proposed - recommend phased rollout with monitoring',
        impact: 'medium',
        confidence: 0.70
      });
    }

    return recommendations;
  }

  private sampleFromDistribution(
    type: 'normal' | 'uniform' | 'triangular' | 'poisson' | 'exponential',
    params: Record<string, number>
  ): number {
    switch (type) {
      case 'uniform':
        const min = params.min || 0;
        const max = params.max || 1;
        return min + Math.random() * (max - min);

      case 'normal':
        const mean = params.mean || 0;
        const std = params.std || 1;
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + std * z;

      case 'triangular':
        const tMin = params.min || 0;
        const tMax = params.max || 1;
        const mode = params.mode || (tMin + tMax) / 2;
        const u = Math.random();
        const cf = (mode - tMin) / (tMax - tMin);
        if (u < cf) {
          return tMin + Math.sqrt(u * (tMax - tMin) * (mode - tMin));
        } else {
          return tMax - Math.sqrt((1 - u) * (tMax - tMin) * (tMax - mode));
        }

      case 'poisson':
        const lambda = params.lambda || 1;
        const l = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k++;
          p *= Math.random();
        } while (p > l);
        return k - 1;

      case 'exponential':
        const rate = params.rate || 1;
        return -Math.log(1 - Math.random()) / rate;

      default:
        return params.mean || 0;
    }
  }

  private generateHistogram(values: number[], bins: number): Array<{ range: string; frequency: number }> {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;
    const histogram: Array<{ range: string; frequency: number }> = [];

    for (let i = 0; i < bins; i++) {
      const binMin = min + i * binWidth;
      const binMax = binMin + binWidth;
      const count = values.filter(v => v >= binMin && (i === bins - 1 ? v <= binMax : v < binMax)).length;
      histogram.push({
        range: `${binMin.toFixed(2)}-${binMax.toFixed(2)}`,
        frequency: count / values.length
      });
    }

    return histogram;
  }
}

export const simulationEngine = new SimulationEngine();

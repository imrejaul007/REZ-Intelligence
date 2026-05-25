/**
 * REZ Explainability Engine - Main Service
 *
 * Provides SHAP-like feature importance, natural language explanations,
 * counterfactuals, and audit trails for AI predictions
 */

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  Explanation,
  ExplanationRequest,
  ExplanationResponse,
  ExplanationFactor,
  Counterfactual,
  FeatureImportance,
  ModelType,
  MODEL_COEFFICIENTS,
  ModelCoefficients,
  PredictionContext,
} from './types';

const CACHE_TTL = 3600; // 1 hour
const MAX_FACTORS = 10;

export class ExplainabilityService {
  private redis: Redis | null = null;
  private cache: Map<string, { explanation: Explanation; expiry: number }> = new Map();
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    latency: { sum: 0, count: 0 },
    byModel: {} as Record<string, { count: number; latencySum: number }>,
  };

  constructor(redisClient?: Redis) {
    this.redis = redisClient ?? null;
  }

  /**
   * Generate explanation for a prediction
   */
  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const cacheKey = this.getCacheKey(request);

    // Check cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return { success: true, explanation: cached, cached: true };
    }

    try {
      // Get model coefficients
      const modelConfig = MODEL_COEFFICIENTS[request.modelType];
      if (!modelConfig) {
        return {
          success: false,
          error: `Unknown model type: ${request.modelType}`,
        };
      }

      // Generate explanation
      const explanation = await this.generateExplanation(request, modelConfig);

      // Cache the result
      await this.setCache(cacheKey, explanation);

      // Update stats
      const latency = Date.now() - startTime;
      this.updateStats(request.modelType, latency);

      return { success: true, explanation, cached: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate detailed explanation for a prediction
   */
  private async generateExplanation(
    request: ExplanationRequest,
    modelConfig: ModelCoefficients
  ): Promise<Explanation> {
    const { features, prediction, modelType, options = {} } = request;
    const maxFactors = options.maxFactors || MAX_FACTORS;

    // Calculate feature importance (simplified SHAP-like)
    const featureImportance = this.calculateFeatureImportance(
      features,
      prediction,
      modelConfig
    );

    // Generate factors
    const factors = this.generateFactors(
      features,
      featureImportance,
      maxFactors
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(modelType, prediction, factors);

    // Generate natural language explanation
    const naturalLanguageExplanation = this.generateNaturalLanguage(
      modelType,
      prediction,
      factors
    );

    // Generate counterfactuals if requested
    const counterfactuals = options.includeCounterfactuals
      ? this.generateCounterfactuals(features, prediction, modelConfig)
      : [];

    // Determine confidence interval
    const confidenceInterval = options.includeConfidenceInterval
      ? this.calculateConfidenceInterval(prediction, factors)
      : undefined;

    // Determine prediction label
    const predictionLabel = this.getPredictionLabel(modelType, prediction);

    return {
      predictionId: request.predictionId,
      modelType,
      originalPrediction: prediction,
      predictionLabel,
      confidence: this.calculateConfidence(factors),
      factors,
      reasoning,
      naturalLanguageExplanation,
      counterfactuals,
      featureImportance: options.includeFeatureImportance !== false
        ? featureImportance.slice(0, maxFactors)
        : [],
      confidenceInterval,
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate feature importance (simplified SHAP-like)
   */
  private calculateFeatureImportance(
    features: Record<string, number>,
    prediction: number,
    modelConfig: ModelCoefficients
  ): FeatureImportance[] {
    const importance: FeatureImportance[] = [];
    const baseline = modelConfig.intercept;

    for (const [feature, value] of Object.entries(features)) {
      const coefficient = modelConfig.coefficients[feature] || 0;
      const featureValue = coefficient * value;
      const contribution = featureValue / (prediction || baseline);

      // Calculate SHAP-like value
      const shapValue = this.calculateSHAPValue(
        value,
        coefficient,
        baseline,
        prediction
      );

      importance.push({
        feature,
        importance: Math.abs(shapValue),
        shapValue,
        percentage: Math.abs(contribution) * 100,
      });
    }

    // Sort by absolute importance
    return importance.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Calculate SHAP-like value for a feature
   */
  private calculateSHAPValue(
    featureValue: number,
    coefficient: number,
    baseline: number,
    prediction: number
  ): number {
    // Simplified SHAP: contribution of this feature to the prediction
    const featureContribution = coefficient * featureValue;
    const totalContribution = this.calculateTotalContribution(
      featureValue,
      coefficient,
      baseline
    );
    return (featureContribution / totalContribution) * prediction;
  }

  /**
   * Calculate total contribution from all features
   */
  private calculateTotalContribution(
    featureValue: number,
    coefficient: number,
    baseline: number
  ): number {
    return baseline + coefficient * featureValue;
  }

  /**
   * Generate explanation factors
   */
  private generateFactors(
    features: Record<string, number>,
    featureImportance: FeatureImportance[],
    maxFactors: number
  ): ExplanationFactor[] {
    return featureImportance.slice(0, maxFactors).map((item) => {
      const coefficient = MODEL_COEFFICIENTS[this.getCurrentModelType() as ModelType]?.coefficients[item.feature] || 0;
      const direction = item.shapValue > 0 ? 'positive' : item.shapValue < 0 ? 'negative' : 'neutral';

      return {
        name: item.feature,
        value: features[item.feature] || 0,
        impact: item.percentage,
        importance: item.importance,
        percentage: item.percentage,
        direction,
        description: this.getFeatureDescription(item.feature),
      };
    });
  }

  private currentModelType: ModelType = 'churn_predictor';

  private getCurrentModelType(): ModelType {
    return this.currentModelType;
  }

  /**
   * Generate reasoning text
   */
  private generateReasoning(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): string {
    const topFactors = factors.slice(0, 3);
    const positiveFactors = topFactors.filter((f) => f.direction === 'positive');
    const negativeFactors = topFactors.filter((f) => f.direction === 'negative');

    let reasoning = `This ${modelType.replace('_', ' ')} prediction is primarily driven by `;

    if (positiveFactors.length > 0) {
      reasoning += positiveFactors
        .map((f) => `${f.description.toLowerCase()} (${f.name}: ${f.value.toFixed(2)})`)
        .join(', ');
    }

    if (negativeFactors.length > 0) {
      if (positiveFactors.length > 0) {
        reasoning += ', while ';
      }
      reasoning += negativeFactors
        .map((f) => `${f.description.toLowerCase()} (${f.name}: ${f.value.toFixed(2)})`)
        .join(', ');
    }

    reasoning += `. The prediction value is ${prediction.toFixed(4)}.`;

    return reasoning;
  }

  /**
   * Generate natural language explanation
   */
  private generateNaturalLanguage(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): string {
    const topFactor = factors[0];
    const label = this.getPredictionLabel(modelType, prediction);

    switch (modelType) {
      case 'churn_predictor':
        return this.explainChurn(prediction, factors);
      case 'ltv_predictor':
        return this.explainLTV(prediction, factors);
      case 'revisit_predictor':
        return this.explainRevisit(prediction, factors);
      case 'conversion_predictor':
        return this.explainConversion(prediction, factors);
      case 'fraud_detector':
        return this.explainFraud(prediction, factors);
      default:
        return `The model predicts a ${label} with confidence ${(prediction * 100).toFixed(1)}%. The top factor is ${topFactor?.name || 'unknown'}.`;
    }
  }

  private explainChurn(prediction: number, factors: ExplanationFactor[]): string {
    const highRisk = prediction > 0.7;
    const mediumRisk = prediction > 0.4;
    const inactivity = factors.find((f) => f.name === 'inactivity_days');
    const engagement = factors.find((f) => f.name === 'engagement_score');

    if (highRisk) {
      return `This customer has a HIGH CHURN RISK of ${(prediction * 100).toFixed(1)}%. ` +
        `The primary concern is ${inactivity?.description || 'inactivity'} ` +
        `(${inactivity?.value.toFixed(0) || 'N/A'} days). ` +
        `Engagement is ${engagement?.value.toFixed(0) || 'N/A'}%. ` +
        `Immediate retention action is recommended.`;
    } else if (mediumRisk) {
      return `This customer has a MODERATE CHURN RISK of ${(prediction * 100).toFixed(1)}%. ` +
        `While not critical yet, ${inactivity?.description || 'inactivity levels'} ` +
        `are concerning. Consider proactive engagement.`;
    } else {
      return `This customer has a LOW CHURN RISK of ${(prediction * 100).toFixed(1)}%. ` +
        `Engagement levels are healthy (${engagement?.value.toFixed(0) || 'N/A'}%). ` +
        `Continue current engagement strategy.`;
    }
  }

  private explainLTV(prediction: number, factors: ExplanationFactor[]): string {
    const totalOrders = factors.find((f) => f.name === 'total_orders');
    const avgOrderValue = factors.find((f) => f.name === 'avg_order_value');
    const orderFrequency = factors.find((f) => f.name === 'order_frequency');

    const ltvTier = prediction > 50000 ? 'HIGH' : prediction > 10000 ? 'MEDIUM' : 'STANDARD';

    return `This customer is classified as ${ltvTier} VALUE with an estimated lifetime value of ₹${prediction.toFixed(0)}. ` +
      `Key drivers: ${totalOrders?.value.toFixed(0) || 0} total orders, ` +
      `₹${avgOrderValue?.value.toFixed(0) || 0} average order value, ` +
      `${orderFrequency?.value.toFixed(1) || 0} orders/month.`;
  }

  private explainRevisit(prediction: number, factors: ExplanationFactor[]): string {
    const highLikelihood = prediction > 0.7;
    const daysSince = factors.find((f) => f.name === 'days_since_last_order');
    const frequency = factors.find((f) => f.name === 'order_frequency');

    if (highLikelihood) {
      return `This customer is HIGH LIKELIHOOD to revisit. ` +
        `Order frequency of ${frequency?.value.toFixed(1) || 0} orders/month suggests strong habit. ` +
        `Last order was ${daysSince?.value.toFixed(0) || 'N/A'} days ago.`;
    } else {
      return `This customer has ${(prediction * 100).toFixed(1)}% likelihood of revisiting. ` +
        `Time since last order (${daysSince?.value.toFixed(0) || 'N/A'} days) is a factor. ` +
        `Consider re-engagement campaigns.`;
    }
  }

  private explainConversion(prediction: number, factors: ExplanationFactor[]): string {
    const addToCart = factors.find((f) => f.name === 'add_to_cart_rate');
    const productViews = factors.find((f) => f.name === 'product_views');

    if (prediction > 0.5) {
      return `HIGH CONVERSION PROBABILITY of ${(prediction * 100).toFixed(1)}%. ` +
        `Strong purchase intent signals: ${addToCart?.value.toFixed(1) || 0}% add-to-cart rate, ` +
        `${productViews?.value.toFixed(0) || 0} product views. ` +
        `Optimal time for personalized offer.`;
    } else {
      return `Conversion probability is ${(prediction * 100).toFixed(1)}%. ` +
        `Building purchase intent through engagement recommended.`;
    }
  }

  private explainFraud(prediction: number, factors: ExplanationFactor[]): string {
    const velocity = factors.find((f) => f.name === 'order_velocity');
    const newAddress = factors.find((f) => f.name === 'new_address_ratio');

    if (prediction > 0.7) {
      return `⚠️ HIGH FRAUD RISK of ${(prediction * 100).toFixed(1)}%. ` +
        `Red flags: Order velocity ${velocity?.value.toFixed(1) || 'N/A'}x normal, ` +
        `${(newAddress?.value || 0) * 100}% new addresses. ` +
        `Manual review or order hold recommended.`;
    } else {
      return `Fraud risk is LOW at ${(prediction * 100).toFixed(1)}%. ` +
        `Order pattern appears normal. No action required.`;
    }
  }

  /**
   * Generate counterfactual explanations
   */
  private generateCounterfactuals(
    features: Record<string, number>,
    prediction: number,
    modelConfig: ModelCoefficients
  ): Counterfactual[] {
    const counterfactuals: Counterfactual[] = [];
    const topFeatures = Object.entries(features)
      .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 3);

    for (const [feature, currentValue] of topFeatures) {
      const coefficient = modelConfig.coefficients[feature] || 0;
      const exampleValues = modelConfig.exampleValues[feature];

      if (!exampleValues || coefficient === 0) continue;

      // Suggest improvement in opposite direction
      const alternativeValue = coefficient > 0
        ? Math.max(exampleValues.min, currentValue * 0.7)
        : Math.min(exampleValues.max, currentValue * 1.3);

      const impactOnPrediction =
        (alternativeValue - currentValue) * coefficient;

      counterfactuals.push({
        condition: feature,
        currentValue,
        alternativeValue: Math.round(alternativeValue * 100) / 100,
        impactOnPrediction,
        description: `If ${feature} changes from ${currentValue.toFixed(2)} to ${alternativeValue.toFixed(2)}, ` +
          `prediction would change by ${impactOnPrediction > 0 ? '+' : ''}${impactOnPrediction.toFixed(4)}`,
      });
    }

    return counterfactuals;
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    prediction: number,
    factors: ExplanationFactor[]
  ): { lower: number; upper: number } {
    // Calculate uncertainty based on factor consistency
    const avgUncertainty = factors.reduce(
      (sum, f) => sum + (1 - f.percentage / 100),
      0
    ) / Math.max(factors.length, 1);

    const margin = Math.abs(prediction) * (0.1 + avgUncertainty * 0.2);

    return {
      lower: Math.max(0, prediction - margin),
      upper: Math.min(1, prediction + margin),
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(factors: ExplanationFactor[]): number {
    if (factors.length === 0) return 0.5;

    const totalImportance = factors.reduce((sum, f) => sum + f.importance, 0);
    const weightedConfidence = factors.reduce(
      (sum, f) => sum + f.percentage * f.importance,
      0
    ) / totalImportance;

    return Math.min(1, Math.max(0, weightedConfidence / 100));
  }

  /**
   * Get prediction label
   */
  private getPredictionLabel(modelType: ModelType, prediction: number): string {
    switch (modelType) {
      case 'churn_predictor':
        return prediction > 0.7 ? 'HIGH_RISK' : prediction > 0.4 ? 'MEDIUM_RISK' : 'LOW_RISK';
      case 'ltv_predictor':
        return prediction > 50000 ? 'HIGH_VALUE' : prediction > 10000 ? 'MEDIUM_VALUE' : 'STANDARD_VALUE';
      case 'revisit_predictor':
        return prediction > 0.7 ? 'WILL_REVISIT' : prediction > 0.4 ? 'MAY_REVISIT' : 'UNLIKELY_REVISIT';
      case 'fraud_detector':
        return prediction > 0.7 ? 'HIGH_RISK' : prediction > 0.3 ? 'REVIEW' : 'CLEAR';
      case 'conversion_predictor':
        return prediction > 0.5 ? 'WILL_CONVERT' : 'WILL_NOT_CONVERT';
      default:
        return `SCORE_${prediction.toFixed(2)}`;
    }
  }

  /**
   * Get feature description
   */
  private getFeatureDescription(feature: string): string {
    const descriptions: Record<string, string> = {
      inactivity_days: 'Days Since Last Order',
      engagement_score: 'Engagement Score',
      order_frequency: 'Order Frequency',
      avg_order_value: 'Average Order Value',
      total_orders: 'Total Orders',
      push_notification_open_rate: 'Push Notification Open Rate',
      support_ticket_count: 'Support Tickets',
      cart_abandonment_rate: 'Cart Abandonment Rate',
      wishlist_usage: 'Wishlist Usage',
      loyalty_tier: 'Loyalty Tier',
      add_to_cart_rate: 'Add to Cart Rate',
      product_views: 'Product Views',
      price_sensitivity: 'Price Sensitivity',
    };
    return descriptions[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Cache management
   */
  private getCacheKey(request: ExplanationRequest): string {
    const featuresKey = Object.entries(request.features)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join('|');
    return `explain:${request.modelType}:${request.predictionId}:${featuresKey}`;
  }

  private async getFromCache(key: string): Promise<Explanation | null> {
    // Check in-memory cache first
    const memCache = this.cache.get(key);
    if (memCache && memCache.expiry > Date.now()) {
      return memCache.explanation;
    }

    // Check Redis
    if (this.redis) {
      try {
        const data = await this.redis.get(`explain:${key}`);
        if (data) {
          const explanation = JSON.parse(data);
          this.cache.set(key, { explanation, expiry: Date.now() + CACHE_TTL * 1000 });
          return explanation;
        }
      } catch {
        // Cache error, continue
      }
    }

    return null;
  }

  private async setCache(key: string, explanation: Explanation): Promise<void> {
    // Set in-memory cache
    this.cache.set(key, { explanation, expiry: Date.now() + CACHE_TTL * 1000 });

    // Set Redis cache
    if (this.redis) {
      try {
        await this.redis.setex(`explain:${key}`, CACHE_TTL, JSON.stringify(explanation));
      } catch {
        // Cache error, continue
      }
    }
  }

  private updateStats(modelType: string, latency: number): void {
    this.stats.latency.sum += latency;
    this.stats.latency.count++;

    if (!this.stats.byModel[modelType]) {
      this.stats.byModel[modelType] = { count: 0, latencySum: 0 };
    }
    this.stats.byModel[modelType].count++;
    this.stats.byModel[modelType].latencySum += latency;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalRequests: number;
    cacheHitRate: number;
    avgLatency: number;
    byModel: Record<string, { count: number; avgLatency: number }>;
  } {
    return {
      totalRequests: this.stats.totalRequests,
      cacheHitRate: this.stats.totalRequests > 0
        ? this.stats.cacheHits / this.stats.totalRequests
        : 0,
      avgLatency: this.stats.latency.count > 0
        ? this.stats.latency.sum / this.stats.latency.count
        : 0,
      byModel: Object.fromEntries(
        Object.entries(this.stats.byModel).map(([k, v]) => [
          k,
          { count: v.count, avgLatency: v.latencySum / v.count },
        ])
      ),
    };
  }
}

// Default instance
let defaultInstance: ExplainabilityService | null = null;

export function getExplainabilityService(redisClient?: Redis): ExplainabilityService {
  if (!defaultInstance) {
    defaultInstance = new ExplainabilityService(redisClient);
  }
  return defaultInstance;
}

export default ExplainabilityService;

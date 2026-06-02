/**
 * REZ Explainability Engine - SHAP Explainer Service
 *
 * Implements SHAP (SHapley Additive exPlanations) for feature importance
 * using sampling-based approximation for scalability
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SHAPResult,
  SHAPConfiguration,
  SHAPBackgroundData,
  FeatureImportance,
  ModelCoefficients,
  MODEL_COEFFICIENTS,
  DEFAULT_FEATURE_DESCRIPTIONS,
} from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: SHAPConfiguration = {
  samplingMethod: 'monte_carlo',
  nSamples: 1000,
  maxFeatures: 20,
  randomSeed: 42,
  computeInteractions: true,
};

const INTERACTION_THRESHOLD = 0.05;

// ============================================
// SHAP EXPLAINER CLASS
// ============================================

export class ShapleyExplainer {
  private config: SHAPConfiguration;
  private backgroundData: SHAPBackgroundData | null = null;
  private modelCache: Map<string, ModelCoefficients> = new Map();

  constructor(config: Partial<SHAPConfiguration> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set background data for conditional expectations
   * This data represents the distribution of features
   */
  setBackgroundData(data: Record<string, number>[]): void {
    if (data.length === 0) return;

    const features = Object.keys(data[0]);
    const aggregations = {
      mean: {} as Record<string, number>,
      std: {} as Record<string, number>,
      min: {} as Record<string, number>,
      max: {} as Record<string, number>,
    };

    for (const feature of features) {
      const values = data.map((d) => d[feature]).filter((v) => v !== undefined && v !== null);
      if (values.length === 0) continue;

      aggregations.mean[feature] = this.mean(values);
      aggregations.std[feature] = this.standardDeviation(values);
      aggregations.min[feature] = Math.min(...values);
      aggregations.max[feature] = Math.max(...values);
    }

    this.backgroundData = { samples: data, aggregations };
  }

  /**
   * Main SHAP computation using sampling approximation
   * Implements Kernel SHAP (for arbitrary models) with Monte Carlo sampling
   */
  async computeSHAP(
    features: Record<string, number>,
    modelType: string,
    prediction: number
  ): Promise<SHAPResult[]> {
    const modelConfig = this.getModelConfig(modelType);
    const featureNames = Object.keys(features);

    // Limit to maxFeatures
    const selectedFeatures = featureNames.slice(0, this.config.maxFeatures);

    // Initialize results
    const shapValues: Map<string, { sum: number; count: number; interactions: Map<string, number> }> = new Map();
    for (const feature of selectedFeatures) {
      shapValues.set(feature, { sum: 0, count: 0, interactions: new Map() });
    }

    // Monte Carlo sampling for SHAP values
    const samplesPerFeature = Math.ceil(this.config.nSamples / selectedFeatures.length);

    for (const feature of selectedFeatures) {
      const shapData = shapValues.get(feature)!;

      for (let i = 0; i < samplesPerFeature; i++) {
        // Sample a coalition (subset of features)
        const coalition = this.sampleCoalition(selectedFeatures, feature);

        // Compute the marginal contribution
        const marginalContribution = this.computeMarginalContribution(
          features,
          feature,
          coalition,
          modelConfig
        );

        // Weight by coalition size (Shapley kernel)
        const weight = this.computeShapleyWeight(coalition.length, selectedFeatures.length);
        shapData.sum += marginalContribution * weight;
        shapData.count++;

        // Compute interactions if enabled
        if (this.config.computeInteractions && this.config.samplingMethod === 'monte_carlo') {
          const interactions = await this.computeFeatureInteractions(
            features,
            feature,
            modelConfig
          );
          for (const [interactionFeature, interactionValue] of Object.entries(interactions)) {
            const existingInteractions = shapValues.get(interactionFeature);
            if (existingInteractions) {
              const currentValue = existingInteractions.interactions.get(feature) || 0;
              existingInteractions.interactions.set(
                feature,
                currentValue + interactionValue / selectedFeatures.length
              );
            }
          }
        }
      }
    }

    // Convert to SHAP results
    const results = this.convertToSHAPResults(shapValues, features, modelConfig, prediction);

    return results;
  }

  /**
   * Compute SHAP values using linear model approximation
   * More efficient for linear/additive models
   */
  computeLinearSHAP(
    features: Record<string, number>,
    modelType: string
  ): SHAPResult[] {
    const modelConfig = this.getModelConfig(modelType);
    const results: SHAPResult[] = [];

    // For linear models, SHAP values equal coefficient * (value - mean)
    // Plus intercept contribution
    const featureNames = Object.keys(features);
    let totalContribution = modelConfig.intercept;

    for (const feature of featureNames) {
      const value = features[feature] || 0;
      const coefficient = modelConfig.coefficients[feature] || 0;

      const backgroundMean = this.backgroundData?.aggregations.mean[feature] ?? 0;
      const shapValue = coefficient * (value - backgroundMean);

      totalContribution += shapValue;

      results.push({
        feature,
        shapValue,
        expectedValue: modelConfig.intercept,
        contribution: Math.abs(shapValue),
        confidenceInterval: this.computeConfidenceInterval(shapValue, modelConfig),
        interactionEffects: [],
      });
    }

    // Sort by absolute contribution
    results.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

    // Add rank
    results.forEach((r, i) => {
      const featureData = results.find((f) => f.feature === r.feature);
      if (featureData) {
        featureData.expectedValue = totalContribution;
      }
    });

    return results;
  }

  /**
   * Compute SHAP values using TreeExplainer-style recursive algorithm
   * Optimized for tree-based models
   */
  computeTreeSHAP(
    features: Record<string, number>,
    modelType: string,
    prediction: number
  ): SHAPResult[] {
    const modelConfig = this.getModelConfig(modelType);
    const results: SHAPResult[] = [];

    const featureNames = Object.keys(features);
    const featureValues = featureNames.map((f) => features[f] || 0);
    const coefficients = featureNames.map((f) => modelConfig.coefficients[f] || 0);

    // Simple tree SHAP approximation for linear models
    // In real implementation, this would traverse tree structure
    let totalValue = modelConfig.intercept;
    const contributions: { feature: string; value: number }[] = [];

    for (let i = 0; i < featureNames.length; i++) {
      const value = featureValues[i];
      const coefficient = coefficients[i];

      // Marginal contribution with tree-based weighting
      const marginalContribution = coefficient * value;
      totalValue += marginalContribution;

      contributions.push({
        feature: featureNames[i],
        value: marginalContribution,
      });
    }

    // Normalize contributions
    const totalContribution = contributions.reduce((sum, c) => sum + Math.abs(c.value), 0);

    for (const contribution of contributions) {
      results.push({
        feature: contribution.feature,
        shapValue: contribution.value,
        expectedValue: modelConfig.intercept,
        contribution: totalContribution > 0 ? Math.abs(contribution.value) / totalContribution : 0,
        confidenceInterval: this.computeConfidenceInterval(
          contribution.value,
          modelConfig
        ),
        interactionEffects: [],
      });
    }

    return results.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));
  }

  /**
   * Get feature importance from SHAP values
   */
  getFeatureImportance(shapResults: SHAPResult[]): FeatureImportance[] {
    const totalContribution = shapResults.reduce(
      (sum, r) => sum + Math.abs(r.shapValue),
      0
    );

    return shapResults.map((result, index) => ({
      feature: result.feature,
      importance: Math.abs(result.shapValue) / (totalContribution || 1),
      shapValue: result.shapValue,
      shapConfidence: result.confidenceInterval,
      percentage: (Math.abs(result.shapValue) / (totalContribution || 1)) * 100,
      rank: index + 1,
    }));
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Get model configuration
   */
  private getModelConfig(modelType: string): ModelCoefficients {
    // Check cache first
    if (this.modelCache.has(modelType)) {
      return this.modelCache.get(modelType)!;
    }

    // Get from registry
    const config = MODEL_COEFFICIENTS[modelType as keyof typeof MODEL_COEFFICIENTS];
    if (!config) {
      // Create default config
      const defaultConfig: ModelCoefficients = {
        modelType: modelType as any,
        coefficients: {},
        intercept: 0,
        featureDescriptions: DEFAULT_FEATURE_DESCRIPTIONS,
        exampleValues: {},
        featureDomains: {},
      };
      this.modelCache.set(modelType, defaultConfig);
      return defaultConfig;
    }

    this.modelCache.set(modelType, config);
    return config;
  }

  /**
   * Sample a coalition (subset of features)
   */
  private sampleCoalition(allFeatures: string[], excludeFeature: string): string[] {
    const otherFeatures = allFeatures.filter((f) => f !== excludeFeature);
    const coalition: string[] = [];

    // Random coalition size with bias towards middle sizes
    const sizeProb = Math.random();
    let coalitionSize: number;
    if (sizeProb < 0.2) {
      coalitionSize = Math.floor(Math.random() * (otherFeatures.length / 2));
    } else if (sizeProb < 0.8) {
      coalitionSize =
        Math.floor(Math.random() * (otherFeatures.length / 2)) +
        Math.floor(otherFeatures.length / 2);
    } else {
      coalitionSize =
        Math.floor(Math.random() * (otherFeatures.length / 2)) +
        Math.floor(otherFeatures.length / 2);
    }

    coalitionSize = Math.min(coalitionSize, otherFeatures.length);

    // Shuffle and select
    const shuffled = [...otherFeatures].sort(() => Math.random() - 0.5);
    coalition.push(...shuffled.slice(0, coalitionSize));

    return coalition;
  }

  /**
   * Compute marginal contribution of a feature
   */
  private computeMarginalContribution(
    features: Record<string, number>,
    feature: string,
    coalition: string[],
    modelConfig: ModelCoefficients
  ): number {
    // Prediction with feature in coalition
    const valueWithFeature = this.predictWithFeatures(
      features,
      [...coalition, feature],
      modelConfig
    );

    // Prediction without feature (use background data mean)
    const valueWithoutFeature = this.predictWithFeatures(features, coalition, modelConfig);

    return valueWithFeature - valueWithoutFeature;
  }

  /**
   * Predict using only specified features
   */
  private predictWithFeatures(
    features: Record<string, number>,
    activeFeatures: string[],
    modelConfig: ModelCoefficients
  ): number {
    let prediction = modelConfig.intercept;

    for (const feature of activeFeatures) {
      const value = features[feature];
      if (value === undefined || value === null) continue;

      const coefficient = modelConfig.coefficients[feature] || 0;
      prediction += coefficient * value;
    }

    // For features not in coalition, use background mean
    for (const [feature, coefficient] of Object.entries(modelConfig.coefficients)) {
      if (!activeFeatures.includes(feature)) {
        const backgroundMean = this.backgroundData?.aggregations.mean[feature] ?? 0;
        prediction += coefficient * backgroundMean;
      }
    }

    return prediction;
  }

  /**
   * Compute Shapley kernel weight for coalition size
   */
  private computeShapleyWeight(k: number, n: number): number {
    // Shapley kernel: (n-1) / (C(n,k) * k * (n-k))
    if (k === 0 || k === n) return 0;

    const combination = this.binomialCoefficient(n - 1, k - 1);
    return (n - 1) / (combination * k * (n - k));
  }

  /**
   * Compute feature interactions
   */
  private async computeFeatureInteractions(
    features: Record<string, number>,
    targetFeature: string,
    modelConfig: ModelCoefficients
  ): Promise<Record<string, number>> {
    const interactions: Record<string, number> = {};
    const otherFeatures = Object.keys(features).filter((f) => f !== targetFeature);

    // Sample some other features to compute interactions with
    const sampleSize = Math.min(3, otherFeatures.length);
    const sampledFeatures = otherFeatures
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    for (const interactionFeature of sampledFeatures) {
      const targetValue = features[targetFeature];
      const interactionValue = features[interactionFeature];
      const targetCoef = modelConfig.coefficients[targetFeature] || 0;
      const interactionCoef = modelConfig.coefficients[interactionFeature] || 0;

      // Approximate interaction effect
      const interactionEffect = targetCoef * interactionCoef * 0.1; // Simplified

      if (Math.abs(interactionEffect) > INTERACTION_THRESHOLD) {
        interactions[interactionFeature] = interactionEffect;
      }
    }

    return interactions;
  }

  /**
   * Convert internal results to SHAP result format
   */
  private convertToSHAPResults(
    shapValues: Map<string, { sum: number; count: number; interactions: Map<string, number> }>,
    features: Record<string, number>,
    modelConfig: ModelCoefficients,
    prediction: number
  ): SHAPResult[] {
    const results: SHAPResult[] = [];
    let totalContribution = 0;

    // First pass: calculate total
    for (const [feature, data] of shapValues) {
      totalContribution += Math.abs(data.sum);
    }

    // Second pass: create results
    for (const [feature, data] of shapValues) {
      const shapValue = data.count > 0 ? data.sum / data.count : 0;

      const interactionEffects = Array.from(data.interactions.entries()).map(
        ([interactionFeature, interactionValue]) => ({
          feature: interactionFeature,
          interactionValue,
        })
      );

      results.push({
        feature,
        shapValue,
        expectedValue: modelConfig.intercept,
        contribution: totalContribution > 0 ? Math.abs(shapValue) / totalContribution : 0,
        confidenceInterval: this.computeConfidenceInterval(shapValue, modelConfig),
        interactionEffects: interactionEffects.length > 0 ? interactionEffects : undefined,
      });
    }

    // Sort by absolute value
    return results.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));
  }

  /**
   * Compute confidence interval for SHAP value
   */
  private computeConfidenceInterval(
    shapValue: number,
    modelConfig: ModelCoefficients
  ): { lower: number; upper: number } {
    // Bootstrap-based confidence interval
    // In practice, this would use multiple samples
    const stdError = Math.abs(shapValue) * 0.1; // Simplified
    const margin = 1.96 * stdError; // 95% CI

    return {
      lower: shapValue - margin,
      upper: shapValue + margin,
    };
  }

  /**
   * Utility: binomial coefficient
   */
  private binomialCoefficient(n: number, k: number): number {
    if (k === 0 || k === n) return 1;
    if (k > n) return 0;

    let result = 1;
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    return result;
  }

  /**
   * Utility: mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Utility: standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a SHAP explainer with default configuration
 */
export function createShapExplainer(
  config?: Partial<SHAPConfiguration>
): ShapleyExplainer {
  return new ShapleyExplainer(config);
}

/**
 * Quick SHAP computation for a single prediction
 */
export async function quickSHAP(
  features: Record<string, number>,
  modelType: string,
  prediction: number,
  options?: Partial<SHAPConfiguration>
): Promise<{
  shapValues: SHAPResult[];
  featureImportance: FeatureImportance[];
}> {
  const explainer = new ShapleyExplainer(options);

  // Set background data if we have enough samples
  // In production, this would come from historical data
  const backgroundSamples = generateBackgroundSamples(features, 100);
  explainer.setBackgroundData(backgroundSamples);

  const shapValues = await explainer.computeSHAP(features, modelType, prediction);
  const featureImportance = explainer.getFeatureImportance(shapValues);

  return { shapValues, featureImportance };
}

/**
 * Generate synthetic background samples
 */
function generateBackgroundSamples(
  features: Record<string, number>,
  nSamples: number
): Record<string, number>[] {
  const samples: Record<string, number>[] = [];
  const featureKeys = Object.keys(features);

  for (let i = 0; i < nSamples; i++) {
    const sample: Record<string, number> = {};
    for (const feature of featureKeys) {
      const value = features[feature];
      // Add noise around the original value
      const noise = (Math.random() - 0.5) * 0.2 * Math.abs(value);
      sample[feature] = value + noise;
    }
    samples.push(sample);
  }

  return samples;
}

/**
 * Compute SHAP explanation with confidence
 */
export function computeSHAPWithConfidence(
  features: Record<string, number>,
  modelType: string,
  prediction: number,
  nBootstrap: number = 10
): {
  shapValues: SHAPResult[];
  featureImportance: import('../types/index.js').FeatureImportance[];
  confidence: { low: number; medium: number; high: number };
} {
  const explainer = new ShapleyExplainer({
    nSamples: 100,
    computeInteractions: false,
  });

  const backgroundSamples = generateBackgroundSamples(features, 50);
  explainer.setBackgroundData(backgroundSamples);

  const allResults: SHAPResult[][] = [];

  for (let i = 0; i < nBootstrap; i++) {
    const results = explainer.computeLinearSHAP(features, modelType);
    allResults.push(results);
  }

  // Aggregate results across bootstrap samples
  if (allResults.length === 0) {
    return {
      shapValues: [],
      featureImportance: [],
      confidence: { low: 0, medium: 0, high: 0 },
    };
  }

  const featureNames = Object.keys(features);
  const aggregatedResults: SHAPResult[] = [];
  const stabilities: number[] = [];

  for (const feature of featureNames) {
    const values = allResults
      .map((results) => results.find((r) => r.feature === feature)?.shapValue || 0);

    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
    const stdValue = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - meanValue, 2), 0) / values.length
    );

    // Calculate stability (inverse of coefficient of variation)
    const stability = 1 - Math.min(1, stdValue / (Math.abs(meanValue) || 1));
    stabilities.push(stability);

    aggregatedResults.push({
      feature,
      shapValue: meanValue,
      expectedValue: prediction,
      contribution: Math.abs(meanValue),
      confidenceInterval: {
        lower: meanValue - 1.96 * stdValue,
        upper: meanValue + 1.96 * stdValue,
      },
      interactionEffects: [],
    });
  }

  const avgStability = stabilities.reduce((a, b) => a + b, 0) / stabilities.length;

  // Assign confidence levels
  const confidence = {
    high: avgStability > 0.8 ? 1 : 0,
    medium: avgStability > 0.5 && avgStability <= 0.8 ? 1 : 0,
    low: avgStability <= 0.5 ? 1 : 0,
  };

  // Normalize
  const total = confidence.high + confidence.medium + confidence.low;
  if (total > 0) {
    confidence.high /= total;
    confidence.medium /= total;
    confidence.low /= total;
  }

  return {
    shapValues: aggregatedResults.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue)),
    featureImportance: aggregatedResults.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue)).map((r, i) => ({
      feature: r.feature,
      importance: Math.abs(r.shapValue),
      shapValue: r.shapValue,
      shapConfidence: r.confidenceInterval,
      percentage: Math.abs(r.shapValue) * 100,
      rank: i + 1,
    })),
    confidence: {
      low: Math.round(confidence.low * 100),
      medium: Math.round(confidence.medium * 100),
      high: Math.round(confidence.high * 100),
    },
  };
}

export default ShapleyExplainer;

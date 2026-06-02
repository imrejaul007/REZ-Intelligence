/**
 * REZ Explainability Engine - Counterfactual Engine Service
 *
 * Generates "What-if" explanations by finding minimal changes to features
 * that would lead to desired prediction outcomes
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Counterfactual,
  CounterfactualRequest,
  CounterfactualConstraints,
  CounterfactualResult,
  ModelCoefficients,
  MODEL_COEFFICIENTS,
  DEFAULT_FEATURE_DESCRIPTIONS,
  ModelType,
} from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

const ACTIONABILITY_SCORES = {
  easy: 0.9, // No cost/effort to change
  moderate: 0.6, // Some effort required
  hard: 0.3, // Significant effort required
};

const DEFAULT_CONSTRAINTS: CounterfactualConstraints = {
  maxChanges: 3,
  valueRanges: {},
  costWeights: {},
};

// ============================================
// COUNTERFACTUAL ENGINE CLASS
// ============================================

export class CounterfactualEngine {
  private modelCache: Map<string, ModelCoefficients> = new Map();

  /**
   * Generate counterfactual explanations for a prediction
   */
  async generateCounterfactuals(
    request: CounterfactualRequest
  ): Promise<CounterfactualResult> {
    const {
      predictionId,
      modelType,
      features,
      prediction,
      targetPrediction,
      constraints = DEFAULT_CONSTRAINTS,
    } = request;

    const modelConfig = this.getModelConfig(modelType);

    // Generate candidate counterfactuals
    const candidates = this.generateCandidates(features, modelConfig, constraints, prediction);

    // Score and rank counterfactuals
    const scoredCounterfactuals = this.scoreCounterfactuals(
      candidates,
      features,
      modelConfig,
      prediction,
      targetPrediction
    );

    // Select best counterfactuals
    const bestCounterfactuals = scoredCounterfactuals
      .slice(0, constraints.maxChanges * 2)
      .map((candidate) => this.createCounterfactual(candidate, features, modelConfig, prediction));

    // Find nearest desired outcome
    let nearestDesiredOutcome: Counterfactual | null = null;
    if (targetPrediction !== undefined) {
      nearestDesiredOutcome = this.findNearestDesiredOutcome(
        bestCounterfactuals,
        prediction,
        targetPrediction
      );
    }

    // Calculate overall feasibility
    const feasibilityScore = this.calculateFeasibilityScore(bestCounterfactuals);

    return {
      id: uuidv4(),
      originalPrediction: prediction,
      targetPrediction,
      counterfactuals: bestCounterfactuals.slice(0, constraints.maxChanges),
      nearestDesiredOutcome,
      summary: this.generateSummary(bestCounterfactuals, prediction, targetPrediction),
      feasibilityScore,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate candidate counterfactual changes
   */
  private generateCandidates(
    features: Record<string, number>,
    modelConfig: ModelCoefficients,
    constraints: CounterfactualConstraints,
    currentPrediction: number
  ): CounterfactualCandidate[] {
    const candidates: CounterfactualCandidate[] = [];
    const allowedFeatures = constraints.allowedFeatures || Object.keys(features);

    for (const feature of allowedFeatures) {
      // Skip disallowed features
      if (constraints.disallowedFeatures?.includes(feature)) continue;

      const currentValue = features[feature];
      const coefficient = modelConfig.coefficients[feature] || 0;

      if (coefficient === 0) continue;

      const valueRange = this.getFeatureValueRange(feature, currentValue, modelConfig);
      const steps = this.generateChangeSteps(currentValue, valueRange, coefficient, currentPrediction);

      for (const step of steps) {
        candidates.push({
          feature,
          currentValue,
          newValue: step.value,
          impact: step.impact,
          effort: this.calculateEffort(feature, currentValue, step.value, constraints),
          feasibility: this.calculateChangeFeasibility(
            feature,
            currentValue,
            step.value,
            valueRange
          ),
        });
      }
    }

    // Sort by impact (absolute value) and filter
    return candidates
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 50);
  }

  /**
   * Generate change steps for a feature
   */
  private generateChangeSteps(
    currentValue: number,
    valueRange: { min: number; max: number },
    coefficient: number,
    currentPrediction: number
  ): { value: number; impact: number }[] {
    const steps: { value: number; impact: number }[] = [];

    // Determine direction based on coefficient
    const direction = coefficient > 0 ? 1 : -1;

    // Generate percentage changes
    const percentages = [0.1, 0.2, 0.3, 0.5, 0.7, 1.0];

    for (const pct of percentages) {
      // Calculate new value
      let newValue = currentValue + direction * Math.abs(currentValue) * pct;

      // Clamp to valid range
      newValue = Math.max(valueRange.min, Math.min(valueRange.max, newValue));

      // Skip if too close to current value
      if (Math.abs(newValue - currentValue) < 0.001 * Math.abs(currentValue || 1)) continue;

      // Calculate impact
      const impact = (newValue - currentValue) * coefficient;

      steps.push({ value: newValue, impact });
    }

    // Also try specific target values
    const targetPercentiles = [
      valueRange.min + (valueRange.max - valueRange.min) * 0.1,
      valueRange.min + (valueRange.max - valueRange.min) * 0.25,
      valueRange.min + (valueRange.max - valueRange.min) * 0.5,
      valueRange.min + (valueRange.max - valueRange.min) * 0.75,
      valueRange.min + (valueRange.max - valueRange.min) * 0.9,
    ];

    for (const target of targetPercentiles) {
      if (Math.abs(target - currentValue) > 0.01 * Math.abs(currentValue || 1)) {
        const impact = (target - currentValue) * coefficient;
        steps.push({ value: target, impact });
      }
    }

    return steps;
  }

  /**
   * Score counterfactuals
   */
  private scoreCounterfactuals(
    candidates: CounterfactualCandidate[],
    features: Record<string, number>,
    modelConfig: ModelCoefficients,
    originalPrediction: number,
    targetPrediction?: number
  ): ScoredCounterfactual[] {
    const scored: ScoredCounterfactual[] = [];

    for (const candidate of candidates) {
      const {
        feature,
        currentValue,
        newValue,
        impact,
        effort,
        feasibility,
      } = candidate;

      // Calculate new prediction
      const newPrediction = originalPrediction + impact;

      // Score components
      const impactScore = Math.abs(impact);
      const effortScore = 1 - effort; // Lower effort = higher score
      const feasibilityScore = feasibility;
      const proximityScore = targetPrediction !== undefined
        ? 1 - Math.abs(newPrediction - targetPrediction) / Math.abs(targetPrediction || 1)
        : 1;

      // Combined score (weighted)
      const score =
        impactScore * 0.3 +
        effortScore * 0.25 +
        feasibilityScore * 0.25 +
        Math.max(0, proximityScore) * 0.2;

      // Categorize actionability
      const actionability = this.categorizeActionability(effort, feasibility);

      scored.push({
        ...candidate,
        newPrediction,
        score,
        actionability,
        changes: {
          feature,
          from: currentValue,
          to: newValue,
          difference: newValue - currentValue,
          percentageChange: currentValue !== 0
            ? ((newValue - currentValue) / currentValue) * 100
            : 0,
        },
      });
    }

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Create Counterfactual object
   */
  private createCounterfactual(
    candidate: ScoredCounterfactual,
    features: Record<string, number>,
    modelConfig: ModelCoefficients,
    originalPrediction: number
  ): Counterfactual {
    const description = this.generateCounterfactualDescription(
      candidate.feature,
      candidate.currentValue,
      candidate.newValue,
      candidate.impact,
      modelConfig
    );

    const effort = this.generateEffortDescription(candidate.feature, candidate.changes.percentageChange);

    return {
      id: uuidv4(),
      condition: candidate.feature,
      currentValue: candidate.currentValue,
      alternativeValue: Math.round(candidate.newValue * 100) / 100,
      impactOnPrediction: Math.round(candidate.impact * 1000) / 1000,
      impactPercentage:
        Math.abs(originalPrediction) > 0.001
          ? (candidate.impact / originalPrediction) * 100
          : 0,
      description,
      actionability: candidate.actionability,
      effort,
      expectedOutcome: this.generateExpectedOutcome(
        candidate.feature,
        candidate.newValue,
        candidate.newPrediction
      ),
    };
  }

  /**
   * Generate human-readable description
   */
  private generateCounterfactualDescription(
    feature: string,
    currentValue: number,
    newValue: number,
    impact: number,
    modelConfig: ModelCoefficients
  ): string {
    const featureDescription =
      modelConfig.featureDescriptions[feature] ||
      DEFAULT_FEATURE_DESCRIPTIONS[feature] ||
      feature.replace(/_/g, ' ');

    const direction = newValue > currentValue ? 'increased' : 'decreased';
    const impactDirection = impact > 0 ? 'increase' : 'decrease';

    const formattedCurrent = this.formatValue(feature, currentValue);
    const formattedNew = this.formatValue(feature, newValue);

    return `If ${featureDescription} is ${direction} from ${formattedCurrent} to ${formattedNew}, ` +
      `the prediction would ${impactDirection} by ${Math.abs(impact).toFixed(4)} (${Math.abs(impact / (Math.abs(impact) + 0.001) * 100).toFixed(1)}%).`;
  }

  /**
   * Generate effort description
   */
  private generateEffortDescription(feature: string, percentageChange: number): string {
    const absChange = Math.abs(percentageChange);

    if (absChange < 15) {
      return `Minimal change needed (${absChange.toFixed(1)}% ${percentageChange > 0 ? 'increase' : 'decrease'})`;
    } else if (absChange < 30) {
      return `Moderate effort required (${absChange.toFixed(1)}% ${percentageChange > 0 ? 'increase' : 'decrease'})`;
    } else {
      return `Significant change required (${absChange.toFixed(1)}% ${percentageChange > 0 ? 'increase' : 'decrease'})`;
    }
  }

  /**
   * Generate expected outcome description
   */
  private generateExpectedOutcome(
    feature: string,
    newValue: number,
    newPrediction: number
  ): string {
    const predictionDirection = newPrediction > 0 ? 'higher' : 'lower';

    return `Expected prediction: ${newPrediction.toFixed(4)} (${predictionDirection} than original)`;
  }

  /**
   * Find nearest counterfactual to target prediction
   */
  private findNearestDesiredOutcome(
    counterfactuals: Counterfactual[],
    originalPrediction: number,
    targetPrediction: number
  ): Counterfactual | null {
    if (counterfactuals.length === 0) return null;

    let nearest = counterfactuals[0];
    let minDistance = Infinity;

    for (const cf of counterfactuals) {
      const newPrediction = originalPrediction + cf.impactOnPrediction;
      const distance = Math.abs(newPrediction - targetPrediction);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = cf;
      }
    }

    return nearest;
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    counterfactuals: Counterfactual[],
    originalPrediction: number,
    targetPrediction?: number
  ): string {
    if (counterfactuals.length === 0) {
      return 'No actionable counterfactuals could be generated for this prediction.';
    }

    const topCounterfactual = counterfactuals[0];
    const topFeature = topCounterfactual.condition;
    const direction = topCounterfactual.alternativeValue > topCounterfactual.currentValue
      ? 'increase'
      : 'decrease';

    let summary = `The most impactful change would be to ${direction} "${topFeature}" ` +
      `from ${topCounterfactual.currentValue.toFixed(2)} to ${topCounterfactual.alternativeValue.toFixed(2)}. ` +
      `This alone would change the prediction by ${topCounterfactual.impactOnPrediction > 0 ? '+' : ''}${topCounterfactual.impactOnPrediction.toFixed(4)} ` +
      `(${topCounterfactual.impactPercentage > 0 ? '+' : ''}${topCounterfactual.impactPercentage.toFixed(1)}%).`;

    if (counterfactuals.length > 1) {
      summary += ` Combined with the next ${Math.min(counterfactuals.length - 1, 2)} changes, ` +
        `you could achieve a maximum impact of ${this.calculateCombinedImpact(counterfactuals).toFixed(4)}.`;
    }

    if (targetPrediction !== undefined) {
      const closest = this.findNearestDesiredOutcome(
        counterfactuals,
        originalPrediction,
        targetPrediction
      );
      if (closest) {
        const achievedPrediction = originalPrediction + closest.impactOnPrediction;
        summary += ` To reach target prediction of ${targetPrediction.toFixed(4)}, ` +
          `consider modifying ${closest.condition}.`;
      }
    }

    return summary;
  }

  /**
   * Calculate combined impact of multiple counterfactuals
   */
  private calculateCombinedImpact(counterfactuals: Counterfactual[]): number {
    return counterfactuals.reduce((sum, cf) => sum + cf.impactOnPrediction, 0);
  }

  /**
   * Calculate overall feasibility score
   */
  private calculateFeasibilityScore(counterfactuals: Counterfactual[]): number {
    if (counterfactuals.length === 0) return 0;

    const actionabilityScores = counterfactuals.map((cf) => {
      switch (cf.actionability) {
        case 'easy':
          return ACTIONABILITY_SCORES.easy;
        case 'moderate':
          return ACTIONABILITY_SCORES.moderate;
        case 'hard':
          return ACTIONABILITY_SCORES.hard;
        default:
          return 0.5;
      }
    });

    return actionabilityScores.reduce((sum, score) => sum + score, 0) / actionabilityScores.length;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Get model configuration
   */
  private getModelConfig(modelType: string): ModelCoefficients {
    if (this.modelCache.has(modelType)) {
      return this.modelCache.get(modelType)!;
    }

    const config = MODEL_COEFFICIENTS[modelType as keyof typeof MODEL_COEFFICIENTS];
    if (!config) {
      const defaultConfig: ModelCoefficients = {
        modelType: modelType as ModelType,
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
   * Get feature value range
   */
  private getFeatureValueRange(
    feature: string,
    currentValue: number,
    modelConfig: ModelCoefficients
  ): { min: number; max: number } {
    const exampleValues = modelConfig.exampleValues[feature];

    if (exampleValues) {
      return { min: exampleValues.min, max: exampleValues.max };
    }

    // Default range based on current value
    const margin = Math.abs(currentValue) * 0.5 || 10;
    return {
      min: currentValue - margin,
      max: currentValue + margin,
    };
  }

  /**
   * Calculate effort of changing a feature
   */
  private calculateEffort(
    feature: string,
    currentValue: number,
    newValue: number,
    constraints: CounterfactualConstraints
  ): number {
    // Check cost weights
    const costWeight = constraints.costWeights?.[feature] || 1;

    // Calculate percentage change
    const percentageChange =
      currentValue !== 0
        ? Math.abs((newValue - currentValue) / currentValue)
        : Math.abs(newValue);

    // Check if within allowed range
    const range = constraints.valueRanges?.[feature];
    if (range) {
      const isInRange = newValue >= range.min && newValue <= range.max;
      if (!isInRange) return 1; // Maximum effort
    }

    return Math.min(1, percentageChange * costWeight);
  }

  /**
   * Calculate change feasibility
   */
  private calculateChangeFeasibility(
    feature: string,
    currentValue: number,
    newValue: number,
    valueRange: { min: number; max: number }
  ): number {
    // How achievable is the new value
    const rangeSize = valueRange.max - valueRange.min;
    const distanceFromCurrent = Math.abs(newValue - currentValue);
    const positionInRange = (newValue - valueRange.min) / (rangeSize || 1);

    // Feasibility is higher if:
    // 1. Change is small relative to range
    // 2. New value is within realistic bounds (not at extremes)

    const changeFeasibility = 1 - Math.min(1, distanceFromCurrent / (rangeSize || 1));
    const boundFeasibility = 1 - Math.abs(0.5 - positionInRange);

    return changeFeasibility * 0.7 + boundFeasibility * 0.3;
  }

  /**
   * Categorize actionability
   */
  private categorizeActionability(
    effort: number,
    feasibility: number
  ): 'easy' | 'moderate' | 'hard' {
    const combinedScore = (1 - effort) * feasibility;

    if (combinedScore > 0.7) return 'easy';
    if (combinedScore > 0.4) return 'moderate';
    return 'hard';
  }

  /**
   * Format value for display
   */
  private formatValue(feature: string, value: number): string {
    // Check if it's a percentage-based feature
    const percentageFeatures = [
      'rate',
      'ratio',
      'score',
      'percentage',
      'open_rate',
      'abandonment_rate',
    ];

    const isPercentage = percentageFeatures.some((p) => feature.includes(p));

    if (isPercentage || (value >= 0 && value <= 1)) {
      return `${(value * 100).toFixed(1)}%`;
    }

    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    } else if (Math.abs(value) >= 1) {
      return value.toFixed(2);
    } else {
      return value.toFixed(4);
    }
  }
}

// ============================================
// HELPER TYPES
// ============================================

interface CounterfactualCandidate {
  feature: string;
  currentValue: number;
  newValue: number;
  impact: number;
  effort: number;
  feasibility: number;
}

interface ScoredCounterfactual extends CounterfactualCandidate {
  newPrediction: number;
  score: number;
  actionability: 'easy' | 'moderate' | 'hard';
  changes: {
    feature: string;
    from: number;
    to: number;
    difference: number;
    percentageChange: number;
  };
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a counterfactual engine instance
 */
export function createCounterfactualEngine(): CounterfactualEngine {
  return new CounterfactualEngine();
}

/**
 * Quick counterfactual generation
 */
export async function generateQuickCounterfactuals(
  features: Record<string, number>,
  modelType: string,
  prediction: number,
  targetPrediction?: number
): Promise<CounterfactualResult> {
  const engine = new CounterfactualEngine();

  return engine.generateCounterfactuals({
    predictionId: uuidv4(),
    modelType: modelType as ModelType,
    features,
    prediction,
    targetPrediction,
  });
}

export default CounterfactualEngine;

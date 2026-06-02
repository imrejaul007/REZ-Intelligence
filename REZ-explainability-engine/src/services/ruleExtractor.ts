/**
 * REZ Explainability Engine - Rule Extractor Service
 *
 * Extracts interpretable decision rules from ML model predictions
 * using various algorithms (Decision Tree, Association Rules, Sequential Covering)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DecisionRule,
  RuleExtractionRequest,
  RuleExtractionDataPoint,
  RuleExtractionOptions,
  RuleExtractionResult,
  ModelCoefficients,
  MODEL_COEFFICIENTS,
  DEFAULT_FEATURE_DESCRIPTIONS,
  ModelType,
} from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_OPTIONS: RuleExtractionOptions = {
  minSupport: 0.05,
  minConfidence: 0.7,
  maxDepth: 5,
  algorithm: 'decision_tree',
  featureNames: {},
};

const RULE_CACHE_TTL = 3600000; // 1 hour

// ============================================
// RULE EXTRACTOR CLASS
// ============================================

export class RuleExtractor {
  private options: RuleExtractionOptions;
  private ruleCache: Map<string, DecisionRule[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(options: Partial<RuleExtractionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract decision rules from a dataset
   */
  async extractRules(request: RuleExtractionRequest): Promise<RuleExtractionResult> {
    const startTime = Date.now();
    const { modelType, dataset, options = {} } = request;
    const extractionOptions = { ...this.options, ...options };

    // Check cache
    const cacheKey = this.generateCacheKey(modelType, dataset);
    const cachedRules = this.getCachedRules(cacheKey);
    if (cachedRules) {
      return {
        rules: cachedRules,
        modelInfo: this.computeModelInfo(dataset, cachedRules),
        generatedAt: new Date(),
        processingTimeMs: 0,
      };
    }

    let rules: DecisionRule[];

    switch (extractionOptions.algorithm) {
      case 'decision_tree':
        rules = this.extractDecisionTreeRules(dataset, modelType, extractionOptions);
        break;
      case 'association_rules':
        rules = this.extractAssociationRules(dataset, modelType, extractionOptions);
        break;
      case 'sequential_covering':
        rules = this.extractSequentialCoveringRules(dataset, modelType, extractionOptions);
        break;
      default:
        rules = this.extractDecisionTreeRules(dataset, modelType, extractionOptions);
    }

    // Filter by minimum support and confidence
    rules = rules.filter(
      (rule) =>
        rule.support >= extractionOptions.minSupport &&
        rule.confidence >= extractionOptions.minConfidence
    );

    // Sort by confidence descending
    rules.sort((a, b) => b.confidence - a.confidence);

    // Limit number of rules
    rules = rules.slice(0, 100);

    // Add ranks
    rules = rules.map((rule, index) => ({ ...rule, rank: index + 1 } as DecisionRule));

    // Cache the results
    this.cacheRules(cacheKey, rules);

    const processingTime = Date.now() - startTime;

    return {
      rules,
      modelInfo: this.computeModelInfo(dataset, rules),
      generatedAt: new Date(),
      processingTimeMs: processingTime,
    };
  }

  /**
   * Extract rules using Decision Tree algorithm
   */
  private extractDecisionTreeRules(
    dataset: RuleExtractionDataPoint[],
    modelType: string,
    options: RuleExtractionOptions
  ): DecisionRule[] {
    const rules: DecisionRule[] = [];
    const features = this.getAllFeatures(dataset);

    // Build a simple decision tree recursively
    const tree = this.buildDecisionTree(dataset, features, options.maxDepth, 0);

    // Extract rules from tree
    this.extractRulesFromTree(tree, [], rules, modelType);

    return rules;
  }

  /**
   * Build a simple decision tree
   */
  private buildDecisionTree(
    data: RuleExtractionDataPoint[],
    features: string[],
    maxDepth: number,
    currentDepth: number
  ): DecisionTreeNode {
    // Base cases
    if (data.length === 0) {
      return { type: 'leaf', prediction: 0, count: 0 };
    }

    // Check if all predictions are the same
    const predictions = data.map((d) => d.prediction);
    const allSame = predictions.every((p) => p === predictions[0]);
    if (allSame) {
      return {
        type: 'leaf',
        prediction: predictions[0],
        count: data.length,
      };
    }

    // Check if max depth reached
    if (currentDepth >= maxDepth || features.length === 0) {
      const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
      return {
        type: 'leaf',
        prediction: avgPrediction,
        count: data.length,
      };
    }

    // Find best split
    let bestFeature = features[0];
    let bestThreshold = this.calculateMean(data, features[0]);
    let bestScore = 0;

    for (const feature of features.slice(0, 10)) {
      const threshold = this.calculateMean(data, feature);
      const score = this.calculateSplitScore(data, feature, threshold);

      if (score > bestScore) {
        bestScore = score;
        bestFeature = feature;
        bestThreshold = threshold;
      }
    }

    // Split data
    const leftData = data.filter((d) => (d.features[bestFeature] || 0) <= bestThreshold);
    const rightData = data.filter((d) => (d.features[bestFeature] || 0) > bestThreshold);

    // Create node with required prediction field
    const node: DecisionTreeNode = {
      type: 'split',
      feature: bestFeature,
      threshold: bestThreshold,
      count: data.length,
      prediction: 0, // Required field
      left: this.buildDecisionTree(leftData, features.filter((f) => f !== bestFeature), maxDepth, currentDepth + 1),
      right: this.buildDecisionTree(rightData, features.filter((f) => f !== bestFeature), maxDepth, currentDepth + 1),
    };
    return node;
  }

  /**
   * Extract rules from decision tree
   */
  private extractRulesFromTree(
    node: DecisionTreeNode,
    path: { feature: string; operator: '<=' | '>'; value: number }[],
    rules: DecisionRule[],
    modelType: string
  ): void {
    if (node.type === 'leaf') {
      // Generate rule from path
      const rule = this.createRuleFromPath(path, node.prediction, modelType);
      rules.push(rule);
      return;
    }

    // Left branch (<=)
    if (node.left) {
      this.extractRulesFromTree(
        node.left,
        [...path, { feature: node.feature!, operator: '<=', value: node.threshold! }],
        rules,
        modelType
      );
    }

    // Right branch (>)
    if (node.right) {
      this.extractRulesFromTree(
        node.right,
        [...path, { feature: node.feature!, operator: '>', value: node.threshold! }],
        rules,
        modelType
      );
    }
  }

  /**
   * Extract rules using Association Rules algorithm
   */
  private extractAssociationRules(
    dataset: RuleExtractionDataPoint[],
    modelType: string,
    options: RuleExtractionOptions
  ): DecisionRule[] {
    const rules: DecisionRule[] = [];
    const features = this.getAllFeatures(dataset);

    // Convert predictions to categories
    const categorizedData = this.categorizePredictions(dataset);

    // Generate frequent itemsets
    const frequentItemsets = this.generateFrequentItemsets(categorizedData, options.minSupport);

    // Generate rules from itemsets
    for (const itemset of frequentItemsets) {
      if (itemset.length < 2) continue;

      // Generate all possible rule combinations
      const consequentOptions = this.generateConsequents(itemset);

      for (const consequent of consequentOptions) {
        const antecedent = itemset.filter((item) => !consequent.includes(item));

        if (antecedent.length === 0) continue;

        // Calculate support and confidence
        const support = this.calculateSupport(dataset, [...antecedent, ...consequent]);
        const antecedentSupport = this.calculateSupport(dataset, antecedent);
        const confidence = antecedentSupport > 0 ? support / antecedentSupport : 0;

        if (confidence >= options.minConfidence) {
          const rule = this.createAssociationRule(
            antecedent,
            consequent,
            support,
            confidence,
            dataset,
            modelType
          );
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  /**
   * Extract rules using Sequential Covering algorithm
   */
  private extractSequentialCoveringRules(
    dataset: RuleExtractionDataPoint[],
    modelType: string,
    options: RuleExtractionOptions
  ): DecisionRule[] {
    const rules: DecisionRule[] = [];
    const remainingExamples = [...dataset];
    const positiveClass = this.determinePositiveClass(dataset);

    while (remainingExamples.length > options.minSupport * dataset.length) {
      // Find best rule for remaining examples
      const bestRule = this.findBestRule(remainingExamples, positiveClass, options);

      if (!bestRule || bestRule.confidence < options.minConfidence) {
        break;
      }

      rules.push(bestRule);

      // Remove covered examples
      const coveredIndices: number[] = [];
      for (let i = 0; i < remainingExamples.length; i++) {
        if (this.ruleCoversExample(bestRule, remainingExamples[i])) {
          coveredIndices.push(i);
        }
      }

      // Remove in reverse order
      for (let i = coveredIndices.length - 1; i >= 0; i--) {
        remainingExamples.splice(coveredIndices[i], 1);
      }

      if (rules.length >= 50) break; // Limit rules
    }

    return rules;
  }

  // ============================================
  // RULE CREATION HELPERS
  // ============================================

  /**
   * Create a rule from a path in decision tree
   */
  private createRuleFromPath(
    path: { feature: string; operator: string; value: number }[],
    prediction: number,
    modelType: string
  ): DecisionRule {
    const antecedent = path
      .map((p) => `${p.feature} ${p.operator} ${this.formatValue(p.value)}`)
      .join(' AND ');

    const consequent = this.getPredictionLabel(modelType, prediction);
    const rule = `IF ${antecedent} THEN ${modelType} = ${consequent}`;

    return {
      id: uuidv4(),
      rule,
      antecedent,
      consequent,
      confidence: 0.9, // Placeholder - would need full data to calculate
      support: 0.1, // Placeholder
      lift: 1.0, // Placeholder
      coverage: 0.1, // Placeholder
      modelType: modelType as ModelType,
      generatedAt: new Date(),
      examples: {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
      },
    };
  }

  /**
   * Create an association rule
   */
  private createAssociationRule(
    antecedent: string[],
    consequent: string[],
    support: number,
    confidence: number,
    dataset: RuleExtractionDataPoint[],
    modelType: string
  ): DecisionRule {
    const antecedentStr = antecedent.join(' AND ');
    const consequentStr = consequent.join(' THEN ');

    // Calculate lift
    const consequentSupport = this.calculateSupport(dataset, consequent);
    const lift = consequentSupport > 0 ? confidence / consequentSupport : 0;

    return {
      id: uuidv4(),
      rule: `IF ${antecedentStr} THEN ${modelType}:${consequentStr}`,
      antecedent: antecedentStr,
      consequent: consequentStr,
      confidence,
      support,
      lift,
      coverage: support, // Simplified
      modelType: modelType as ModelType,
      generatedAt: new Date(),
      examples: {
        truePositives: Math.round(support * dataset.length),
        falsePositives: Math.round((confidence - support) * dataset.length),
        trueNegatives: 0,
        falseNegatives: 0,
      },
    };
  }

  /**
   * Find best rule using sequential covering
   */
  private findBestRule(
    examples: RuleExtractionDataPoint[],
    positiveClass: number,
    options: RuleExtractionOptions
  ): DecisionRule | null {
    let bestRule: DecisionRule | null = null;
    let bestScore = 0;

    const features = this.getAllFeatures(examples);

    // Greedy rule construction
    const currentAntecedent: string[] = [];
    let coveredPositive = examples.filter((e) => e.prediction === positiveClass);

    for (let depth = 0; depth < options.maxDepth; depth++) {
      let bestFeature: string | null = null;
      let bestThreshold: number | null = null;
      let bestCoverage = 0;

      // Find best literal to add
      for (const feature of features.slice(0, 20)) {
        const threshold = this.calculateMean(examples, feature);

        const covered = coveredPositive.filter(
          (e) => (e.features[feature] || 0) <= threshold
        );

        if (covered.length > bestCoverage) {
          bestCoverage = covered.length;
          bestFeature = feature;
          bestThreshold = threshold;
        }
      }

      if (!bestFeature || bestCoverage === 0) break;

      currentAntecedent.push(`${bestFeature} <= ${this.formatValue(bestThreshold!)}`);
      coveredPositive = coveredPositive.filter(
        (e) => (e.features[bestFeature!] || 0) <= bestThreshold!
      );
    }

    if (currentAntecedent.length === 0) return null;

    const antecedent = currentAntecedent.join(' AND ');
    const consequent = `outcome = ${positiveClass}`;

    const coveredAll = examples.filter((e) =>
      currentAntecedent.every((cond) => {
        const [feature, op, val] = cond.split(' ');
        const value = parseFloat(val);
        const featureValue = e.features[feature] || 0;
        return op === '<=' ? featureValue <= value : featureValue > value;
      })
    );

    const coveredPositiveCount = coveredAll.filter((e) => e.prediction === positiveClass).length;
    const coveredNegativeCount = coveredAll.length - coveredPositiveCount;
    const totalPositive = examples.filter((e) => e.prediction === positiveClass).length;

    const confidence = coveredAll.length > 0 ? coveredPositiveCount / coveredAll.length : 0;
    const support = coveredAll.length / examples.length;

    return {
      id: uuidv4(),
      rule: `IF ${antecedent} THEN ${consequent}`,
      antecedent,
      consequent,
      confidence,
      support,
      lift: 1.0, // Simplified
      coverage: support,
      modelType: options.algorithm as ModelType,
      generatedAt: new Date(),
      examples: {
        truePositives: coveredPositiveCount,
        falsePositives: coveredNegativeCount,
        trueNegatives: examples.length - totalPositive - coveredNegativeCount,
        falseNegatives: totalPositive - coveredPositiveCount,
      },
    };
  }

  /**
   * Check if rule covers an example
   */
  private ruleCoversExample(rule: DecisionRule, example: RuleExtractionDataPoint): boolean {
    const conditions = rule.antecedent.split(' AND ');

    return conditions.every((condition) => {
      const match = condition.match(/(\w+)\s*(<=|>=|<|>)\s*([\d.]+)/);
      if (!match) return false;

      const [, feature, operator, valueStr] = match;
      const value = parseFloat(valueStr);
      const featureValue = example.features[feature] || 0;

      switch (operator) {
        case '<=':
          return featureValue <= value;
        case '>=':
          return featureValue >= value;
        case '<':
          return featureValue < value;
        case '>':
          return featureValue > value;
        default:
          return false;
      }
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get all unique features from dataset
   */
  private getAllFeatures(dataset: RuleExtractionDataPoint[]): string[] {
    const featureSet = new Set<string>();

    for (const point of dataset) {
      for (const feature of Object.keys(point.features)) {
        featureSet.add(feature);
      }
    }

    return Array.from(featureSet);
  }

  /**
   * Calculate mean of a feature
   */
  private calculateMean(data: RuleExtractionDataPoint[], feature: string): number {
    const values = data.map((d) => d.features[feature]).filter((v) => v !== undefined);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate split score (information gain)
   */
  private calculateSplitScore(
    data: RuleExtractionDataPoint[],
    feature: string,
    threshold: number
  ): number {
    const left = data.filter((d) => (d.features[feature] || 0) <= threshold);
    const right = data.filter((d) => (d.features[feature] || 0) > threshold);

    if (left.length === 0 || right.length === 0) return 0;

    const parentEntropy = this.calculateEntropy(data);
    const leftEntropy = this.calculateEntropy(left);
    const rightEntropy = this.calculateEntropy(right);

    const weightedChildEntropy =
      (left.length / data.length) * leftEntropy + (right.length / data.length) * rightEntropy;

    return parentEntropy - weightedChildEntropy;
  }

  /**
   * Calculate entropy
   */
  private calculateEntropy(data: RuleExtractionDataPoint[]): number {
    if (data.length === 0) return 0;

    const predictions = data.map((d) => d.prediction);
    const counts = new Map<number, number>();

    for (const pred of predictions) {
      counts.set(pred, (counts.get(pred) || 0) + 1);
    }

    let entropy = 0;
    for (const count of counts.values()) {
      const p = count / data.length;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  /**
   * Categorize predictions into bins
   */
  private categorizePredictions(dataset: RuleExtractionDataPoint[]): RuleExtractionDataPoint[] {
    const predictions = dataset.map((d) => d.prediction);
    const min = Math.min(...predictions);
    const max = Math.max(...predictions);
    const binSize = (max - min) / 5;

    return dataset.map((d) => ({
      ...d,
      prediction: Math.floor((d.prediction - min) / binSize) * binSize + min,
    }));
  }

  /**
   * Generate frequent itemsets
   */
  private generateFrequentItemsets(
    data: RuleExtractionDataPoint[],
    minSupport: number
  ): string[][] {
    const itemsets: string[][] = [];
    const featureCounts = new Map<string, number>();

    // Count individual features
    for (const point of data) {
      for (const feature of Object.keys(point.features)) {
        const value = point.features[feature];
        const valueBin = Math.floor(value / 10); // Bin numeric values
        const item = `${feature}=${valueBin}`;
        featureCounts.set(item, (featureCounts.get(item) || 0) + 1);
      }
    }

    // Filter by support
    const frequentItems = Array.from(featureCounts.entries())
      .filter(([, count]) => count / data.length >= minSupport)
      .map(([item]) => [item]);

    itemsets.push(...frequentItems);

    // Generate pairs
    for (let i = 0; i < frequentItems.length; i++) {
      for (let j = i + 1; j < frequentItems.length; j++) {
        itemsets.push([frequentItems[i][0], frequentItems[j][0]]);
      }
    }

    return itemsets;
  }

  /**
   * Generate consequent options from itemset
   */
  private generateConsequents(itemset: string[]): string[][] {
    const consequents: string[][] = [];

    for (let i = 1; i < itemset.length; i++) {
      consequents.push([itemset[itemset.length - 1]]);
    }

    return consequents;
  }

  /**
   * Calculate support for items
   */
  private calculateSupport(data: RuleExtractionDataPoint[], items: string[]): number {
    let count = 0;

    for (const point of data) {
      const matches = items.every((item) => {
        const [feature, valueStr] = item.split('=');
        const value = parseFloat(valueStr);
        const featureValue = point.features[feature] || 0;
        return Math.floor(featureValue / 10) === Math.floor(value / 10);
      });

      if (matches) count++;
    }

    return count / data.length;
  }

  /**
   * Determine positive class
   */
  private determinePositiveClass(dataset: RuleExtractionDataPoint[]): number {
    const predictions = dataset.map((d) => d.prediction);
    const avg = predictions.reduce((a, b) => a + b, 0) / predictions.length;

    // Use median as threshold
    const sorted = [...predictions].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * Get prediction label
   */
  private getPredictionLabel(modelType: string, prediction: number): string {
    switch (modelType) {
      case 'churn_predictor':
        return prediction > 0.7 ? 'HIGH_RISK' : prediction > 0.4 ? 'MEDIUM_RISK' : 'LOW_RISK';
      case 'ltv_predictor':
        return prediction > 50000 ? 'HIGH_VALUE' : prediction > 10000 ? 'MEDIUM_VALUE' : 'STANDARD_VALUE';
      case 'fraud_detector':
        return prediction > 0.5 ? 'FRAUD' : 'CLEAR';
      default:
        return `CLASS_${prediction.toFixed(2)}`;
    }
  }

  /**
   * Format value for display
   */
  private formatValue(value: number): string {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  }

  /**
   * Compute model information
   */
  private computeModelInfo(
    dataset: RuleExtractionDataPoint[],
    rules: DecisionRule[]
  ): RuleExtractionResult['modelInfo'] {
    const features = this.getAllFeatures(dataset);
    const totalCoverage = rules.reduce((sum, r) => sum + r.coverage, 0);
    const avgConfidence = rules.length > 0
      ? rules.reduce((sum, r) => sum + r.confidence, 0) / rules.length
      : 0;

    return {
      totalDataPoints: dataset.length,
      featuresUsed: features,
      coverage: Math.min(1, totalCoverage),
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    modelType: string,
    dataset: RuleExtractionDataPoint[]
  ): string {
    const hash = dataset
      .slice(0, 10)
      .map((d) => JSON.stringify(d.features))
      .join('|')
      .substring(0, 100);
    return `${modelType}:${hash}`;
  }

  /**
   * Get cached rules
   */
  private getCachedRules(cacheKey: string): DecisionRule[] | null {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return null;

    if (Date.now() - timestamp > RULE_CACHE_TTL) {
      this.ruleCache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      return null;
    }

    return this.ruleCache.get(cacheKey) || null;
  }

  /**
   * Cache rules
   */
  private cacheRules(cacheKey: string, rules: DecisionRule[]): void {
    this.ruleCache.set(cacheKey, rules);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }
}

// ============================================
// HELPER TYPES
// ============================================

interface DecisionTreeNode {
  type: 'leaf' | 'split';
  prediction: number;
  count: number;
  feature?: string;
  threshold?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a rule extractor with default options
 */
export function createRuleExtractor(
  options?: Partial<RuleExtractionOptions>
): RuleExtractor {
  return new RuleExtractor(options);
}

/**
 * Quick rule extraction
 */
export async function quickRuleExtraction(
  dataset: RuleExtractionDataPoint[],
  modelType: string,
  algorithm: 'decision_tree' | 'association_rules' | 'sequential_covering' = 'decision_tree'
): Promise<RuleExtractionResult> {
  const extractor = new RuleExtractor({ algorithm });

  return extractor.extractRules({
    modelType: modelType as ModelType,
    dataset,
    options: {
      algorithm,
      minSupport: 0.05,
      minConfidence: 0.7,
      maxDepth: 5,
    },
  });
}

export default RuleExtractor;

/**
 * REZ Explainability Engine - Narrative Generator Service
 *
 * Generates human-readable explanations and narratives from ML predictions
 * with support for multiple audiences and tones
 */

import { v4 as uuidv4 } from 'uuid';
import {
  NarrativeExplanation,
  NarrativeSection,
  NarrativeGenerationRequest,
  NarrativeGenerationResult,
  ExplanationFactor,
  Counterfactual,
  ModelType,
  DEFAULT_FEATURE_DESCRIPTIONS,
} from '../types/index.js';

// ============================================
// CONSTANTS
// ============================================

type AudienceKey = 'technical' | 'business' | 'end_user';
type ToneKey = 'formal' | 'friendly' | 'urgent';

interface Vocabulary {
  high: string;
  medium: string;
  low: string;
  increase: string;
  decrease: string;
  factor: string;
  impact: string;
}

interface ToneConfig {
  prefix: string;
  suffix: string;
  separator: string;
  emphasis: string;
}

const AUDIENCE_VOCABULARY: Record<AudienceKey, Vocabulary> = {
  technical: {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    increase: 'increase',
    decrease: 'decrease',
    factor: 'feature',
    impact: 'impact',
  },
  business: {
    high: 'significant',
    medium: 'moderate',
    low: 'minimal',
    increase: 'growth',
    decrease: 'decline',
    factor: 'driver',
    impact: 'effect',
  },
  end_user: {
    high: 'very likely',
    medium: 'somewhat likely',
    low: 'unlikely',
    increase: 'more',
    decrease: 'less',
    factor: 'factor',
    impact: 'reason',
  },
};

const TONE_MODIFIERS: Record<ToneKey, ToneConfig> = {
  formal: {
    prefix: '',
    suffix: '.',
    separator: '; ',
    emphasis: 'notably',
  },
  friendly: {
    prefix: 'Hey there! ',
    suffix: '!',
    separator: '. Also, ',
    emphasis: 'especially',
  },
  urgent: {
    prefix: 'ACTION REQUIRED: ',
    suffix: '.',
    separator: ' - ',
    emphasis: 'CRITICAL',
  },
};

// ============================================
// NARRATIVE GENERATOR CLASS
// ============================================

export class NarrativeGenerator {
  private vocabulary: Vocabulary;
  private tone: ToneKey;

  constructor(audience: AudienceKey = 'business', tone: ToneKey = 'formal') {
    this.vocabulary = AUDIENCE_VOCABULARY[audience];
    this.tone = tone;
  }

  /**
   * Generate a complete narrative explanation
   */
  async generateNarrative(request: NarrativeGenerationRequest): Promise<NarrativeGenerationResult> {
    const {
      predictionId,
      modelType,
      features,
      prediction,
      factors,
      counterfactuals = [],
      context,
      audience = 'business',
      tone = 'formal',
    } = request;

    // Update vocabulary and tone based on request
    this.vocabulary = AUDIENCE_VOCABULARY[audience];
    this.tone = tone;

    // Generate sections
    const sections = this.generateSections(modelType, prediction, factors, counterfactuals, context);

    // Generate summary
    const summary = this.generateSummary(modelType, prediction, factors);

    // Generate key insight
    const keyInsight = this.generateKeyInsight(modelType, prediction, factors);

    // Generate actionable recommendation
    const actionableRecommendation = this.generateRecommendation(
      modelType,
      prediction,
      factors,
      counterfactuals
    );

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(factors);

    const narrative: NarrativeExplanation = {
      id: uuidv4(),
      predictionId,
      summary,
      sections,
      keyInsight,
      actionableRecommendation,
      confidenceLevel,
      generatedAt: new Date(),
    };

    // Generate alternative formats
    const alternativeFormats = this.generateAlternativeFormats(
      narrative,
      modelType,
      prediction,
      factors
    );

    return {
      narrative,
      alternativeFormats,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate narrative sections
   */
  private generateSections(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[],
    counterfactuals: Counterfactual[],
    context?: NarrativeGenerationRequest['context']
  ): NarrativeSection[] {
    const sections: NarrativeSection[] = [];

    // Background section
    sections.push(this.generateBackgroundSection(modelType, context));

    // Analysis section
    sections.push(this.generateAnalysisSection(modelType, prediction, factors));

    // Comparison section (if counterfactuals available)
    if (counterfactuals.length > 0) {
      sections.push(this.generateComparisonSection(factors, counterfactuals));
    }

    // Recommendation section
    sections.push(this.generateRecommendationSection(modelType, prediction, factors, counterfactuals));

    return sections;
  }

  /**
   * Generate background section
   */
  private generateBackgroundSection(
    modelType: ModelType,
    context?: NarrativeGenerationRequest['context']
  ): NarrativeSection {
    const modelDescriptions: Record<ModelType, string> = {
      churn_predictor: 'Customer Churn Risk Assessment',
      ltv_predictor: 'Customer Lifetime Value Prediction',
      revisit_predictor: 'Customer Return Likelihood Analysis',
      conversion_predictor: 'Purchase Conversion Prediction',
      recommendation_engine: 'Product Recommendation Engine',
      price_predictor: 'Dynamic Price Optimization',
      demand_forecast: 'Demand Forecasting Analysis',
      fraud_detector: 'Fraud Risk Assessment',
      segmentation: 'Customer Segmentation Analysis',
      propensity_scorer: 'Purchase Propensity Scoring',
    };

    const modelDescription = modelDescriptions[modelType] || 'AI Prediction Model';

    let content = `This analysis is generated by our ${modelDescription} system. `;

    if (context?.userId) {
      content += `The prediction pertains to user ${context.userId}. `;
    }

    if (context?.merchantId) {
      content += `The analysis is for merchant ${context.merchantId}. `;
    }

    content += 'The model evaluates multiple factors to generate its prediction.';

    return {
      title: 'About This Prediction',
      content,
      type: 'background',
    };
  }

  /**
   * Generate analysis section
   */
  private generateAnalysisSection(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): NarrativeSection {
    const topFactors = factors.slice(0, 5);
    const dataPoints = topFactors.map((factor) => ({
      label: this.getFeatureLabel(factor.name),
      value: this.formatFactorValue(factor),
      trend: factor.direction === 'positive' ? 'up' as const : factor.direction === 'negative' ? 'down' as const : 'stable' as const,
    }));

    let content = `The model predicts a ${this.vocabulary.high} probability of `;

    switch (modelType) {
      case 'churn_predictor':
        content += `churn at ${(prediction * 100).toFixed(1)}%. `;
        break;
      case 'ltv_predictor':
        content += `high customer value at ₹${prediction.toFixed(0)}. `;
        break;
      case 'revisit_predictor':
        content += `customer return at ${(prediction * 100).toFixed(1)}%. `;
        break;
      case 'fraud_detector':
        content += `fraudulent activity at ${(prediction * 100).toFixed(1)}%. `;
        break;
      default:
        content += `the outcome at ${(prediction * 100).toFixed(1)}%. `;
    }

    content += `${TONE_MODIFIERS[this.tone].emphasis} important ${this.vocabulary.factor}s driving this prediction include: `;

    content += topFactors
      .map((factor) => {
        const direction = factor.direction === 'positive' ? this.vocabulary.increase : this.vocabulary.decrease;
        return `${factor.name} (${direction}: ${Math.abs(factor.impact).toFixed(1)}%)`;
      })
      .join(TONE_MODIFIERS[this.tone].separator);

    return {
      title: 'Key Findings',
      content,
      type: 'analysis',
      dataPoints,
    };
  }

  /**
   * Generate comparison section
   */
  private generateComparisonSection(
    factors: ExplanationFactor[],
    counterfactuals: Counterfactual[]
  ): NarrativeSection {
    if (counterfactuals.length === 0) {
      return {
        title: 'What Could Change This',
        content: 'No actionable changes identified for this prediction.',
        type: 'comparison',
      };
    }

    const topCounterfactuals = counterfactuals.slice(0, 3);
    const content = topCounterfactuals
      .map((cf) => {
        const actionability = cf.actionability === 'easy' ? 'easily' : cf.actionability === 'moderate' ? 'with some effort' : 'with significant effort';
        return `${cf.description} This could be achieved ${actionability}.`;
      })
      .join(TONE_MODIFIERS[this.tone].separator);

    return {
      title: 'What If Scenarios',
      content,
      type: 'comparison',
      dataPoints: topCounterfactuals.map((cf) => ({
        label: cf.condition,
        value: `${cf.currentValue.toFixed(2)} → ${cf.alternativeValue.toFixed(2)}`,
        trend: cf.impactOnPrediction > 0 ? 'up' as const : 'down' as const,
      })),
    };
  }

  /**
   * Generate recommendation section
   */
  private generateRecommendationSection(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[],
    counterfactuals: Counterfactual[]
  ): NarrativeSection {
    const topCounterfactual = counterfactuals[0];

    let content = 'Based on this analysis, we recommend: ';

    switch (modelType) {
      case 'churn_predictor':
        if (prediction > 0.7) {
          content += 'Immediately implement retention strategies. ';
        } else if (prediction > 0.4) {
          content += 'Consider proactive engagement campaigns. ';
        } else {
          content += 'Continue current engagement practices. ';
        }
        break;
      case 'fraud_detector':
        if (prediction > 0.7) {
          content += 'Flag for manual review or hold the transaction. ';
        } else {
          content += 'No immediate action required. ';
        }
        break;
      default:
        content += 'Monitor and track this prediction over time. ';
    }

    if (topCounterfactual) {
      content += `The most impactful action would be to ${topCounterfactual.effort.toLowerCase()}.`;
    }

    return {
      title: 'Recommendations',
      content,
      type: 'recommendation',
    };
  }

  /**
   * Generate summary
   */
  private generateSummary(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): string {
    const topFactor = factors[0];
    const topFactorLabel = this.getFeatureLabel(topFactor?.name || 'unknown');

    let summary = `${TONE_MODIFIERS[this.tone].prefix}This ${modelType.replace(/_/g, ' ')} prediction is `;

    if (prediction > 0.7) {
      summary += `${this.vocabulary.high}. `;
    } else if (prediction > 0.4) {
      summary += `${this.vocabulary.medium}. `;
    } else {
      summary += `${this.vocabulary.low}. `;
    }

    if (topFactor) {
      summary += `The primary ${this.vocabulary.impact} comes from ${topFactorLabel} `;
      summary += `(${topFactor.direction === 'positive' ? 'positive' : 'negative'} ${topFactor.impact.toFixed(1)}% contribution).`;
    }

    return summary + TONE_MODIFIERS[this.tone].suffix;
  }

  /**
   * Generate key insight
   */
  private generateKeyInsight(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): string {
    const topFactor = factors[0];
    const secondFactor = factors[1];

    if (!topFactor) {
      return 'Insufficient data available to generate key insights.';
    }

    const topLabel = this.getFeatureLabel(topFactor.name);
    const topDirection = topFactor.direction === 'positive' ? 'positively' : 'negatively';

    let insight = `The most significant factor influencing this prediction is ${topLabel}, which ${topDirection} affects the outcome by ${topFactor.impact.toFixed(1)}%. `;

    if (secondFactor) {
      const secondLabel = this.getFeatureLabel(secondFactor.name);
      insight += `Secondary factors include ${secondLabel} (${secondFactor.impact.toFixed(1)}%). `;
    }

    // Model-specific insights
    switch (modelType) {
      case 'churn_predictor':
        if (topFactor.name === 'inactivity_days') {
          insight += 'Customer inactivity is the primary churn driver - consider re-engagement campaigns.';
        } else if (topFactor.name === 'engagement_score') {
          insight += 'Engagement levels are critical - focus on increasing user interaction.';
        }
        break;
      case 'fraud_detector':
        if (prediction > 0.5) {
          insight += 'Multiple fraud indicators present - manual review recommended.';
        }
        break;
    }

    return insight;
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[],
    counterfactuals: Counterfactual[]
  ): string {
    const topCounterfactual = counterfactuals[0];

    let recommendation = 'Recommended actions: ';

    switch (modelType) {
      case 'churn_predictor':
        if (prediction > 0.7) {
          recommendation += '1) Send personalized re-engagement offer, 2) Assign to customer success team, 3) Review recent interactions for issues.';
        } else if (prediction > 0.4) {
          recommendation += '1) Implement loyalty rewards, 2) Increase engagement touchpoints, 3) Monitor for behavioral changes.';
        } else {
          recommendation += '1) Maintain current service levels, 2) Continue regular engagement.';
        }
        break;
      case 'ltv_predictor':
        recommendation += '1) Focus retention efforts on high-value segments, 2) Upsell premium offerings, 3) Enhance customer experience.';
        break;
      case 'fraud_detector':
        if (prediction > 0.7) {
          recommendation += '1) Hold transaction pending review, 2) Verify customer identity, 3) Contact customer via secure channel.';
        } else {
          recommendation += '1) Process transaction normally, 2) Continue monitoring patterns.';
        }
        break;
      default:
        recommendation += '1) Monitor prediction over time, 2) Review contributing factors.';
    }

    if (topCounterfactual && topCounterfactual.actionability === 'easy') {
      recommendation += ` 4) Consider adjusting ${topCounterfactual.condition} - this is the most actionable change.`;
    }

    return recommendation;
  }

  /**
   * Determine confidence level
   */
  private determineConfidenceLevel(factors: ExplanationFactor[]): 'high' | 'medium' | 'low' {
    if (factors.length === 0) return 'low';

    // Calculate weighted importance
    const totalImportance = factors.reduce((sum, f) => sum + f.importance, 0);
    const topFactorImportance = factors[0]?.importance || 0;

    // High confidence if top factor is not too dominant (diversified) or has high importance
    if (factors.length >= 3 && topFactorImportance < 0.5 && totalImportance > 0.8) {
      return 'high';
    } else if (factors.length >= 2 && topFactorImportance < 0.7) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate alternative formats (email, SMS, push)
   */
  private generateAlternativeFormats(
    narrative: NarrativeExplanation,
    modelType: ModelType,
    prediction: number,
    factors: ExplanationFactor[]
  ): { email: string; sms: string; push: string } {
    const topFactor = factors[0];
    const topLabel = topFactor ? this.getFeatureLabel(topFactor.name) : 'multiple factors';

    return {
      // Email format - detailed
      email: `
Dear Customer,

${narrative.summary}

KEY INSIGHTS:
${narrative.keyInsight}

RECOMMENDED ACTIONS:
${narrative.actionableRecommendation}

For detailed analysis, please visit your dashboard.

Best regards,
REZ Intelligence Team
      `.trim(),

      // SMS format - concise
      sms: `${modelType.replace(/_/g, ' ').toUpperCase()}: ${(prediction * 100).toFixed(0)}% ${this.vocabulary.high}. Top ${this.vocabulary.factor}: ${topLabel}. Action: ${narrative.actionableRecommendation.split('1)')[1]?.split(',')[0]?.trim() || 'See dashboard'}`,

      // Push format - ultra-short
      push: `${modelType.replace(/_/g, ' ').toUpperCase()} update: ${topLabel} is driving ${(prediction * 100).toFixed(0)}% ${this.vocabulary.high} prediction. Tap to learn more.`,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get human-readable feature label
   */
  private getFeatureLabel(featureName: string): string {
    return DEFAULT_FEATURE_DESCRIPTIONS[featureName] ||
      featureName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Format factor value for display
   */
  private formatFactorValue(factor: ExplanationFactor): string {
    const absValue = Math.abs(factor.value);

    // Check if percentage-based
    if (absValue <= 1) {
      return `${(factor.value * 100).toFixed(1)}%`;
    }

    // Currency for order values
    if (factor.name.includes('order_value') || factor.name.includes('price')) {
      return `₹${factor.value.toFixed(0)}`;
    }

    // Count values
    if (factor.name.includes('count') || factor.name.includes('frequency') || factor.name.includes('days')) {
      return factor.value.toFixed(0);
    }

    // Default
    return factor.value.toFixed(2);
  }
}

// ============================================
// SPECIALIZED NARRATIVE GENERATORS
// ============================================

/**
 * Get human-readable feature label
 */
function getFeatureLabel(featureName: string): string {
  return DEFAULT_FEATURE_DESCRIPTIONS[featureName] ||
    featureName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generate churn-focused narrative
 */
export function generateChurnNarrative(
  prediction: number,
  factors: ExplanationFactor[],
  counterfactuals: Counterfactual[]
): NarrativeExplanation {
  // Churn-specific messaging
  const riskLevel = prediction > 0.7 ? 'HIGH' : prediction > 0.4 ? 'MODERATE' : 'LOW';

  const sections: NarrativeSection[] = [
    {
      title: 'Churn Risk Assessment',
      content: `Customer shows ${riskLevel} churn risk (${(prediction * 100).toFixed(1)}% probability). ` +
        `Immediate attention ${prediction > 0.5 ? 'required' : 'recommended'} to prevent customer loss.`,
      type: 'background',
      dataPoints: [
        { label: 'Risk Level', value: riskLevel, trend: 'stable' },
        { label: 'Risk Score', value: (prediction * 100).toFixed(1) + '%', trend: prediction > 0.5 ? 'down' : 'up' },
      ],
    },
    {
      title: 'Primary Drivers',
      content: factors
        .slice(0, 3)
        .map((f, i) => `${i + 1}. ${getFeatureLabel(f.name)}: ${f.direction === 'negative' ? 'Contributing to churn' : 'Protective factor'} (${f.impact.toFixed(1)}%)`)
        .join('. '),
      type: 'analysis',
    },
  ];

  if (counterfactuals.length > 0) {
    sections.push({
      title: 'Retention Actions',
      content: counterfactuals
        .slice(0, 3)
        .map((cf) => `${cf.description} - ${cf.effort}`)
        .join('. '),
      type: 'recommendation',
    });
  }

  return {
    id: uuidv4(),
    predictionId: '',
    summary: `Customer churn risk is ${riskLevel} at ${(prediction * 100).toFixed(1)}%. Primary factor: ${factors[0]?.name || 'unknown'}.`,
    sections,
    keyInsight: factors[0]
      ? `Inactivity ${factors[0]?.value > 7 ? 'significantly exceeds' : 'is within'} normal thresholds. ${prediction > 0.5 ? 'Urgent retention action recommended.' : 'Monitor closely.'}`
      : 'Insufficient data for detailed analysis.',
    actionableRecommendation: prediction > 0.7
      ? '1) Send personalized win-back offer. 2) Trigger customer success outreach. 3) Review and resolve any recent complaints.'
      : prediction > 0.4
        ? '1) Increase engagement touchpoints. 2) Offer loyalty rewards. 3) Personalize communications.'
        : '1) Continue current engagement strategy. 2) Maintain service quality.',
    confidenceLevel: 'medium',
    generatedAt: new Date(),
  };
}

/**
 * Generate LTV-focused narrative
 */
export function generateLTVNarrative(
  prediction: number,
  factors: ExplanationFactor[],
  counterfactuals: Counterfactual[]
): NarrativeExplanation {
  const valueTier = prediction > 50000 ? 'PREMIUM' : prediction > 10000 ? 'HIGH' : 'STANDARD';

  return {
    id: uuidv4(),
    predictionId: '',
    summary: `Customer lifetime value estimated at ₹${prediction.toFixed(0)} (${valueTier} tier).`,
    sections: [
      {
        title: 'LTV Assessment',
        content: `Predicted customer lifetime value: ₹${prediction.toFixed(0)}. ` +
          `This ${valueTier} tier customer contributes significantly to revenue.`,
        type: 'background',
        dataPoints: [
          { label: 'LTV', value: `₹${prediction.toFixed(0)}`, trend: 'up' },
          { label: 'Tier', value: valueTier, trend: 'stable' },
        ],
      },
      {
        title: 'Value Drivers',
        content: factors
          .slice(0, 3)
          .map((f, i) => `${i + 1}. ${getFeatureLabel(f.name)}: ${f.impact.toFixed(1)}% contribution`)
          .join('. '),
        type: 'analysis',
      },
    ],
    keyInsight: factors[0]
      ? `${getFeatureLabel(factors[0].name)} is the primary value driver with ${factors[0].impact.toFixed(1)}% contribution.`
      : 'Strong overall customer profile.',
    actionableRecommendation: prediction > 10000
      ? '1) Prioritize retention of this customer. 2) Offer premium experiences. 3) Cross-sell complementary products.'
      : '1) Focus on increasing order frequency. 2) Encourage higher-value purchases.',
    confidenceLevel: 'high',
    generatedAt: new Date(),
  };
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a narrative generator
 */
export function createNarrativeGenerator(
  audience: 'technical' | 'business' | 'end_user' = 'business',
  tone: 'formal' | 'friendly' | 'urgent' = 'formal'
): NarrativeGenerator {
  return new NarrativeGenerator(audience, tone);
}

/**
 * Quick narrative generation
 */
export async function quickNarrative(
  request: Omit<NarrativeGenerationRequest, 'predictionId'>
): Promise<NarrativeGenerationResult> {
  const generator = new NarrativeGenerator(request.audience, request.tone);

  return generator.generateNarrative({
    ...request,
    predictionId: uuidv4(),
  });
}

export default NarrativeGenerator;
